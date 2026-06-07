const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getSystemMetrics, getTopProcesses, performLagSweep, killProcess, getDistractingProcesses, killProcessByName } = require('./src/optimizer');
const { organizeDirectory } = require('./src/organizer');

let controlCenterWindow = null;
let widgetWindow = null;
let tray = null;
let autoOrganizeInterval = null;
let telemetryInterval = null;
let lastAutoSweepTime = 0;

// Settings Management
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let appSettings = {
  theme: 'dark',
  autoStart: false,
  organizerPath: path.join(os.homedir(), 'Downloads'),
  organizerActive: false,
  organizerRules: {
    Documents: true,
    Images: true,
    Videos: true,
    Audio: true,
    Installers: true,
    Archives: true,
    Code: true
  },
  focusTimerMinutes: 25,
  zenModeOptimize: true,
  widget: {
    clickThrough: true,
    opacity: 0.9,
    showPerformance: true,
    showTasks: true,
    themeColor: '#00f0ff'
  },
  tasks: [
    { id: 1, text: 'Plan today\'s productivity goals', completed: false },
    { id: 2, text: 'Run AI System Sweep to clear temp lag', completed: false },
    { id: 3, text: 'Organize desktop/downloads folder', completed: false }
  ]
};

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loaded = JSON.parse(data);
      appSettings = { ...appSettings, ...loaded };
      
      // Ensure nested objects merge properly
      if (loaded.organizerRules) appSettings.organizerRules = { ...appSettings.organizerRules, ...loaded.organizerRules };
      if (loaded.widget) appSettings.widget = { ...appSettings.widget, ...loaded.widget };
      if (loaded.tasks) appSettings.tasks = loaded.tasks;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// Save settings to file
