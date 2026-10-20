<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { METHODS } from '@/lib/model'
import { methodColor } from '@/lib/format'

const model = defineModel({ type: String, required: true })
const open = ref(false)
const root = ref(null)

function choose(method) {
  model.value = method
  open.value = false
}

const onDocClick = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="root" class="relative">
    <button
      class="flex h-9 w-[104px] items-center justify-between rounded-l-md border-r border-line px-3 font-mono text-[12.5px] font-bold"
      :class="methodColor[model]"
      @click="open = !open"
    >
      {{ model }}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <div
      v-if="open"
      class="absolute left-0 top-10 z-30 w-36 overflow-hidden rounded-md border border-line bg-panel py-1 shadow-xl"
    >
      <button
        v-for="m in METHODS"
        :key="m"
        class="block w-full px-3 py-1.5 text-left font-mono text-[12.5px] font-bold hover:bg-surface"
        :class="methodColor[m]"
        @click="choose(m)"
      >
        {{ m }}
      </button>
    </div>
  </div>
</template>
