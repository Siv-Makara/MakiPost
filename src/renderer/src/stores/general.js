import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const DEFAULTS = { clearHistoryOnClose: true }

/** App-wide preferences (Settings → General). */
export const useGeneralStore = defineStore('general', () => {
  const general = ref({ ...DEFAULTS })

  function init(saved) {
    general.value = { ...DEFAULTS, ...saved }
    watch(general, (value) => window.sar.settings.set('general', { ...value }), { deep: true })
  }

  return { general, init }
})
