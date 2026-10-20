import { app, BrowserWindow, dialog } from 'electron'
import electronUpdater from 'electron-updater'

/*
 * Auto-update from GitHub Releases (see `publish` in electron-builder.yml).
 * Only the installed (NSIS) version updates itself; the portable .exe and dev runs don't.
 * New versions download in the background; the user chooses when to restart.
 */
const { autoUpdater } = electronUpdater

const RECHECK = 6 * 60 * 60_000 // also check every 6 hours for people who leave the app open

export function startAutoUpdate() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // "Later" still installs the next time the app closes

  autoUpdater.on('update-downloaded', async ({ version }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: `MakiPost ${version} is ready to install`,
      detail: 'Restart now to update, or keep working and it will be installed when you close MakiPost.'
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })
  // No network or no release yet: try again later, never bother the user.
  autoUpdater.on('error', () => {})

  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  setTimeout(check, 10_000) // after startup, off the critical path
  setInterval(check, RECHECK)
}
