import { createFormRow, createRequest, createRow, RAW_TYPES } from './model'
import { paramsFromUrl } from './url'

// ---------------------------------------------------------------------------
// Parsing: `curl …` command -> editable request
// ---------------------------------------------------------------------------

export const looksLikeCurl = (text) => /^\s*curl(\.exe)?\s/i.test(text)

// Flags we don't model but must skip together with their argument.
const IGNORED_WITH_ARG = new Set([
  '-o', '--output', '--connect-timeout', '-w', '--write-out', '--retry', '--retry-delay',
  '--retry-max-time', '-x', '--proxy', '-U', '--proxy-user', '--cacert', '--capath', '--cert', '-E', '--key',
  '--cert-type', '--key-type', '--ciphers', '-r', '--range', '--resolve', '--max-redirs', '-c', '--cookie-jar',
  '-T', '--upload-file', '-D', '--dump-header', '--limit-rate', '-K', '--config', '--interface', '-y', '-Y',
  '-z', '--time-cond', '--tls-max', '--trace', '--trace-ascii', '--stderr', '--unix-socket', '--variable'
])

// Short flags that take a value, which may be attached (`-XPOST`, `-d@body.json`).
const SHORT_WITH_VALUE = /^-([XHdFubAe])(.+)$/

/** Expand $'…' (ANSI-C quoting) escapes, as used by Chrome's "Copy as cURL (bash)". */
function ansiC(text) {
  return text.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, (_m, e) => {
    if (e.length > 1) return String.fromCharCode(parseInt(e.slice(1), 16))
    return { n: '\n', t: '\t', r: '\r', '0': '\0' }[e] ?? e
  })
}

