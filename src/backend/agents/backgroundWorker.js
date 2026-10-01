import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Simple background agent runner.
 * Only runs when explicitly enabled via ENABLE_BACKGROUND_AGENTS=true.
 * When enabled, guards against incompatible paths and unsupported CLI flags.
 */
const AGENT_DIR = path.resolve(process.cwd(), 'src/backend/agents');

// Running child processes tracked by agent name
const activeAgentProcesses = new Map();

// Per-agent environment overrides
function agentEnv(agent) {
  const base = { ...process.env };
  const nameLower = (agent.name || '').toLowerCase();

  if (nameLower.includes('gemini')) {
    // Trust workspace so Gemini CLI doesn't block on interactive prompt
    base.GEMINI_CLI_TRUST_WORKSPACE = 'true';
  }

  return base;
}

export function startBackgroundWorker(intervalMs = 5 * 60 * 1000) {
  if (process.env.ENABLE_BACKGROUND_AGENTS !== 'true') {
    // Disabled by default: CLI agents are interactive REPLs intended for TerminalView
    return;
  }

  console.log('🤖 Background agent workers enabled (ENABLE_BACKGROUND_AGENTS=true)');
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

      // Skip if this agent worker is already actively running
      if (activeAgentProcesses.has(agent.name)) {
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
      } else {
        // Linux / WSL: Ensure we don't try executing broken Windows wrapper scripts
        if (execPath.startsWith('/mnt/') && (execPath.includes('/bin/node_modules/node/bin/node') || execPath.includes('.nvm/versions/node/'))) {
          const resolved = findInPath(getAgentCmd(agent.name));
          if (resolved) {
            execPath = resolved;
            updateAgentPathAndConfig(agent.name, resolved, agent.config_uri).catch(() => {});
          } else {
            console.log(`Skipping background worker for ${agent.name}: Windows wrapper not runnable on Linux (${execPath}).`);
            continue;
          }
        }
      }

      if (!fs.existsSync(execPath)) {
        console.log(`Skipping background worker for ${agent.name}: path missing (${execPath}).`);
        continue;
      }

      console.log(`Starting background worker for ${agent.name}`);
      const args = [];
      const nameLower = (agent.name || '').toLowerCase();

      // Configure flags correctly according to each agent's actual CLI syntax
      if (agent.config_uri && fs.existsSync(agent.config_uri)) {
        if (nameLower.includes('claude')) {
          // Claude Code CLI accepts --settings <file>
          args.push('--settings', agent.config_uri);
        } else if (nameLower.includes('aider') || nameLower.includes('opencode')) {
          // Aider and OpenCode accept --config <file>
          args.push('--config', agent.config_uri);
        }
      }

      const useShell = process.platform === 'win32' && (execPath.toLowerCase().endsWith('.cmd') || execPath.toLowerCase().endsWith('.bat'));
      const child = spawn(execPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: agentEnv(agent),
        shell: useShell,
        detached: false,
      });

      activeAgentProcesses.set(agent.name, child);

      child.stdout?.on('data', (data) => {
        process.stdout.write(`[${agent.name}] ${data}`);
      });
      child.stderr?.on('data', (data) => {
        process.stderr.write(`[${agent.name}] ${data}`);
      });
      child.on('error', (err) => {
        console.error(`Failed to start background worker for ${agent.name}:`, err.message);
        activeAgentProcesses.delete(agent.name);
      });
      child.on('exit', () => {
        activeAgentProcesses.delete(agent.name);
      });
    }
  } catch (err) {
    console.error('BackgroundWorker error:', err.message);
  }
}
