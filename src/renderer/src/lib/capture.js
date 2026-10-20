// Evaluate "capture" expressions against a response, to save values into variables.
//
//   status                     HTTP status code
//   body                       the whole body text
//   body.data.token            a value from a JSON body (also: $.data.token, JSONPath style)
//   body.items[0].id           array index; [-1] is the last element
//   body["odd-key"]            keys with special characters
//   header.x-request-id        a response header (case-insensitive)
//   cookie.session             a cookie from Set-Cookie

const parsedBodies = new WeakMap()

function jsonOf(response) {
  if (!parsedBodies.has(response)) {
    let value
    try {
      value = JSON.parse(response.body)
    } catch {
      value = undefined
    }
    parsedBodies.set(response, value)
  }
  return parsedBodies.get(response)
}

/** Split ".a.b[0]['c-d']" into path segments, or null if it isn't a valid path. */
function parsePath(path) {
  const segments = []
  const re = /\.([^.[\]]+)|\[(-?\d+)\]|\[\s*["']([^"']*)["']\s*\]/y
  let index = 0
  while (index < path.length) {
    re.lastIndex = index
    const m = re.exec(path)
    if (!m) return null
    segments.push(m[1] ?? (m[2] !== undefined ? Number(m[2]) : m[3]))
    index = re.lastIndex
  }
  return segments
}

function walk(value, segments) {
  for (const seg of segments) {
    if (value == null || typeof value !== 'object') return undefined
    if (typeof seg === 'number' && Array.isArray(value)) value = value[seg < 0 ? value.length + seg : seg]
    else value = value[seg]
  }
  return value
}

const stringify = (v) => (typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v))
const notFound = { found: false, value: '' }
const found = (v) => (v === undefined ? notFound : { found: true, value: stringify(v) })

/** @returns {{ found: boolean, value: string, error?: string }} */
export function evaluate(expression, response) {
  const expr = String(expression || '').trim()
  if (!expr || !response?.ok) return notFound
  if (expr === 'status') return found(response.status)
  if (expr === 'body') return found(response.body)

  const header = /^headers?(?:\.(.+)|\[\s*["'](.+)["']\s*\])$/i.exec(expr)
  if (header) {
    const name = (header[1] || header[2]).toLowerCase()
    return found(response.headers.find(([k]) => k.toLowerCase() === name)?.[1])
  }

  const cookie = /^cookies?\.(.+)$/i.exec(expr)
  if (cookie) {
    for (const [k, v] of response.headers) {
      if (k.toLowerCase() !== 'set-cookie') continue
      const [pair] = v.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0 && pair.slice(0, eq).trim() === cookie[1]) return found(pair.slice(eq + 1).trim())
    }
    return notFound
  }

  const body = /^(?:\$|body|res\.body|response\.body)(.*)$/.exec(expr)
  if (body) {
    const segments = parsePath(body[1])
    if (!segments) return { ...notFound, error: `Invalid path: ${expr}` }
    const json = jsonOf(response)
    if (json === undefined) return { ...notFound, error: 'The response body is not JSON' }
    return found(walk(json, segments))
  }

  return { ...notFound, error: `Unknown expression: ${expr}` }
}
