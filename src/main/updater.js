import { app, BrowserWindow, dialog, net, shell } from 'electron'
import electronUpdater from 'electron-updater'

/*
 * Updates from GitHub Releases (see `publish` in electron-builder.yml).
 *  - Windows (installed): downloads in the background; the user chooses when to restart.
 *  - macOS: installing an update needs an Apple Developer ID signature, which the app doesn't
 *    have, so it only says a new version is out and opens the download.
 *  - Portable .exe and dev runs: no updates.
 */
const { autoUpdater } = electronUpdater

const REPO = 'Siv-Makara/MakiPost'
const RECHECK = 6 * 60 * 60_000 // also check every 6 hours for people who leave the app open

const mainWindow = () => BrowserWindow.getAllWindows().find((w) => !w.getParentWindow())

export function startAutoUpdate() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return
  const check = process.platform === 'darwin' ? checkMac : checkWindows()
  setTimeout(check, 10_000) // after startup, off the critical path
  setInterval(check, RECHECK)
}

function checkWindows() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // "Later" still installs the next time the app closes

  autoUpdater.on('update-downloaded', async ({ version }) => {
    const { response } = await dialog.showMessageBox(mainWindow(), {
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
  return () => autoUpdater.checkForUpdates().catch(() => {})
}

/** true if version a (e.g. "0.7.10") is newer than b. */
export function isNewer(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  }
  return false
}

let toldAbout = null // ask once per new version, not every 6 hours
async function checkMac() {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return
    const release = await res.json()
    const latest = String(release.tag_name || '').replace(/^v/, '')
    const dmg = (release.assets || []).find((a) => a.name.endsWith('.dmg'))
    if (!dmg || !isNewer(latest, app.getVersion()) || toldAbout === latest) return
    toldAbout = latest
    const { response } = await dialog.showMessageBox(mainWindow(), {
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: `MakiPost ${latest} is available`,
      detail: `You have ${app.getVersion()}. Download the new version, then drag it into Applications to replace this one.`
    })
    if (response === 0) shell.openExternal(dmg.browser_download_url)
  } catch {
    /* offline: try again later */
  }
}