function saveSettings() {
  try {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Check and start Folder Organizer background watcher
function startFolderOrganizerWatcher() {
  if (autoOrganizeInterval) {
    clearInterval(autoOrganizeInterval);
    autoOrganizeInterval = null;
  }

  if (appSettings.organizerActive && appSettings.organizerPath) {
    console.log(`Starting Folder Organizer background monitor for: ${appSettings.organizerPath}`);
    
    // Periodically organize every 10 seconds
    autoOrganizeInterval = setInterval(async () => {
      if (appSettings.organizerPath && fs.existsSync(appSettings.organizerPath)) {
        const result = await organizeDirectory(appSettings.organizerPath, appSettings.organizerRules);
        if (result.success && result.organizedCount > 0) {
          console.log(`Auto-organized ${result.organizedCount} files in ${appSettings.organizerPath}`);
          // Send notification/update to renderer windows
          if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
            controlCenterWindow.webContents.send('auto-organize-success', result);
          }
        }
      }
    }, 10000);
  }
}

// Create Control Center (Main Dashboard Window)
function createControlCenterWindow() {
  if (controlCenterWindow) {
    controlCenterWindow.show();
    return;
  }

  controlCenterWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Custom frameless window for premium design
    transparent: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlCenterWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  controlCenterWindow.once('ready-to-show', () => {
    controlCenterWindow.show();
  });

  controlCenterWindow.on('closed', () => {
    controlCenterWindow = null;
  });
}

// Create Desktop Widget Window
function createWidgetWindow() {
  if (widgetWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const widgetWidth = 400;
  const widgetHeight = 620;
  
  // Position widget on the right side of the desktop with offset
  const x = screenWidth - widgetWidth - 20;
  const y = 40;

  widgetWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true, // Let them move it if they hold Shift/drag
    skipTaskbar: true,
    alwaysOnTop: false, // Keep it pinned to the desktop behind normal apps
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.loadFile(path.join(__dirname, 'src', 'widget.html'));

  widgetWindow.once('ready-to-show', () => {
    // Set opacity
    widgetWindow.setOpacity(appSettings.widget.opacity);
    
    // Set click-through state
    const ignoreClicks = appSettings.widget.clickThrough;
    widgetWindow.setIgnoreMouseEvents(ignoreClicks, { forward: true });
    
    widgetWindow.show();
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

// Create System Tray Icon
function createTray() {
  // Use a temporary tray dot icon or transparent icon if assets don't exist
  const iconPath = path.join(__dirname, 'src', 'widget_temp.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (err) {
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Zenith Control Center', click: () => createControlCenterWindow() },
    { label: 'Show Desktop Widget', click: () => createWidgetWindow() },
    { type: 'separator' },
    { label: 'Run AI Lag Sweeper', click: async () => {
        const result = await performLagSweep();
        dialog.showMessageBox({
          type: 'info',
          title: 'Zenith System Sweep',
          message: `AI Lag Sweeper Complete!\n\nFreed Memory: ${result.memoryFreedGB.toFixed(2)} GB\nTemp Files Cleaned: ${result.filesDeleted} files (${result.spaceFreedMB.toFixed(2)} MB)\nPerformance Rating: ${result.initialPerformanceScore}% -> ${result.optimizedPerformanceScore}%`
        });
      }
    },
    { label: 'Organize Files Now', click: async () => {
        if (appSettings.organizerPath && fs.existsSync(appSettings.organizerPath)) {
          const result = await organizeDirectory(appSettings.organizerPath, appSettings.organizerRules);
          dialog.showMessageBox({
            type: 'info',
            title: 'Folder Organizer',
            message: `Organized ${result.organizedCount} files successfully.\nSkipped: ${result.skippedCount}\nErrors: ${result.errorCount}`
          });
        }
      }
    },
    { type: 'separator' },
    { label: 'Exit Zenith', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Zenith Productivity Hub');
  tray.setContextMenu(contextMenu);

  // Double click tray icon opens control center
  tray.on('double-click', () => {
    createControlCenterWindow();
  });
}

// Background loop for broadcasting system metrics (every 3 seconds)
function startTelemetryLoop() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
  }

  telemetryInterval = setInterval(async () => {
    const metrics = await getSystemMetrics();
    
    // Auto-trigger optimizer if RAM exceeds 85%
    const now = Date.now();
    if (metrics.memory.usagePercent > 85 && (now - lastAutoSweepTime) > 5 * 60 * 1000) {
      lastAutoSweepTime = now;
      performLagSweep().then(report => {
        if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
          controlCenterWindow.webContents.send('auto-sweep-triggered', report);
        }
      }).catch(err => console.error('Auto-triggered sweep failed:', err));
    }
    
    // Broadcast to windows
    if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
      controlCenterWindow.webContents.send('system-update', metrics);
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('system-update', metrics);
    }
  }, 3000);
}

// Focus Session Timer Variables
let focusTimer = null;
let focusTimeRemaining = 0; // seconds
let focusDurationTotal = 0; // seconds
let isZenModeActive = false;

function startFocusTimer(durationMinutes, zenMode) {
  stopFocusTimer();

  isZenModeActive = zenMode;
  focusDurationTotal = durationMinutes * 60;
  focusTimeRemaining = focusDurationTotal;

  console.log(`Focus session started: ${durationMinutes} minutes. Zen Mode: ${zenMode}`);
  
  if (isZenModeActive) {
    // Run an initial Optimizer sweep to clear lag for the focus session
    performLagSweep().then(report => {
      console.log('Zen Mode Active - System Optimization Complete:', report);
    });
  }

  focusTimer = setInterval(() => {
    focusTimeRemaining--;

    const data = {
      remaining: focusTimeRemaining,
      total: focusDurationTotal,
      minutes: Math.floor(focusTimeRemaining / 60),
      seconds: focusTimeRemaining % 60,
      percent: (focusTimeRemaining / focusDurationTotal) * 100
    };

    // Update windows
    if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
      controlCenterWindow.webContents.send('focus-timer-tick', data);
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('focus-timer-tick', data);
    }

    if (focusTimeRemaining <= 0) {
      endFocusSession();
    }
  }, 1000);
}

function stopFocusTimer() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
  }
}

function endFocusSession() {
  stopFocusTimer();
  console.log('Focus session completed!');

  const completionData = { completed: true, totalMinutes: Math.round(focusDurationTotal / 60) };
  
  if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
    controlCenterWindow.webContents.send('focus-session-end', completionData);
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('focus-session-end', completionData);
  }
}

