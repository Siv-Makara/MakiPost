// Turns an editable request into the plain payload the main process sends.
// `resolve` substitutes {{variables}}; it's the identity until environments exist.

import { DEFAULT_OPTIONS } from './model'

const identity = (s) => s

function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

const activeRows = (rows) => rows.filter((r) => r.enabled && r.key.trim())

function appendQuery(url, key, value) {
  const hashAt = url.indexOf('#')
  const [base, hash] = hashAt >= 0 ? [url.slice(0, hashAt), url.slice(hashAt)] : [url, '']
  const pair = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  return base + (base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?') + pair + hash
}

/**
 * `oauthToken` ({ accessToken }) is fetched beforehand by the caller, because getting
 * one may need a network round trip or a login window.
 */
export function buildRequest(request, resolve = identity, { oauthToken = null } = {}) {
  let url = resolve(request.url)
  let digest = null
  const headers = activeRows(request.headers).map((h) => [resolve(h.key.trim()), resolve(h.value)])
  const hasHeader = (name) => headers.some(([k]) => k.toLowerCase() === name)

  const { auth } = request
  if (auth.type === 'bearer' && auth.bearer.token && !hasHeader('authorization')) {
    headers.push(['Authorization', `Bearer ${resolve(auth.bearer.token)}`])
  } else if (auth.type === 'basic' && !hasHeader('authorization')) {
    const creds = `${resolve(auth.basic.username)}:${resolve(auth.basic.password)}`
    headers.push(['Authorization', `Basic ${base64Utf8(creds)}`])
  } else if (auth.type === 'apikey' && auth.apikey.key.trim()) {
    const key = resolve(auth.apikey.key.trim())
    const value = resolve(auth.apikey.value)
    if (auth.apikey.in === 'query') url = appendQuery(url, key, value)
    else if (!hasHeader(key.toLowerCase())) headers.push([key, value])
  } else if (auth.type === 'digest' && !hasHeader('authorization')) {
    // Needs the server's challenge first, so the main process adds the header.
    digest = { username: resolve(auth.digest.username), password: resolve(auth.digest.password) }
  } else if (auth.type === 'oauth2' && oauthToken?.accessToken && !hasHeader('authorization')) {
    const prefix = (auth.oauth2.headerPrefix ?? 'Bearer').trim()
    headers.push(['Authorization', prefix ? `${prefix} ${oauthToken.accessToken}` : oauthToken.accessToken])
  }

  const setContentType = (type) => {
    if (!hasHeader('content-type')) headers.push(['Content-Type', type])
  }

  let body = null
  const { body: b } = request
  switch (b.mode) {
    case 'json':
      setContentType('application/json')
      body = { kind: 'text', text: resolve(b.json) }
      break
    case 'raw':
      setContentType(b.rawType)
      body = { kind: 'text', text: resolve(b.raw) }
      break
    case 'urlencoded': {
      const params = new URLSearchParams()
      for (const row of activeRows(b.urlencoded)) params.append(resolve(row.key), resolve(row.value))
      setContentType('application/x-www-form-urlencoded')
      body = { kind: 'text', text: params.toString() }
      break
    }
    case 'form-data':
      body = {
        kind: 'form-data',
        fields: activeRows(b.formData).map((row) => ({
          key: resolve(row.key),
          type: row.type,
          value: row.type === 'file' ? '' : resolve(row.value),
          path: row.type === 'file' ? row.path : ''
        }))
      }
      break
  }

  const options = { ...DEFAULT_OPTIONS, ...request.options }
  return {
    method: request.method,
    url,
    headers,
    body,
    digest,
    options: {
      timeout: Math.max(0, Number(options.timeout) || 0),
      followRedirects: options.followRedirects !== false,
      verifySsl: options.verifySsl !== false
    }
  }
}
