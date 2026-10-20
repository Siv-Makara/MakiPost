import './migrate' // first: moves data from the old "Sar" folder before the settings store loads
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { basename, join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { sendRequest, cancelRequest, prefetch, warmUp } from './http'
import { store, registerSettingsIpc, clearHistoryIfWanted } from './store'
import { registerCollectionsIpc } from './collections'
import { registerOAuthIpc } from './oauth'
import { startAutoUpdate } from './updater'
import { registerAppearance, registerBackgroundScheme } from './appearance'

registerBackgroundScheme()

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    // No 🇰🇭 here: Windows title bars show flag emoji as the letters "KH".
    title: 'MakiPost - ខ្មែរ',
    // Match the saved theme so there's no flash of the default color on launch.
    backgroundColor: store.get('appearance')?.colors?.bg || '#0b0d12',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Never open new Electron windows; send links to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// A deliberately small menu: the default one binds Ctrl+W to "close window",
// which we want for "close tab" in the renderer instead.
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpc() {
  ipcMain.handle('http:send', (_event, req) => sendRequest(req))
  ipcMain.handle('http:cancel', (_event, id) => cancelRequest(id))
  ipcMain.on('http:prefetch', (_event, url) => prefetch(url))

  ipcMain.handle('dialog:saveText', async (event, defaultName, text) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win, { defaultPath: defaultName })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, text, 'utf8')
    return result.filePath
  })

  ipcMain.handle('dialog:pickFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // 0 = Save, 1 = Don't save, 2 = Cancel
  ipcMain.handle('dialog:unsavedChanges', async (event, name) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Save changes to "${name}"?`,
      detail: 'Your changes will be lost if you close this tab without saving.'
    })
    return response
  })

  ipcMain.handle('dialog:confirm', async (event, { message, detail = '', ok = 'OK' }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [ok, 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message,
      detail
    })
    return response === 0
  })

  // Returns [{ file, data }] for each chosen JSON file.
  ipcMain.handle('dialog:openJson', async (event, title) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      title,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled) return []
    return Promise.all(
      result.filePaths.map(async (file) => {
        try {
          return { file: basename(file), data: JSON.parse(await readFile(file, 'utf8')) }
        } catch {
          throw new Error(`${basename(file)} is not valid JSON.`)
        }
      })
    )
  })

  ipcMain.handle('dialog:saveJson', async (event, defaultName, data) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    return result.filePath
  })

  registerSettingsIpc()
  registerCollectionsIpc()
  registerOAuthIpc()
  registerAppearance()
}

app.whenReady().then(() => {
  buildMenu()
  registerIpc()
  createWindow()
  // Off the critical path: the window is already loading.
  setTimeout(warmUp, 0)
  startAutoUpdate()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', clearHistoryIfWanted)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
