<script setup>
import { computed, ref } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useGeneralStore } from '@/stores/general'
import { fromFile } from '@/lib/requestFile'
import { formatTime, methodColor, methodShort, statusTone } from '@/lib/format'
import { curlMenuItems } from '@/lib/actions'

const history = useHistoryStore()
const tabs = useTabsStore()
const ui = useUiStore()
const prefs = useGeneralStore()
const query = ref('')

const statusClass = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-muted'
}

const dayLabel = (ts) => {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const shortUrl = (url) => (url || '').replace(/^[a-z]+:\/\//i, '')

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const out = []
  for (const entry of history.entries) {
    if (q) {
      const haystack = `${entry.method} ${entry.name} ${entry.url} ${entry.resolvedUrl} ${entry.status ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) continue
    }
    const label = dayLabel(entry.at)
    if (out.at(-1)?.label !== label) out.push({ label, entries: [] })
    out.at(-1).entries.push(entry)
  }
  return out
})

const open = (entry) => tabs.openCopy(fromFile(entry.request))

function onContextMenu(event, entry) {
  ui.openMenu(event, [
    { label: 'Open in tab', action: () => open(entry) },
    { label: 'Copy URL', action: () => navigator.clipboard.writeText(entry.resolvedUrl || entry.url) },
    ...curlMenuItems(() => fromFile(entry.request)),
    { separator: true },
    { label: 'Delete from history', danger: true, action: () => history.remove(entry.id) }
  ])
}

async function clearAll() {
  const ok = await window.sar.dialog.confirm({
    message: 'Clear request history?',
    detail: `All ${history.entries.length} entries will be removed.`,
    ok: 'Clear'
  })
  if (ok) history.clear()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-1.5 border-b border-line px-2 py-1.5">
      <input v-model="query" class="input h-7 flex-1 text-[12px]" placeholder="Search history" spellcheck="false" />
      <button
        class="btn-ghost h-7 shrink-0 text-[11.5px]"
        :disabled="!history.entries.length"
        title="Clear history"
        @click="clearAll"
      >
        Clear
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pb-2">
      <template v-for="group in groups" :key="group.label">
        <div class="sticky top-0 z-10 bg-panel px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
          {{ group.label }}
        </div>
        <button
          v-for="entry in group.entries"
          :key="entry.id"
          class="group flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-surface/70"
          :title="`${entry.method} ${entry.resolvedUrl || entry.url}${entry.environment ? `\nEnvironment: ${entry.environment}` : ''}`"
          @click="open(entry)"
          @contextmenu.prevent="onContextMenu($event, entry)"
        >
          <span class="mt-px w-[42px] shrink-0 text-right font-mono text-[10px] font-bold" :class="methodColor[entry.method] || 'text-muted'">
            {{ methodShort(entry.method) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-mono text-[11.5px] text-fg/90">{{ shortUrl(entry.resolvedUrl || entry.url) }}</span>
            <span class="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
              <span v-if="entry.ok" class="font-mono font-semibold" :class="statusClass[statusTone(entry.status)]">{{ entry.status }}</span>
              <span v-else class="font-semibold text-danger">{{ entry.error === 'Cancelled' ? 'Cancelled' : 'Error' }}</span>
              <span v-if="entry.time != null">{{ formatTime(entry.time) }}</span>
              <span class="ml-auto">{{ clock(entry.at) }}</span>
            </span>
          </span>
        </button>
      </template>

      <div v-if="!history.entries.length" class="px-5 py-10 text-center text-[12px] leading-relaxed text-muted">
        Requests you send appear here.<br />
        {{ prefs.general.clearHistoryOnClose ? 'History is cleared when MakiPost closes.' : 'The last 100 are kept.' }}
      </div>
      <div v-else-if="!groups.length" class="px-5 py-8 text-center text-[12px] text-muted">No matches</div>
    </div>
    <div v-if="prefs.general.clearHistoryOnClose" class="shrink-0 border-t border-line px-3 py-1.5 text-[10.5px] text-muted">
      Cleared when MakiPost closes ·
      <button class="text-accent hover:underline" @click="ui.settingsPage = 'general'; ui.settingsOpen = true">change</button>
    </div>
  </div>
</template>
