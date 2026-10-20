<script setup>
import { onMounted, ref } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const box = ref(null)
onMounted(() => box.value?.focus())
const isMac = window.sar.platform === 'darwin'
const mod = isMac ? '⌘' : 'Ctrl'
const close = () => (ui.shortcutsOpen = false)

const GROUPS = [
  {
    title: 'General',
    keys: [
      [[mod, 'P'], 'Search everything'],
      [[mod, 'K'], 'Same as above'],
      [[mod, ','], 'Settings'],
      [[mod, '/'], 'This list']
    ]
  },
  {
    title: 'Requests',
    keys: [
      [[mod, 'Enter'], 'Send'],
      [[mod, 'S'], 'Save'],
      [[mod, 'L'], 'Focus the URL bar'],
      [['{{'], 'Insert a variable']
    ]
  },
  {
    title: 'Tabs',
    keys: [
      [[mod, 'T'], 'New tab'],
      [[mod, 'W'], 'Close tab'],
      [['Ctrl', 'Tab'], 'Next tab'],
      [['Ctrl', 'Shift', 'Tab'], 'Previous tab'],
      [['Middle-click'], 'Close tab'],
      [['Right-click'], 'Tab menu']
    ]
  },
  {
    title: 'Response',
    keys: [
      [[mod, 'F'], 'Find in response'],
      [[mod, 'G'], 'Next match']
    ]
  }
]
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40" @mousedown.self="close">
    <div
      class="w-[min(760px,94vw)] rounded-lg border border-line bg-panel shadow-2xl outline-none"
      ref="box"
      tabindex="-1"
      @keydown.esc="close"
    >
      <div class="flex items-center border-b border-line px-5 py-3">
        <span class="text-[14px] font-semibold">Keyboard shortcuts</span>
        <button class="btn-ghost ml-auto" @click="close">Close</button>
      </div>
      <div class="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        <div v-for="g in GROUPS" :key="g.title">
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{{ g.title }}</div>
          <div v-for="([keys, text], i) in g.keys" :key="i" class="flex items-center gap-3 py-1 text-[12.5px]">
            <span class="flex w-44 shrink-0 items-center gap-1">
              <template v-for="(k, j) in keys" :key="j">
                <span v-if="j" class="text-[10px] text-muted">+</span>
                <span class="kbd px-1.5 py-0.5 text-[11px]">{{ k }}</span>
              </template>
            </span>
            <span class="text-fg/85">{{ text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
