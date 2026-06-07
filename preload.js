const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('win-minimize'),
  maximizeWindow: () => ipcRenderer.send('win-maximize'),
  closeWindow: () => ipcRenderer.send('win-close'),
  
  // Widget specific
  setWidgetClickThrough: (ignore) => ipcRenderer.send('set-widget-click-through', ignore),
  getWidgetSettings: () => ipcRenderer.invoke('get-widget-settings'),
  saveWidgetSettings: (settings) => ipcRenderer.send('save-widget-settings', settings),
  
  // Real-time system monitoring
  getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
  getTopProcesses: (limit) => ipcRenderer.invoke('get-top-processes', limit),
  getDistractingProcesses: () => ipcRenderer.invoke('get-distracting-processes'),
  
  // Optimization Actions
  runOptimizer: () => ipcRenderer.invoke('run-optimizer'),
  terminateProcess: (pid) => ipcRenderer.invoke('terminate-process', pid),
  terminateProcessByName: (name) => ipcRenderer.invoke('terminate-process-by-name', name),
  
  // Folder Organizer
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  organizeFolder: (dirPath, rules) => ipcRenderer.invoke('organize-folder', dirPath, rules),
  
  // Focus Timer / Zen Mode
  startFocusSession: (durationMinutes, zenModeActive) => ipcRenderer.send('start-focus-session', { durationMinutes, zenModeActive }),
  stopFocusSession: () => ipcRenderer.send('stop-focus-session'),
  
  // Startup Configuration
  setStartupOnLogin: (enable) => ipcRenderer.invoke('set-startup-on-login', enable),
  getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
  
  // App settings load/save
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  
  // Event listeners for push updates (e.g. CPU stats, Focus Timer ticks)
  onSystemUpdate: (callback) => {
    ipcRenderer.on('system-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('system-update');
  },
  onFocusTimerTick: (callback) => {
    ipcRenderer.on('focus-timer-tick', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('focus-timer-tick');
  },
  onFocusSessionEnd: (callback) => {
    ipcRenderer.on('focus-session-end', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('focus-session-end');
  },
  onFocusSessionStopped: (callback) => {
    ipcRenderer.on('focus-session-stopped', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('focus-session-stopped');
  },
  onTasksUpdated: (callback) => {
    ipcRenderer.on('tasks-updated', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('tasks-updated');
  },
  onClickThroughToggled: (callback) => {
    ipcRenderer.on('click-through-toggled', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('click-through-toggled');
  },
  onAutoSweepTriggered: (callback) => {
    ipcRenderer.on('auto-sweep-triggered', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('auto-sweep-triggered');
  }
});
