<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { methodColor, methodShort } from '@/lib/format'
import { curlMenuItems } from '@/lib/actions'
import { fromFile } from '@/lib/requestFile'

const props = defineProps({
  node: { type: Object, required: true },
  siblings: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 },
  // While the sidebar is filtered, every folder shown is open.
  filtering: { type: Boolean, default: false }
})

const store = useCollectionsStore()
const tabs = useTabsStore()
const ui = useUiStore()

const SEP = window.sar.platform === 'win32' ? '\\' : '/'
const REVEAL_LABEL = { win32: 'Show in Explorer', darwin: 'Reveal in Finder' }[window.sar.platform] || 'Show in Folder'

const isContainer = computed(() => props.node.type !== 'request')
const isOpen = computed(() => props.filtering || store.expanded.has(props.node.path))
const isActive = computed(() => props.node.type === 'request' && tabs.activeTab?.filePath === props.node.path)
const renaming = computed(() => store.renamingPath === props.node.path)

const renameInput = ref(null)
watch(
  renaming,
  async (on) => {
    if (!on) return
    await nextTick()
    renameInput.value?.focus()
    renameInput.value?.select()
  },
  { immediate: true }
)

function commitRename(event) {
  if (store.renamingPath === props.node.path) store.rename(props.node, event.target.value)
}

const isSelected = computed(() => isContainer.value && store.selectedPath === props.node.path)

function onClick() {
  if (renaming.value) return
  store.selectedPath = props.node.path
  if (isContainer.value) store.toggle(props.node.path)
  else tabs.openFile(props.node.path).catch(ui.error)
}

function onContextMenu(event) {
  const n = props.node
  const items = []
  if (isContainer.value) {
    items.push(
      { label: 'New Request', action: () => store.newRequest(n.path) },
      { label: 'New Folder', action: () => store.newFolder(n.path) },
      { separator: true }
    )
  } else {
    items.push(
      { label: 'Open', action: onClick },
      { label: 'Duplicate', action: () => store.duplicate(n) },
      ...curlMenuItems(async () => fromFile(await window.sar.collections.readRequest(n.path)))
    )
  }
  items.push({ label: 'Rename', action: () => (store.renamingPath = n.path) })
  items.push({ label: REVEAL_LABEL, action: () => store.reveal(n.path) })
  if (n.type === 'collection') {
    items.push({ label: 'Refresh', action: () => store.refresh() })
    items.push({ separator: true }, { label: 'Close Collection', action: () => store.close(n.path) })
  } else {
    items.push({ separator: true }, { label: 'Delete', danger: true, action: () => store.remove(n) })
  }
  ui.openMenu(event, items)
}

// --- drag & drop ------------------------------------------------------------

const dropZone = ref(null) // 'before' | 'after' | 'into'

function onDragStart(event) {
  if (props.node.type === 'collection' || renaming.value) return event.preventDefault()
  ui.dragPath = props.node.path
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', props.node.name)
}

function onDragEnd() {
  ui.dragPath = null
}

function canDropHere() {
  const src = ui.dragPath
  return src && src !== props.node.path && !props.node.path.startsWith(src + SEP)
}

function onDragOver(event) {
  if (!canDropHere()) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  if (props.node.type === 'collection') return (dropZone.value = 'into')
  const rect = event.currentTarget.getBoundingClientRect()
  const y = (event.clientY - rect.top) / rect.height
  if (isContainer.value) dropZone.value = y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'into'
  else dropZone.value = y < 0.5 ? 'before' : 'after'
}

function onDrop(event) {
  event.preventDefault()
  const zone = dropZone.value
  const src = ui.dragPath
  dropZone.value = null
  ui.dragPath = null
  if (!zone || !src) return

  const n = props.node
  if (zone === 'into') return store.move(src, n.path, null)
  if (zone === 'before') return store.move(src, n.dir, n.file)
  // 'after': insert before the next sibling that isn't the item being moved.
  const others = props.siblings.filter((s) => s.path !== src)
  const next = others[others.findIndex((s) => s.path === n.path) + 1]
  store.move(src, n.dir, next ? next.file : null)
}
</script>

<template>
  <div>
    <div
      class="group relative flex h-7 cursor-pointer items-center gap-1.5 pr-2 text-[12.5px]"
      :class="[
        isActive ? 'bg-accent/15 text-fg' : isSelected ? 'bg-surface text-fg' : 'text-fg/85 hover:bg-surface/70',
        dropZone === 'into' && 'bg-accent/20 ring-1 ring-inset ring-accent',
        ui.dragPath === node.path && 'opacity-40'
      ]"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      :data-path="node.path"
      :draggable="node.type !== 'collection' && !renaming && !filtering"
      @click="onClick"
      @contextmenu.prevent="onContextMenu"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="dropZone = null"
      @drop="onDrop"
    >
      <span v-if="dropZone === 'before'" class="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-accent"></span>
      <span v-if="dropZone === 'after'" class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent"></span>

      <!-- icon -->
      <template v-if="isContainer">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="shrink-0 text-muted transition-transform"
          :class="isOpen && 'rotate-90'"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <svg v-if="node.type === 'collection'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-accent">
          <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2m18 0v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-muted">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
      </template>
      <span v-else class="w-[42px] shrink-0 text-right font-mono text-[10px] font-bold" :class="methodColor[node.method] || 'text-muted'">
        {{ methodShort(node.method) }}
      </span>

      <!-- name -->
      <input
        v-if="renaming"
        ref="renameInput"
        class="h-5 min-w-0 flex-1 rounded bg-surface px-1 text-[12.5px] text-fg outline-none ring-1 ring-accent"
        :value="node.name"
        @click.stop
        @keydown.enter="$event.target.blur()"
        @keydown.esc="store.renamingPath = null"
        @blur="commitRename"
      />
      <span v-else class="min-w-0 flex-1 truncate" :class="node.type === 'collection' && 'font-semibold'" :title="node.path">
        {{ node.name }}
      </span>
      <span v-if="node.error" class="text-[10px] text-danger">{{ node.error }}</span>

      <!-- hover actions -->
      <template v-if="isContainer && !renaming && !node.error">
        <button
          class="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg group-hover:flex"
          title="New request here"
          @click.stop="store.newRequest(node.path)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M12 18v-6M9 15h6" />
          </svg>
        </button>
        <button
          class="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg group-hover:flex"
          title="New folder here"
          @click.stop="store.newFolder(node.path)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            <path d="M12 10v6M9 13h6" />
          </svg>
        </button>
      </template>
      <button
        v-if="!renaming"
        class="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-fg group-hover:flex"
        title="More actions"
        @click.stop="onContextMenu"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
    </div>

    <template v-if="isContainer && isOpen">
      <TreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :siblings="node.children"
        :depth="depth + 1"
        :filtering="filtering"
      />
      <div
        v-if="!node.children.length && !node.error && !filtering"
        class="flex h-6 items-center gap-1 text-[11.5px] text-muted/80"
        :style="{ paddingLeft: `${30 + depth * 14}px` }"
      >
        Empty —
        <button class="text-accent hover:underline" @click="store.newRequest(node.path)">add request</button>
        or
        <button class="text-accent hover:underline" @click="store.newFolder(node.path)">folder</button>
      </div>
    </template>
  </div>
</template>
