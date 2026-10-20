import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { store } from './store'

/*
 * On-disk layout of a collection (Git friendly, one file per request):
 *
 *   my-api/
 *     sar-collection.json     { "sar": 1, "name": "My API" }
 *     .sar-order.json         { "order": ["Users", "Health check.json"] }  (optional)
 *     Health check.json       a request
 *     Users/                  a folder
 *       .sar-order.json
 *       List users.json
 */

const COLLECTION_FILE = 'sar-collection.json'
const ORDER_FILE = '.sar-order.json'
const IGNORED = new Set(['node_modules'])

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p))
const isWithin = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(norm(parent) + path.sep)

const getRoots = () => store.get('collections', [])
const rootOf = (p) => getRoots().find((root) => isWithin(p, root))

// Every path coming from the renderer must live inside an open collection.
function assertInside(p) {
  if (typeof p !== 'string' || !rootOf(p)) throw new Error('That path is not inside an open collection.')
  return path.resolve(p)
}

const exists = (p) => fs.access(p).then(() => true, () => false)
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'))
const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
const isRequestData = (d) => d && typeof d === 'object' && typeof d.method === 'string' && typeof d.url === 'string'

function sanitizeName(name) {
  const cleaned = String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80)
  if (!cleaned) return 'Untitled'
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned) ? `${cleaned}_` : cleaned
}

async function uniquePath(dir, base, ext, except = null) {
  let candidate = path.join(dir, base + ext)
  let n = 2
  while ((await exists(candidate)) && !(except && norm(candidate) === norm(except))) {
    candidate = path.join(dir, `${base} (${n++})${ext}`)
  }
  return candidate
}

async function readOrder(dir) {
  try {
    const data = await readJson(path.join(dir, ORDER_FILE))
    return Array.isArray(data.order) ? data.order : []
  } catch {
    return []
  }
}

function sortEntries(items, order) {
  const rank = new Map(order.map((name, i) => [name, i]))
  return items.sort((a, b) => {
    const ra = rank.get(a.file) ?? Infinity
    const rb = rank.get(b.file) ?? Infinity
    if (ra !== rb) return ra - rb
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function readDir(dir, deep) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const items = await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.') || IGNORED.has(entry.name)) return null
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return {
          type: 'folder',
          name: entry.name,
          file: entry.name,
          path: full,
          dir,
          children: deep ? await readDir(full, true) : []
        }
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json') && entry.name !== COLLECTION_FILE) {
        try {
          const data = await readJson(full)
          // Other JSON files (package.json, fixtures…) are simply not requests.
          if (!isRequestData(data)) return null
          return {
            type: 'request',
            name: data.name || entry.name.slice(0, -5),
            method: data.method.toUpperCase(),
            file: entry.name,
            path: full,
            dir
          }
        } catch {
          return null
        }
      }
      return null
    })
  )
  return sortEntries(items.filter(Boolean), await readOrder(dir))
}

/** Insert `name` into dir's order, before sibling `before` (or at the end). */
async function placeInOrder(dir, name, before = null) {
  const names = (await readDir(dir, false)).map((i) => i.file).filter((n) => n !== name)
  const index = before ? names.indexOf(before) : -1
  names.splice(index >= 0 ? index : names.length, 0, name)
  await writeJson(path.join(dir, ORDER_FILE), { order: names })
}

async function editOrder(dir, fn) {
  const file = path.join(dir, ORDER_FILE)
  if (!(await exists(file))) return
  await writeJson(file, { order: fn(await readOrder(dir)) })
}

async function collectionName(root) {
  try {
    return (await readJson(path.join(root, COLLECTION_FILE))).name || path.basename(root)
  } catch {
    return path.basename(root)
  }
}

// ---------------------------------------------------------------------------

async function listCollections() {
  return Promise.all(
    getRoots().map(async (root) => {
      try {
        return { type: 'collection', root, path: root, name: await collectionName(root), children: await readDir(root, true) }
      } catch {
        return { type: 'collection', root, path: root, name: path.basename(root), children: [], error: 'Folder not found' }
      }
    })
  )
}

async function openCollection(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open or create a collection folder',
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const root = path.resolve(result.filePaths[0])
  await fs.mkdir(root, { recursive: true })

  const metaFile = path.join(root, COLLECTION_FILE)
  if (!(await exists(metaFile))) await writeJson(metaFile, { sar: 1, name: path.basename(root) })

  const roots = getRoots()
  if (!roots.some((r) => norm(r) === norm(root))) store.set('collections', [...roots, root])
  return root
}

function closeCollection(root) {
  store.set(
    'collections',
    getRoots().filter((r) => norm(r) !== norm(root))
  )
}

async function createRequest(dir, name, data) {
  const parent = assertInside(dir)
  const file = await uniquePath(parent, sanitizeName(name), '.json')
  await writeJson(file, { ...data, name: name.trim() || 'Untitled' })
  await placeInOrder(parent, path.basename(file))
  return file
}

async function createFolder(dir, name) {
  const parent = assertInside(dir)
  const folder = await uniquePath(parent, sanitizeName(name), '')
  await fs.mkdir(folder)
  await placeInOrder(parent, path.basename(folder))
  return folder
}

