import { createRow } from './model'

// URLs may contain {{variables}}, so these helpers split strings by hand
// instead of using the URL constructor (which would mangle or reject them).

const decode = (s) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

// Encode the characters that would break query parsing, but leave {{ }} readable.
const encode = (s) => s.replace(/[%&=#+ ]/g, (c) => (c === ' ' ? '%20' : encodeURIComponent(c)))

export function splitUrl(url) {
  const hashAt = url.indexOf('#')
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const rest = hashAt >= 0 ? url.slice(0, hashAt) : url
  const qAt = rest.indexOf('?')
  return {
    base: qAt >= 0 ? rest.slice(0, qAt) : rest,
    query: qAt >= 0 ? rest.slice(qAt + 1) : null,
    hash
  }
}

/**
 * Parse the URL's query string into param rows. Disabled rows from `previous`
 * are kept (they're not in the URL), in their original position.
 */
export function paramsFromUrl(url, previous = []) {
  const { query } = splitUrl(url)
  const parsed = query
    ? query
        .split('&')
        .filter((part) => part.length)
        .map((part) => {
          const eq = part.indexOf('=')
          const key = decode(eq >= 0 ? part.slice(0, eq) : part)
          const value = eq >= 0 ? decode(part.slice(eq + 1)) : ''
          return { key, value }
        })
    : []

  const result = []
  let i = 0
  for (const row of previous) {
    if (!row.enabled) {
      if (row.key || row.value) result.push(row)
      continue
    }
    if (!(row.key || row.value)) continue
    const next = parsed[i++]
    if (next) result.push({ ...row, key: next.key, value: next.value })
  }
  for (; i < parsed.length; i++) result.push(createRow(parsed[i]))
  return result
}

export function urlWithParams(url, params) {
  const { base, hash } = splitUrl(url)
  const query = params
    .filter((p) => p.enabled && (p.key || p.value))
    .map((p) => `${encode(p.key)}=${encode(p.value)}`)
    .join('&')
  return base + (query ? `?${query}` : '') + hash
}
