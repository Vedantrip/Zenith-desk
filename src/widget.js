// ZENITH WIDGET - SYSTEM RUNTIME LOGIC

document.addEventListener('DOMContentLoaded', async () => {
  // --- STATE ---
  let widgetSettings = null;
  let allTasks = [];
  const widgetContainer = document.getElementById('widget-container');

  // --- DOM ELEMENTS ---
  const clockDisplay = document.getElementById('clock-display');
  const clockAmPm = document.getElementById('clock-ampm');
  const dateDay = document.getElementById('date-day');
  const dateDisplay = document.getElementById('date-display');
  
  const timerText = document.getElementById('widget-timer-text');
  const timerBar = document.getElementById('widget-timer-bar');
  const taskChecklist = document.getElementById('widget-task-checklist');
  
  const cpuBar = document.getElementById('widget-cpu-bar');
  const cpuText = document.getElementById('widget-cpu-text');
  const ramBar = document.getElementById('widget-ram-bar');
  const ramText = document.getElementById('widget-ram-text');
  
  const clickthroughStatus = document.getElementById('clickthrough-status');

  const secFocus = document.getElementById('section-focus-timer');
  const secTasks = document.getElementById('section-tasks');
  const secTelemetry = document.getElementById('section-telemetry');

  // --- INITIALIZATION ---
  async function init() {
    // Start Clock Tick
    updateClock();
    setInterval(updateClock, 1000);

    try {
      // Fetch current settings
      const settings = await window.api.loadAppSettings();
      widgetSettings = await window.api.getWidgetSettings();
      allTasks = settings.tasks || [];
      
      applyWidgetSettings(settings);
      renderTasks();
    } catch (err) {
      console.error('Failed to load widget config:', err);
    }
  }

  // Update Clock Face
  function updateClock() {
    const now = new Date();
    
    // Time formatting
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = hours.toString().padStart(2, '0');
    
    clockDisplay.textContent = `${hoursStr}:${minutes}:${seconds}`;
    clockAmPm.textContent = ampm;

    // Date formatting
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    dateDay.textContent = days[now.getDay()];
    dateDisplay.textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }

  // Apply visual configurations (themes, toggles, transparency status)
  function applyWidgetSettings(appSettings) {
    const wConfig = appSettings.widget;
    
    // 1. Accent color
    if (wConfig.themeColor) {
      document.documentElement.style.setProperty('--glow-color', wConfig.themeColor);
    }

    // 2. Click-through status footer text
    clickthroughStatus.textContent = wConfig.clickThrough 
      ? 'Transparency Lock: Active' 
      : 'Transparency Lock: Unlocked';

    // 3. Section Toggles
    secTelemetry.style.display = wConfig.showPerformance ? 'flex' : 'none';
    secTasks.style.display = wConfig.showTasks ? 'flex' : 'none';
  }

  // Render list of focus tasks
  function renderTasks() {
    taskChecklist.innerHTML = '';

    if (allTasks.length === 0) {
      taskChecklist.innerHTML = '<li class="widget-task-text text-muted" style="text-align:center; padding: 10px 0;">No active milestones.</li>';
      return;
    }

    allTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `widget-task-item ${task.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <input type="checkbox" class="widget-task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
        <span class="widget-task-text">${task.text}</span>
      `;

      // Checkbox click listener (only works if click-through is false)
      li.querySelector('.widget-task-checkbox').addEventListener('change', (e) => {
        const taskId = parseInt(e.target.dataset.id);
        const taskObj = allTasks.find(t => t.id === taskId);
        if (taskObj) {
          taskObj.completed = e.target.checked;
          if (taskObj.completed) {
            li.classList.add('completed');
          } else {
            li.classList.remove('completed');
          }
          // Sync changes back to settings
          window.api.saveAppSettings({ tasks: allTasks });
        }
      });

      taskChecklist.appendChild(li);
    });
  }

  // --- IPC WIDGET LISTENERS ---

  // Telemetry updates
  window.api.onSystemUpdate((metrics) => {
    const cpuLoad = Math.round(metrics.cpu.currentLoad);
    cpuBar.style.width = `${cpuLoad}%`;
    cpuText.textContent = `${cpuLoad}%`;

    const ramLoad = Math.round(metrics.memory.usagePercent);
    ramBar.style.width = `${ramLoad}%`;
    ramText.textContent = `${ramLoad}%`;
  });

  // Focus Timer ticks
  window.api.onFocusTimerTick((data) => {
    timerText.textContent = `${data.minutes.toString().padStart(2, '0')}:${data.seconds.toString().padStart(2, '0')}`;
    timerBar.style.width = `${data.percent}%`;
    
    // Pulse indicator glow if focus is running
    timerText.style.color = '#ff9d00';
    timerBar.style.backgroundColor = '#ff9d00';
    document.documentElement.style.setProperty('--glow-color', '#ff9d00');
  });

  // Focus Timer completed/stopped
  const resetWidgetTimer = () => {
    timerText.textContent = 'ZEN SPACE READY';
    timerText.style.color = '#ff9d00';
    timerBar.style.width = '0%';
    timerBar.style.backgroundColor = '#ff9d00';
    
    // Restore primary color
    if (widgetSettings && widgetSettings.themeColor) {
      document.documentElement.style.setProperty('--glow-color', widgetSettings.themeColor);
    } else {
      document.documentElement.style.setProperty('--glow-color', '#00f0ff');
    }
  };

  window.api.onFocusSessionEnd(resetWidgetTimer);
  window.api.onFocusSessionStopped(resetWidgetTimer);

  // Sync tasks when updated in control center
  window.api.onTasksUpdated((tasks) => {
    allTasks = tasks || [];
    renderTasks();
  });

  // Listen for transparency clickthrough toggles
  window.api.onClickThroughToggled((ignore) => {
    clickthroughStatus.textContent = ignore 
      ? 'Transparency Lock: Active' 
      : 'Transparency Lock: Unlocked';
    
    // Also toggle visual hover styles if needed
  });

  // Execute initialization
  init();
});
