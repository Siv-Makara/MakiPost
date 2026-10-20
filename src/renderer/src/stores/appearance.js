import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { channels, hexToRgb, luminance, mix } from '@/lib/color'

export const DEFAULT_APPEARANCE = {
  colors: {
    bg: '#0b0d12',
    panel: '#1c1f27',
    text: '#e4e7ee',
    accent: '#6384ff'
  },
  panelOpacity: 1,
  background: {
    image: null, // file name inside userData/backgrounds
    fit: 'cover', // cover | contain | tile
    overlay: 0.3,
    blur: 0
  }
}

export const PRESETS = [
  { id: 'sar', name: 'MakiPost Dark', colors: { ...DEFAULT_APPEARANCE.colors } },
  { id: 'angkor', name: 'Angkor', colors: { bg: '#b89a6e', panel: '#f2e6cf', text: '#3d2f1e', accent: '#b8860b' } },
  { id: 'tonle-sap', name: 'Tonle Sap', colors: { bg: '#04121f', panel: '#0c2236', text: '#d6edf4', accent: '#1fb8ac' } },
  { id: 'romduol', name: 'Romduol', colors: { bg: '#efd3d6', panel: '#fff8f1', text: '#4a3337', accent: '#d45f86' } },
  { id: 'night-market', name: 'Night Market', colors: { bg: '#05040b', panel: '#13111e', text: '#eeeaff', accent: '#ff3db2' } }
]

const clone = (v) => JSON.parse(JSON.stringify(v))

function merge(saved) {
  const d = clone(DEFAULT_APPEARANCE)
  if (!saved) return d
  return {
    colors: { ...d.colors, ...saved.colors },
    panelOpacity: saved.panelOpacity ?? d.panelOpacity,
    background: { ...d.background, ...saved.background }
  }
}

const DARK_CODE = { key: '#78aaff', string: '#78d296', number: '#f0aa5a', bool: '#c88cfa', null: '#a0a0af' }
const LIGHT_CODE = { key: '#2456c7', string: '#23863a', number: '#b4560a', bool: '#8a3fd1', null: '#7a7a88' }

// Method badge colors: the bright defaults (in main.css) wash out on light panels.
const DARK_METHODS = { get: '#34c77b', post: '#f0aa3c', put: '#56a8f5', patch: '#b278f5', delete: '#f05252' }
const LIGHT_METHODS = { get: '#16894e', post: '#b86e00', put: '#1f6fc4', patch: '#7c3fc9', delete: '#c92a2a' }

/** Write the theme into CSS variables. Secondary colors are derived so any pick stays coherent. */
function apply(a) {
  const style = document.documentElement.style
  const rgb = (hex, fallback) => hexToRgb(hex) || hexToRgb(fallback)
  const set = (name, value) => style.setProperty(`--sar-${name}`, Array.isArray(value) ? channels(value) : value)

  const bg = rgb(a.colors.bg, DEFAULT_APPEARANCE.colors.bg)
  const panel = rgb(a.colors.panel, DEFAULT_APPEARANCE.colors.panel)
  const text = rgb(a.colors.text, DEFAULT_APPEARANCE.colors.text)
  const accent = rgb(a.colors.accent, DEFAULT_APPEARANCE.colors.accent)
  const light = luminance(panel) > 0.45

  set('bg', bg)
  set('panel', panel)
  set('text', text)
  set('accent', accent)
  set('accent-fg', luminance(accent) > 0.5 ? [17, 17, 17] : [255, 255, 255])
  set('surface', mix(panel, text, light ? 0.06 : 0.07))
  set('border', mix(panel, text, light ? 0.16 : 0.13))
  set('muted', mix(text, panel, 0.42))
  set('code-punct', mix(text, panel, 0.35))
  for (const [k, hex] of Object.entries(light ? LIGHT_CODE : DARK_CODE)) set(`code-${k}`, hexToRgb(hex))
  for (const [k, hex] of Object.entries(light ? LIGHT_METHODS : DARK_METHODS)) set(`method-${k}`, hexToRgb(hex))
  set('panel-alpha', String(a.panelOpacity))
  style.colorScheme = light ? 'light' : 'dark'
}

export const useAppearanceStore = defineStore('appearance', () => {
  const appearance = ref(clone(DEFAULT_APPEARANCE))

  function init(saved) {
    appearance.value = merge(saved)
    apply(appearance.value)
    let timer = null
    // Live preview: every edit applies instantly; persistence is debounced.
    watch(
      appearance,
      (a) => {
        apply(a)
        clearTimeout(timer)
        timer = setTimeout(() => window.sar.settings.set('appearance', clone(a)), 300)
      },
      { deep: true }
    )
  }

  function applyPreset(preset) {
    appearance.value.colors = { ...preset.colors }
  }

  async function uploadBackground() {
    const name = await window.sar.appearance.pickBackground()
    if (!name) return
    const bg = appearance.value.background
    const first = !bg.image
    bg.image = name
    // Make the image visible straight away the first time.
    if (first && appearance.value.panelOpacity > 0.85) appearance.value.panelOpacity = 0.8
  }

  async function removeBackground() {
    await window.sar.appearance.removeBackground()
    appearance.value.background.image = null
    appearance.value.panelOpacity = 1
  }

  async function reset() {
    if (appearance.value.background.image) await window.sar.appearance.removeBackground()
    appearance.value = clone(DEFAULT_APPEARANCE)
  }

  return { appearance, init, applyPreset, uploadBackground, removeBackground, reset }
})
