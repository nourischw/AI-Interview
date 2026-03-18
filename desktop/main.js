/**
 * Electron Main Process
 * AI Interview Assistant Desktop App
 */

const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow = null;
let isStealthMode = false;

// Platform-specific imports
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

/**
 * Create the main application window
 */
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1200, width - 100),
    height: Math.min(800, height - 100),
    x: 100,
    y: 100,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    frame: true,
    transparent: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    show: true,
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Window event handlers
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    // Auto-hide on blur if stealth mode enabled
    if (isStealthMode) {
      hideWindow();
    }
  });

  // Setup stealth features
  setupStealthFeatures();
}

/**
 * Setup stealth and anti-detection features
 */
function setupStealthFeatures() {
  // Windows: Set window display affinity to exclude from capture
  if (isWindows && mainWindow) {
    try {
      // WDA_EXCLUDEFROMCAPTURE = 2
      mainWindow.setWindowDisplayAffinity(2);
    } catch (error) {
      console.error('Failed to set window display affinity:', error);
    }
  }

  // macOS: Set window level above screen capture
  if (isMac && mainWindow) {
    // This requires native module for full implementation
    // Using CSS fallback in renderer
  }

  // Hide from screen capture via CSS injection
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline'"],
      },
    });
  });
}

/**
 * Hide window from screen capture
 */
function hideWindow() {
  if (!mainWindow) return;

  // Minimize or hide
  if (isMac) {
    mainWindow.minimize();
  } else {
    mainWindow.hide();
  }

  isStealthMode = true;
  mainWindow?.webContents.send('stealth-mode-changed', { isHidden: true });
}

/**
 * Show window
 */
function showWindow() {
  if (!mainWindow) return;

  if (isMac) {
    mainWindow.restore();
  } else {
    mainWindow.show();
  }

  isStealthMode = false;
  mainWindow?.webContents.send('stealth-mode-changed', { isHidden: false });
}

/**
 * Toggle stealth mode
 */
function toggleStealth() {
  if (isStealthMode) {
    showWindow();
  } else {
    hideWindow();
  }
}

/**
 * Setup IPC handlers for renderer communication
 */
function setupIpcHandlers() {
  // Stealth mode control
  ipcMain.handle('stealth:toggle', () => {
    toggleStealth();
    return isStealthMode;
  });

  ipcMain.handle('stealth:hide', () => {
    hideWindow();
    return true;
  });

  ipcMain.handle('stealth:show', () => {
    showWindow();
    return true;
  });

  ipcMain.handle('stealth:getState', () => {
    return { isHidden: isStealthMode };
  });

  // Window control
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  // System audio setup (Windows)
  ipcMain.handle('audio:setupStereoMix', async () => {
    return setupStereoMixWindows();
  });

  // Process information
  ipcMain.handle('system:getInfo', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };
  });
}

/**
 * Setup Stereo Mix on Windows (for system audio capture)
 */
function setupStereoMixWindows() {
  return new Promise((resolve, reject) => {
    // This would enable Stereo Mix via registry or control panel
    // Note: Requires admin privileges in some cases
    const script = `
      powershell -Command "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -like '*Stereo Mix*' } | Select-Object Name"
    `;

    exec(script, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
        return;
      }

      if (stdout.includes('Stereo Mix')) {
        resolve({ success: true, message: 'Stereo Mix detected' });
      } else {
        resolve({ 
          success: false, 
          message: 'Stereo Mix not found. Please enable it in Sound settings.',
          instructions: [
            'Right-click speaker icon in taskbar',
            'Select "Sounds" or "Sound Settings"',
            'Go to "Recording" tab',
            'Right-click and enable "Show Disabled Devices"',
            'Enable "Stereo Mix"',
          ]
        });
      }
    });
  });
}

/**
 * Setup global keyboard shortcuts
 */
function setupGlobalShortcuts() {
  // Emergency hide shortcut: Ctrl+Shift+X
  const { globalShortcut } = require('electron');

  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleStealth();
  });

  // Quick show shortcut: Ctrl+Shift+S
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (isStealthMode) {
      showWindow();
    }
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  setupGlobalShortcuts();

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

app.on('before-quit', () => {
  // Cleanup
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

// Export for use in other modules
module.exports = {
  hideWindow,
  showWindow,
  toggleStealth,
};
