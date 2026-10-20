// Lightweight matching for the command palette and the sidebar filter.

const isSubsequence = (needle, hay) => {
  let i = 0
  for (const ch of hay) if (ch === needle[i]) i++
  return i === needle.length
}

/**
 * Score how well `query` matches an item, or null if it doesn't. Every word of the
 * query must be found: in the label (best, especially at a word start), anywhere in
 * `extra` (e.g. folder path, method, URL), or as letters in order in the label.
 */
export function matchScore(query, label, extra = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const l = label.toLowerCase()
  const e = extra.toLowerCase()
  let score = 0
  for (const w of words) {
    const at = l.indexOf(w)
    if (at >= 0) score += 10 + (at === 0 ? 6 : /[\s/_\-.]/.test(l[at - 1]) ? 4 : 0)
    else if (e.includes(w)) score += 4
    else if (isSubsequence(w, l)) score += 1
    else return null
  }
  return score - label.length / 100 // shorter labels win ties
}

/** Does every word of `query` appear somewhere in `text`? */
export const matchesAllWords = (query, text) => {
  const t = text.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w))
}
