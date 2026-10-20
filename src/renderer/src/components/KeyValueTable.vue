<script setup>
import { computed, reactive, ref } from 'vue'
import { createFormRow, createRow, uid } from '@/lib/model'
import VarInput from './VarInput.vue'

// Rows are edited in place (they live in the store); `change` fires after any edit.
const props = defineProps({
  rows: { type: Array, required: true },
  withFiles: { type: Boolean, default: false },
  // Adds a lock toggle per row that masks the value (environment variables).
  withSecrets: { type: Boolean, default: false },
  keyPlaceholder: { type: String, default: 'Key' },
  valuePlaceholder: { type: String, default: 'Value' },
  keySuggestions: { type: Array, default: () => [] }
})
const emit = defineEmits(['change'])

const listId = `kv-${uid()}`
const make = () => (props.withFiles ? createFormRow() : createRow(props.withSecrets ? { secret: false } : {}))

// A trailing blank row: typing into it promotes it to a real row.
const ghost = ref(make())
const displayRows = computed(() => [...props.rows, ghost.value])
const revealed = reactive(new Set())

function edit(row, field, value) {
  row[field] = value
  if (row === ghost.value) {
    props.rows.push(row)
    ghost.value = make()
  }
  emit('change')
}

function remove(row) {
  const index = props.rows.indexOf(row)
  if (index >= 0) props.rows.splice(index, 1)
  emit('change')
}

async function pickFile(row) {
  const path = await window.sar.dialog.pickFile()
  if (path) edit(row, 'path', path)
}

const fileName = (path) => path.split(/[\\/]/).pop()
const cellClass = (row) => ['input-bare font-mono text-[12px]', !row.enabled && 'text-muted line-through']
</script>

<template>
  <div class="overflow-hidden rounded-md border border-line">
    <datalist v-if="keySuggestions.length" :id="listId">
      <option v-for="s in keySuggestions" :key="s" :value="s" />
    </datalist>
    <div
      v-for="row in displayRows"
      :key="row.id"
      class="group flex items-center border-b border-line last:border-b-0"
      :class="row === ghost ? 'opacity-70' : ''"
    >
      <label class="flex w-8 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          class="accent-[rgb(var(--sar-accent))]"
          :checked="row.enabled"
          :disabled="row === ghost"
          @change="edit(row, 'enabled', $event.target.checked)"
        />
      </label>
      <VarInput
        wrapper-class="flex-1 self-stretch border-l border-line"
        :input-class="cellClass(row)"
        :model-value="row.key"
        :placeholder="keyPlaceholder"
        :list="keySuggestions.length ? listId : undefined"
        @update:model-value="edit(row, 'key', $event)"
      />
      <select
        v-if="withFiles"
        class="h-8 w-[70px] shrink-0 border-l border-line bg-transparent px-1 text-[12px] text-muted outline-none"
        :value="row.type"
        @change="edit(row, 'type', $event.target.value)"
      >
        <option value="text" class="bg-panel">Text</option>
        <option value="file" class="bg-panel">File</option>
      </select>
      <div class="flex flex-[1.4] items-center self-stretch border-l border-line">
        <template v-if="withFiles && row.type === 'file'">
          <button class="btn-ghost ml-1 h-6 text-[12px]" @click="pickFile(row)">Choose file…</button>
          <span class="truncate px-2 text-[12px] text-muted" :title="row.path">
            {{ row.path ? fileName(row.path) : 'No file selected' }}
          </span>
        </template>
        <VarInput
          v-else
          wrapper-class="flex-1"
          :input-class="cellClass(row)"
          :type="withSecrets && row.secret && !revealed.has(row.id) ? 'password' : 'text'"
          :model-value="row.value"
          :placeholder="valuePlaceholder"
          @update:model-value="edit(row, 'value', $event)"
        />
        <template v-if="withSecrets && row !== ghost">
          <button
            v-if="row.secret"
            class="flex h-8 w-7 shrink-0 items-center justify-center text-muted hover:text-fg"
            :title="revealed.has(row.id) ? 'Hide value' : 'Show value'"
            @click="revealed.has(row.id) ? revealed.delete(row.id) : revealed.add(row.id)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              <path v-if="revealed.has(row.id)" d="M3 3l18 18" />
            </svg>
          </button>
          <button
            class="flex h-8 w-7 shrink-0 items-center justify-center"
            :class="row.secret ? 'text-warning' : 'text-muted/60 hover:text-fg'"
            :title="row.secret ? 'Secret (value is masked) — click to unmark' : 'Mark as secret'"
            @click="edit(row, 'secret', !row.secret)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path :d="row.secret ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'" />
            </svg>
          </button>
        </template>
      </div>
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
        :class="row === ghost && 'invisible'"
        title="Remove"
        @click="remove(row)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
