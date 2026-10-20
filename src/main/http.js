import { AsyncLocalStorage } from 'node:async_hooks'
import diagnostics from 'node:diagnostics_channel'
import { createHash, randomBytes } from 'node:crypto'
import dns from 'node:dns'
import http from 'node:http'
import tls from 'node:tls'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { Agent, FormData, fetch } from 'undici'

/*
 * Request engine. Speed comes from:
 *  - one shared connection pool with long keep-alive, so repeat requests skip TCP/TLS setup
 *    (Node's built-in fetch drops idle connections after 4s);
 *  - a DNS cache, plus prefetching the host while the user is still editing the URL;
 *  - warming the fetch code path at startup.
 * Diagnostics channels give a per-request timing breakdown (DNS, connect, wait, download).
 */

// --- DNS cache -----------------------------------------------------------------

const DNS_TTL = 5 * 60_000
const dnsCache = new Map() // hostname -> { addresses, expires }
const lastLookupMs = new Map() // hostname -> ms the most recent lookup took (0 = cache hit)

function resolveHost(hostname) {
  const hit = dnsCache.get(hostname)
  if (hit && hit.expires > Date.now()) {
    lastLookupMs.set(hostname, 0)
    return Promise.resolve(hit.addresses)
  }
  const start = performance.now()
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return reject(err)
      lastLookupMs.set(hostname, performance.now() - start)
      dnsCache.set(hostname, { addresses, expires: Date.now() + DNS_TTL })
      resolve(addresses)
    })
  })
}

// Same contract as dns.lookup, used by net/tls.connect.
function cachedLookup(hostname, options, callback) {
  if (typeof options === 'function') [callback, options] = [options, {}]
  resolveHost(hostname).then((addresses) => {
    const list = options.family === 4 || options.family === 6 ? addresses.filter((a) => a.family === options.family) : addresses
    if (!list.length) {
      return callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND', hostname }))
    }
    if (options.all) callback(null, list)
    else callback(null, list[0].address, list[0].family)
  }, callback)
}

const agentOptions = (connect = {}) => ({
  keepAliveTimeout: 30_000, // used when the server doesn't say how long it keeps connections
  keepAliveMaxTimeout: 10 * 60_000,
  connect: { lookup: cachedLookup, timeout: 15_000, ...connect }
})
const agent = new Agent(agentOptions())
// For requests with "Verify SSL certificates" turned off. Its own pool, so connections
// opened without verification are never reused by normal requests.
let insecure = null
const insecureAgent = () => (insecure ??= new Agent(agentOptions({ rejectUnauthorized: false })))

// --- timing breakdown via undici diagnostics channels ------------------------------

const traceContext = new AsyncLocalStorage()
const traceByRequest = new WeakMap() // undici request -> trace
const connectStarts = new Map() // origin key -> [start times]
const socketInfo = new WeakMap() // socket -> { connectMs, dnsMs, fresh }

const now = () => performance.now()
const originKey = (p) => `${p.protocol}//${p.hostname}:${p.port}`

diagnostics.subscribe('undici:request:create', ({ request }) => {
  const trace = traceContext.getStore()
  if (trace) traceByRequest.set(request, trace)
})
diagnostics.subscribe('undici:client:beforeConnect', ({ connectParams }) => {
  const key = originKey(connectParams)
  if (!connectStarts.has(key)) connectStarts.set(key, [])
  connectStarts.get(key).push(now())
})
diagnostics.subscribe('undici:client:connected', ({ socket, connectParams }) => {
  const start = connectStarts.get(originKey(connectParams))?.shift()
  socketInfo.set(socket, {
    connectMs: start == null ? null : now() - start,
    dnsMs: lastLookupMs.get(connectParams.hostname) ?? null,
    fresh: true
  })
})
diagnostics.subscribe('undici:client:sendHeaders', ({ request, socket }) => {
  const trace = traceByRequest.get(request)
  if (!trace) return
  trace.sent = now()
  const info = socketInfo.get(socket)
  if (info?.fresh) {
    info.fresh = false
    trace.reused = false
    trace.dns = info.dnsMs
    trace.connect = info.connectMs
  } else {
    trace.reused = true
    trace.dns = trace.connect = null
  }
})
diagnostics.subscribe('undici:request:headers', ({ request }) => {
  const trace = traceByRequest.get(request)
  if (trace) trace.headers = now()
})

