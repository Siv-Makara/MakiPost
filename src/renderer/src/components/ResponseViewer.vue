<script setup>
import { computed, ref, watch } from 'vue'
import { formatBytes, formatTime, prettyBody, statusTone } from '@/lib/format'
import { useUiStore } from '@/stores/ui'
import CodeEditor from './CodeEditor.vue'
import FlagKH from './FlagKH.vue'

const props = defineProps({
  tab: { type: Object, required: true }
})
const emit = defineEmits(['cancel'])
const ui = useUiStore()

// Above these sizes, pretty-printing / soft-wrapping / rendering everything gets slow.
const PRETTY_LIMIT = 5_000_000
const WRAP_LIMIT = 1_000_000
const DISPLAY_LIMIT = 10_000_000

const section = ref('body')
const view = ref('pretty')
const copied = ref(false)
const showAll = ref(false)
const editor = ref(null)

const response = computed(() => props.tab.response)
watch(response, () => (showAll.value = false))

// Only dim the view for requests that take a noticeable time.
const slow = ref(false)
let slowTimer = null
watch(
  () => props.tab.loading,
  (loading) => {
    clearTimeout(slowTimer)
    slow.value = false
    if (loading) slowTimer = setTimeout(() => (slow.value = true), 150)
  },
  { immediate: true }
)

const toneClass = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface text-muted'
}

const bodyLength = computed(() => (response.value?.ok ? response.value.body.length : 0))
const truncated = computed(() => bodyLength.value > DISPLAY_LIMIT && !showAll.value)
const canPretty = computed(() => bodyLength.value <= PRETTY_LIMIT)

const shown = computed(() => {
  const r = response.value
  if (!r?.ok) return { text: '', language: 'text' }
  const body = truncated.value ? r.body.slice(0, DISPLAY_LIMIT) : r.body
  return view.value === 'pretty' && canPretty.value ? prettyBody(body, r.contentType) : { text: body, language: 'text' }
})

// --- timing breakdown ------------------------------------------------------------

const PHASES = [
  { key: 'prepare', label: 'Prepare', color: 'bg-muted' },
  { key: 'dns', label: 'DNS lookup', color: 'bg-info' },
  { key: 'connect', label: 'TCP + TLS', color: 'bg-warning' },
  { key: 'wait', label: 'Waiting (TTFB)', color: 'bg-success' },
  { key: 'download', label: 'Download', color: 'bg-accent' }
]

const phases = computed(() => {
  const t = response.value?.timings
  if (!t) return []
  const total = PHASES.reduce((sum, p) => sum + (t[p.key] || 0), 0) || 1
  let offset = 0
  return PHASES.filter((p) => t[p.key] != null).map((p) => {
    const value = t[p.key]
    const row = { ...p, value, left: (offset / total) * 100, width: Math.max((value / total) * 100, 0.8) }
    offset += value
    return row
  })
})

