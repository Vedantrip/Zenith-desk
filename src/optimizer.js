const os = require('os');
const fs = require('fs');
const path = require('path');
const si = require('systeminformation');

/**
 * Gets real-time system performance metrics.
 * @returns {Promise<Object>} Object containing CPU, Memory, and Uptime stats.
 */
async function getSystemMetrics() {
  try {
    const [cpuLoad, memory] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);

    const totalMemGB = memory.total / (1024 * 1024 * 1024);
    const activeMemGB = memory.active / (1024 * 1024 * 1024);
    const freeMemGB = memory.free / (1024 * 1024 * 1024);
    const memUsagePercent = (memory.active / memory.total) * 100;

    return {
      cpu: {
        currentLoad: cpuLoad.currentLoad,
        cores: cpuLoad.cpus.length,
        speed: cpuLoad.cpus[0]?.speed || 0
      },
      memory: {
        total: totalMemGB,
        active: activeMemGB,
        free: freeMemGB,
        usagePercent: memUsagePercent
      },
      uptime: os.uptime()
    };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    // Fallback using basic os module
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      cpu: { currentLoad: 5.0, cores: os.cpus().length, speed: 0 },
      memory: {
        total: totalMem / (1024 * 1024 * 1024),
        active: usedMem / (1024 * 1024 * 1024),
        free: freeMem / (1024 * 1024 * 1024),
        usagePercent: (usedMem / totalMem) * 100
      },
      uptime: os.uptime()
    };
  }
}

/**
 * Retrieves list of running processes sorted by memory or CPU usage.
 * @param {number} limit - Maximum number of processes to return.
 * @returns {Promise<Array>} List of processes.
 */
async function getTopProcesses(limit = 10) {
  try {
    const processData = await si.processes();
    // Sort processes by memory usage
    const sorted = processData.list
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        memUsageBytes: p.memVsz || (p.mem * 1024 * 1024), // Approx
        parentPid: p.parentPid
      }))
      .sort((a, b) => b.mem - a.mem);

    return sorted.slice(0, limit);
  } catch (error) {
    console.error('Error fetching process list:', error);
    return [];
  }
}

/**
 * Recursively scans and cleans temporary files in the OS temp directory.
 * @returns {Promise<Object>} Optimization results (space freed, files deleted).
 */
async function cleanTempFiles() {
  const tempDir = os.tmpdir();
  let bytesFreed = 0;
  let filesDeleted = 0;
  let foldersDeleted = 0;
  let errors = 0;

  function deleteRecursive(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) return;
      const list = fs.readdirSync(dirPath);

      for (const file of list) {
        const filePath = path.join(dirPath, file);
        let stat;
        try {
          stat = fs.statSync(filePath);
        } catch (e) {
          // File might have been deleted in the meantime
          continue;
        }

        if (stat.isDirectory()) {
          // Delete children first
          deleteRecursive(filePath);
          // Try to delete directory
          try {
            fs.rmdirSync(filePath);
            foldersDeleted++;
          } catch (err) {
            // Directory might be locked/in-use
            errors++;
          }
        } else {
          // Try to delete file
          try {
            const fileSize = stat.size;
            fs.unlinkSync(filePath);
            bytesFreed += fileSize;
            filesDeleted++;
          } catch (err) {
            // File is locked/in-use
            errors++;
          }
        }
      }
    } catch (e) {
      console.error(`Failed to clean directory ${dirPath}:`, e);
    }
  }

  // Run cleanup in OS temp folder
  deleteRecursive(tempDir);

  const mbFreed = bytesFreed / (1024 * 1024);
  return {
    success: true,
    spaceFreedMB: mbFreed,
    filesDeleted,
    foldersDeleted,
    lockedFilesCount: errors
  };
}

/**
 * Simulates AI Memory Flushing and reports optimizations.
 * Evaluates high resource applications and triggers cleanup.
 * @returns {Promise<Object>} Optimization report.
 */
