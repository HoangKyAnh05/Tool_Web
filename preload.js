const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openLink: (url) => ipcRenderer.invoke('open-link', url),
  saveFile: (filename, content) => ipcRenderer.invoke('save-file', { filename, content }),
  saveToWorkspace: (filename, content) => ipcRenderer.invoke('save-to-workspace', { filename, content }),
  readFromWorkspace: (filename) => ipcRenderer.invoke('read-from-workspace', { filename }),
  getConfig: () => ipcRenderer.invoke('get-config')
});
