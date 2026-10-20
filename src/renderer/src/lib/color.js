// Small color helpers. Theme colors are stored as #rrggbb and written to CSS
// variables as "r g b" channel triplets.

export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h, 16)
  if (!/^[0-9a-f]{6}$/i.test(h) || Number.isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const isHex = (hex) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex).trim())

export const channels = (rgb) => rgb.map((v) => Math.round(v)).join(' ')

/** Mix `a` toward `b` by `amount` (0..1). */
export const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount)

/** Relative luminance, 0 (black) .. 1 (white). */
export function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
