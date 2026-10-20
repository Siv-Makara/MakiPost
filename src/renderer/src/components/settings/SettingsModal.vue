<script setup>
import { computed } from 'vue'
import { PRESETS, useAppearanceStore } from '@/stores/appearance'
import { useUiStore } from '@/stores/ui'
import { useGeneralStore } from '@/stores/general'
import { useHistoryStore } from '@/stores/history'
import ColorField from './ColorField.vue'
import FlagKH from '../FlagKH.vue'

const ui = useUiStore()
const prefs = useGeneralStore()
const history = useHistoryStore()
const PAGES = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'about', label: 'About' }
]
/* global __APP_NAME__, __APP_VERSION__, __APP_COPYRIGHT__ */
const ABOUT = { name: __APP_NAME__, version: __APP_VERSION__, copyright: __APP_COPYRIGHT__ }
const pageLabel = computed(() => PAGES.find((p) => p.id === ui.settingsPage)?.label)
const store = useAppearanceStore()
const a = computed(() => store.appearance)
const bg = computed(() => store.appearance.background)

const FITS = [
  { id: 'cover', label: 'Cover' },
  { id: 'contain', label: 'Contain' },
  { id: 'tile', label: 'Tile' }
]

const isPreset = (p) => Object.entries(p.colors).every(([k, v]) => a.value.colors[k]?.toLowerCase() === v.toLowerCase())

async function upload() {
  try {
    await store.uploadBackground()
  } catch (err) {
    ui.error(err)
  }
}

