<script setup>
import { computed, ref, watch } from 'vue'
import { paramsFromUrl, urlWithParams } from '@/lib/url'
import { hasVars } from '@/lib/variables'
import { looksLikeCurl, parseCurl } from '@/lib/curl'
import { curlMenuItems } from '@/lib/actions'
import { useEnvironmentsStore } from '@/stores/environments'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import MethodSelect from './MethodSelect.vue'
import CaptureEditor from './CaptureEditor.vue'
import VarInput from './VarInput.vue'
import KeyValueTable from './KeyValueTable.vue'
import BodyEditor from './BodyEditor.vue'
import AuthEditor from './AuthEditor.vue'
import RequestOptions from './RequestOptions.vue'
import { DEFAULT_OPTIONS } from '@/lib/model'

const props = defineProps({
  tab: { type: Object, required: true }
})
const emit = defineEmits(['send', 'cancel', 'save'])
const isMac = window.sar.platform === 'darwin'

const request = computed(() => props.tab.request)
const env = useEnvironmentsStore()
const tabs = useTabsStore()
const ui = useUiStore()

// Preview of the URL with variables filled in (only shown when it has variables).
const resolvedUrl = computed(() => (hasVars(request.value.url) ? env.resolve(request.value.url) : ''))

// Resolve the host's DNS in the background while the URL is being edited, so Send is faster.
let prefetchTimer = null
watch(
  () => resolvedUrl.value || request.value.url,
  (url) => {
    clearTimeout(prefetchTimer)
    if (url.trim()) prefetchTimer = setTimeout(() => window.sar.http.prefetch(url), 400)
  },
  { immediate: true }
)
const section = ref('params')

const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'If-None-Match',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Api-Key',
  'X-Requested-With'
]

const count = (rows) => rows.filter((r) => r.enabled && r.key).length
const sections = computed(() => {
  const r = request.value
  return [
    { id: 'params', label: 'Params', badge: count(r.params) },
    { id: 'headers', label: 'Headers', badge: count(r.headers) },
    { id: 'body', label: 'Body', dot: r.body.mode !== 'none' },
    { id: 'auth', label: 'Auth', dot: r.auth.type !== 'none' },
    { id: 'capture', label: 'Capture', badge: count(r.captures) },
    { id: 'settings', label: 'Settings', dot: Object.entries(DEFAULT_OPTIONS).some(([k, v]) => r.options[k] !== v) }
  ]
})

function onUrlInput(value) {
  request.value.url = value
  request.value.params = paramsFromUrl(value, request.value.params)
}

function onParamsChange() {
  request.value.url = urlWithParams(request.value.url, request.value.params)
}

// Pasting a whole cURL command into the URL bar fills in the full request.
function onUrlPaste(event) {
  const text = event.clipboardData.getData('text')
  if (!looksLikeCurl(text)) return
  event.preventDefault()
  try {
    tabs.replaceRequest(props.tab.id, parseCurl(text))
    ui.toast('Imported cURL command')
  } catch (err) {
    ui.error(err)
  }
}

function openCurlMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  ui.openMenu({ clientX: rect.left, clientY: rect.bottom + 4 }, [
    ...curlMenuItems(() => request.value),
    { separator: true },
    { label: 'Import cURL…', action: () => (ui.curlImport = true) }
  ])
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- URL bar -->
    <div class="flex items-center gap-2 px-4 pb-2 pt-3">
      <div
        class="flex h-9 flex-1 items-center rounded-md border border-line bg-surface/60 transition-colors focus-within:border-accent"
      >
        <MethodSelect v-model="request.method" />
        <VarInput
          data-url-input
          wrapper-class="h-full flex-1"
          input-class="h-full w-full bg-transparent px-3 font-mono text-[13px] text-fg outline-none placeholder:text-muted/60"
          :model-value="request.url"
          placeholder="{{baseUrl}}/users?page=1"
          @update:model-value="onUrlInput"
          @paste="onUrlPaste"
        />
      </div>
      <button v-if="tab.loading" class="btn h-9 w-[92px]" @click="emit('cancel')">Cancel</button>
      <button v-else class="btn-accent h-9 w-[92px]" :disabled="!request.url.trim()" @click="emit('send')">
        Send
      </button>
      <button class="btn h-9" :title="`Save (${isMac ? '⌘' : 'Ctrl'}+S)`" @click="emit('save')">Save</button>
      <button class="btn h-9 px-2.5 font-mono text-[11.5px]" title="Copy as cURL / import cURL" @click="openCurlMenu">
        cURL
      </button>
    </div>

    <div v-if="resolvedUrl" class="-mt-1 truncate px-4 pb-1 font-mono text-[11px] text-muted" :title="resolvedUrl">
      <span class="text-muted/70">→</span> {{ resolvedUrl }}
    </div>

    <!-- Section tabs -->
    <div class="flex items-center border-b border-line px-2">
      <button
        v-for="s in sections"
        :key="s.id"
        class="tab"
        :class="section === s.id && 'tab-active'"
        @click="section = s.id"
      >
        {{ s.label }}
        <span v-if="s.badge" class="ml-1 text-[11px] text-accent">{{ s.badge }}</span>
        <span v-else-if="s.dot" class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"></span>
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <KeyValueTable
        v-if="section === 'params'"
        :key="tab.id + 'params'"
        :rows="request.params"
        key-placeholder="Parameter"
        @change="onParamsChange"
      />
      <KeyValueTable
        v-else-if="section === 'headers'"
        :key="tab.id + 'headers'"
        :rows="request.headers"
        key-placeholder="Header"
        :key-suggestions="COMMON_HEADERS"
      />
      <BodyEditor v-else-if="section === 'body'" :key="tab.id + 'body'" :body="request.body" />
      <AuthEditor v-else-if="section === 'auth'" :auth="request.auth" />
      <CaptureEditor v-else-if="section === 'capture'" :key="tab.id + 'capture'" :tab="tab" />
      <RequestOptions v-else-if="section === 'settings'" :options="request.options" />
    </div>
  </div>
</template>
