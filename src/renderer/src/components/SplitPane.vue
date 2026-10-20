<script setup>
import { ref } from 'vue'

// Two panes with a draggable divider. The ratio is remembered per `storageKey`.
const props = defineProps({
  direction: { type: String, default: 'vertical' }, // 'vertical' = stacked top/bottom
  initial: { type: Number, default: 0.5 },
  min: { type: Number, default: 0.15 },
  storageKey: { type: String, default: '' },
  gutter: { type: Number, default: 0 } // > 0: a transparent gap of this many px instead of a 1px line
})

const stored = props.storageKey ? Number(localStorage.getItem(`sar:split:${props.storageKey}`)) : 0
const ratio = ref(stored > 0 && stored < 1 ? stored : props.initial)
const root = ref(null)
const dragging = ref(false)
const vertical = props.direction === 'vertical'

function startDrag(event) {
  event.preventDefault()
  dragging.value = true
  const rect = root.value.getBoundingClientRect()
  const move = (e) => {
    const pos = vertical ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width
    ratio.value = Math.min(1 - props.min, Math.max(props.min, pos))
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (props.storageKey) localStorage.setItem(`sar:split:${props.storageKey}`, String(ratio.value))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
</script>

<template>
  <div ref="root" class="flex h-full min-h-0 w-full min-w-0" :class="vertical ? 'flex-col' : 'flex-row'">
    <div class="min-h-0 min-w-0 overflow-hidden" :style="{ flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 }">
      <slot name="first" />
    </div>
    <div
      class="group relative shrink-0"
      :class="[
        vertical ? 'cursor-row-resize' : 'cursor-col-resize',
        gutter ? '' : vertical ? 'h-px bg-line' : 'w-px bg-line'
      ]"
      :style="gutter ? { [vertical ? 'height' : 'width']: `${gutter}px` } : {}"
      @pointerdown="startDrag"
    >
      <!-- wider invisible hit area -->
      <div class="absolute" :class="vertical ? '-top-1 -bottom-1 inset-x-0' : '-left-1 -right-1 inset-y-0'"></div>
      <div
        class="absolute bg-accent opacity-0 transition-opacity group-hover:opacity-100"
        :class="[
          gutter
            ? vertical ? 'inset-x-2 top-1/2 h-[3px] -translate-y-1/2 rounded-full' : 'inset-y-2 left-1/2 w-[3px] -translate-x-1/2 rounded-full'
            : vertical ? 'inset-x-0 -top-px h-[3px]' : 'inset-y-0 -left-px w-[3px]',
          dragging && 'opacity-100'
        ]"
      ></div>
    </div>
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <slot name="second" />
    </div>
    <!-- prevents iframes/editors from swallowing pointer events mid-drag -->
    <div v-if="dragging" class="fixed inset-0 z-50" :class="vertical ? 'cursor-row-resize' : 'cursor-col-resize'"></div>
  </div>
</template>
