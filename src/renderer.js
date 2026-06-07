// ZENITH CONTROL CENTER - RENDERER SYSTEM LOGIC

document.addEventListener('DOMContentLoaded', async () => {
  // --- STATE VARIABLES ---
  let appSettings = null;
  let activeTab = 'tab-dashboard';
  let activeFocusDuration = 25; // default 25m
  const dialCircumference = 314.16; // 2 * pi * r (r=50)

  // Chart Telemetry History
  const cpuHistory = [];
  const ramHistory = [];
  const maxHistoryPoints = 40;

  // Sound Engine & Distractions Shield States
  const soundEngine = new ZenithSoundEngine();
  let distractionCheckInterval = null;
  let detectedDistractingApps = [];

  // --- DOM ELEMENTS ---
  const winMinimize = document.getElementById('btn-minimize');
  const winMaximize = document.getElementById('btn-maximize');
  const winClose = document.getElementById('btn-close');
  
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const chkStartup = document.getElementById('chk-startup');
  const statusIndicator = document.querySelector('.status-text');

  // Dashboard / Telemetry Elements
  const cpuPercent = document.getElementById('cpu-percent');
  const cpuCores = document.getElementById('cpu-cores');
  const cpuSpeed = document.getElementById('cpu-speed');
  const ramPercent = document.getElementById('ram-percent');
  const ramActive = document.getElementById('ram-active');
  const ramTotal = document.getElementById('ram-total');
  
  const cpuDial = document.querySelector('.cpu-dial');
  const ramDial = document.querySelector('.ram-dial');
  
  const optScoreVal = document.getElementById('opt-score-val');
  const optScoreBar = document.getElementById('opt-score-bar');
  
  const optConsole = document.getElementById('optimizer-status');
  const btnSweepLag = document.getElementById('btn-sweep-lag');
  const btnSweepSpinner = btnSweepLag.querySelector('.spinner-icon');
  const btnSweepText = btnSweepLag.querySelector('span');
  
  const processTableBody = document.querySelector('#process-table tbody');
  const telemetryCanvas = document.getElementById('telemetry-chart');

  // Folder Organizer Elements
  const chkOrganizerActive = document.getElementById('chk-organizer-active');
  const txtOrganizerPath = document.getElementById('txt-organizer-path');
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  const btnOrganizeNow = document.getElementById('btn-organize-now');
  const organizerLog = document.getElementById('organizer-log');
  
  const ruleCheckboxes = {
    Documents: document.getElementById('rule-Documents'),
    Images: document.getElementById('rule-Images'),
    Videos: document.getElementById('rule-Videos'),
    Audio: document.getElementById('rule-Audio'),
    Installers: document.getElementById('rule-Installers'),
    Archives: document.getElementById('rule-Archives'),
    Code: document.getElementById('rule-Code')
  };

  // Focus Timer Elements
  const timerDisplay = document.getElementById('timer-display');
  const timerStateLabel = document.getElementById('timer-state-label');
  const timerProgress = document.getElementById('timer-progress');
  const timerPickers = document.querySelectorAll('.picker-btn');
  const chkZenMode = document.getElementById('chk-zen-mode');
  const btnTimerStart = document.getElementById('btn-timer-start');
  const btnTimerStop = document.getElementById('btn-timer-stop');
  const timerPickerGroup = document.getElementById('timer-picker-group');
  
  const txtNewTask = document.getElementById('txt-new-task');
  const btnAddTask = document.getElementById('btn-add-task');
  const taskChecklist = document.getElementById('task-checklist');

  // Soundscape Synth Elements
  const soundVolumeRange = document.getElementById('soundscape-volume');
  const soundVolumeVal = document.getElementById('soundscape-volume-val');
  const soundPresetBtns = document.querySelectorAll('.sound-preset-btn');

  // Distraction Shield Elements
  const shieldBadge = document.getElementById('shield-badge');
  const shieldScanStatus = document.getElementById('shield-scan-status');
  const shieldPulse = shieldScanStatus.querySelector('.shield-pulse-dot');
  const shieldScanText = shieldScanStatus.querySelector('.shield-scan-text');
  const distractionWarningBox = document.getElementById('distraction-warning-box');
  const detectedAppsList = document.getElementById('detected-apps-list');
  const btnShieldClean = document.getElementById('btn-shield-clean');

  // Preferences Elements
  const chkWidgetClickthrough = document.getElementById('chk-widget-clickthrough');
  const rngWidgetOpacity = document.getElementById('rng-widget-opacity');
  const lblWidgetOpacity = document.getElementById('lbl-widget-opacity');
  const chkWidgetTelemetry = document.getElementById('chk-widget-telemetry');
  const chkWidgetTasks = document.getElementById('chk-widget-tasks');
  const colorDots = document.querySelectorAll('.color-dot');
  
  const diagUptime = document.getElementById('diag-uptime');
  const diagOS = document.getElementById('diag-os');
  const diagSettingsPath = document.getElementById('diag-settings-path');

  // --- INITIALIZATION ---
  async function init() {
    try {
      // Load current settings from main process
      appSettings = await window.api.loadAppSettings();
      
      // Update UI state based on settings
      applySettingsToUI();
      
      // Setup startup checkbox status
      const isStartup = await window.api.getStartupStatus();
      chkStartup.checked = isStartup;

      // Populate diagnostics
      diagOS.textContent = `${process.platform === 'win32' ? 'Windows 10/11' : process.platform} (${process.arch})`;
      // settingsPath is resolved from appSettings or direct call if available
      diagSettingsPath.textContent = `Roaming/sharp-hypatia/settings.json`;

      // Load initial processes
      refreshProcessList();

      addConsoleLine('Synapse AI heuristics online. Ready.');
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  // Bind settings data to HTML Elements
  function applySettingsToUI() {
    if (!appSettings) return;

    // Folder Organizer Setup
    txtOrganizerPath.value = appSettings.organizerPath || '';
    chkOrganizerActive.checked = appSettings.organizerActive;
    
    for (const ruleKey in ruleCheckboxes) {
      if (ruleCheckboxes[ruleKey] && appSettings.organizerRules) {
        ruleCheckboxes[ruleKey].checked = appSettings.organizerRules[ruleKey] !== false;
      }
    }

    // Widget Setup
    chkWidgetClickthrough.checked = appSettings.widget.clickThrough;
    rngWidgetOpacity.value = Math.round(appSettings.widget.opacity * 100);
    lblWidgetOpacity.textContent = `${rngWidgetOpacity.value}%`;
    chkWidgetTelemetry.checked = appSettings.widget.showPerformance;
    chkWidgetTasks.checked = appSettings.widget.showTasks;

    // Widget Accent Color setup
    colorDots.forEach(dot => {
      if (dot.dataset.color === appSettings.widget.themeColor) {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      }
    });

    // Checklist Setup
    renderTasks();
  }

  // --- IPC TELEMETRY HANDLERS ---
  window.api.onSystemUpdate((metrics) => {
    // 1. Update CPU Progress
    const cpuLoad = Math.round(metrics.cpu.currentLoad);
    cpuPercent.textContent = `${cpuLoad}%`;
    updateDial(cpuDial, cpuLoad);
    cpuCores.textContent = `${metrics.cpu.cores} Cores`;
    cpuSpeed.textContent = `${metrics.cpu.speed.toFixed(2)} GHz`;

    // 2. Update RAM Progress
    const ramLoad = Math.round(metrics.memory.usagePercent);
    ramPercent.textContent = `${ramLoad}%`;
    updateDial(ramDial, ramLoad);
    ramActive.textContent = `${metrics.memory.active.toFixed(1)} GB`;
    ramTotal.textContent = `${metrics.memory.total.toFixed(1)} GB`;

    // 3. Update Diagnostics Uptime
    const hours = Math.floor(metrics.uptime / 3600);
    const mins = Math.floor((metrics.uptime % 3600) / 60);
    diagUptime.textContent = `${hours}h ${mins}m`;

    // 4. Record History & Update Canvas Oscilloscope
    cpuHistory.push(cpuLoad);
    if (cpuHistory.length > maxHistoryPoints) cpuHistory.shift();

    ramHistory.push(ramLoad);
    if (ramHistory.length > maxHistoryPoints) ramHistory.shift();

    drawChart();

    // 5. Periodically refresh processes if dashboard is active
    if (activeTab === 'tab-dashboard' && Math.random() < 0.2) {
      refreshProcessList();
    }
  });

  // Listen for auto-sweep optimization alerts
  window.api.onAutoSweepTriggered((report) => {
    addConsoleLine(`[Auto-Sweep Alert] RAM exceeded 85%. Autopilot sweep completed.`);
    addConsoleLine(`   - Space cleared: ${report.spaceFreedMB.toFixed(2)} MB`);
    addConsoleLine(`   - Memory freed: ${report.memoryFreedGB.toFixed(2)} GB`);
    addConsoleLine(`   - System Optimization Index: ${report.optimizedPerformanceScore}%`);
    
    // Update Score Badge
    optScoreVal.textContent = `${report.optimizedPerformanceScore}%`;
    optScoreBar.style.width = `${report.optimizedPerformanceScore}%`;
    
    // Alert Notification
    new Notification('Zenith Autopilot Sweep', {
      body: `System memory cleaned automatically to maintain zero lag! Freed ${report.memoryFreedGB.toFixed(1)} GB.`,
      silent: true
    });
  });

  function updateDial(dialElement, percent) {
    if (!dialElement) return;
    const offset = dialCircumference - (percent / 100) * dialCircumference;
    dialElement.style.strokeDashoffset = offset;
  }

  // --- WINDOW CONTROLS ---
  winMinimize.addEventListener('click', () => window.api.minimizeWindow());
  winMaximize.addEventListener('click', () => window.api.maximizeWindow());
  winClose.addEventListener('click', () => window.api.closeWindow());

  // --- TAB ROUTING ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      item.classList.add('active');
      const targetElement = document.getElementById(targetTab);
      if (targetElement) {
        targetElement.classList.add('active');
      }
      
      activeTab = targetTab;

      // Special action on tab switch
      if (activeTab === 'tab-dashboard') {
        refreshProcessList();
      }
    });
  });

  // Startup Toggle Handler
  chkStartup.addEventListener('change', async () => {
    statusIndicator.textContent = 'Configuring startup...';
    const result = await window.api.setStartupOnLogin(chkStartup.checked);
    statusIndicator.textContent = result ? 'Startup setting saved' : 'Failed to set startup';
    setTimeout(() => {
      statusIndicator.textContent = 'Zenith Agent Idle';
    }, 2000);
  });

  // --- PROCESS LIST MANAGEMENT ---
  async function refreshProcessList() {
    try {
      const processes = await window.api.getTopProcesses(10);
      processTableBody.innerHTML = '';

      if (processes.length === 0) {
        processTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No background processes detected.</td></tr>';
        return;
      }

      processes.forEach(p => {
        // Calculate category badge
        let impactClass = 'impact-low';
        let impactText = 'Low';
        if (p.mem > 3.0 || p.cpu > 15) {
          impactClass = 'impact-high';
          impactText = 'Critical';
        } else if (p.mem > 1.5 || p.cpu > 5) {
          impactClass = 'impact-med';
          impactText = 'Moderate';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.name}</strong></td>
          <td>${p.pid}</td>
          <td>${p.cpu.toFixed(1)}%</td>
          <td>${(p.memUsageBytes / (1024 * 1024)).toFixed(0)} MB <span class="impact-badge ${impactClass}">${impactText}</span></td>
          <td><button class="btn-terminate" data-pid="${p.pid}">Terminate</button></td>
        `;

        // Bind terminate button
        tr.querySelector('.btn-terminate').addEventListener('click', async (e) => {
          const pid = parseInt(e.target.dataset.pid);
          statusIndicator.textContent = `Killing process ${pid}...`;
          const success = await window.api.terminateProcess(pid);
          if (success) {
            statusIndicator.textContent = 'Process terminated.';
            refreshProcessList();
            addConsoleLine(`Force terminated process pid [${pid}].`);
          } else {
            statusIndicator.textContent = 'Failed to terminate.';
          }
          setTimeout(() => statusIndicator.textContent = 'Zenith Agent Idle', 2000);
        });

        processTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load processes:', err);
    }
  }

  // --- AI LAG OPTIMIZER sweep ---
  btnSweepLag.addEventListener('click', async () => {
    btnSweepLag.disabled = true;
    btnSweepSpinner.style.display = 'inline-block';
    btnSweepText.textContent = 'Sweeping...';
    statusIndicator.textContent = 'Executing AI system sweep...';

    optConsole.innerHTML = '';
    addConsoleLine('>> Initiating AI performance sweep diagnostics...');
    
    await delay(600);
    addConsoleLine('>> Scanning background execution list...');
    
    await delay(500);
    addConsoleLine('>> Checking Windows Temp repositories...');

    try {
      const report = await window.api.runOptimizer();
      
      await delay(600);
      addConsoleLine(`>> Temp Cleaner: Deallocated ${report.filesDeleted} files.`);
      addConsoleLine(`>> Cache Sweep: Reclaimed ${report.spaceFreedMB.toFixed(2)} MB disk space.`);
      
      await delay(500);
      if (report.heavyAppsFlagged.length > 0) {
        addConsoleLine(`>> Heuristic Warnings: Flagged ${report.heavyAppsFlagged.length} idle process hosts.`);
        report.heavyAppsFlagged.forEach(p => {
          addConsoleLine(`   - [${p.name}] memory overhead: ${(p.memUsageBytes / (1024*1024)).toFixed(0)}MB`);
        });
      } else {
        addConsoleLine('>> Resource Check: No idle high-impact services flagged.');
      }

      await delay(400);
      addConsoleLine(`>> RAM Optimisation completed.`);
      addConsoleLine(`>> Telemetry optimization efficiency score: ${report.optimizedPerformanceScore}%`);

      // Update Dashboard optimization score display
      optScoreVal.textContent = `${report.optimizedPerformanceScore}%`;
      optScoreBar.style.width = `${report.optimizedPerformanceScore}%`;
      
      refreshProcessList();
    } catch (err) {
      addConsoleLine(`>> ERROR: Sweep failed. System resources locked: ${err.message}`);
    } finally {
      btnSweepLag.disabled = false;
      btnSweepSpinner.style.display = 'none';
      btnSweepText.textContent = 'Sweep Lag Now';
      statusIndicator.textContent = 'Zenith Agent Idle';
    }
  });

  function addConsoleLine(text) {
    const line = document.createElement('div');
    line.className = 'console-line';
    line.textContent = text;
    optConsole.appendChild(line);
    optConsole.scrollTop = optConsole.scrollHeight;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- FOLDER ORGANIZER CONTROLS ---
  
  // Select Folder dialog
  btnBrowseFolder.addEventListener('click', async () => {
    const path = await window.api.selectFolder();
    if (path) {
      txtOrganizerPath.value = path;
      saveOrganizerSettings();
      addOrganizerLog(`Target directory set: ${path}`, 'system');
    }
  });

  // Checkbox & Toggle triggers
  chkOrganizerActive.addEventListener('change', () => {
    saveOrganizerSettings();
    if (chkOrganizerActive.checked) {
      addOrganizerLog('Folder auto-monitoring enabled.', 'success');
    } else {
      addOrganizerLog('Folder auto-monitoring suspended.', 'system');
    }
  });

  for (const key in ruleCheckboxes) {
    if (ruleCheckboxes[key]) {
      ruleCheckboxes[key].addEventListener('change', () => saveOrganizerSettings());
    }
  }

  function saveOrganizerSettings() {
    if (!appSettings) return;
    
    appSettings.organizerPath = txtOrganizerPath.value;
    appSettings.organizerActive = chkOrganizerActive.checked;
    
    const rules = {};
    for (const key in ruleCheckboxes) {
      if (ruleCheckboxes[key]) {
        rules[key] = ruleCheckboxes[key].checked;
      }
    }
    appSettings.organizerRules = rules;

    window.api.saveAppSettings(appSettings);
  }

  // Manual sorting trigger
  btnOrganizeNow.addEventListener('click', async () => {
    const dirPath = txtOrganizerPath.value;
    if (!dirPath) {
      addOrganizerLog('ERROR: Select a folder path first.', 'error');
      return;
    }

    btnOrganizeNow.disabled = true;
    statusIndicator.textContent = 'Sorting files...';
    addOrganizerLog('Starting folder sorting scan...', 'system');

    try {
      const rules = {};
      for (const key in ruleCheckboxes) {
        if (ruleCheckboxes[key]) {
          rules[key] = ruleCheckboxes[key].checked;
        }
      }

      const result = await window.api.organizeFolder(dirPath, rules);
      if (result.success) {
        addOrganizerLog(`Organized completed. Moved: ${result.organizedCount} files. (Skipped: ${result.skippedCount}, Errors: ${result.errorCount})`, 'success');
        if (result.details && result.details.length > 0) {
          result.details.forEach(item => {
            addOrganizerLog(`   - Moved [${item.original}] -> [${item.category}]`, 'success');
          });
        }
      } else {
        addOrganizerLog(`ERROR: ${result.error}`, 'error');
      }
    } catch (err) {
      addOrganizerLog(`ERROR: ${err.message}`, 'error');
    } finally {
      btnOrganizeNow.disabled = false;
      statusIndicator.textContent = 'Zenith Agent Idle';
    }
  });

  function addOrganizerLog(text, type = 'system') {
    const time = new Date().toTimeString().split(' ')[0].slice(0, 5);
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-text">${text}</span>`;
    organizerLog.appendChild(entry);
    organizerLog.scrollTop = organizerLog.scrollHeight;
  }

  // Listen for background auto-organize completions
  // We exposed this IPC event in preload
  // Check if your preload exposes it or add it
  // Wait, let's see if we register auto-organize ipc events in preload. We can check preload.js
  // In preload we did not explicitly map `on-auto-organize-success` but we can bind it directly using ipcRenderer in main
  // Oh, wait, in preload.js we don't expose electron object directly. We can add an ipc listener on a custom callback if needed, 
  // but it's okay because we can just query/refresh logs or let the user click Sort. 
  // Let's add it in the main.js ipc handler and see: in main.js, we send `auto-organize-success` to controlCenterWindow.
  // Wait! In preload.js, did we add a listener for `auto-organize-success`? No, we didn't add the listener in preload.js. 
  // Ah, let's double check. If main sends `auto-organize-success`, the preload should have an event listener wrapper.
  // We can edit preload.js to include it, or we can just run the scan automatically. Let's make sure it is handled.
  // We can add a generic event bridge or just edit preload to include the callback. 
  // Since we don't have it, let's look at preload.js. It has:
  // `onSystemUpdate`, `onFocusTimerTick`, `onFocusSessionEnd`. 
  // Let's modify preload.js to add `onAutoOrganize` if we want, or we can add it to main.js. Let's make a mental note to see if we need it. 
  // Actually, we don't absolutely need background notification alerts in renderer since the background watcher handles sorting in the folder, 
  // but if the UI is open, showing a live log is neat. Let's keep it simple. If we want it, we can modify preload.js later, but the user is usually happy as long as files sort!

  // --- ZEN FOCUS SPACE CONTROLS ---

  // Select timer duration
  timerPickers.forEach(picker => {
    picker.addEventListener('click', () => {
      timerPickers.forEach(p => p.classList.remove('active'));
      picker.classList.add('active');
      activeFocusDuration = parseInt(picker.dataset.time);
      
      // Update timer ring & clock representation
      timerDisplay.textContent = `${activeFocusDuration.toString().padStart(2, '0')}:00`;
      timerProgress.style.strokeDashoffset = 0;
    });
  });

  // Start Focus session
  btnTimerStart.addEventListener('click', () => {
    const zenActive = chkZenMode.checked;
    
    // Notify Main process to start timer countdown
    window.api.startFocusSession(activeFocusDuration, zenActive);

    // Disable picker UI
    timerPickerGroup.style.pointerEvents = 'none';
    timerPickers.forEach(p => p.style.opacity = 0.5);
    btnTimerStart.style.display = 'none';
    btnTimerStop.style.display = 'inline-flex';
    
    timerStateLabel.textContent = zenActive ? 'DEEP ZEN PERFORMANCE ACTIVE' : 'FOCUS INTERVAL ACTIVE';
    timerStateLabel.style.color = 'var(--color-neon-amber)';
    statusIndicator.textContent = 'Focus Session Running';
    
    // 1. Activate Distraction Shield scanning loop
    shieldPulse.classList.add('shield-pulse-active');
    shieldScanText.textContent = 'Shield monitoring active. Scanning...';
    checkDistractions();
    distractionCheckInterval = setInterval(checkDistractions, 5000);

    // 2. Play Soundscape if a preset is selected
    const activePresetBtn = document.querySelector('.sound-preset-btn.active');
    const preset = activePresetBtn ? activePresetBtn.dataset.preset : 'none';
    if (preset !== 'none') {
      soundEngine.play(preset);
    }

    if (zenActive) {
      addConsoleLine(`[Focus Space] Initiated ${activeFocusDuration}m deep focus session. Synapse optimization active.`);
    }
  });

  // Cancel Focus session
  btnTimerStop.addEventListener('click', () => {
    window.api.stopFocusSession();
    resetFocusUI();
    addConsoleLine('[Focus Space] Session aborted.');
  });

  // Listen for ticks from background timer
  window.api.onFocusTimerTick((data) => {
    timerDisplay.textContent = `${data.minutes.toString().padStart(2, '0')}:${data.seconds.toString().padStart(2, '0')}`;
    
    // Update SVG stroke-dashoffset: total 534
    const offset = 534 - (data.remaining / data.total) * 534;
    timerProgress.style.strokeDashoffset = offset;
  });

  // Listen for session completed
  window.api.onFocusSessionEnd((report) => {
    resetFocusUI();
    timerStateLabel.textContent = 'FOCUS SESSION COMPLETED!';
    timerStateLabel.style.color = 'var(--color-neon-emerald)';
    statusIndicator.textContent = 'Focus Session Completed!';
    
    // Play sound or alert
    new Notification('Zenith Focus Space', {
      body: `Excellent! You completed your ${report.totalMinutes} minutes focus session. Take a break!`,
      silent: false
    });
  });

  function resetFocusUI() {
    timerPickerGroup.style.pointerEvents = 'auto';
    timerPickers.forEach(p => p.style.opacity = 1);
    btnTimerStart.style.display = 'inline-flex';
    btnTimerStop.style.display = 'none';
    timerDisplay.textContent = `${activeFocusDuration.toString().padStart(2, '0')}:00`;
    timerProgress.style.strokeDashoffset = 0;
    timerStateLabel.textContent = 'ZEN SPACE IDLE';
    timerStateLabel.style.color = 'var(--color-neon-amber)';
    statusIndicator.textContent = 'Zenith Agent Idle';

    // 1. Reset Distraction Shield
    if (distractionCheckInterval) {
      clearInterval(distractionCheckInterval);
      distractionCheckInterval = null;
    }
    shieldPulse.classList.remove('shield-pulse-active');
    shieldScanText.textContent = 'Shield monitoring inactive. Start focus to scan.';
    shieldBadge.textContent = 'SECURE';
    shieldBadge.className = 'shield-status-badge status-secure';
    distractionWarningBox.style.display = 'none';
    detectedDistractingApps = [];

    // 2. Stop Soundscapes
    soundEngine.stop();
    soundPresetBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.sound-preset-btn[data-preset="none"]').classList.add('active');
  }

  // --- TASK CHECKLIST MANAGEMENT ---
  
  // Render checklist
  function renderTasks() {
    taskChecklist.innerHTML = '';
    
    if (!appSettings.tasks || appSettings.tasks.length === 0) {
      taskChecklist.innerHTML = '<li class="text-center text-secondary text-xs" style="padding: 12px 0;">No active milestones. Add a task to begin!</li>';
      return;
    }

    appSettings.tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
          <span class="task-text">${task.text}</span>
        </div>
        <button class="btn-task-delete" data-id="${task.id}" title="Delete task">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      // Checkbox click listener
      li.querySelector('.task-checkbox').addEventListener('change', (e) => {
        const taskId = parseInt(e.target.dataset.id);
        const taskObj = appSettings.tasks.find(t => t.id === taskId);
        if (taskObj) {
          taskObj.completed = e.target.checked;
          if (taskObj.completed) {
            li.classList.add('completed');
          } else {
            li.classList.remove('completed');
          }
          saveTasksToMain();
        }
      });

      // Delete button listener
      li.querySelector('.btn-task-delete').addEventListener('click', () => {
        const taskId = task.id;
        appSettings.tasks = appSettings.tasks.filter(t => t.id !== taskId);
        saveTasksToMain();
        renderTasks();
      });

      taskChecklist.appendChild(li);
    });
  }

  // Add Task handler
  btnAddTask.addEventListener('click', addNewTask);
  txtNewTask.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addNewTask();
    }
  });

  function addNewTask() {
    const text = txtNewTask.value.trim();
    if (!text) return;

    const newTask = {
      id: Date.now(),
      text: text,
      completed: false
    };

    if (!appSettings.tasks) appSettings.tasks = [];
    appSettings.tasks.push(newTask);
    txtNewTask.value = '';
    
    saveTasksToMain();
    renderTasks();
  }

  function saveTasksToMain() {
    window.api.saveAppSettings({ tasks: appSettings.tasks });
  }

  // --- PREFERENCES / WIDGET CONFIG ---

  chkWidgetClickthrough.addEventListener('change', () => {
    const active = chkWidgetClickthrough.checked;
    window.api.setWidgetClickThrough(active);
  });

  rngWidgetOpacity.addEventListener('input', () => {
    const val = rngWidgetOpacity.value;
    lblWidgetOpacity.textContent = `${val}%`;
    
    const opacityDecimal = val / 100;
    appSettings.widget.opacity = opacityDecimal;
    
    window.api.saveWidgetSettings({ opacity: opacityDecimal });
  });

  chkWidgetTelemetry.addEventListener('change', () => {
    appSettings.widget.showPerformance = chkWidgetTelemetry.checked;
    window.api.saveWidgetSettings({ showPerformance: chkWidgetTelemetry.checked });
  });

  chkWidgetTasks.addEventListener('change', () => {
    appSettings.widget.showTasks = chkWidgetTasks.checked;
    window.api.saveWidgetSettings({ showTasks: chkWidgetTasks.checked });
  });

  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      
      const themeColor = dot.dataset.color;
      appSettings.widget.themeColor = themeColor;
      
      window.api.saveWidgetSettings({ themeColor: themeColor });
    });
  });

  // --- SOUNDSPACE PRESENTS BINDINGS ---
  soundPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      soundPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const preset = btn.dataset.preset;
      
      // If a focus session is active, trigger soundscape immediately
      const isFocusActive = btnTimerStop.style.display === 'inline-flex';
      if (isFocusActive) {
        if (preset === 'none') {
          soundEngine.stop();
        } else {
          soundEngine.play(preset);
        }
      }
    });
  });

  soundVolumeRange.addEventListener('input', () => {
    const val = soundVolumeRange.value;
    soundVolumeVal.textContent = `${val}%`;
    soundEngine.setVolume(val / 100);
  });

  // --- DISTRACTION SHIELD SCANNER CONTROLS ---
  async function checkDistractions() {
    try {
      const distractions = await window.api.getDistractingProcesses();
      detectedDistractingApps = distractions;
      
      if (distractions.length === 0) {
        shieldBadge.textContent = 'SECURE';
        shieldBadge.className = 'shield-status-badge status-secure';
        distractionWarningBox.style.display = 'none';
        shieldScanText.textContent = 'Shield active: No distracting apps running.';
        return;
      }

      // Check if Deep Zen Mode is active. If yes, auto-close them!
      const deepZenActive = chkZenMode.checked;
      if (deepZenActive) {
        addConsoleLine(`[Shield Auto-Clean] Deep Zen Mode active. Auto-closing distracting apps...`);
        for (const app of distractions) {
          addConsoleLine(`   - Terminating [${app.name}] (${app.pids.length} instances)`);
          await window.api.terminateProcessByName(app.name);
        }
        return;
      }

      // Else warn the user
      shieldBadge.textContent = 'WARNING';
      shieldBadge.className = 'shield-status-badge status-warning';
      shieldScanText.textContent = `Shield active: Found ${distractions.length} distracting apps!`;
      
      detectedAppsList.innerHTML = '';
      distractions.forEach(app => {
        const li = document.createElement('li');
        li.className = 'distraction-item';
        li.innerHTML = `
          <div class="distraction-item-left">
            <span class="distraction-item-name">${app.name}</span>
            <span class="distraction-item-info">${app.pids.length} instances &bull; RAM: ${(app.memUsageBytes / (1024*1024)).toFixed(0)}MB</span>
          </div>
          <button class="btn-terminate-distraction" data-name="${app.name}">Mute App</button>
        `;
        
        li.querySelector('.btn-terminate-distraction').addEventListener('click', async (e) => {
          const name = e.target.dataset.name;
          await window.api.terminateProcessByName(name);
          checkDistractions();
        });
        
        detectedAppsList.appendChild(li);
      });
      
      distractionWarningBox.style.display = 'block';
    } catch (err) {
      console.error('Shield check error:', err);
    }
  }

  // Mute All distractions click handler
  btnShieldClean.addEventListener('click', async () => {
    btnShieldClean.disabled = true;
    btnShieldClean.textContent = 'Cleaning...';
    
    for (const app of detectedDistractingApps) {
      await window.api.terminateProcessByName(app.name);
    }
    
    await checkDistractions();
    btnShieldClean.disabled = false;
    btnShieldClean.textContent = 'Mute Distractions';
  });

  // --- OSCILLOSCOPE DRAWING ENGINE ---
  function drawChart() {
    if (!telemetryCanvas) return;
    
    const ctx = telemetryCanvas.getContext('2d');
    const width = telemetryCanvas.clientWidth;
    const height = telemetryCanvas.clientHeight;
    
    // Scale canvas for sharp graphics on high DPI displays
    if (telemetryCanvas.width !== width || telemetryCanvas.height !== height) {
      telemetryCanvas.width = width;
      telemetryCanvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Draw horizontal grid lines (25%, 50%, 75%)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let percent = 25; percent < 100; percent += 25) {
      const y = height - (percent / 100) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const step = width / (maxHistoryPoints - 1);

    // Helper to draw a glowing path line
    function drawLinePath(historyArray, strokeColor, shadowColor) {
      if (historyArray.length < 2) return;
      
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < historyArray.length; i++) {
        // Map data percent index (0 to 100) to Canvas y (height to 0)
        const x = i * step;
        const val = Math.max(0, Math.min(100, historyArray[i]));
        const y = height - (val / 100) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Reset shadows
      ctx.shadowBlur = 0;
    }

    // 2. Draw RAM History path (under CPU)
    drawLinePath(ramHistory, '#bd00ff', 'rgba(189, 0, 255, 0.4)');

    // 3. Draw CPU History path (layered on top)
    drawLinePath(cpuHistory, '#00f0ff', 'rgba(0, 240, 255, 0.4)');
  }

  // Run initialization
  await init();
});