const fmtMs = (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ms'

const isMac = window.sar.platform === 'darwin'

async function copyBody() {
  await navigator.clipboard.writeText(response.value.body)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

async function saveBody() {
  const r = response.value
  const ext = /json/.test(r.contentType) ? 'json' : /html/.test(r.contentType) ? 'html' : /xml/.test(r.contentType) ? 'xml' : 'txt'
  try {
    const file = await window.sar.dialog.saveText(`response.${ext}`, r.body)
    if (file) ui.toast('Response saved')
  } catch (err) {
    ui.error(err)
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- Status bar -->
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
      <button class="tab" :class="section === 'body' && 'tab-active'" @click="section = 'body'">Body</button>
      <button class="tab" :class="section === 'headers' && 'tab-active'" @click="section = 'headers'">
        Headers
        <span v-if="response?.ok" class="ml-1 text-[11px] text-accent">{{ response.headers.length }}</span>
      </button>

      <div
        v-if="response"
        class="ml-auto flex items-center gap-3 pr-2 text-[12px] transition-opacity"
        :class="tab.loading && 'opacity-50'"
      >
        <template v-if="response.ok">
          <span
            class="rounded px-2 py-0.5 font-mono font-semibold"
            :class="toneClass[statusTone(response.status)]"
            :title="response.url"
          >
            {{ response.status }} {{ response.statusText }}
          </span>

          <!-- Time, with a breakdown on hover -->
          <div class="group relative">
            <span class="cursor-default text-muted">
              Time <span class="text-fg underline decoration-dotted underline-offset-2">{{ formatTime(response.time) }}</span>
            </span>
            <div
              v-if="phases.length"
              class="invisible absolute right-0 top-full z-30 mt-2 w-80 rounded-md border border-line bg-panel p-3 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100"
            >
              <div class="mb-2 flex items-center text-[11.5px]">
                <span class="font-semibold text-fg">Timing</span>
                <span
                  class="ml-auto rounded px-1.5 py-0.5 text-[10.5px]"
                  :class="response.timings.reused ? 'bg-success/15 text-success' : 'bg-surface text-muted'"
                >
                  {{ response.timings.reused ? 'Reused connection' : 'New connection' }}
                </span>
              </div>
              <div v-for="p in phases" :key="p.key" class="flex items-center gap-2 py-0.5 text-[11.5px]">
                <span class="w-24 shrink-0 text-muted">{{ p.label }}</span>
                <div class="relative h-2 flex-1 rounded-full bg-surface">
                  <div class="absolute inset-y-0 rounded-full" :class="p.color" :style="{ left: `${p.left}%`, width: `${p.width}%` }"></div>
                </div>
                <span class="w-14 shrink-0 text-right font-mono text-fg">{{ fmtMs(p.value) }}</span>
              </div>
              <p v-if="!response.timings.reused" class="mt-2 text-[10.5px] leading-snug text-muted">
                The next request to this host reuses the connection and skips DNS + TCP + TLS.
              </p>
            </div>
          </div>

          <span class="text-muted">Size <span class="text-fg">{{ formatBytes(response.size) }}</span></span>
        </template>
        <span v-else class="rounded bg-danger/15 px-2 py-0.5 font-semibold text-danger">
          {{ response.cancelled ? 'Cancelled' : response.timedOut ? 'Timed out' : 'Error' }}
        </span>
      </div>
    </div>

    <!--
      The previous response stays mounted while a request is in flight (rebuilding the
      editor on every send costs more than a fast request itself). A progress bar shows
      at once; the dimming overlay only appears if the request is slow.
    -->
    <div class="relative flex min-h-0 flex-1 flex-col">
    <div v-if="tab.loading" class="sar-progress absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden"></div>
    <div
      v-if="tab.loading && slow"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-panel/75 text-muted"
    >
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent"></div>
      <span>Sending request…</span>
      <button class="btn" @click="emit('cancel')">Cancel</button>
    </div>

    <!-- Empty -->
    <div v-if="!response" class="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
      <div class="flex items-center gap-2 text-2xl font-semibold text-fg/80">ខ្មែរ <FlagKH :height="20" /></div>
      <div>
        Press <span class="kbd">{{ isMac ? '⌘' : 'Ctrl' }}</span> + <span class="kbd">Enter</span> to send the
        request
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="!response.ok" class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <div class="font-semibold text-danger">
        {{ response.cancelled ? 'Request cancelled' : response.timedOut ? 'Request timed out' : 'Could not send request' }}
      </div>
      <div v-if="!response.cancelled" class="max-w-lg select-text font-mono text-[12px] text-muted">
        {{ response.error }}
      </div>
    </div>

    <!-- Body -->
    <div v-else-if="section === 'body'" class="flex min-h-0 flex-1 flex-col">
      <div v-if="!response.imageBase64" class="flex items-center gap-1 px-3 pt-2">
        <button
          v-for="v in ['pretty', 'raw']"
          :key="v"
          class="rounded px-2 py-0.5 text-[12px] capitalize disabled:opacity-40"
          :class="view === v && (v === 'raw' || canPretty) ? 'bg-surface text-fg' : 'text-muted hover:text-fg'"
          :disabled="v === 'pretty' && !canPretty"
          :title="v === 'pretty' && !canPretty ? 'Too large to pretty-print quickly' : ''"
          @click="view = v"
        >
          {{ v }}
        </button>
        <span class="ml-2 truncate text-[11px] text-muted/80">{{ response.contentType }}</span>
        <button class="btn-ghost ml-auto text-[12px]" :title="`Find (${isMac ? '⌘' : 'Ctrl'}+F)`" @click="editor?.find()">Find</button>
        <button class="btn-ghost text-[12px]" @click="saveBody">Save…</button>
        <button class="btn-ghost text-[12px]" @click="copyBody">{{ copied ? 'Copied' : 'Copy' }}</button>
      </div>
      <div
        v-if="truncated"
        class="mx-3 mt-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-[12px] text-warning"
      >
        Large response ({{ formatBytes(response.size) }}) — showing the first {{ formatBytes(DISPLAY_LIMIT) }}.
        <button class="ml-auto underline" @click="showAll = true">Show all</button>
        <button class="underline" @click="saveBody">Save to file</button>
      </div>
      <div v-if="response.imageBase64" class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <img :src="`data:${response.contentType};base64,${response.imageBase64}`" class="max-h-full max-w-full" />
      </div>
      <div v-else-if="!response.body" class="flex flex-1 items-center justify-center text-muted">Empty response body</div>
      <div v-else class="min-h-0 flex-1 pt-1">
        <CodeEditor ref="editor" :model-value="shown.text" :language="shown.language" :wrap="shown.text.length <= WRAP_LIMIT" readonly />
      </div>
    </div>

    <!-- Headers -->
    <div v-else class="min-h-0 flex-1 overflow-auto p-3">
      <table class="w-full select-text border-collapse text-[12px]">
        <tbody>
          <tr v-for="([key, value], i) in response.headers" :key="i" class="border-b border-line last:border-0">
            <td class="w-1/3 py-1.5 pr-4 align-top font-mono font-medium text-fg">{{ key }}</td>
            <td class="break-all py-1.5 font-mono text-muted">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </div>
</template>
