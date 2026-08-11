import { spawn } from 'child_process';
import path from 'path';

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
    const { getAgents } = await import(agentsPath);
    const agents = await getAgents();
    for (const agent of agents) {
      // Skip if already running – in a real system we would track PIDs
      console.log(`Starting background worker for ${agent.name}`);
      spawn(agent.path, ["--config", agent.config_uri], { stdio: 'inherit' });
    }
  } catch (err) {
    console.error('BackgroundWorker error:', err.message);
  }
}
