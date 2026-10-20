<script setup>
import { computed, onMounted, ref } from 'vue'
import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const tabs = useTabsStore()
const collections = useCollectionsStore()

const tab = computed(() => tabs.tabs.find((t) => t.id === ui.saveRequest?.tabId))
const name = ref(tab.value?.request.name === 'Untitled Request' ? '' : tab.value?.request.name || '')
const destinations = computed(() => collections.destinations())
const dest = ref(destinations.value[0]?.path || null)
const saving = ref(false)
const nameInput = ref(null)

onMounted(() => nameInput.value?.focus())

const close = () => (ui.saveRequest = null)

async function save() {
  if (!dest.value || !tab.value) return
  saving.value = true
  try {
    const { closeAfter } = ui.saveRequest
    await tabs.saveAs(tab.value.id, dest.value, name.value.trim() || 'Untitled Request')
    collections.expand(dest.value)
    await collections.refresh()
    close()
    if (closeAfter) tabs.closeTab(tab.value.id)
  } catch (err) {
    ui.error(err)
  } finally {
    saving.value = false
  }
}

async function openFolder() {
  await collections.openFolder()
  if (!dest.value) dest.value = destinations.value[0]?.path || null
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" @mousedown.self="close">
    <div class="w-[440px] rounded-lg border border-line bg-panel shadow-2xl" @keydown.esc="close">
      <div class="border-b border-line px-5 py-3 text-[14px] font-semibold">Save request</div>
      <div class="flex flex-col gap-4 p-5">
        <label class="flex flex-col gap-1.5">
          <span class="text-[12px] text-muted">Name</span>
          <input ref="nameInput" v-model="name" class="input" placeholder="Untitled Request" @keydown.enter="save" />
        </label>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-center">
            <span class="text-[12px] text-muted">Save to</span>
            <button class="btn-ghost ml-auto h-6 text-[12px]" @click="openFolder">+ Collection folder</button>
          </div>
          <div class="max-h-60 overflow-y-auto rounded-md border border-line py-1">
            <button
              v-for="d in destinations"
              :key="d.path"
              class="flex w-full items-center gap-2 py-1.5 pr-3 text-left text-[12.5px]"
              :class="dest === d.path ? 'bg-accent/20 text-fg' : 'text-fg/85 hover:bg-surface'"
              :style="{ paddingLeft: `${12 + d.depth * 16}px` }"
              :title="d.path"
              @click="dest = d.path"
            >
              <span :class="d.isCollection ? 'font-semibold' : ''">{{ d.name }}</span>
            </button>
            <p v-if="!destinations.length" class="px-3 py-4 text-center text-[12px] text-muted">
              No collections yet. Open or create a collection folder first.
            </p>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button class="btn" @click="close">Cancel</button>
        <button class="btn-accent" :disabled="!dest || saving" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
