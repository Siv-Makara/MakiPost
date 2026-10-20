<script setup>
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
    <div
      v-for="t in ui.toasts"
      :key="t.id"
      class="pointer-events-auto max-w-sm select-text rounded-md border bg-panel px-3 py-2 text-[12.5px] shadow-xl"
      :class="{
        'border-danger/60 text-danger': t.kind === 'error',
        'border-warning/60 text-warning': t.kind === 'warning',
        'border-line text-fg': t.kind === 'info'
      }"
    >
      {{ t.message }}
    </div>
  </div>
</template>
