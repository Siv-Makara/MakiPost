import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args)

// The only bridge between the renderer and Node. Keep it narrow and explicit.
contextBridge.exposeInMainWorld('sar', {
  platform: process.platform,
  http: {
    send: invoke('http:send'),
    cancel: invoke('http:cancel'),
    // Fire-and-forget: resolve the host's DNS while the user is still typing.
    prefetch: (url) => ipcRenderer.send('http:prefetch', url)
  },
  dialog: {
    pickFile: invoke('dialog:pickFile'),
    unsavedChanges: invoke('dialog:unsavedChanges'),
    confirm: invoke('dialog:confirm'),
    openJson: invoke('dialog:openJson'),
    saveJson: invoke('dialog:saveJson'),
    saveText: invoke('dialog:saveText')
  },
  settings: {
    get: invoke('settings:get'),
    set: invoke('settings:set')
  },
  history: {
    get: invoke('history:get'),
    set: invoke('history:set')
  },
  collections: {
    list: invoke('collections:list'),
    open: invoke('collections:open'),
    close: invoke('collections:close'),
    readRequest: invoke('collections:readRequest'),
    saveRequest: invoke('collections:saveRequest'),
    createRequest: invoke('collections:createRequest'),
    createFolder: invoke('collections:createFolder'),
    rename: invoke('collections:rename'),
    remove: invoke('collections:delete'),
    move: invoke('collections:move'),
    reveal: invoke('collections:reveal'),
    import: invoke('collections:import')
  },
  oauth: {
    getToken: invoke('oauth:getToken'),
    peek: invoke('oauth:peek'),
    clear: invoke('oauth:clear')
  },
  appearance: {
    pickBackground: invoke('appearance:pickBackground'),
    removeBackground: invoke('appearance:removeBackground')
  }
})
