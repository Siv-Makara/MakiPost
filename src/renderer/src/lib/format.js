export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatTime(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`
}

/** Tailwind text/background color token for an HTTP status. */
export function statusTone(status) {
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  if (status >= 300) return 'info'
  if (status >= 200) return 'success'
  return 'muted'
}

export const methodColor = {
  GET: 'text-m-get',
  POST: 'text-m-post',
  PUT: 'text-m-put',
  PATCH: 'text-m-patch',
  DELETE: 'text-m-delete',
  HEAD: 'text-info',
  OPTIONS: 'text-muted'
}

/** Short method label for narrow places (sidebar, history). */
export const methodShort = (m) => ({ DELETE: 'DEL', OPTIONS: 'OPT' })[m] || m

/** Pick a CodeMirror language from a content type, and pretty-print JSON when possible. */
export function prettyBody(body, contentType = '') {
  const ct = contentType.toLowerCase()
  const looksJson = ct.includes('json') || /^\s*[[{]/.test(body)
  if (looksJson) {
    try {
      return { text: JSON.stringify(JSON.parse(body), null, 2), language: 'json' }
    } catch {
      /* not JSON after all */
    }
  }
  if (ct.includes('html')) return { text: body, language: 'html' }
  if (ct.includes('xml')) return { text: body, language: 'xml' }
  return { text: body, language: 'text' }
}
