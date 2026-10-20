<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const el = ref(null)
const pos = ref({ left: 0, top: 0 })

// Keep the menu inside the window.
watch(
  () => ui.contextMenu,
  async (menu) => {
    if (!menu) return
    pos.value = { left: menu.x, top: menu.y }
    await nextTick()
    const rect = el.value.getBoundingClientRect()
    pos.value = {
      left: Math.min(menu.x, window.innerWidth - rect.width - 6),
      top: Math.min(menu.y, window.innerHeight - rect.height - 6)
    }
  }
)

function run(item) {
  ui.contextMenu = null
  item.action()
}

const close = () => (ui.contextMenu = null)
const onKey = (e) => e.key === 'Escape' && close()
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', close)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur', close)
})
</script>

<template>
  <div v-if="ui.contextMenu" class="fixed inset-0 z-50" @mousedown.self="close" @contextmenu.prevent="close">
    <div
      ref="el"
      class="fixed min-w-[180px] rounded-md border border-line bg-panel py-1 text-[12.5px] shadow-2xl"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    >
      <template v-for="(item, i) in ui.contextMenu.items" :key="i">
        <div v-if="item.separator" class="my-1 h-px bg-line"></div>
        <button
          v-else
          class="block w-full px-3 py-1.5 text-left hover:bg-accent hover:text-accent-fg"
          :class="item.danger ? 'text-danger' : 'text-fg'"
          @click="run(item)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>