function timingsFrom(trace, end) {
  if (trace.sent == null || trace.headers == null) return null
  const round = (v) => (v == null ? null : Math.max(0, Math.round(v * 10) / 10))
  const dnsMs = trace.dns ?? 0
  const connectMs = trace.connect ?? 0
  return {
    reused: trace.reused,
    prepare: round(trace.sent - trace.start - connectMs),
    dns: trace.reused ? null : round(dnsMs),
    connect: trace.reused ? null : round(connectMs - dnsMs), // TCP + TLS handshake
    wait: round(trace.headers - trace.sent), // time to first byte
    download: round(end - trace.headers)
  }
}

// --- Digest auth (RFC 7616) ------------------------------------------------------------

/** The parameters of the Digest challenge in a WWW-Authenticate header, or null. */
export function digestChallenge(header) {
  const at = header ? header.search(/\bDigest\s/i) : -1
  if (at < 0) return null
  const params = {}
  const re = /\s*([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]*))\s*(,|$)/y
  re.lastIndex = at + 7
  let m
  // Reads key=value pairs until something else starts (e.g. ", Basic realm=…").
  while ((m = re.exec(header))) {
    params[m[1].toLowerCase()] = m[2] != null ? m[2].replace(/\\(.)/g, '$1') : m[3]
    if (!m[4]) break
  }
  return params.nonce ? params : null
}

