<script setup>
import { ref, watch } from 'vue'
import { isHex } from '@/lib/color'

const model = defineModel({ type: String, required: true })
defineProps({ label: { type: String, required: true }, hint: { type: String, default: '' } })

// The text field only commits valid hex values, so typing "#12" doesn't break the theme.
const draft = ref(model.value)
watch(model, (v) => (draft.value = v))

function onText(value) {
  draft.value = value
  if (isHex(value)) model.value = value.startsWith('#') ? value : `#${value}`
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="w-36">
      <div class="text-[12.5px] text-fg">{{ label }}</div>
      <div v-if="hint" class="text-[11px] text-muted">{{ hint }}</div>
    </div>
    <label class="relative h-8 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line">
      <span class="absolute inset-0" :style="{ background: model }"></span>
      <input v-model="model" type="color" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
    <input
      class="input w-28 font-mono text-[12px] uppercase"
      :value="draft"
      maxlength="7"
      spellcheck="false"
      @input="onText($event.target.value)"
      @blur="draft = model"
    />
  </div>
</template>
