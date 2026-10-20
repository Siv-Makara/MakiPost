import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Background images are copied into userData/backgrounds and served to the
// renderer as sar-bg://image/<file>, so the original file can move or vanish.
const SCHEME = 'sar-bg'
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp']
const bgDir = () => path.join(app.getPath('userData'), 'backgrounds')

/** Must run before the app is ready. */
export function registerBackgroundScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

async function clearBackgrounds(keep = null) {
  const files = await fs.readdir(bgDir()).catch(() => [])
  await Promise.all(files.filter((f) => f !== keep).map((f) => fs.rm(path.join(bgDir(), f), { force: true })))
}

async function pickBackground(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose a background image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: IMAGE_EXTS }]
  })
  if (result.canceled || !result.filePaths[0]) return null

  const source = result.filePaths[0]
  const ext = path.extname(source).slice(1).toLowerCase()
  if (!IMAGE_EXTS.includes(ext)) throw new Error('Please choose a PNG, JPG or WebP image.')

  await fs.mkdir(bgDir(), { recursive: true })
  const name = `background-${Date.now()}.${ext}`
  await fs.copyFile(source, path.join(bgDir(), name))
  await clearBackgrounds(name)
  return name
}

export function registerAppearance() {
  protocol.handle(SCHEME, (request) => {
    // basename() keeps requests confined to the backgrounds folder.
    const name = path.basename(decodeURIComponent(new URL(request.url).pathname))
    return net.fetch(pathToFileURL(path.join(bgDir(), name)).toString())
  })

  ipcMain.handle('appearance:pickBackground', (e) => pickBackground(BrowserWindow.fromWebContents(e.sender)))
  ipcMain.handle('appearance:removeBackground', () => clearBackgrounds())
}
