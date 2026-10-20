import { ipcMain } from 'electron'
import Store from 'electron-store'

export const store = new Store({
  name: 'sar-settings',
  defaults: {
    collections: [], // absolute paths of open collection folders
    appearance: null, // null = defaults (see renderer stores/appearance.js)
    session: null, // open tabs, restored on launch
    environments: null, // { globals, list, activeId }
    general: { clearHistoryOnClose: true }
  }
})

// Request history lives in its own file so it can grow and be cleared independently.
const HISTORY_LIMIT = 100
const historyStore = new Store({ name: 'sar-history', defaults: { entries: [] } })

// Keys the renderer may read and write directly. Collections are managed by the main process only.
const RENDERER_KEYS = new Set(['appearance', 'session', 'environments', 'general'])

/** Called as the app quits, after the window (and its last history write) is gone. */
export function clearHistoryIfWanted() {
  if (store.get('general')?.clearHistoryOnClose !== false) historyStore.set('entries', [])
}

export function registerSettingsIpc() {
  ipcMain.handle('settings:get', (_e, key) => (RENDERER_KEYS.has(key) ? store.get(key) : undefined))
  ipcMain.handle('settings:set', (_e, key, value) => {
    if (!RENDERER_KEYS.has(key)) throw new Error(`Unknown setting: ${key}`)
    store.set(key, value)
  })

  ipcMain.handle('history:get', () => historyStore.get('entries'))
  ipcMain.handle('history:set', (_e, entries) => {
    if (!Array.isArray(entries)) throw new Error('History must be a list')
    historyStore.set('entries', entries.slice(0, HISTORY_LIMIT))
  })
}
