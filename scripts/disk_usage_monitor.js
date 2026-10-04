// scripts/disk_usage_monitor.js
// Node.js script to fetch remote disk usage via SSH and output JSON for a custom widget
// Usage: node scripts/disk_usage_monitor.js

import { exec } from 'child_process';
const SSH_CMD = 'ssh -o StrictHostKeyChecking=accept-new root@10.10.10.100 "df -h"';

exec(SSH_CMD, (error, stdout, stderr) => {
  if (error) {
    console.error(JSON.stringify({ error: error.message, stderr: stderr.trim() }));
    process.exit(1);
  }
  // Parse df -h output
  const lines = stdout.trim().split('\n');
  const header = lines.shift();
  const cols = header.split(/\s+/);
  const usage = lines.map(line => {
    const parts = line.split(/\s+/);
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = parts[idx] || '';
    });
    return obj;
  });
  const result = {
    timestamp: new Date().toISOString(),
    usage: usage
  };
  console.log(JSON.stringify(result));
});
