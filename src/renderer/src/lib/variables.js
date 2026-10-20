// {{variable}} parsing and substitution.

export const varRegex = () => /\{\{\s*([^{}]+?)\s*\}\}/g

export const hasVars = (text) => typeof text === 'string' && /\{\{[^{}]+\}\}/.test(text)

/** Built-in variables that produce a fresh value on every send. */
export const DYNAMIC_VARS = [
  { name: '$guid', description: 'Random UUID v4', fn: () => crypto.randomUUID() },
  { name: '$timestamp', description: 'Unix time in seconds', fn: () => String(Math.floor(Date.now() / 1000)) },
  { name: '$isoTimestamp', description: 'Current time (ISO 8601)', fn: () => new Date().toISOString() },
  { name: '$randomInt', description: 'Random integer 0–1000', fn: () => String(Math.floor(Math.random() * 1001)) }
]
const dynamic = new Map(DYNAMIC_VARS.map((d) => [d.name, d]))
export const isDynamic = (name) => dynamic.has(name)

/** Split text into plain and {{variable}} parts, for highlighting. */
export function segments(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(varRegex())) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], name: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/**
 * Replace {{name}} using `lookup(name) -> string | null`. Values may reference
 * other variables (up to 5 levels). Unknown names are left as-is and added to `missing`.
 */
export function interpolate(text, lookup, missing = null, depth = 0) {
  if (typeof text !== 'string' || !text.includes('{{')) return text
  return text.replace(varRegex(), (whole, name) => {
    if (dynamic.has(name)) return dynamic.get(name).fn()
    const value = lookup(name)
    if (value == null) {
      missing?.add(name)
      return whole
    }
    return depth < 5 ? interpolate(value, lookup, missing, depth + 1) : value
  })
}
