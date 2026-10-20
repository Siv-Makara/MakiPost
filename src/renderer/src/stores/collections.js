import { defineStore } from 'pinia'
import { nextTick, ref, watch } from 'vue'
import { createRequest } from '@/lib/model'
import { toFile } from '@/lib/requestFile'
import { convertPostmanCollection } from '@/lib/postman'
import { useTabsStore } from './tabs'
import { useUiStore } from './ui'
import { useEnvironmentsStore } from './environments'

const api = () => window.sar.collections
const EXPANDED_KEY = 'sar:expanded'

function loadExpanded() {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY)) || [])
  } catch {
    return new Set()
  }
}

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref([])
  const expanded = ref(loadExpanded())
  const renamingPath = ref(null)
  const selectedPath = ref(null) // last clicked item; decides where the header's "New" buttons create things

  watch(expanded, (set) => localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set])), { deep: true })

  const expand = (p) => expanded.value.add(p)
  const toggle = (p) => (expanded.value.has(p) ? expanded.value.delete(p) : expanded.value.add(p))

  /** Run an IPC action, reporting failures as a toast. */
  async function attempt(fn) {
    try {
      return await fn()
    } catch (err) {
      useUiStore().error(err)
      return undefined
    }
  }

  async function refresh() {
    collections.value = (await attempt(() => api().list())) || []
  }

  function findNode(p, nodes = collections.value) {
    for (const node of nodes) {
      if (node.path === p) return node
      const found = node.children && findNode(p, node.children)
      if (found) return found
    }
    return null
  }

  /** Every request in every collection, with the names of the folders above it. */
  function allRequests() {
    const out = []
    const walk = (node, trail) => {
      for (const child of node.children || []) {
        if (child.type === 'request') out.push({ ...child, trail })
        else walk(child, [...trail, child.name])
      }
    }
    collections.value.filter((c) => !c.error).forEach((c) => walk(c, [c.name]))
    return out
  }

  /** Expand the folders above `p` and scroll it into view in the sidebar. */
  async function locate(p) {
    const chain = []
    const find = (nodes) => {
      for (const node of nodes) {
        if (node.path === p) return true
        if (node.children && find(node.children)) {
          chain.push(node.path)
          return true
        }
      }
      return false
    }
    if (!find(collections.value)) return false
    chain.forEach(expand)
    useUiStore().sidebarView = 'collections'
    await nextTick()
    document.querySelector(`[data-path="${CSS.escape(p)}"]`)?.scrollIntoView({ block: 'nearest' })
    return true
  }

  /** Flat list of places a request can be saved into, for the Save dialog. */
  function destinations() {
    const out = []
    const walk = (node, depth) => {
      out.push({ path: node.path, name: node.name, depth, isCollection: node.type === 'collection' })
      for (const child of node.children || []) if (child.type === 'folder') walk(child, depth + 1)
    }
    collections.value.filter((c) => !c.error).forEach((c) => walk(c, 0))
    return out
  }

  /** Folder the header buttons create into: the selected folder, the selected request's folder, or the first collection. */
  function targetDir() {
    const node = selectedPath.value && findNode(selectedPath.value)
    if (node && !node.error) return node.type === 'request' ? node.dir : node.path
    return collections.value.find((c) => !c.error)?.path || null
  }

  async function createInTarget(kind) {
    let dir = targetDir()
    if (!dir) {
      await openFolder()
      dir = targetDir()
      if (!dir) return
    }
    return kind === 'folder' ? newFolder(dir) : newRequest(dir)
  }

  async function openFolder() {
    const root = await attempt(() => api().open())
    if (!root) return
    expand(root)
    await refresh()
  }

  async function close(root) {
    await attempt(() => api().close(root))
    await refresh()
  }

  async function newRequest(dir) {
    const blank = createRequest({ name: 'New Request' })
    const file = await attempt(() => api().createRequest(dir, blank.name, toFile(blank)))
    if (!file) return
    expand(dir)
    await refresh()
    await useTabsStore().openFile(file)
    selectedPath.value = file
    renamingPath.value = file
  }

  async function newFolder(dir) {
    const folder = await attempt(() => api().createFolder(dir, 'New Folder'))
    if (!folder) return
    expand(dir)
    await refresh()
    selectedPath.value = folder
    renamingPath.value = folder
  }

  async function duplicate(node) {
    const data = await attempt(() => api().readRequest(node.path))
    if (!data) return
    const name = `${node.name} copy`
    await attempt(() => api().createRequest(node.dir, name, { ...data, name }))
    await refresh()
  }

  async function rename(node, name) {
    renamingPath.value = null
    name = name.trim()
    if (!name || name === node.name) return
    const result = await attempt(() => api().rename(node.path, name))
    if (!result) return
    const tabs = useTabsStore()
    tabs.remapPath(result.oldPath, result.newPath)
    if (node.type === 'request') tabs.applyRename(result.newPath, name)
    if (selectedPath.value === result.oldPath) selectedPath.value = result.newPath
    if (expanded.value.has(result.oldPath)) {
      expanded.value.delete(result.oldPath)
      expanded.value.add(result.newPath)
    }
    await refresh()
  }

  async function remove(node) {
    const removed = await attempt(() => api().remove(node.path))
    if (!removed) return
    useTabsStore().detachPath(node.path)
    await refresh()
  }

  async function move(src, destDir, before) {
    const result = await attempt(() => api().move(src, destDir, before))
    if (!result) return
    useTabsStore().remapPath(result.oldPath, result.newPath)
    expand(destDir)
    await refresh()
  }

  const reveal = (p) => attempt(() => api().reveal(p))

  /** Import Postman collection files, each as a new collection folder. */
  async function importPostman() {
    const ui = useUiStore()
    const files = await attempt(() => window.sar.dialog.openJson('Import Postman collection'))
    for (const { file, data } of files || []) {
      let converted
      try {
        converted = convertPostmanCollection(data)
      } catch (err) {
        ui.error(`${file}: ${err.message}`)
        continue
      }
      const result = await attempt(() => api().import(converted.name, converted.items))
      if (!result) continue
      expand(result.root)
      selectedPath.value = result.root
      await refresh()

      const { requests, folders } = converted.stats
      let message = `Imported "${converted.name}": ${requests} request${requests === 1 ? '' : 's'}`
      if (folders) message += ` in ${folders} folder${folders === 1 ? '' : 's'}`
      // Postman collection variables become an environment (activated if none is).
      if (converted.variables.length) {
        const env = useEnvironmentsStore()
        const created = env.create(converted.name, converted.variables)
        if (!env.activeId) env.activeId = created.id
        const n = converted.variables.length
        message += `. Its ${n === 1 ? 'variable is' : `${n} variables are`} in the "${created.name}" environment`
      }
      ui.toast(message)
      for (const note of converted.notes) ui.toast(note, 'warning')
    }
  }

  return {
    collections,
    expanded,
    renamingPath,
    selectedPath,
    targetDir,
    createInTarget,
    toggle,
    expand,
    refresh,
    findNode,
    allRequests,
    locate,
    destinations,
    openFolder,
    close,
    newRequest,
    newFolder,
    duplicate,
    rename,
    remove,
    move,
    reveal,
    importPostman
  }
})
