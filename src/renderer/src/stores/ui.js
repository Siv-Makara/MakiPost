import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/** Strip Electron's "Error invoking remote method 'x': Error:" prefix. */
export const cleanError = (err) =>
  String(err?.message || err).replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([])
  const contextMenu = ref(null) // { x, y, items: [{ label, action, danger, separator }] }
  const settingsOpen = ref(false)
  const environmentsOpen = ref(false)
  const curlImport = ref(false)
  const paletteOpen = ref(false)
  const shortcutsOpen = ref(false)
  const settingsPage = ref('appearance')
  const sidebarView = ref(localStorage.getItem('sar:sidebar-view') === 'history' ? 'history' : 'collections')
  watch(sidebarView, (v) => localStorage.setItem('sar:sidebar-view', v))
  const saveRequest = ref(null) // { tabId, closeAfter }
  const dragPath = ref(null)

  let nextToast = 1
  function toast(message, kind = 'info') {
    const id = nextToast++
    toasts.value.push({ id, message, kind })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), kind === 'info' ? 3000 : 6000)
  }
  const error = (err) => toast(cleanError(err), 'error')

  function openMenu(event, items) {
    contextMenu.value = { x: event.clientX, y: event.clientY, items }
  }

  /** Is a modal open (so global shortcuts should stay out of its way)? */
  const modalOpen = () =>
    !!(saveRequest.value || settingsOpen.value || environmentsOpen.value || curlImport.value || paletteOpen.value || shortcutsOpen.value)

  return {
    toasts,
    contextMenu,
    settingsOpen,
    environmentsOpen,
    curlImport,
    paletteOpen,
    shortcutsOpen,
    settingsPage,
    sidebarView,
    saveRequest,
    dragPath,
    toast,
    error,
    openMenu,
    modalOpen
  }
})
