import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { uid } from '@/lib/model'

export const HISTORY_LIMIT = 100
// Bodies bigger than this aren't kept in history, so the file stays small.
const MAX_BODY_CHARS = 100_000

export const useHistoryStore = defineStore('history', () => {
  const entries = ref([]) // newest first

  function init(saved) {
    entries.value = Array.isArray(saved) ? saved : []
    let timer = null
    watch(
      entries,
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => window.sar.history.set(JSON.parse(JSON.stringify(entries.value))), 500)
      },
      { deep: true }
    )
  }

  /** Record a sent request. `request` is the saved-file form (see requestFile.toFile). */
  function add({ request, resolvedUrl, response, environment }) {
    const body = { ...request.body }
    let bodyDropped = false
    for (const key of ['json', 'raw']) {
      if (body[key]?.length > MAX_BODY_CHARS) {
        body[key] = ''
        bodyDropped = true
      }
    }
    entries.value.unshift({
      id: uid(),
      at: Date.now(),
      method: request.method,
      name: request.name,
      url: request.url,
      resolvedUrl,
      environment,
      ok: !!response.ok,
      status: response.status ?? null,
      error: response.ok ? null : response.cancelled ? 'Cancelled' : response.error,
      time: response.time ?? null,
      size: response.size ?? null,
      bodyDropped,
      request: { ...request, body }
    })
    if (entries.value.length > HISTORY_LIMIT) entries.value.length = HISTORY_LIMIT
  }

  function remove(id) {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function clear() {
    entries.value = []
  }

  return { entries, init, add, remove, clear }
})
