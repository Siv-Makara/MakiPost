<script setup>
import { useUiStore } from '@/stores/ui'
import { useEnvironmentsStore } from '@/stores/environments'
import FlagKH from './FlagKH.vue'
const ui = useUiStore()
const env = useEnvironmentsStore()
const mod = window.sar.platform === 'darwin' ? '⌘' : 'Ctrl+'
</script>

<template>
  <header class="panel flex h-11 shrink-0 items-center gap-3 rounded-lg border border-line px-4">
    <div class="flex shrink-0 items-center gap-1.5">
      <span class="text-[15px] font-bold tracking-tight text-fg">Maki<span class="text-accent">Post</span></span>
      <span class="text-[15px] text-muted">-</span>
      <span class="text-[15px] font-semibold text-accent">ខ្មែរ</span>
      <FlagKH :height="14" />
    </div>

    <button
      class="mx-auto flex h-7 w-[min(360px,40%)] items-center gap-2 rounded-md border border-line bg-surface/40 px-2.5 text-[12px] text-muted transition-colors hover:border-accent/60 hover:text-fg"
      title="Search requests, tabs and commands"
      @click="ui.paletteOpen = true"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span class="truncate">Search requests and commands…</span>
      <span class="kbd ml-auto shrink-0">{{ mod }}P</span>
    </button>

    <div class="flex items-center gap-2">
      <div class="flex h-7 items-center rounded-md border border-line bg-surface/60" title="Active environment">
        <span class="ml-2.5 h-2 w-2 shrink-0 rounded-full" :class="env.active ? 'bg-success' : 'bg-muted/40'"></span>
        <select
          v-model="env.activeId"
          class="h-full w-44 cursor-pointer truncate bg-transparent pl-2 pr-1 text-[12px] outline-none"
          :class="env.active ? 'text-fg' : 'text-muted'"
        >
          <option :value="null" class="bg-panel text-fg">No Environment</option>
          <option v-for="e in env.list" :key="e.id" :value="e.id" class="bg-panel text-fg">{{ e.name }}</option>
        </select>
        <button
          class="flex h-full items-center border-l border-line px-2 text-muted hover:text-fg"
          title="Manage environments"
          @click="ui.environmentsOpen = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
          </svg>
        </button>
      </div>
      <button class="btn-ghost h-7 w-7 px-0" title="Settings" @click="ui.settingsOpen = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>
