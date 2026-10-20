<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import TopBar from './components/TopBar.vue'
import RequestTabs from './components/RequestTabs.vue'
import RequestEditor from './components/RequestEditor.vue'
import ResponseViewer from './components/ResponseViewer.vue'
import SplitPane from './components/SplitPane.vue'
import Sidebar from './components/sidebar/Sidebar.vue'
import BackgroundLayer from './components/BackgroundLayer.vue'
import ContextMenu from './components/ContextMenu.vue'
import Toasts from './components/Toasts.vue'
import SaveRequestModal from './components/SaveRequestModal.vue'
import SettingsModal from './components/settings/SettingsModal.vue'
import EnvironmentsModal from './components/EnvironmentsModal.vue'
import CurlImportModal from './components/CurlImportModal.vue'
import CommandPalette from './components/CommandPalette.vue'
import ShortcutsModal from './components/ShortcutsModal.vue'

const store = useTabsStore()
const ui = useUiStore()

// Captured before CodeMirror sees them, so Ctrl+Enter sends instead of inserting a line.
function onKeydown(e) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod || ui.modalOpen()) return
  let handled = true
  const key = e.key.toLowerCase()
  if (key === 'enter') store.send()
  else if (key === 's') store.save()
  else if (key === 't') store.openTab()
  else if (key === 'w') store.activeId && store.closeTab(store.activeId)
  else if (key === 'tab') store.cycle(e.shiftKey ? -1 : 1)
  else if (key === 'l') document.querySelector('[data-url-input]')?.select()
  else if (key === ',') ui.settingsOpen = true
  else if (key === 'p' || key === 'k') ui.paletteOpen = true
  else if (key === '/') ui.shortcutsOpen = true
  else handled = false
  if (handled) {
    e.preventDefault()
    e.stopPropagation()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <BackgroundLayer />
  <div class="relative flex h-full flex-col gap-1.5 p-1.5">
    <TopBar />
    <div class="min-h-0 flex-1">
      <SplitPane direction="horizontal" :initial="0.2" :min="0.12" :gutter="6" storage-key="sidebar">
        <template #first>
          <div class="panel h-full overflow-hidden rounded-lg border border-line">
            <Sidebar />
          </div>
        </template>
        <template #second>
          <main class="panel flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line">
            <RequestTabs />
            <SplitPane v-if="store.activeTab" :initial="0.45" storage-key="editor">
              <template #first>
                <RequestEditor
                  :tab="store.activeTab"
                  @send="store.send()"
                  @cancel="store.cancel()"
                  @save="store.save()"
                />
              </template>
              <template #second>
                <ResponseViewer :tab="store.activeTab" @cancel="store.cancel()" />
              </template>
            </SplitPane>
          </main>
        </template>
      </SplitPane>
    </div>
  </div>

  <ContextMenu />
  <SaveRequestModal v-if="ui.saveRequest" :key="ui.saveRequest.tabId" />
  <SettingsModal v-if="ui.settingsOpen" />
  <EnvironmentsModal v-if="ui.environmentsOpen" />
  <CurlImportModal v-if="ui.curlImport" />
  <CommandPalette v-if="ui.paletteOpen" />
  <ShortcutsModal v-if="ui.shortcutsOpen" />
  <Toasts />
</template>
