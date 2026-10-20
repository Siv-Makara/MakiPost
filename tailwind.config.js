/** @type {import('tailwindcss').Config} */

// Every color is a CSS variable holding space-separated RGB channels
// ("r g b"), so themes swap instantly and Tailwind's /opacity modifiers work.
const v = (name) => `rgb(var(--sar-${name}) / <alpha-value>)`

module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        surface: v('surface'),
        fg: v('text'),
        muted: v('muted'),
        line: v('border'),
        accent: v('accent'),
        'accent-fg': v('accent-fg'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
        'm-get': v('method-get'),
        'm-post': v('method-post'),
        'm-put': v('method-put'),
        'm-patch': v('method-patch'),
        'm-delete': v('method-delete')
      },
      fontFamily: {
        sans: ['var(--sar-font-sans)'],
        mono: ['var(--sar-font-mono)']
      }
    }
  },
  plugins: []
}