export function digestAuthorization({ username, password }, method, url, challenge) {
  const algorithm = challenge.algorithm || 'MD5'
  const hashName = /sha-?256/i.test(algorithm) ? 'sha256' : 'md5'
  const H = (text) => createHash(hashName).update(text, 'utf8').digest('hex')
  const qops = (challenge.qop || '').split(',').map((q) => q.trim())
  const qop = qops.includes('auth') ? 'auth' : null
  const nc = '00000001'
  const cnonce = randomBytes(8).toString('hex')
  const { pathname, search } = new URL(url)
  const uri = pathname + search
  const realm = challenge.realm || ''

  let ha1 = H(`${username}:${realm}:${password}`)
  if (/-sess$/i.test(algorithm)) ha1 = H(`${ha1}:${challenge.nonce}:${cnonce}`)
  const ha2 = H(`${method}:${uri}`)
  const response = qop ? H(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : H(`${ha1}:${challenge.nonce}:${ha2}`)

  const q = (v) => `"${String(v).replace(/(["\\])/g, '\\$1')}"`
  const parts = [
    `username=${q(username)}`,
    `realm=${q(realm)}`,
    `nonce=${q(challenge.nonce)}`,
    `uri=${q(uri)}`,
    `algorithm=${algorithm}`,
    `response=${q(response)}`
  ]
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce=${q(cnonce)}`)
  if (challenge.opaque) parts.push(`opaque=${q(challenge.opaque)}`)
  return `Digest ${parts.join(', ')}`
}

// --- sending -------------------------------------------------------------------------

// In-flight requests, keyed by the renderer's request id, so they can be cancelled.
const inflight = new Map()

const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded|.*\+json|.*\+xml))/i
// Errors that mean a kept-alive connection was closed by the server just as we reused it.
const STALE_SOCKET = new Set(['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE', 'UND_ERR_CLOSED'])
const CERT_ERRORS = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/
const CERT_HINT = `. If this is a development server with a self-signed certificate, turn off "Verify SSL certificates" in the request's Settings tab.`

function normalizeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('URL is empty')
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

async function buildFormData(fields) {
  const form = new FormData()
  for (const field of fields) {
    if (field.type === 'file') {
      if (!field.path) continue
      const data = await readFile(field.path)
      form.append(field.key, new Blob([data]), basename(field.path))
    } else {
      form.append(field.key, field.value)
    }
  }
  return form
}

async function prepare(req, extraHeaders = []) {
  const method = req.method.toUpperCase()
  const headers = new Headers()
  for (const [key, value] of [...req.headers, ...extraHeaders]) headers.append(key, value)

  let body
  if (req.body && method !== 'GET' && method !== 'HEAD') {
    if (req.body.kind === 'form-data') {
      // fetch must generate the multipart boundary itself.
      headers.delete('content-type')
      body = await buildFormData(req.body.fields)
    } else {
      body = req.body.text
    }
  }
  return { method, headers, body }
}

/**
 * Execute an HTTP request described by the renderer.
 * @param {{ id: string, method: string, url: string, headers: [string, string][],
 *           body: null | { kind: 'text', text: string } | { kind: 'form-data', fields: object[] },
 *           digest?: null | { username: string, password: string },
 *           options?: { timeout: number, followRedirects: boolean, verifySsl: boolean } }} req
 */
export async function sendRequest(req) {
  const controller = new AbortController()
  inflight.set(req.id, controller)
  const options = { timeout: 0, followRedirects: true, verifySsl: true, ...req.options }
  let timedOut = false
  const timer =
    options.timeout > 0
      ? setTimeout(() => {
          timedOut = true
          controller.abort()
        }, options.timeout)
      : null

  const startedAt = Date.now()
  const start = now()
  let trace = { start }
  try {
    const url = normalizeUrl(req.url)
    const dispatcher = options.verifySsl ? agent : insecureAgent()
    const redirect = options.followRedirects ? 'follow' : 'manual'
    const attempt = async (extraHeaders) => {
      trace = { start: now() }
      const { method, headers, body } = await prepare(req, extraHeaders)
      return traceContext.run(trace, () => fetch(url, { method, headers, body, redirect, signal: controller.signal, dispatcher }))
    }
    const attemptWithRetry = async (extraHeaders) => {
      try {
        return await attempt(extraHeaders)
      } catch (err) {
        // A reused connection the server had already closed: retry once on a fresh one,
        // like browsers do. Nothing reached the server, so this is safe for any method.
        if (!(trace.reused && trace.headers == null && STALE_SOCKET.has(err.cause?.code))) throw err
        return attempt(extraHeaders)
      }
    }

    let res = await attemptWithRetry()
    if (req.digest && res.status === 401) {
      const challenge = digestChallenge(res.headers.get('www-authenticate'))
      if (challenge) {
        await res.arrayBuffer() // finish the first response so its connection can be reused
        const authorization = digestAuthorization(req.digest, req.method.toUpperCase(), url, challenge)
        res = await attemptWithRetry([['Authorization', authorization]])
      }
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const end = now()

    const contentType = res.headers.get('content-type') || ''
    const responseHeaders = []
    res.headers.forEach((value, key) => {
      if (key !== 'set-cookie') responseHeaders.push([key, value])
    })
    for (const cookie of res.headers.getSetCookie()) responseHeaders.push(['set-cookie', cookie])

    const isImage = contentType.startsWith('image/')
    const isText = !isImage && (TEXT_TYPES.test(contentType) || !contentType)

    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      time: Math.round(end - start),
      timings: timingsFrom(trace, end),
      size: buffer.byteLength,
      startedAt,
      contentType,
      headers: responseHeaders,
      body: isImage ? '' : buffer.toString('utf8'),
      isText,
      imageBase64: isImage ? buffer.toString('base64') : null
    }
  } catch (err) {
    const cancelled = err.name === 'AbortError' && !timedOut
    const code = err.cause?.code
    // Don't keep a cached address that just failed (e.g. the server moved).
    if (['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
      try {
        dnsCache.delete(new URL(normalizeUrl(req.url)).hostname)
      } catch {
        /* invalid URL */
      }
    }
    const cause = code || err.cause?.message
    return {
      ok: false,
      cancelled,
      time: Math.round(now() - start),
      startedAt,
      timedOut,
      error: timedOut
        ? `Request timed out after ${options.timeout} ms. You can change the timeout in the request's Settings tab.`
        : cancelled
          ? 'Request cancelled'
          : cause
            ? `${err.message} (${cause})${CERT_ERRORS.test(cause) ? CERT_HINT : ''}`
            : err.message
    }
  } finally {
    clearTimeout(timer)
    inflight.delete(req.id)
  }
}

export function cancelRequest(id) {
  inflight.get(id)?.abort()
}

/** Resolve a URL's host ahead of time so Send doesn't wait on DNS. */
export function prefetch(url) {
  try {
    const { hostname } = new URL(normalizeUrl(url))
    if (hostname && !hostname.includes('{')) resolveHost(hostname.replace(/^\[|\]$/g, '')).catch(() => {})
  } catch {
    /* incomplete URL while typing */
  }
}

/**
 * Run one real request through the whole client path (against a throwaway local
 * server) and load the TLS root certificates, so the user's first request isn't
 * paying for module loading and JIT warm-up.
 */
export function warmUp() {
  tls.createSecureContext()
  const server = http.createServer((_req, res) => res.end('ok'))
  server.listen(0, '127.0.0.1', async () => {
    try {
      await (await fetch(`http://127.0.0.1:${server.address().port}/`, { dispatcher: agent })).text()
    } catch {
      /* warm-up is best effort */
    }
    server.closeAllConnections()
    server.close()
  })
}
