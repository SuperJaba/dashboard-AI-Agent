#!/usr/bin/env node

/**
 * Lightweight System Diagnostics Dispatcher
 * Provides structured system metrics (CPU, RAM, Disk, Top Processes)
 * with zero external dependencies to preserve token budgets.
 */

import os from 'os';
import { execSync } from 'child_process';

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(1)} MB`;
}

function getCpuInfo() {
  const cpus = os.cpus();
  const load = os.loadavg();
  return {
    model: cpus[0]?.model || 'Unknown',
    cores: cpus.length,
    loadAvg: {
      '1m': Number(load[0].toFixed(2)),
      '5m': Number(load[1].toFixed(2)),
      '15m': Number(load[2].toFixed(2))
    }
  };
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    usagePercent: Number(((used / total) * 100).toFixed(1))
  };
}

function getDiskInfo() {
  try {
    const raw = execSync('df -k / | tail -n 1', { encoding: 'utf-8', timeout: 3000 }).trim();
    const parts = raw.split(/\s+/);
    if (parts.length >= 6) {
      const totalKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const availKb = parseInt(parts[3], 10);
      return {
        mount: parts[5],
        total: formatBytes(totalKb * 1024),
        used: formatBytes(usedKb * 1024),
        available: formatBytes(availKb * 1024),
        usagePercent: parts[4]
      };
    }
  } catch {
    // Fallback if df fails
  }
  return { status: 'unavailable' };
}

function getTopProcesses() {
  try {
    const isBsd = process.platform === 'freebsd' || process.platform === 'darwin';
    const cmd = isBsd
      ? 'ps -ax -o pid,pcpu,pmem,comm -m | head -n 6'
      : 'ps -eo pid,pcpu,pmem,comm --sort=-%mem | head -n 6';
    const raw = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 3000
    }).trim();
    const lines = raw.split('\n');
    return lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[0],
        cpuPercent: parts[1],
        memPercent: parts[2],
        command: parts[3]
      };
    });
  } catch {
    return [];
  }
}

function getSystemSummary() {
  return {
    uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    topProcesses: getTopProcesses()
  };
}

// CLI argument parsing
const args = process.argv.slice(2);
const flag = args[0];

const data = getSystemSummary();

if (flag === '--cpu') {
  console.log(JSON.stringify(data.cpu, null, 2));
} else if (flag === '--mem') {
  console.log(JSON.stringify(data.memory, null, 2));
} else if (flag === '--disk') {
  console.log(JSON.stringify(data.disk, null, 2));
} else if (flag === '--proc') {
  console.log(JSON.stringify(data.topProcesses, null, 2));
} else if (flag === '--compact') {
  console.log(JSON.stringify(data));
} else {
  console.log(JSON.stringify(data, null, 2));
}