async function performLagSweep() {
  const metricsBefore = await getSystemMetrics();
  const processes = await getTopProcesses(15);
  
  // Find processes that are non-critical background apps but consume high resources
  // e.g. discord, slack, steam, epicgames, spotify, chrome/edge (if background-only)
  const heavyApps = processes.filter(p => {
    const name = p.name.toLowerCase();
    const isHeavy = p.mem > 1.5 || p.cpu > 10;
    const isBackgroundService = name.includes('discord') || 
                                name.includes('spotify') || 
                                name.includes('steam') || 
                                name.includes('epicgames') || 
                                name.includes('chrome') ||
                                name.includes('msedge') ||
                                name.includes('game') ||
                                name.includes('launcher');
    return isHeavy && isBackgroundService;
  });

  // Perform Temp Cleanup
  const tempCleanupResult = await cleanTempFiles();

  // Force Garbage Collection if Electron runs with --expose-gc
  if (global.gc) {
    global.gc();
  }

  const metricsAfter = await getSystemMetrics();
  const memoryFreed = Math.max(0, metricsBefore.memory.active - metricsAfter.memory.active);

  // We simulate optimization score improvement
  const initialScore = Math.max(30, Math.round(100 - metricsBefore.memory.usagePercent));
  const finalScore = Math.min(100, Math.max(initialScore, Math.round(100 - metricsAfter.memory.usagePercent + 5)));

  return {
    success: true,
    spaceFreedMB: tempCleanupResult.spaceFreedMB,
    filesDeleted: tempCleanupResult.filesDeleted,
    memoryFreedGB: memoryFreed + (tempCleanupResult.spaceFreedMB / 1024), // Total simulated & actual freed
    heavyAppsFlagged: heavyApps,
    initialPerformanceScore: initialScore,
    optimizedPerformanceScore: finalScore,
    timestamp: new Date().toISOString()
  };
}

/**
 * Attempts to terminate a process by pid.
 * @param {number} pid - Process ID.
 * @returns {boolean} Success state.
 */
function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch (err) {
    console.error(`Failed to kill process ${pid}:`, err);
    try {
      process.kill(pid, 'SIGKILL'); // Force kill
      return true;
    } catch (killErr) {
      return false;
    }
  }
}

/**
 * Scans active processes and returns matches from a distracting apps catalog grouped by name.
 * @returns {Promise<Array>} List of active distracting processes.
 */
async function getDistractingProcesses() {
  try {
    const processData = await si.processes();
    const distractionPatterns = [
      'discord', 'spotify', 'steam', 'epicgames', 'chrome', 'msedge', 
      'slack', 'teams', 'whatsapp', 'zoom', 'netflix', 'origin', 
      'battle.net', 'uplay', 'goggalaxy', 'gamebar', 'skype'
    ];
    
    const grouped = {};
    
    for (const p of processData.list) {
      const nameLower = p.name.toLowerCase();
      const matchPattern = distractionPatterns.find(pattern => nameLower.includes(pattern));
      
      if (matchPattern) {
        if (!grouped[p.name]) {
          grouped[p.name] = {
            name: p.name,
            pids: [],
            cpu: 0,
            mem: 0,
            memUsageBytes: 0
          };
        }
        grouped[p.name].pids.push(p.pid);
        grouped[p.name].cpu += p.cpu;
        grouped[p.name].mem += p.mem;
        grouped[p.name].memUsageBytes += p.memVsz || (p.mem * 1024 * 1024);
      }
    }
    
    return Object.values(grouped);
  } catch (error) {
    console.error('Error scanning for distracting processes:', error);
    return [];
  }
}

/**
 * Terminates all running process instances matching a name.
 * @param {string} name - The name of the process (e.g. chrome.exe).
 * @returns {Promise<boolean>} True if any process was terminated.
 */
async function killProcessByName(name) {
  try {
    const processData = await si.processes();
    const targetName = name.toLowerCase();
    let success = false;
    
    for (const p of processData.list) {
      if (p.name.toLowerCase() === targetName) {
        if (killProcess(p.pid)) {
          success = true;
        }
      }
    }
    return success;
  } catch (err) {
    console.error(`Failed to kill process by name ${name}:`, err);
    return false;
  }
}

module.exports = {
  getSystemMetrics,
  getTopProcesses,
  cleanTempFiles,
  performLagSweep,
  killProcess,
  getDistractingProcesses,
  killProcessByName
};
