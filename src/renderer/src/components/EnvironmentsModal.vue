<script setup>
import { computed, nextTick, ref } from 'vue'
import { GLOBALS_ID, useEnvironmentsStore } from '@/stores/environments'
import { useUiStore } from '@/stores/ui'
import KeyValueTable from './KeyValueTable.vue'

const env = useEnvironmentsStore()
const ui = useUiStore()

const selectedId = ref(env.activeId || env.list[0]?.id || GLOBALS_ID)
const isGlobals = computed(() => selectedId.value === GLOBALS_ID)
const selected = computed(() => env.list.find((e) => e.id === selectedId.value) || null)
const rows = computed(() => (isGlobals.value ? env.globals : selected.value?.variables || []))
const count = (vars) => vars.filter((v) => v.enabled && v.key.trim()).length

const nameInput = ref(null)

async function create() {
  const created = env.create()
  selectedId.value = created.id
  await nextTick()
  nameInput.value?.select()
}

function duplicate() {
  selectedId.value = env.duplicate(selected.value).id
}

async function remove() {
  const target = selected.value
  const ok = await window.sar.dialog.confirm({
    message: `Delete environment "${target.name}"?`,
    detail: `Its ${target.variables.length} variable(s) will be removed. This cannot be undone.`,
    ok: 'Delete'
  })
  if (!ok) return
  const index = env.list.indexOf(target)
  env.remove(target)
  selectedId.value = env.list[Math.min(index, env.list.length - 1)]?.id || GLOBALS_ID
}

async function exportSelected() {
  const target = isGlobals.value ? { name: 'Globals', variables: env.globals } : selected.value
  try {
    const file = await window.sar.dialog.saveJson(`${target.name}.environment.json`, env.exportData(target))
    if (file) ui.toast(`Exported "${target.name}"`)
  } catch (err) {
    ui.error(err)
  }
}

async function importFiles() {
  try {
    const files = await window.sar.dialog.openJson('Import environments')
    let last = null
    for (const { file, data } of files) {
      const imported = env.importData(data, file.replace(/\.json$/i, ''))
      last = imported.at(-1) || last
    }
    if (last) {
      selectedId.value = last.id
      ui.toast(`Imported ${files.length} file(s)`)
    }
  } catch (err) {
    ui.error(err)
  }
}

const close = () => (ui.environmentsOpen = false)
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/30" @mousedown.self="close">
    <div
      class="flex h-[min(640px,90vh)] w-[min(900px,94vw)] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl"
      @keydown.esc="close"
    >
      <!-- list -->
      <nav class="flex w-60 shrink-0 flex-col border-r border-line">
        <div class="flex h-12 shrink-0 items-center gap-1 border-b border-line pl-4 pr-2">
          <span class="text-[14px] font-semibold">Environments</span>
          <button class="btn-ghost ml-auto h-7 w-7 px-0" title="Import (Postman or MakiPost JSON)" @click="importFiles">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          <button class="btn-ghost h-7 w-7 px-0" title="New environment" @click="create">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <button
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px]"
            :class="isGlobals ? 'bg-accent/15 text-fg' : 'text-fg/85 hover:bg-surface'"
            @click="selectedId = GLOBALS_ID"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
            </svg>
            <span class="flex-1">Globals</span>
            <span class="text-[11px] text-muted">{{ count(env.globals) }}</span>
          </button>

          <div class="px-2.5 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Environments</div>
          <button
            v-for="e in env.list"
            :key="e.id"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px]"
            :class="selectedId === e.id ? 'bg-accent/15 text-fg' : 'text-fg/85 hover:bg-surface'"
            @click="selectedId = e.id"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" :class="env.activeId === e.id ? 'bg-success' : 'bg-muted/30'"></span>
            <span class="min-w-0 flex-1 truncate">{{ e.name }}</span>
            <span class="text-[11px] text-muted">{{ count(e.variables) }}</span>
          </button>
          <p v-if="!env.list.length" class="px-2.5 py-3 text-[12px] leading-relaxed text-muted">
            No environments yet. Create one for each place you send requests to, e.g. <i>Local</i>, <i>Staging</i>,
            <i>Production</i>.
          </p>
          <button class="mt-1 w-full rounded-md px-2.5 py-2 text-left text-[12.5px] text-accent hover:bg-surface" @click="create">
            + New environment
          </button>
        </div>
      </nav>

      <!-- editor -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line px-5">
          <span v-if="isGlobals" class="text-[14px] font-semibold">Globals</span>
          <input
            v-else-if="selected"
            ref="nameInput"
            v-model="selected.name"
            class="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[14px] font-semibold outline-none hover:border-line focus:border-accent"
            title="Rename"
          />
          <div class="ml-auto flex shrink-0 items-center gap-1.5">
            <template v-if="selected">
              <button v-if="env.activeId === selected.id" class="btn h-7 text-[12px] text-success" @click="env.activeId = null">
                ✓ Active
              </button>
              <button v-else class="btn-accent h-7 text-[12px]" @click="env.activeId = selected.id">Use this environment</button>
              <button class="btn-ghost" title="Duplicate" @click="duplicate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </template>
            <button v-if="selected || isGlobals" class="btn-ghost" title="Export as JSON" @click="exportSelected">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </button>
            <button v-if="selected" class="btn-ghost hover:text-danger" title="Delete environment" @click="remove">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
            <button class="btn-ghost h-7 w-7 px-0" title="Close" @click="close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p class="mb-3 text-[12px] leading-relaxed text-muted">
            <template v-if="isGlobals">
              Globals are available in every request. The active environment overrides a global with the same name.
            </template>
            <template v-else>
              Use variables as <code v-pre class="font-mono text-fg/90">{{name}}</code> in the URL, params, headers, body and
              auth. Values can reference other variables, e.g. <code v-pre class="font-mono text-fg/90">https://{{host}}/api</code>.
            </template>
          </p>
          <KeyValueTable
            v-if="isGlobals || selected"
            :key="selectedId"
            :rows="rows"
            with-secrets
            key-placeholder="Variable"
            value-placeholder="Value"
          />
          <p class="mt-3 text-[11.5px] leading-relaxed text-muted/80">
            Built-in: <code v-pre class="font-mono">{{$guid}}</code>, <code v-pre class="font-mono">{{$timestamp}}</code>,
            <code v-pre class="font-mono">{{$isoTimestamp}}</code>, <code v-pre class="font-mono">{{$randomInt}}</code>.
            Secret values are masked on screen but stored unencrypted in MakiPost's settings and included in exports.
          </p>
        </div>

        <div class="flex shrink-0 justify-end border-t border-line px-5 py-3">
          <button class="btn-accent" @click="close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>
