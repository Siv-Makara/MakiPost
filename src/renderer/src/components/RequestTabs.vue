<script setup>
import { nextTick, ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useCollectionsStore } from '@/stores/collections'
import { methodColor } from '@/lib/format'
import { curlMenuItems } from '@/lib/actions'
import { useUiStore } from '@/stores/ui'

const store = useTabsStore()
const collections = useCollectionsStore()
const renamingId = ref(null)
const renameInput = ref(null)
const ui = useUiStore()

function onContextMenu(event, tab) {
  const index = store.tabs.indexOf(tab)
  const others = store.tabs.filter((t) => t.id !== tab.id).map((t) => t.id)
  const right = store.tabs.slice(index + 1).map((t) => t.id)
  const saved = store.tabs.filter((t) => !store.isDirty(t)).map((t) => t.id)
  ui.openMenu(event, [
    { label: 'Close', action: () => store.closeTab(tab.id) },
    ...(others.length ? [{ label: 'Close Others', action: () => store.closeMany(others) }] : []),
    ...(right.length ? [{ label: 'Close to the Right', action: () => store.closeMany(right) }] : []),
    ...(saved.length ? [{ label: 'Close Saved', action: () => store.closeMany(saved) }] : []),
    { separator: true },
    { label: 'Duplicate', action: () => store.duplicateTab(tab.id) },
    { label: 'Rename', action: () => startRename(tab) },
    ...(tab.filePath ? [{ label: 'Show in Sidebar', action: () => collections.locate(tab.filePath) }] : []),
    { separator: true },
    ...curlMenuItems(() => tab.request)
  ])
}

async function startRename(tab) {
  renamingId.value = tab.id
  await nextTick()
  renameInput.value?.[0]?.select()
}

function finishRename(tab, value) {
  if (renamingId.value !== tab.id) return
  renamingId.value = null
  const name = value.trim()
  if (!name || name === tab.request.name) return
  // Saved requests are renamed on disk too, so the file name follows.
  if (tab.filePath) {
    const node = collections.findNode(tab.filePath)
    if (node) return collections.rename(node, name)
  }
  tab.request.name = name
}
</script>

<template>
  <div class="flex h-9 shrink-0 items-stretch border-b border-line">
    <div class="flex min-w-0 flex-1 items-stretch overflow-x-auto [&::-webkit-scrollbar]:h-0">
      <div
        v-for="tab in store.tabs"
        :key="tab.id"
        class="group relative flex max-w-[220px] shrink-0 cursor-pointer items-center gap-2 border-r border-line pl-3 pr-1.5"
        :class="tab.id === store.activeId ? 'bg-surface/50 text-fg' : 'text-muted hover:bg-surface/30 hover:text-fg'"
        @click="store.setActive(tab.id)"
        @mousedown.middle.prevent="store.closeTab(tab.id)"
        @dblclick="startRename(tab)"
        @contextmenu.prevent="onContextMenu($event, tab)"
      >
        <span
          v-if="tab.id === store.activeId"
          class="absolute inset-x-0 top-0 h-0.5 bg-accent"
        ></span>
        <span class="font-mono text-[10.5px] font-bold" :class="methodColor[tab.request.method]">
          {{ tab.request.method }}
        </span>
        <input
          v-if="renamingId === tab.id"
          ref="renameInput"
          class="w-32 rounded bg-surface px-1 text-[12px] text-fg outline-none ring-1 ring-accent"
          :value="tab.request.name"
          @blur="finishRename(tab, $event.target.value)"
          @keydown.enter="$event.target.blur()"
          @keydown.esc="renamingId = null"
          @click.stop
        />
        <span v-else class="truncate text-[12px]" :class="!tab.filePath && 'italic'" :title="tab.filePath || 'Not saved yet'">
          {{ tab.request.name }}
        </span>
        <span v-if="tab.loading" class="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"></span>
        <button
          class="group/close relative flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg"
          :title="store.isDirty(tab) ? 'Unsaved changes — close tab' : 'Close tab'"
          @click.stop="store.closeTab(tab.id)"
        >
          <!-- Unsaved: a dot that turns into × on hover (like most editors) -->
          <span v-if="store.isDirty(tab)" class="h-2 w-2 rounded-full bg-fg/70 group-hover/close:hidden"></span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            :class="[
              store.isDirty(tab) ? 'hidden group-hover/close:block' : 'opacity-0 group-hover:opacity-100',
              !store.isDirty(tab) && tab.id === store.activeId && 'opacity-100'
            ]"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <button class="flex w-9 shrink-0 items-center justify-center text-muted hover:text-fg" title="New tab" @click="store.openTab()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>
</template>
