<script setup>
import { onMounted, ref } from 'vue'
import { parseCurl } from '@/lib/curl'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const tabs = useTabsStore()
const text = ref('')
const error = ref('')
const area = ref(null)

onMounted(() => area.value?.focus())

const close = () => (ui.curlImport = false)

function importCommand() {
  try {
    tabs.openCopy(parseCurl(text.value))
    ui.toast('Imported cURL command')
    close()
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40" @mousedown.self="close">
    <div class="w-[min(680px,92vw)] rounded-lg border border-line bg-panel shadow-2xl" @keydown.esc="close">
      <div class="border-b border-line px-5 py-3 text-[14px] font-semibold">Import cURL</div>
      <div class="flex flex-col gap-2 p-5">
        <p class="text-[12px] text-muted">
          Paste a cURL command, e.g. from your browser's DevTools (<i>Network → right-click → Copy → Copy as cURL</i>, bash
          or cmd) or from API docs. Method, URL, headers, body and auth are imported into a new tab.
        </p>
        <textarea
          ref="area"
          v-model="text"
          class="h-56 w-full resize-none rounded-md border border-line bg-surface/60 p-3 font-mono text-[12px] text-fg outline-none focus:border-accent"
          placeholder="curl 'https://api.example.com/users' -H 'Authorization: Bearer …' --data-raw '{&quot;name&quot;:&quot;Maki&quot;}'"
          spellcheck="false"
          @input="error = ''"
          @keydown.ctrl.enter.prevent="importCommand"
          @keydown.meta.enter.prevent="importCommand"
        ></textarea>
        <p v-if="error" class="text-[12px] text-danger">{{ error }}</p>
      </div>
      <div class="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button class="btn" @click="close">Cancel</button>
        <button class="btn-accent" :disabled="!text.trim()" @click="importCommand">Import</button>
      </div>
    </div>
  </div>
</template>
