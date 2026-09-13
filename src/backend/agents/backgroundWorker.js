import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Simple background agent runner.
 * Periodically scans for installed agents and starts them in a child process.
 */
const AGENT_DIR = path.resolve(process.cwd(), 'src/backend/agents');

export function startBackgroundWorker(intervalMs = 5 * 60 * 1000) {
  // Run immediately then on interval
  runAgents();
  setInterval(runAgents, intervalMs);
}

async function runAgents() {
  try {
    const agentsPath = path.join(AGENT_DIR, 'agentsRepository.js');
    const { getAgents } = await import(pathToFileURL(agentsPath).href);
    const agents = await getAgents();
    for (const agent of agents) {
      // Only attempt to start agents that are actually installed and whose
      // binary genuinely exists on disk. Run the "System scan" (POST
      // /api/agents/scan) to (re)detect real CLI agents instead of relying
      // on stale/manually-entered rows with bad paths.
      if (!agent.installed || !agent.path || !fs.existsSync(agent.path)) {
        console.log(`Skipping background worker for ${agent.name}: not installed or path missing (${agent.path}). Run a System scan to re-detect it.`);
        continue;
      }

      // Skip if already running – in a real system we would track PIDs
      console.log(`Starting background worker for ${agent.name}`);
      const child = spawn(agent.path, ["--config", agent.config_uri], { stdio: 'inherit' });
      // Prevent an unhandled 'error' event (e.g. missing binary) from crashing the process.
      child.on('error', (err) => {
        console.error(`Failed to start background worker for ${agent.name}:`, err.message);
      });
    }
  } catch (err) {
    console.error('BackgroundWorker error:', err.message);
  }
}

