<script setup>
import { computed } from 'vue'
import { evaluate } from '@/lib/capture'
import { useEnvironmentsStore } from '@/stores/environments'
import KeyValueTable from './KeyValueTable.vue'

const props = defineProps({ tab: { type: Object, required: true } })
const env = useEnvironmentsStore()

const target = computed(() => (env.active ? `the "${env.active.name}" environment` : 'Globals (no environment is active)'))
const rules = computed(() => props.tab.request.captures.filter((c) => c.key.trim() && c.value.trim()))

// What each rule would capture from the response currently shown.
const preview = computed(() => {
  const response = props.tab.response
  if (!response?.ok) return []
  return rules.value.map((rule) => ({ rule, result: evaluate(rule.value, response) }))
})

const EXAMPLES = [
  ['body.token', 'a field in a JSON body'],
  ['body.data.items[0].id', 'nested fields and array items ([-1] = last)'],
  ['$.access_token', 'JSONPath style, same as body.access_token'],
  ['header.x-request-id', 'a response header'],
  ['cookie.session', 'a cookie from Set-Cookie'],
  ['status', 'the HTTP status code']
]

const short = (v) => (v.length > 80 ? `${v.slice(0, 80)}…` : v)
</script>

<template>
  <div class="flex max-w-4xl flex-col gap-4">
    <p class="text-[12px] leading-relaxed text-muted">
      After each response, save values from it into variables, e.g. capture a login token once and use
      <code v-pre class="font-mono text-fg/90">{{token}}</code> in every other request. Values are saved to
      <span class="text-fg">{{ target }}</span>.
    </p>

    <KeyValueTable :rows="tab.request.captures" key-placeholder="Variable name" value-placeholder="body.token" />

    <!-- live preview against the last response -->
    <div v-if="preview.length" class="rounded-md border border-line">
      <div class="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Preview from the last response
      </div>
      <div v-for="{ rule, result } in preview" :key="rule.id" class="flex items-center gap-3 px-3 py-1.5 font-mono text-[12px]">
        <span class="w-36 shrink-0 truncate text-fg">{{ rule.key }}</span>
        <span class="text-muted">←</span>
        <span class="w-48 shrink-0 truncate text-muted">{{ rule.value }}</span>
        <span v-if="result.found" class="min-w-0 flex-1 truncate text-success" :title="result.value">{{ short(result.value) }}</span>
        <span v-else class="min-w-0 flex-1 truncate text-danger">{{ result.error || 'not found' }}</span>
      </div>
    </div>
    <p v-else-if="rules.length" class="text-[12px] text-muted">Send the request to preview what these rules capture.</p>

    <div class="text-[12px]">
      <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">What you can capture</div>
      <div v-for="[expr, text] in EXAMPLES" :key="expr" class="flex gap-3 py-0.5">
        <code class="w-48 shrink-0 font-mono text-fg/90">{{ expr }}</code>
        <span class="text-muted">{{ text }}</span>
      </div>
    </div>
  </div>
</template>
