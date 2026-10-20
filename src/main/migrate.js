import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/*
 * The app was called "Sar" before 0.7.0, so its data lived in …/Sar. On the first launch
 * as MakiPost, copy settings, environments, open tabs, history, OAuth tokens and the
 * background image across. The old folder is left untouched. Must run before the
 * settings store is created (see the import order in index.js).
 */
const FILES = ['sar-settings.json', 'sar-history.json', 'sar-oauth.json']

try {
  const target = app.getPath('userData')
  const legacy = path.join(path.dirname(target), 'Sar')
  if (!fs.existsSync(path.join(target, 'sar-settings.json')) && fs.existsSync(path.join(legacy, 'sar-settings.json'))) {
    fs.mkdirSync(target, { recursive: true })
    for (const file of FILES) {
      if (fs.existsSync(path.join(legacy, file))) fs.copyFileSync(path.join(legacy, file), path.join(target, file))
    }
    if (fs.existsSync(path.join(legacy, 'backgrounds'))) {
      fs.cpSync(path.join(legacy, 'backgrounds'), path.join(target, 'backgrounds'), { recursive: true })
    }
  }
} catch {
  /* best effort: start fresh rather than fail to launch */
}
