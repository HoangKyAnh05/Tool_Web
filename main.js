const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Clean null bytes from renderer.js if they exist to prevent binary corruption
try {
  const rPath = path.join(__dirname, 'renderer', 'renderer.js');
  const cleanPath = path.join(__dirname, 'renderer', 'renderer_clean.js');
  if (fs.existsSync(rPath)) {
    const rawContent = fs.readFileSync(rPath);
    const cleanContent = rawContent.filter(byte => byte !== 0);
    fs.writeFileSync(rPath, cleanContent);
    fs.writeFileSync(cleanPath, cleanContent);
  }
} catch (e) {
  console.error("Error cleaning renderer.js:", e);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0f19',
      symbolColor: '#a855f7',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  // IPC Handlers
  ipcMain.handle('get-config', () => {
    try {
      const configPath = path.join(__dirname, 'config.json');
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading config.json:", err);
    }
    return {};
  });

  ipcMain.handle('open-link', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-file', async (event, { filename, content }) => {
    try {
      // Prompt user where to save the file
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Implementation Plan',
        defaultPath: path.join(app.getPath('documents'), filename),
        filters: [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled by user' };
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-to-workspace', async (event, { filename, content }) => {
    try {
      const workspacePath = path.join(__dirname, filename);
      fs.writeFileSync(workspacePath, content, 'utf-8');
      return { success: true, filePath: workspacePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('read-from-workspace', async (event, { filename }) => {
    try {
      const workspacePath = path.join(__dirname, filename);
      if (fs.existsSync(workspacePath)) {
        const content = fs.readFileSync(workspacePath, 'utf-8');
        return { success: true, content };
      }
      return { success: false, error: 'File not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