async function renameItem(p, newName) {
  const target = assertInside(p)
  const name = String(newName).trim()
  if (!name) throw new Error('Name cannot be empty.')

  const root = rootOf(target)
  if (norm(target) === norm(root)) {
    // Renaming a collection changes its display name, not its folder.
    const metaFile = path.join(root, COLLECTION_FILE)
    let meta = {}
    try {
      meta = await readJson(metaFile)
    } catch {
      /* recreate */
    }
    await writeJson(metaFile, { sar: 1, ...meta, name })
    return { oldPath: target, newPath: target }
  }

  const dir = path.dirname(target)
  const isDir = (await fs.stat(target)).isDirectory()
  if (!isDir) {
    const data = await readJson(target)
    await writeJson(target, { ...data, name })
  }
  const dest = await uniquePath(dir, sanitizeName(name), isDir ? '' : '.json', target)
  if (dest !== target) {
    await fs.rename(target, dest)
    await editOrder(dir, (order) => order.map((n) => (n === path.basename(target) ? path.basename(dest) : n)))
  }
  return { oldPath: target, newPath: dest }
}

async function deleteItem(win, p) {
  const target = assertInside(p)
  if (norm(target) === norm(rootOf(target))) throw new Error('Use "Close collection" to remove a collection.')
  const isDir = (await fs.stat(target)).isDirectory()
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Move to Trash', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Delete "${path.basename(target, isDir ? '' : '.json')}"?`,
    detail: isDir ? 'The folder and every request inside it will be moved to the trash.' : 'The request file will be moved to the trash.'
  })
  if (response !== 0) return false
  try {
    await shell.trashItem(target)
  } catch {
    await fs.rm(target, { recursive: true, force: true })
  }
  await editOrder(path.dirname(target), (order) => order.filter((n) => n !== path.basename(target)))
  return true
}

async function moveItem(src, destDir, before) {
  const from = assertInside(src)
  const toDir = assertInside(destDir)
  if (norm(from) === norm(rootOf(from))) throw new Error('A collection cannot be moved.')
  if (isWithin(toDir, from)) throw new Error('A folder cannot be moved into itself.')

  const fromDir = path.dirname(from)
  const name = path.basename(from)
  let dest = from
  if (norm(fromDir) !== norm(toDir)) {
    const isDir = (await fs.stat(from)).isDirectory()
    const ext = isDir ? '' : path.extname(name)
    dest = await uniquePath(toDir, path.basename(name, ext), ext)
    try {
      await fs.rename(from, dest)
    } catch (err) {
      if (err.code !== 'EXDEV') throw err
      // Collections on different drives.
      await fs.cp(from, dest, { recursive: true })
      await fs.rm(from, { recursive: true, force: true })
    }
    await editOrder(fromDir, (order) => order.filter((n) => n !== name))
  }
  await placeInOrder(toDir, path.basename(dest), before)
  return { oldPath: from, newPath: dest }
}

/**
 * Create a new collection from an imported tree (see renderer lib/postman.js):
 * items = [{ type: 'folder', name, items } | { type: 'request', name, data }].
 * Asks where to put it; the collection gets its own folder there.
 */
async function importCollection(win, name, items) {
  if (!Array.isArray(items)) throw new Error('Nothing to import.')
  const result = await dialog.showOpenDialog(win, {
    title: `Choose where to create "${name}"`,
    buttonLabel: 'Import here',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const parent = path.resolve(result.filePaths[0])
  await fs.mkdir(parent, { recursive: true })

  const root = await uniquePath(parent, sanitizeName(name), '')
  await fs.mkdir(root)
  await writeJson(path.join(root, COLLECTION_FILE), { sar: 1, name: String(name).trim() || path.basename(root) })

  let count = 0
  const writeItems = async (dir, list, depth) => {
    if (depth > 50) throw new Error('The collection is nested too deeply.')
    const order = []
    for (const item of list) {
      if (item?.type === 'folder') {
        const folder = await uniquePath(dir, sanitizeName(item.name), '')
        await fs.mkdir(folder)
        await writeItems(folder, Array.isArray(item.items) ? item.items : [], depth + 1)
        order.push(path.basename(folder))
      } else if (item?.type === 'request' && isRequestData(item.data)) {
        const file = await uniquePath(dir, sanitizeName(item.name), '.json')
        await writeJson(file, { ...item.data, name: String(item.name).trim() || 'Untitled' })
        order.push(path.basename(file))
        count++
      }
    }
    if (order.length) await writeJson(path.join(dir, ORDER_FILE), { order })
  }
  await writeItems(root, items, 0)

  const roots = getRoots()
  if (!roots.some((r) => norm(r) === norm(root))) store.set('collections', [...roots, root])
  return { root, count }
}

export function registerCollectionsIpc() {
  const win = (e) => BrowserWindow.fromWebContents(e.sender)

  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:open', (e) => openCollection(win(e)))
  ipcMain.handle('collections:close', (_e, root) => closeCollection(root))
  ipcMain.handle('collections:readRequest', (_e, file) => readJson(assertInside(file)))
  ipcMain.handle('collections:saveRequest', (_e, file, data) => writeJson(assertInside(file), data))
  ipcMain.handle('collections:createRequest', (_e, dir, name, data) => createRequest(dir, name, data))
  ipcMain.handle('collections:createFolder', (_e, dir, name) => createFolder(dir, name))
  ipcMain.handle('collections:rename', (_e, p, name) => renameItem(p, name))
  ipcMain.handle('collections:delete', (e, p) => deleteItem(win(e), p))
  ipcMain.handle('collections:move', (_e, src, destDir, before) => moveItem(src, destDir, before))
  ipcMain.handle('collections:reveal', (_e, p) => shell.showItemInFolder(assertInside(p)))
  ipcMain.handle('collections:import', (e, name, items) => importCollection(win(e), name, items))
}