/** Split a shell command line into arguments (bash quoting, plus Windows cmd ^ escapes). */
export function tokenize(input) {
  let s = input.trim()
  // Chrome's "Copy as cURL (cmd)": ^" quoting and ^ line continuations.
  if (/\^["\r\n]/.test(s)) s = s.replace(/\^\r?\n/g, ' ').replace(/\^([\s\S])/g, '$1')
  s = s.replace(/\\\r?\n/g, ' ') // bash line continuations

  const tokens = []
  let i = 0
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++
    if (i >= s.length) break
    let token = ''
    while (i < s.length && !/\s/.test(s[i])) {
      const ch = s[i]
      if (ch === "'") {
        const end = s.indexOf("'", i + 1)
        const stop = end < 0 ? s.length : end
        token += s.slice(i + 1, stop)
        i = stop + 1
      } else if (ch === '$' && s[i + 1] === "'") {
        let j = i + 2
        let raw = ''
        while (j < s.length && s[j] !== "'") {
          if (s[j] === '\\' && j + 1 < s.length) {
            raw += s[j] + s[j + 1]
            j += 2
          } else raw += s[j++]
        }
        token += ansiC(raw)
        i = j + 1
      } else if (ch === '"') {
        let j = i + 1
        while (j < s.length && s[j] !== '"') {
          if (s[j] === '\\' && '"\\$`'.includes(s[j + 1])) {
            token += s[j + 1]
            j += 2
          } else token += s[j++]
        }
        i = j + 1
      } else if (ch === '\\' && i + 1 < s.length) {
        token += s[i + 1]
        i += 2
      } else {
        token += ch
        i++
      }
    }
    tokens.push(token)
  }
  return tokens
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

const decodeForm = (s) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

function nameFromUrl(method, url) {
  const path = url.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]+/i, '').split(/[?#]/)[0]
  const label = path && path !== '/' ? path : url.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]
  return `${method} ${label || 'request'}`.slice(0, 80)
}

/** Parse a cURL command into a request. Throws if it isn't one. */
export function parseCurl(text) {
  const tokens = tokenize(text)
  if (!tokens.length || !/^curl(\.exe)?$/i.test(tokens[0])) throw new Error('This is not a cURL command.')

  let method = null
  let url = ''
  let getMode = false
  let user = null
  let digest = false
  let insecure = false
  let maxTime = 0
  const headers = []
  const data = []
  const form = []

  for (let i = 1; i < tokens.length; i++) {
    let flag = tokens[i]
    let value
    if (flag.startsWith('--') && flag.includes('=')) {
      value = flag.slice(flag.indexOf('=') + 1)
      flag = flag.slice(0, flag.indexOf('='))
    } else {
      const attached = SHORT_WITH_VALUE.exec(flag)
      if (attached) [flag, value] = [`-${attached[1]}`, attached[2]]
    }
    const arg = () => value ?? tokens[++i] ?? ''

    switch (flag) {
      case '-X':
      case '--request':
        method = arg().toUpperCase()
        break
      case '-H':
      case '--header': {
        const h = arg()
        const colon = h.indexOf(':')
        if (colon > 0) headers.push([h.slice(0, colon).trim(), h.slice(colon + 1).trim()])
        break
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
        data.push(arg())
        break
      case '--data-urlencode': {
        const v = arg()
        const eq = v.indexOf('=')
        data.push(eq >= 0 ? v.slice(0, eq + 1) + encodeURIComponent(v.slice(eq + 1)) : encodeURIComponent(v))
        break
      }
      case '--json':
        data.push(arg())
        headers.push(['Content-Type', 'application/json'], ['Accept', 'application/json'])
        break
      case '-F':
      case '--form':
      case '--form-string':
        form.push(arg())
        break
      case '-u':
      case '--user':
        user = arg()
        break
      case '-b':
      case '--cookie':
        headers.push(['Cookie', arg()])
        break
      case '-A':
      case '--user-agent':
        headers.push(['User-Agent', arg()])
        break
      case '-e':
      case '--referer':
        headers.push(['Referer', arg()])
        break
      case '-G':
      case '--get':
        getMode = true
        break
      case '-I':
      case '--head':
        method = 'HEAD'
        break
      case '--url':
        url = arg()
        break
      case '--digest':
        digest = true
        break
      case '-k':
      case '--insecure':
        insecure = true
        break
      case '-m':
      case '--max-time':
        maxTime = Math.round(parseFloat(arg()) * 1000) || 0
        break
      default:
        if (IGNORED_WITH_ARG.has(flag)) arg()
        else if (!flag.startsWith('-') && !url) url = flag
      // other flags (-s, -L, --compressed, …) don't change the request
    }
  }
  if (!url) throw new Error('No URL found in the cURL command.')

  let body = data.join('&')
  if (getMode && body) {
    url += (url.includes('?') ? '&' : '?') + body
    body = ''
  }
  method = method || (body || form.length ? 'POST' : 'GET')

  const request = createRequest({ name: nameFromUrl(method, url), method, url, params: paramsFromUrl(url) })

  // Headers, turning Authorization into the Auth tab where possible.
  const seen = new Set()
  for (const [key, value] of headers) {
    const lower = key.toLowerCase()
    if (lower === 'authorization' && /^bearer\s+/i.test(value)) {
      request.auth.type = 'bearer'
      request.auth.bearer.token = value.replace(/^bearer\s+/i, '')
      continue
    }
    if (lower === 'authorization' && /^basic\s+/i.test(value)) {
      try {
        const decoded = decodeBase64Utf8(value.replace(/^basic\s+/i, '').trim())
        const colon = decoded.indexOf(':')
        if (colon >= 0) {
          request.auth.type = 'basic'
          request.auth.basic = { username: decoded.slice(0, colon), password: decoded.slice(colon + 1) }
          continue
        }
      } catch {
        /* not valid base64: keep the header */
      }
    }
    if (lower === 'content-type' && form.length) continue // fetch sets the multipart boundary
    if (seen.has(`${lower}:${value}`)) continue
    seen.add(`${lower}:${value}`)
    request.headers.push(createRow({ key, value }))
  }
  if (user != null) {
    const colon = user.indexOf(':')
    const creds = {
      username: colon >= 0 ? user.slice(0, colon) : user,
      password: colon >= 0 ? user.slice(colon + 1) : ''
    }
    request.auth.type = digest ? 'digest' : 'basic'
    request.auth[request.auth.type] = creds
  }
  if (insecure) request.options.verifySsl = false
  if (maxTime) request.options.timeout = maxTime

  // Body
  const contentType = (headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '').toLowerCase()
  if (form.length) {
    request.body.mode = 'form-data'
    request.body.formData = form.map((field) => {
      const eq = field.indexOf('=')
      const key = eq >= 0 ? field.slice(0, eq) : field
      const value = eq >= 0 ? field.slice(eq + 1) : ''
      if (value.startsWith('@')) return createFormRow({ key, type: 'file', path: value.slice(1).replace(/;type=.*$/, '') })
      return createFormRow({ key, value: value.replace(/^"([\s\S]*)"$/, '$1') })
    })
  } else if (body) {
    let parsedJson
    try {
      parsedJson = JSON.parse(body)
    } catch {
      /* not JSON */
    }
    const isFormLike = /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(body)
    if (contentType.includes('json') || (!contentType && parsedJson !== undefined && /^\s*[[{]/.test(body))) {
      request.body.mode = 'json'
      request.body.json = parsedJson !== undefined ? JSON.stringify(parsedJson, null, 2) : body
    } else if (contentType.includes('x-www-form-urlencoded') || (!contentType && isFormLike)) {
      request.body.mode = 'urlencoded'
      request.body.urlencoded = body.split('&').map((pair) => {
        const eq = pair.indexOf('=')
        return createRow({ key: decodeForm(eq >= 0 ? pair.slice(0, eq) : pair), value: eq >= 0 ? decodeForm(pair.slice(eq + 1)) : '' })
      })
    } else {
      request.body.mode = 'raw'
      request.body.raw = body
      request.body.rawType = RAW_TYPES.find((t) => contentType.startsWith(t.id))?.id || 'text/plain'
    }
  }
  return request
}

// ---------------------------------------------------------------------------
// Export: built request (see buildRequest) -> `curl …` command
// ---------------------------------------------------------------------------

const withScheme = (url) => (/^[a-z][a-z\d+.-]*:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`)

const QUOTE = {
  // POSIX shells (bash, zsh, Git Bash, WSL, macOS/Linux terminals)
  bash: (s) => `'${String(s).replace(/'/g, `'\\''`)}'`,
  // Windows cmd.exe with curl.exe
  cmd: (s) => `"${String(s).replace(/"/g, '\\"').replace(/%/g, '%%')}"`
}
const CONTINUATION = { bash: ' \\\n  ', cmd: ' ^\n  ' }

export function toCurl({ method, url, headers, body, digest, options }, shell = 'bash') {
  const q = QUOTE[shell]
  const flags = [
    method === 'HEAD' ? ' --head' : method !== 'GET' ? ` -X ${method}` : '',
    options?.followRedirects !== false ? ' -L' : '',
    options?.verifySsl === false ? ' -k' : '',
    options?.timeout > 0 ? ` --max-time ${options.timeout / 1000}` : ''
  ].join('')
  const parts = [`curl${flags} ${q(withScheme(url))}`]
  if (digest) parts.push(`--digest -u ${q(`${digest.username}:${digest.password}`)}`)
  for (const [key, value] of headers) parts.push(`-H ${q(`${key}: ${value}`)}`)
  if (method !== 'GET' && method !== 'HEAD' && body) {
    if (body.kind === 'text' && body.text) parts.push(`--data-raw ${q(body.text)}`)
    if (body.kind === 'form-data') {
      for (const f of body.fields) parts.push(`-F ${q(f.type === 'file' ? `${f.key}=@${f.path}` : `${f.key}=${f.value}`)}`)
    }
  }
  return parts.join(CONTINUATION[shell])
}
