<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { matchScore } from '@/lib/search'
import { methodColor, methodShort } from '@/lib/format'
import { useCollectionsStore } from '@/stores/collections'
import { useEnvironmentsStore } from '@/stores/environments'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const tabs = useTabsStore()
const collections = useCollectionsStore()
const env = useEnvironmentsStore()

const query = ref('')
const selected = ref(0)
const input = ref(null)
const list = ref(null)
const mod = window.sar.platform === 'darwin' ? '⌘' : 'Ctrl+'
const MAX = 60

onMounted(() => input.value?.focus())
const close = () => (ui.paletteOpen = false)

const commands = computed(() => [
  { label: 'New request tab', hint: `${mod}T`, run: () => tabs.openTab() },
  { label: 'Save request', hint: `${mod}S`, run: () => tabs.save() },
  { label: 'Duplicate current tab', run: () => tabs.activeId && tabs.duplicateTab(tabs.activeId) },
  { label: 'Import Postman collection…', run: () => collections.importPostman() },
  { label: 'Import cURL command…', run: () => (ui.curlImport = true) },
  { label: 'Open or create a collection folder…', run: () => collections.openFolder() },
  { label: 'Show history', run: () => (ui.sidebarView = 'history') },
  { label: 'Manage environments', run: () => (ui.environmentsOpen = true) },
  ...env.list.map((e) => ({
    label: `Switch environment: ${e.name}`,
    hint: e.id === env.activeId ? 'active' : '',
    run: () => (env.activeId = e.id)
  })),
  ...(env.activeId ? [{ label: 'Switch environment: No Environment', run: () => (env.activeId = null) }] : []),
  { label: 'Settings', hint: `${mod},`, run: () => (ui.settingsOpen = true) },
  { label: 'Keyboard shortcuts', hint: `${mod}/`, run: () => (ui.shortcutsOpen = true) }
])

const items = computed(() => {
  const q = query.value.trim()
  const all = [
    ...tabs.tabs
      .filter((t) => t.id !== tabs.activeId)
      .map((t) => ({
        group: 'Open tabs',
        label: t.request.name,
        method: t.request.method,
        detail: t.request.url,
        run: () => tabs.setActive(t.id)
      })),
    ...collections.allRequests().map((r) => ({
      group: 'Requests',
      label: r.name,
      method: r.method,
      detail: r.trail.join(' › '),
      run: () => tabs.openFile(r.path).catch(ui.error)
    })),
    ...commands.value.map((c) => ({ group: 'Commands', ...c }))
  ]
  if (!q) {
    // No query: tabs and commands first, then a few requests.
    const order = { 'Open tabs': 0, Commands: 1, Requests: 2 }
    return all.sort((a, b) => order[a.group] - order[b.group]).slice(0, MAX)
  }
  return all
    .map((item) => ({ item, score: matchScore(q, item.label, `${item.method || ''} ${item.detail || ''} ${item.group}`) }))
    .filter((r) => r.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX)
    .map((r) => r.item)
})

watch(query, () => (selected.value = 0))
watch(selected, async (i) => {
  await nextTick()
  list.value?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' })
})

function run(item) {
  close()
  item?.run()
}

function onKeydown(e) {
  const n = items.value.length
  if (e.key === 'ArrowDown') selected.value = n ? (selected.value + 1) % n : 0
  else if (e.key === 'ArrowUp') selected.value = n ? (selected.value - 1 + n) % n : 0
  else if (e.key === 'Enter') run(items.value[selected.value])
  else if (e.key === 'Escape') close()
  else return
  e.preventDefault()
}

// Show a group heading above the first item of each group.
const showGroup = (i) => i === 0 || items.value[i - 1].group !== items.value[i].group
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-center bg-black/30 pt-[12vh]" @mousedown.self="close">
    <div class="flex h-fit max-h-[70vh] w-[min(640px,92vw)] flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
      <div class="flex items-center gap-2 border-b border-line px-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref="input"
          v-model="query"
          class="h-11 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-muted/70"
          placeholder="Search requests, tabs and commands…"
          spellcheck="false"
          @keydown="onKeydown"
        />
        <span class="kbd">Esc</span>
      </div>
      <div ref="list" class="min-h-0 flex-1 overflow-y-auto py-1">
        <template v-for="(item, i) in items" :key="i">
          <div v-if="showGroup(i)" class="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
            {{ item.group }}
          </div>
          <button
            :data-index="i"
            class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px]"
            :class="i === selected ? 'bg-accent/20 text-fg' : 'text-fg/85'"
            @mousemove="selected = i"
            @click="run(item)"
          >
            <span
              v-if="item.method"
              class="w-[34px] shrink-0 text-right font-mono text-[10px] font-bold"
              :class="methodColor[item.method] || 'text-muted'"
            >
              {{ methodShort(item.method) }}
            </span>
            <span class="max-w-[60%] shrink-0 truncate" :class="!item.method && 'pl-1'">{{ item.label }}</span>
            <span v-if="item.detail" class="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{{ item.detail }}</span>
            <span v-else class="flex-1"></span>
            <span v-if="item.hint" class="shrink-0 text-[11px] text-muted">{{ item.hint }}</span>
          </button>
        </template>
        <div v-if="!items.length" class="px-4 py-6 text-center text-muted">Nothing matches "{{ query }}"</div>
      </div>
    </div>
  </div>
</template>
