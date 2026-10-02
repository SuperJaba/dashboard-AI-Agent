#!/usr/bin/env node

/**
 * Lightweight Remote SSH Dispatcher for CT8 (FreeBSD)
 * Connects to jagger2@s1.ct8.pl using ~/.ssh/id_ed25519_antigravity
 * with non-blocking BatchMode and devil CLI integration.
 */

import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

const SSH_HOST = process.env.CT8_HOST || 's1.ct8.pl';
const SSH_PORT = process.env.CT8_PORT || '22';
const SSH_USER = process.env.CT8_USER || 'jagger2';
const SSH_KEY = process.env.CT8_KEY || path.join(os.homedir(), '.ssh', 'id_ed25519_antigravity');

const args = process.argv.slice(2);
let command = args.join(' ').trim();

// Preset commands for CT8 host administration
if (!command || command === 'status') {
  command = 'uptime && echo "--- CPU / MEMORY ---" && top -d 1 | head -5 && echo "--- DEVIL APPS ---" && devil www list';
} else if (command === 'restart-dash') {
  command = 'devil www restart dashboard.jagger2.ct8.pl';
} else if (command === 'list-apps') {
  command = 'devil www list';
} else if (command === 'logs') {
  command = 'tail -n 30 /usr/home/jagger2/domains/dashboard.jagger2.ct8.pl/logs/error.log 2>/dev/null || tail -n 30 /usr/home/jagger2/domains/dashboard.jagger2.ct8.pl/app.log 2>/dev/null || echo "No log files found in domain dir"';
}

const sshCmd = `ssh -i "${SSH_KEY}" -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10 ${SSH_USER}@${SSH_HOST} "${command.replace(/"/g, '\\"')}"`;

try {
  const output = execSync(sshCmd, {
    encoding: 'utf-8',
    timeout: 20000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  console.log(output.trim());
} catch (err) {
  console.error(`[SSH ERROR] (code: ${err.status}): ${err.stderr ? err.stderr.trim() : err.message}`);
  process.exit(err.status || 1);
}
