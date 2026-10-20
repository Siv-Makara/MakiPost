import { defineStore } from 'pinia'
import { computed, markRaw, ref, watch } from 'vue'
import { createRequest, uid } from '@/lib/model'
import { buildRequest } from '@/lib/buildRequest'
import { fromFile, snapshot, toFile } from '@/lib/requestFile'
import { cleanError, useUiStore } from './ui'
import { useEnvironmentsStore } from './environments'
import { useHistoryStore } from './history'
import { evaluate } from '@/lib/capture'
import { resolveOAuthConfig } from '@/lib/oauth'

const SEP = window.sar.platform === 'win32' ? '\\' : '/'

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref([])
  const activeId = ref(null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeId.value) || null)
  const findTab = (id) => tabs.value.find((t) => t.id === id)

  // `saved` is the snapshot of what's on disk (or of the blank request for new tabs).
  function makeTab(request, filePath = null, saved = null) {
    return { id: uid(), request, filePath, saved: saved ?? snapshot(request), response: null, loading: false, inflightId: null }
  }

  const isDirty = (tab) => snapshot(tab.request) !== tab.saved
  const isPristine = (tab) => !tab.filePath && !tab.response && !isDirty(tab)

  function openTab(request = createRequest()) {
    const tab = makeTab(request)
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  async function openFile(filePath) {
    const existing = tabs.value.find((t) => t.filePath === filePath)
    if (existing) {
      activeId.value = existing.id
      return existing
    }
    const request = fromFile(await window.sar.collections.readRequest(filePath))
    const tab = makeTab(request, filePath)
    // Reuse an untouched "Untitled" tab instead of piling up empty ones.
    const index = tabs.value.findIndex((t) => t.id === activeId.value)
    if (index >= 0 && isPristine(tabs.value[index])) tabs.value.splice(index, 1, tab)
    else tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  function removeTab(id) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return
    const [tab] = tabs.value.splice(index, 1)
    if (tab.inflightId) window.sar.http.cancel(tab.inflightId)
    if (activeId.value === id) {
      const next = tabs.value[index] || tabs.value[index - 1]
      activeId.value = next ? next.id : null
    }
    if (!tabs.value.length) openTab()
  }

  async function closeTab(id) {
    const tab = findTab(id)
    if (!tab) return
    if (isDirty(tab)) {
      const choice = await window.sar.dialog.unsavedChanges(tab.request.name)
      if (choice === 2) return
      if (choice === 0) {
        if (!tab.filePath) {
          useUiStore().saveRequest = { tabId: id, closeAfter: true }
          return
        }
        if (!(await save(id))) return
      }
    }
    removeTab(id)
  }

  /** Close several tabs one by one (each asks about unsaved changes); stops if one is cancelled. */
  async function closeMany(ids) {
    for (const id of ids) {
      if (!findTab(id)) continue
      activeId.value = id // so the user sees which tab the "unsaved changes" question is about
      await closeTab(id)
      if (findTab(id)) return // cancelled, or waiting for the Save dialog
    }
  }

  /** Open an unsaved copy of a tab's request right after it. */
  function duplicateTab(id) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return
    const source = tabs.value[index].request
    const request = { ...JSON.parse(JSON.stringify(source)), id: uid(), name: `${source.name} copy` }
    const tab = makeTab(request, null, snapshot(createRequest()))
    tabs.value.splice(index + 1, 0, tab)
    activeId.value = tab.id
  }

  function setActive(id) {
    activeId.value = id
  }

  function cycle(step) {
    if (tabs.value.length < 2) return
    const index = tabs.value.findIndex((t) => t.id === activeId.value)
    activeId.value = tabs.value[(index + step + tabs.value.length) % tabs.value.length].id
  }

  /** Save to disk. Unsaved-to-disk tabs open the "Save request" dialog instead. */
  async function save(id = activeId.value) {
    const tab = findTab(id)
    if (!tab) return false
    if (!tab.filePath) {
      useUiStore().saveRequest = { tabId: id, closeAfter: false }
      return false
    }
    try {
      await window.sar.collections.saveRequest(tab.filePath, toFile(tab.request))
      tab.saved = snapshot(tab.request)
      return true
    } catch (err) {
      useUiStore().error(err)
      return false
    }
  }

  /** Called by the Save dialog once a destination is chosen. */
  async function saveAs(id, dir, name) {
    const tab = findTab(id)
    tab.request.name = name
    tab.filePath = await window.sar.collections.createRequest(dir, name, toFile(tab.request))
    tab.saved = snapshot(tab.request)
  }

  // --- keeping tabs in sync with changes in the collection tree -------------

  const under = (filePath, base) => filePath === base || filePath.startsWith(base + SEP)

  function remapPath(oldPath, newPath) {
    if (oldPath === newPath) return
    for (const tab of tabs.value) {
      if (tab.filePath && under(tab.filePath, oldPath)) tab.filePath = newPath + tab.filePath.slice(oldPath.length)
    }
  }

  function applyRename(filePath, name) {
    const tab = tabs.value.find((t) => t.filePath === filePath)
    if (!tab) return
    tab.request.name = name
    tab.saved = JSON.stringify({ ...JSON.parse(tab.saved), name })
  }

  function detachPath(deletedPath) {
    for (const tab of [...tabs.value]) {
      if (!tab.filePath || !under(tab.filePath, deletedPath)) continue
      if (isDirty(tab)) {
        tab.filePath = null
        tab.saved = ''
      } else {
        removeTab(tab.id)
      }
    }
  }

  // --- sending --------------------------------------------------------------

  async function send(tabId = activeId.value) {
    const tab = findTab(tabId)
    if (!tab || tab.loading) return
    if (!tab.request.url.trim()) return

    // Clone through JSON so nothing reactive crosses the IPC boundary.
    const request = JSON.parse(JSON.stringify(tab.request))
    const env = useEnvironmentsStore()
    const missing = new Set()
    const resolve = (text) => env.resolve(text, missing)

    // OAuth 2.0: a cached token, a refreshed one, or a new one (which may open a sign-in window).
    let oauthToken = null
    if (request.auth.type === 'oauth2') {
      tab.loading = true
      try {
        oauthToken = await window.sar.oauth.getToken(resolveOAuthConfig(request.auth.oauth2, resolve))
      } catch (err) {
        tab.response = markRaw({ ok: false, error: `OAuth 2.0: ${cleanError(err)}`, time: 0 })
        return
      } finally {
        tab.loading = false
      }
    }

    const built = buildRequest(request, resolve, { oauthToken })
    if (missing.size) {
      const list = [...missing].map((n) => `{{${n}}}`).join(', ')
      useUiStore().toast(`Not defined in ${env.active ? `"${env.active.name}"` : 'any environment'}: ${list}`, 'warning')
    }
    const payload = { id: uid(), ...built }
    // What was sent, as it was at this moment (the user may keep editing while it runs).
    const sent = toFile(tab.request)
    const environment = env.active?.name || null
    tab.loading = true
    tab.inflightId = payload.id
    let response
    try {
      // markRaw: responses can be megabytes; Vue doesn't need to track them deeply.
      response = markRaw(await window.sar.http.send(payload))
    } catch (err) {
      response = markRaw({ ok: false, error: err.message, time: 0 })
    } finally {
      tab.loading = false
      tab.inflightId = null
    }
    tab.response = response

    useHistoryStore().add({ request: sent, resolvedUrl: built.url, response, environment })
    applyCaptures(sent.captures, response)
  }

  /** Save values from the response into variables, per the request's Capture rules. */
  function applyCaptures(captures, response) {
    const rules = (captures || []).filter((c) => c.enabled && c.key.trim() && c.value.trim())
    if (!rules.length || !response.ok) return
    const env = useEnvironmentsStore()
    const ui = useUiStore()
    const saved = []
    const failed = []
    let target = null
    for (const rule of rules) {
      const result = evaluate(rule.value, response)
      if (result.found) {
        target = env.setVariable(rule.key.trim(), result.value)
        saved.push(rule.key.trim())
      } else {
        failed.push(result.error ? `${rule.value} (${result.error})` : rule.value)
      }
    }
    if (saved.length) ui.toast(`Saved ${saved.join(', ')} to "${target}"`)
    if (failed.length) ui.toast(`Not found in response: ${failed.join(', ')}`, 'warning')
  }

  /** Open a request (e.g. from history or cURL) in a new unsaved tab, reusing an untouched one. */
  function openCopy(request) {
    const tab = makeTab(request, null, snapshot(createRequest()))
    const index = tabs.value.findIndex((t) => t.id === activeId.value)
    if (index >= 0 && isPristine(tabs.value[index])) tabs.value.splice(index, 1, tab)
    else tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  /** Replace a tab's request content (e.g. a pasted cURL command), keeping its name and file. */
  function replaceRequest(tabId, request) {
    const tab = findTab(tabId)
    if (!tab) return
    const keep = { id: tab.request.id, name: tab.filePath || tab.request.name !== 'Untitled Request' ? tab.request.name : request.name }
    tab.request = { ...request, ...keep }
  }

  function cancel(tabId = activeId.value) {
    const tab = findTab(tabId)
    if (tab?.inflightId) window.sar.http.cancel(tab.inflightId)
  }

  // --- session: open tabs survive restarts (including unsaved edits) --------

  function restore(session) {
    // Re-normalize `saved` so snapshots from older versions (fewer fields) don't look dirty.
    const normalize = (saved) => {
      try {
        return saved ? snapshot(fromFile(JSON.parse(saved))) : saved
      } catch {
        return saved
      }
    }
    for (const t of session?.tabs || []) {
      tabs.value.push(makeTab(fromFile(t.request), t.filePath || null, normalize(t.saved)))
    }
    const active = tabs.value[session?.activeIndex ?? 0] || tabs.value[0]
    if (active) activeId.value = active.id
    else openTab()

    let timer = null
    watch(
      [tabs, activeId],
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          window.sar.settings.set('session', {
            activeIndex: tabs.value.findIndex((t) => t.id === activeId.value),
            tabs: tabs.value.map((t) => ({ request: toFile(t.request), filePath: t.filePath, saved: t.saved }))
          })
        }, 400)
      },
      { deep: true }
    )
  }

  return {
    tabs,
    activeId,
    activeTab,
    isDirty,
    openTab,
    openFile,
    closeTab,
    closeMany,
    duplicateTab,
    setActive,
    cycle,
    save,
    saveAs,
    remapPath,
    applyRename,
    detachPath,
    send,
    cancel,
    openCopy,
    replaceRequest,
    restore
  }
})
