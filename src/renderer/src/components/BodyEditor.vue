<script setup>
import { computed, ref } from 'vue'
import { BODY_MODES, RAW_TYPES } from '@/lib/model'
import CodeEditor from './CodeEditor.vue'
import KeyValueTable from './KeyValueTable.vue'

const props = defineProps({ body: { type: Object, required: true } })

const jsonError = ref('')

const rawLanguage = computed(() => {
  if (props.body.rawType.includes('xml')) return 'xml'
  if (props.body.rawType.includes('html')) return 'html'
  return 'text'
})

function prettify() {
  try {
    props.body.json = JSON.stringify(JSON.parse(props.body.json), null, 2)
    jsonError.value = ''
  } catch (err) {
    jsonError.value = err.message
  }
}

function onJsonInput(value) {
  props.body.json = value
  jsonError.value = ''
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2">
      <label
        v-for="mode in BODY_MODES"
        :key="mode.id"
        class="flex cursor-pointer items-center gap-1.5 text-[12px]"
        :class="body.mode === mode.id ? 'text-fg' : 'text-muted hover:text-fg'"
      >
        <input v-model="body.mode" type="radio" :value="mode.id" class="accent-[rgb(var(--sar-accent))]" />
        {{ mode.label }}
      </label>

      <div class="ml-auto flex items-center gap-2">
        <select v-if="body.mode === 'raw'" v-model="body.rawType" class="select h-7 text-[12px]">
          <option v-for="r in RAW_TYPES" :key="r.id" :value="r.id">{{ r.label }}</option>
        </select>
        <template v-if="body.mode === 'json'">
          <span v-if="jsonError" class="max-w-[260px] truncate text-[11px] text-danger" :title="jsonError">
            {{ jsonError }}
          </span>
          <button class="btn-ghost text-[12px]" @click="prettify">Beautify</button>
        </template>
      </div>
    </div>

    <div v-if="body.mode === 'none'" class="flex flex-1 items-center justify-center text-muted">
      This request has no body.
    </div>

    <div v-else-if="body.mode === 'json'" class="min-h-0 flex-1 overflow-hidden rounded-md border border-line">
      <CodeEditor
        :model-value="body.json"
        language="json"
        variables
        placeholder='{ "name": "{{userName}}" }'
        @update:model-value="onJsonInput"
      />
    </div>

    <div v-else-if="body.mode === 'raw'" class="min-h-0 flex-1 overflow-hidden rounded-md border border-line">
      <CodeEditor v-model="body.raw" :language="rawLanguage" variables />
    </div>

    <div v-else-if="body.mode === 'form-data'" class="min-h-0 flex-1 overflow-auto">
      <KeyValueTable :rows="body.formData" with-files />
    </div>

    <div v-else-if="body.mode === 'urlencoded'" class="min-h-0 flex-1 overflow-auto">
      <KeyValueTable :rows="body.urlencoded" />
    </div>
  </div>
</template>