// Application Lifecycle Event Listeners
app.whenReady().then(() => {
  loadSettings();
  
  // Make sure we have a temp icon file for the tray
  // In a real build, we'd package it. For our dev run, we'll write a simple 16x16 transparent PNG
  const assetsDir = path.join(__dirname, 'src');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const iconBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKiAAAABh0RVh0Q29tbWVudAAAU29mdHdhcmUgUGFpbnQuTkVUIHYzLjUuNf0xL2gAAAAOSURBVDhPY2AYBaNgDAAAAjwAAYFh4hAAAAAASUVORK5CYII=',
    'base64'
  );
  fs.writeFileSync(path.join(assetsDir, 'widget_temp.png'), iconBuffer);

  createTray();
  createWidgetWindow();
  createControlCenterWindow();
  startTelemetryLoop();
  startFolderOrganizerWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlCenterWindow();
      createWidgetWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app active in system tray unless explicitly exited
  if (process.platform !== 'darwin') {
    // If they closed everything, we keep the widget window alive or run in background
  }
});

// IPC Handler Registrations
ipcMain.on('win-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('win-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('win-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win === controlCenterWindow) {
    // Hide control center, don't destroy it so it runs fast in background
    controlCenterWindow.hide();
  } else if (win) {
    win.close();
  }
});

ipcMain.on('set-widget-click-through', (event, ignore) => {
  appSettings.widget.clickThrough = ignore;
  saveSettings();
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setIgnoreMouseEvents(ignore, { forward: true });
    // Notify widget window of the click-through status (for hover effects styling)
    widgetWindow.webContents.send('click-through-toggled', ignore);
  }
});

ipcMain.handle('get-widget-settings', () => {
  return appSettings.widget;
});

ipcMain.on('save-widget-settings', (event, settings) => {
  appSettings.widget = { ...appSettings.widget, ...settings };
  saveSettings();
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (settings.opacity !== undefined) {
      widgetWindow.setOpacity(settings.opacity);
    }
  }
});

ipcMain.handle('get-system-metrics', async () => {
  return await getSystemMetrics();
});

ipcMain.handle('get-distracting-processes', async () => {
  return await getDistractingProcesses();
});

ipcMain.handle('terminate-process-by-name', async (event, name) => {
  return await killProcessByName(name);
});

ipcMain.handle('get-top-processes', async (event, limit) => {
  return await getTopProcesses(limit);
});

ipcMain.handle('run-optimizer', async () => {
  return await performLagSweep();
});

ipcMain.handle('terminate-process', async (event, pid) => {
  return killProcess(pid);
});

ipcMain.handle('select-folder', async () => {
  if (!controlCenterWindow) return null;
  const result = await dialog.showOpenDialog(controlCenterWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('organize-folder', async (event, dirPath, rules) => {
  // Update local settings paths and rules
  if (dirPath) {
    appSettings.organizerPath = dirPath;
  }
  if (rules) {
    appSettings.organizerRules = rules;
  }
  saveSettings();
  
  return await organizeDirectory(dirPath || appSettings.organizerPath, appSettings.organizerRules);
});

ipcMain.on('start-focus-session', (event, { durationMinutes, zenModeActive }) => {
  startFocusTimer(durationMinutes, zenModeActive);
});

ipcMain.on('stop-focus-session', () => {
  stopFocusTimer();
  // Notify both windows
  if (controlCenterWindow && !controlCenterWindow.isDestroyed()) {
    controlCenterWindow.webContents.send('focus-session-stopped');
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('focus-session-stopped');
  }
});

ipcMain.handle('set-startup-on-login', async (event, enable) => {
  appSettings.autoStart = enable;
  saveSettings();

  // If in dev mode, startup settings won't work perfectly, but we code it for production
  if (!app.isPackaged) {
    console.log(`Startup on login toggled in dev mode: ${enable}`);
    return enable;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe')
    });
    return true;
  } catch (err) {
    console.error('Failed to set login item settings:', err);
    return false;
  }
});

ipcMain.handle('get-startup-status', async () => {
  if (!app.isPackaged) return appSettings.autoStart;
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (err) {
    return appSettings.autoStart;
  }
});

ipcMain.handle('load-app-settings', () => {
  return appSettings;
});

ipcMain.handle('save-app-settings', (event, settings) => {
  appSettings = { ...appSettings, ...settings };
  
  // Re-sync watcher if settings changed
  saveSettings();
  startFolderOrganizerWatcher();
  
  // If task checklist changed, sync it to widget window
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('tasks-updated', appSettings.tasks);
  }
  
  return appSettings;
});
