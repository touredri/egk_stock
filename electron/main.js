const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');

let mainWindow = null;
let httpServer = null;

function getServerPort() {
  return Number(process.env.ELECTRON_PORT || 3100);
}

async function startEmbeddedServer() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  process.env.EGK_DATA_DIR = dataDir;

  const expressApp = require('../backend/app');
  const port = getServerPort();

  await new Promise((resolve, reject) => {
    httpServer = expressApp.listen(port, () => {
      resolve();
    });

    httpServer.on('error', (error) => {
      reject(error);
    });
  });

  return port;
}

async function createMainWindow() {
  const port = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  await mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox('Démarrage impossible', `Erreur au lancement de l'application: ${error.message}`);
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
    httpServer = null;
  }
});
