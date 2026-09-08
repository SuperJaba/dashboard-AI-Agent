import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Simple background agent runner.
 * Periodically scans for installed agents and starts them in a child process.
 */
const AGENT_DIR = path.resolve(process.cwd(), 'src/backend/agents');

// Agents that accept a --config <path> flag
const AGENTS_WITH_CONFIG_FLAG = new Set(['antigravity', 'claude', 'claude code']);

// Per-agent environment overrides
function agentEnv(agent) {
  const base = { ...process.env };

  const nameLower = (agent.name || '').toLowerCase();

  if (nameLower.includes('gemini')) {
    // Trust the workspace so Gemini CLI doesn't block on an interactive trust prompt
    base.GEMINI_CLI_TRUST_WORKSPACE = 'true';
  }

  return base;
}

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

      console.log(`Starting background worker for ${agent.name}`);

      // Build command arguments based on agent type.
      // Only pass --config to agents that support that flag (claude, antigravity).
      const args = [];
      const nameLower = (agent.name || '').toLowerCase();
      if (
        agent.config_uri &&
        fs.existsSync(agent.config_uri) &&
        AGENTS_WITH_CONFIG_FLAG.has(nameLower)
      ) {
        args.push('--config', agent.config_uri);
      }

      const child = spawn(agent.path, args, {
        // Use 'pipe'/'ignore' so the child never inherits the server's stdin.
        // This prevents "stdin is not a terminal" errors on Linux / Windows / WSL.
        stdio: ['ignore', 'pipe', 'pipe'],
        env: agentEnv(agent),
        detached: false,
      });

      child.stdout?.on('data', (data) => {
        process.stdout.write(`[${agent.name}] ${data}`);
      });
      child.stderr?.on('data', (data) => {
        process.stderr.write(`[${agent.name}] ${data}`);
      });

      // Prevent an unhandled 'error' event (e.g. missing binary) from crashing the process.
      child.on('error', (err) => {
        console.error(`Failed to start background worker for ${agent.name}:`, err.message);
      });
    }
  } catch (err) {
    console.error('BackgroundWorker error:', err.message);
  }
}

