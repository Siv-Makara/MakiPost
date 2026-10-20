<script setup>
import { computed, nextTick, ref } from 'vue'
import { useEnvironmentsStore } from '@/stores/environments'
import { hasVars, segments } from '@/lib/variables'

// A single-line input that highlights {{variables}} and autocompletes them.
// Highlighting works by drawing the text in a backdrop layer behind the input,
// whose own text is made transparent (the caret and selection stay visible).
defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' },
  // Classes shared by the input and its backdrop (padding, font, size) so they line up.
  inputClass: { type: [String, Array, Object], default: '' },
  wrapperClass: { type: [String, Array, Object], default: '' }
})
const emit = defineEmits(['update:modelValue'])

const env = useEnvironmentsStore()
const input = ref(null)
const scrollLeft = ref(0)

const overlay = computed(() => props.type === 'text' && hasVars(props.modelValue))
const parts = computed(() => (overlay.value ? segments(props.modelValue) : []))

function syncScroll() {
  scrollLeft.value = input.value?.scrollLeft || 0
}

// --- autocomplete -------------------------------------------------------------

const suggest = ref(null) // { items, index, start, caret, left, top, width }

function updateSuggest() {
  const el = input.value
  if (!el || props.type !== 'text' || el.selectionStart !== el.selectionEnd) return (suggest.value = null)
  const caret = el.selectionStart
  const match = /\{\{\s*([\w.$-]*)$/.exec(el.value.slice(0, caret))
  if (!match) return (suggest.value = null)
  const items = env.suggestions(match[1]).slice(0, 50)
  if (!items.length) return (suggest.value = null)
  const rect = el.getBoundingClientRect()
  const index = suggest.value ? Math.min(suggest.value.index, items.length - 1) : 0
  suggest.value = {
    items,
    index,
    start: match.index,
    caret,
    left: rect.left,
    top: rect.bottom + 4,
    width: Math.max(rect.width, 280)
  }
}

function choose(item) {
  const s = suggest.value
  const value = props.modelValue
  // Swallow the rest of a half-typed name and any closing braces after the caret.
  const after = value.slice(s.caret).replace(/^[\w.$-]*\s*\}?\}?/, '')
  const inserted = `{{${item.name}}}`
  emit('update:modelValue', value.slice(0, s.start) + inserted + after)
  suggest.value = null
  nextTick(() => {
    const pos = s.start + inserted.length
    input.value.focus()
    input.value.setSelectionRange(pos, pos)
    syncScroll()
  })
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
  nextTick(() => {
    syncScroll()
    updateSuggest()
  })
}

function onKeydown(event) {
  const s = suggest.value
  if (!s || event.ctrlKey || event.metaKey) return
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
  if (step) {
    s.index = (s.index + step + s.items.length) % s.items.length
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    choose(s.items[s.index])
  } else if (event.key === 'Escape') {
    suggest.value = null
  } else {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

function onCaretMove(event) {
  syncScroll()
  if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) updateSuggest()
}

const tone = (name) => (env.isDefined(name) ? 'rounded-sm bg-success/15 text-success' : 'rounded-sm bg-danger/15 text-danger')

defineExpose({ focus: () => input.value?.focus(), select: () => input.value?.select() })
</script>

<template>
  <div class="relative min-w-0" :class="wrapperClass">
    <div
      v-if="overlay"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre"
      :class="inputClass"
    >
      <span :style="{ transform: `translateX(${-scrollLeft}px)` }"
        ><template v-for="(part, i) in parts" :key="i"
          ><span v-if="part.name" :class="tone(part.name)">{{ part.text }}</span
          ><template v-else>{{ part.text }}</template></template
        ></span
      >
    </div>
    <input
      v-bind="$attrs"
      ref="input"
      class="relative"
      :class="inputClass"
      :style="overlay ? { color: 'transparent', background: 'transparent', caretColor: 'rgb(var(--sar-text))' } : null"
      :type="type"
      :value="modelValue"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @scroll="syncScroll"
      @keydown="onKeydown"
      @keyup="onCaretMove"
      @click="onCaretMove"
      @blur="suggest = null"
    />

    <Teleport to="body">
      <div
        v-if="suggest"
        data-var-suggest
        class="fixed z-[70] max-h-64 overflow-y-auto rounded-md border border-line bg-panel py-1 shadow-2xl"
        :style="{ left: `${suggest.left}px`, top: `${suggest.top}px`, width: `${suggest.width}px` }"
      >
        <button
          v-for="(item, i) in suggest.items"
          :key="item.name"
          class="flex w-full items-center gap-3 px-3 py-1.5 text-left text-[12px]"
          :class="i === suggest.index ? 'bg-accent text-accent-fg' : 'text-fg hover:bg-surface'"
          @mousedown.prevent="choose(item)"
          @mouseenter="suggest.index = i"
        >
          <span class="shrink-0 font-mono">{{ item.name }}</span>
          <span class="min-w-0 flex-1 truncate font-mono opacity-70">{{ item.secret ? '••••••' : item.value }}</span>
          <span class="shrink-0 text-[10.5px] opacity-70">{{ item.source }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