const close = () => (ui.settingsOpen = false)
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/30" @mousedown.self="close">
    <div class="flex h-[min(680px,90vh)] w-[min(760px,92vw)] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl" @keydown.esc="close">
      <!-- nav -->
      <nav class="w-44 shrink-0 border-r border-line p-3">
        <div class="px-2 pb-3 text-[14px] font-semibold">Settings</div>
        <button
          v-for="p in PAGES"
          :key="p.id"
          class="mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-[12.5px]"
          :class="ui.settingsPage === p.id ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-surface hover:text-fg'"
          @click="ui.settingsPage = p.id"
        >
          {{ p.label }}
        </button>
      </nav>

      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-12 shrink-0 items-center border-b border-line px-6">
          <h2 class="text-[14px] font-semibold">{{ pageLabel }}</h2>
          <button class="btn-ghost ml-auto h-7 w-7 px-0" title="Close" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div v-if="ui.settingsPage === 'general'" class="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <section>
            <h3 class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">History</h3>
            <label class="flex cursor-pointer items-start gap-3">
              <input v-model="prefs.general.clearHistoryOnClose" type="checkbox" class="mt-0.5 accent-[rgb(var(--sar-accent))]" />
              <span>
                <span class="block text-[12.5px]">Clear history when MakiPost closes</span>
                <span class="block text-[11.5px] text-muted">
                  Each time you start MakiPost, History begins empty. Turn off to keep the last 100 requests between sessions.
                </span>
              </span>
            </label>
            <button class="btn mt-4 h-7 text-[12px]" :disabled="!history.entries.length" @click="history.clear()">
              Clear history now{{ history.entries.length ? ` (${history.entries.length})` : '' }}
            </button>
          </section>
        </div>

        <div v-else-if="ui.settingsPage === 'about'" class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-5 text-center">
          <div class="flex items-center gap-2.5 text-[28px] font-bold tracking-tight">
            <span>Maki<span class="text-accent">Post</span></span>
            <span class="font-normal text-muted">-</span>
            <span class="font-semibold text-accent">ខ្មែរ</span>
            <FlagKH :height="24" />
          </div>
          <div class="text-[13px] text-muted">A fast desktop API client, made in Cambodia</div>
          <div class="mt-2 font-mono text-[12px] text-fg/80">Version {{ ABOUT.version }}</div>
          <div class="mt-4 text-[12.5px] text-fg">{{ ABOUT.copyright }}</div>
          <div class="text-[11.5px] text-muted">Released under the MIT License.</div>
        </div>

        <div v-else class="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <!-- presets -->
          <section>
            <h3 class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Theme presets</h3>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="p in PRESETS"
                :key="p.id"
                class="overflow-hidden rounded-md border text-left transition"
                :class="isPreset(p) ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted'"
                @click="store.applyPreset(p)"
              >
                <div class="flex h-12 items-end gap-1 p-1.5" :style="{ background: p.colors.bg }">
                  <div class="h-full flex-1 rounded-sm p-1" :style="{ background: p.colors.panel }">
                    <div class="h-1.5 w-3/4 rounded-full" :style="{ background: p.colors.text, opacity: 0.7 }"></div>
                    <div class="mt-1 h-2 w-1/2 rounded-sm" :style="{ background: p.colors.accent }"></div>
                  </div>
                </div>
                <div class="truncate px-2 py-1 text-[11.5px]">{{ p.name }}</div>
              </button>
            </div>
          </section>

          <!-- colors -->
          <section>
            <h3 class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Colors</h3>
            <div class="space-y-3">
              <ColorField v-model="a.colors.bg" label="Background" hint="Behind the panels" />
              <ColorField v-model="a.colors.panel" label="Panels" hint="Sidebar, editor, top bar" />
              <ColorField v-model="a.colors.text" label="Text" />
              <ColorField v-model="a.colors.accent" label="Accent" hint="Buttons, active tabs" />
              <div class="flex items-center gap-3">
                <div class="w-36">
                  <div class="text-[12.5px]">Panel opacity</div>
                  <div class="text-[11px] text-muted">Lower shows the background</div>
                </div>
                <input v-model.number="a.panelOpacity" type="range" min="0.3" max="1" step="0.01" class="flex-1 accent-[rgb(var(--sar-accent))]" />
                <span class="w-10 text-right font-mono text-[12px] text-muted">{{ Math.round(a.panelOpacity * 100) }}%</span>
              </div>
            </div>
          </section>

          <!-- background image -->
          <section>
            <h3 class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Background image</h3>
            <div class="flex gap-4">
              <div
                class="flex h-28 w-44 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg"
                :style="bg.image ? { backgroundImage: `url('sar-bg://image/${encodeURIComponent(bg.image)}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
              >
                <span v-if="!bg.image" class="text-[11.5px] text-muted">No image</span>
              </div>
              <div class="flex flex-col justify-center gap-2">
                <button class="btn-accent" @click="upload">{{ bg.image ? 'Change image…' : 'Upload image…' }}</button>
                <button v-if="bg.image" class="btn" @click="store.removeBackground()">Remove background</button>
                <span class="text-[11px] text-muted">PNG, JPG or WebP. A copy is stored with MakiPost's settings.</span>
              </div>
            </div>

            <div v-if="bg.image" class="mt-4 space-y-3">
              <div class="flex items-center gap-3">
                <span class="w-36 text-[12.5px]">Fit</span>
                <div class="flex overflow-hidden rounded-md border border-line">
                  <button
                    v-for="f in FITS"
                    :key="f.id"
                    class="px-3 py-1 text-[12px]"
                    :class="bg.fit === f.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'"
                    @click="bg.fit = f.id"
                  >
                    {{ f.label }}
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-36 text-[12.5px]">Overlay</span>
                <input v-model.number="bg.overlay" type="range" min="0" max="1" step="0.01" class="flex-1 accent-[rgb(var(--sar-accent))]" />
                <span class="w-10 text-right font-mono text-[12px] text-muted">{{ Math.round(bg.overlay * 100) }}%</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-36 text-[12.5px]">Blur</span>
                <input v-model.number="bg.blur" type="range" min="0" max="20" step="1" class="flex-1 accent-[rgb(var(--sar-accent))]" />
                <span class="w-10 text-right font-mono text-[12px] text-muted">{{ bg.blur }}px</span>
              </div>
            </div>
          </section>
        </div>

        <div class="flex shrink-0 items-center border-t border-line px-6 py-3">
          <button v-if="ui.settingsPage === 'appearance'" class="btn mr-3" @click="store.reset()">Reset to default</button>
          <span class="text-[11px] text-muted">Changes apply and save instantly.</span>
          <button class="btn-accent ml-auto" @click="close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>
