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

function getAgentCmd(agentName) {
  const norm = (agentName || '').toLowerCase().trim();
  const map = {
    'antigravity': 'agy',
    'claude code': 'claude',
    'codex': 'codex',
    'gemini cli': 'gemini',
    'opencode': 'opencode',
    'aider': 'aider',
    'github copilot cli': 'copilot',
    'cursor agent': 'cursor-agent'
  };
  return map[norm] || norm.replace(/\s+code|\s+cli/g, '').trim();
}

async function runAgents() {
  try {
    const agentsPath = path.join(AGENT_DIR, 'agentsRepository.js');
    const { getAgents, updateAgentPathAndConfig } = await import(pathToFileURL(agentsPath).href);
    const { findInPath } = await import(pathToFileURL(path.join(AGENT_DIR, 'agentsRouter.js')).href);
    const agents = await getAgents();
    for (const agent of agents) {
      if (!agent.installed || !agent.path) {
        continue;
      }

      let execPath = agent.path;
      if (process.platform === 'win32') {
        const cmdName = getAgentCmd(agent.name);
        const resolved = findInPath(cmdName);
        if (resolved && fs.existsSync(resolved) && (resolved.toLowerCase().endsWith('.exe') || resolved.toLowerCase().endsWith('.cmd') || resolved.toLowerCase().endsWith('.bat'))) {
          execPath = resolved;
          if (agent.path !== resolved) {
            updateAgentPathAndConfig(agent.name, resolved, agent.config_uri).catch(() => {});
          }
        } else if (!fs.existsSync(execPath)) {
          if (fs.existsSync(execPath + '.cmd')) {
            execPath = execPath + '.cmd';
          } else if (fs.existsSync(execPath + '.exe')) {
            execPath = execPath + '.exe';
          }
        }
      }

      if (!fs.existsSync(execPath)) {
        console.log(`Skipping background worker for ${agent.name}: path missing (${execPath}). Run a System scan to re-detect it.`);
        continue;
      }

      console.log(`Starting background worker for ${agent.name}`);
      const args = [];
      const nameLower = (agent.name || '').toLowerCase();
      if (
        agent.config_uri &&
        fs.existsSync(agent.config_uri) &&
        AGENTS_WITH_CONFIG_FLAG.has(nameLower)
      ) {
        args.push('--config', agent.config_uri);
      }

      const useShell = process.platform === 'win32' && (execPath.toLowerCase().endsWith('.cmd') || execPath.toLowerCase().endsWith('.bat'));
      const child = spawn(execPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: agentEnv(agent),
        shell: useShell,
        detached: false,
      });

      child.stdout?.on('data', (data) => {
        process.stdout.write(`[${agent.name}] ${data}`);
      });
      child.stderr?.on('data', (data) => {
        process.stderr.write(`[${agent.name}] ${data}`);
      });
      child.on('error', (err) => {
        console.error(`Failed to start background worker for ${agent.name}:`, err.message);
      });
    }
  } catch (err) {
    console.error('BackgroundWorker error:', err.message);
  }
}

