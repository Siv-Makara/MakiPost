<script setup>
import { computed, onMounted, ref } from 'vue'
import { matchesAllWords } from '@/lib/search'
import { useCollectionsStore } from '@/stores/collections'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import TreeNode from './TreeNode.vue'
import HistoryPanel from './HistoryPanel.vue'

const VIEWS = [
  { id: 'collections', label: 'Collections' },
  { id: 'history', label: 'History' }
]

const store = useCollectionsStore()
const history = useHistoryStore()
const ui = useUiStore()

function openImportMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  ui.openMenu({ clientX: rect.left, clientY: rect.bottom + 4 }, [
    { label: 'Postman collection…', action: () => store.importPostman() },
    { label: 'cURL command…', action: () => (ui.curlImport = true) }
  ])
}
const view = computed(() => ui.sidebarView)
const setView = (id) => (ui.sidebarView = id)

// Filter: keep requests whose method, name or folder names match; a matching folder keeps everything in it.
const filter = ref('')
const filterInput = ref(null)
const clearFilter = () => {
  filter.value = ''
  filterInput.value?.focus()
}
const shown = computed(() => {
  const q = filter.value.trim()
  if (!q) return store.collections
  const prune = (node, trail) => {
    const text = `${trail} ${node.name} ${node.method || ''}`
    if (node.type === 'request') return matchesAllWords(q, text) ? node : null
    if (node.type !== 'collection' && matchesAllWords(q, text)) return node
    const children = (node.children || []).map((c) => prune(c, `${trail} ${node.name}`)).filter(Boolean)
    return children.length ? { ...node, children } : null
  }
  return store.collections.map((c) => prune(c, '')).filter(Boolean)
})
const targetName = computed(() => {
  const dir = store.targetDir()
  return dir ? `"${store.findNode(dir)?.name ?? dir}"` : 'a new collection'
})
onMounted(() => store.refresh())
</script>

<template>
  <aside class="flex h-full flex-col">
    <div class="flex h-9 shrink-0 items-stretch border-b border-line pl-1 pr-1.5">
      <button
        v-for="v in VIEWS"
        :key="v.id"
        class="tab h-9 shrink-0 whitespace-nowrap px-2 text-[11px] font-semibold uppercase tracking-wider"
        :class="view === v.id && 'tab-active'"
        @click="setView(v.id)"
      >
        {{ v.label }}
        <span v-if="v.id === 'history' && history.entries.length" class="ml-0.5 font-normal normal-case text-muted">
          {{ history.entries.length }}
        </span>
      </button>
      <div v-if="view === 'collections'" class="ml-auto flex min-w-0 items-center overflow-hidden">
        <button class="btn-ghost h-6 w-6 px-0" :title="`New request in ${targetName}`" @click="store.createInTarget('request')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M12 18v-6M9 15h6" />
          </svg>
        </button>
        <button class="btn-ghost h-6 w-6 px-0" :title="`New folder in ${targetName}`" @click="store.createInTarget('folder')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            <path d="M12 10v6M9 13h6" />
          </svg>
        </button>
        <button class="btn-ghost h-6 w-6 px-0" title="Import (Postman collection, cURL)" @click="openImportMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
        <button class="btn-ghost h-6 w-6 px-0" title="Open or create a collection folder" @click="store.openFolder()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button class="btn-ghost h-6 w-6 px-0" title="Refresh" @click="store.refresh()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
    </div>

    <HistoryPanel v-if="view === 'history'" class="min-h-0 flex-1" />

    <div v-if="view === 'collections' && store.collections.length" class="shrink-0 px-2 pt-2">
      <div class="flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface/50 px-2 focus-within:border-accent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" class="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref="filterInput"
          v-model="filter"
          class="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-muted/70"
          placeholder="Filter requests"
          spellcheck="false"
          @keydown.esc="filter = ''"
        />
        <button v-if="filter" class="text-muted hover:text-fg" title="Clear filter" @click="clearFilter">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>

    <div v-if="view === 'collections'" class="min-h-0 flex-1 overflow-y-auto py-1">
      <TreeNode v-for="c in shown" :key="c.path" :node="c" :siblings="shown" :filtering="!!filter.trim()" />
      <div v-if="filter.trim() && !shown.length" class="px-4 py-6 text-center text-[12px] text-muted">
        No requests match "{{ filter.trim() }}"
      </div>

      <div v-if="!store.collections.length" class="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <div class="text-[12.5px] text-fg/90">No collections yet</div>
        <p class="text-[12px] leading-relaxed text-muted">
          A collection is a folder on your computer. Each request is saved as its own JSON file, so you can commit it to Git.
        </p>
        <button class="btn-accent h-8 text-[12px]" @click="store.openFolder()">Open collection folder</button>
        <button class="btn h-8 text-[12px]" @click="store.importPostman()">Import Postman collection</button>
      </div>
    </div>
  </aside>
</template>
