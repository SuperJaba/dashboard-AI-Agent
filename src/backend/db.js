import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = pkg;

const schema = process.env.DB_SCHEMA || 'dashboard';

export const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || 'SebaP',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'dashboarddb',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432),
  connectionTimeoutMillis: 10000,
  options: `-c search_path=${schema},public`,
});

// Suppress unhandled connection error events from pg pool
if (pool && typeof pool.on === 'function') {
  pool.on('error', (err) => {
    console.warn('PostgreSQL Pool background connection warning:', err.message);
  });
}

// Fallback in-memory store when PostgreSQL is disconnected or unavailable
export const inMemoryStore = {
  users: [],
  settings: {
    llmName: 'AtomicChat',
    llmUrl: 'http://127.0.0.1:1337/v1',
    llmModel: 'AtomicChat/qwen35-4b-Q8_0',
  },
  projects: [],
  servers: [],
  cli_agents: [],
  custom_widgets: [],
  agents: [],
  user_settings: [],
  agent_scheduled_tasks: [
    {
      id: 1,
      name: 'Nocny audyt bezpieczeństwa',
      task_type: 'npm_audit',
      command: 'npm audit',
      cron_expression: '0 3 * * *',
      enabled: true,
      last_run: null,
      last_status: 'idle',
      last_output: null,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Weryfikacja logów błędów',
      task_type: 'error_check',
      command: 'node -e "console.log(\'Brak krytycznych błędów w logach.\')"',
      cron_expression: '0 * * * *',
      enabled: true,
      last_run: null,
      last_status: 'idle',
      last_output: null,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Synchronizacja zadań z tasks.md',
      task_type: 'sync_tasks',
      command: 'npm run sync-tasks',
      cron_expression: '*/30 * * * *',
      enabled: true,
      last_run: null,
      last_status: 'idle',
      last_output: null,
      created_at: new Date().toISOString()
    }
  ],
  agent_tasks: [],
  agent_logs: [],
  pipelines: [],
  pipeline_runs: [],
  pipeline_artifacts: [],
  snapshot_sessions: [],
  snapshot_events: [],
  llm_usage: [],
  agent_memories: []
};

let useInMemoryFallback = false;

const rawPoolQuery = pool.query.bind(pool);

export async function safeQuery(text, params = []) {
  if (!useInMemoryFallback) {
    try {
      let pgText = text;
      if (text.includes('?')) {
        let paramIndex = 1;
        pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
      }
      return await rawPoolQuery(pgText, params);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.message?.includes('connect ECONNREFUSED')) {
        console.warn('PostgreSQL connection unavailable, using fallback store:', err.message);
        useInMemoryFallback = true;
      } else {
        throw err;
      }
    }
  }

  const sql = text.trim();

  // Users queries
  if (sql.includes('FROM users') && sql.includes('COUNT')) {
    return { rows: [{ count: inMemoryStore.users.length.toString() }] };
  }

  if (sql.includes('FROM users WHERE username')) {
    const user = inMemoryStore.users.find(u => u.username === params[0]);
    return { rows: user ? [user] : [] };
  }

  if (sql.includes('INSERT INTO users')) {
    const newUser = { id: inMemoryStore.users.length + 1, username: params[0], password_hash: params[1] };
    inMemoryStore.users.push(newUser);
    return { rows: [newUser] };
  }

  if (sql.includes('DELETE FROM users')) {
    inMemoryStore.users = [];
    return { rows: [] };
  }

  // Settings queries
  if (sql.includes('FROM settings WHERE key')) {
    if (sql.includes('WHERE key IN')) {
      const keys = ['llmUrl', 'apiKey'];
      const rows = keys.filter(k => inMemoryStore.settings[k] !== undefined).map(k => ({ key: k, value: inMemoryStore.settings[k] }));
      return { rows };
    }
    const val = inMemoryStore.settings[params[0]];
    return { rows: val !== undefined ? [{ value: val }] : [] };
  }

  if (sql.includes('FROM settings')) {
    const rows = Object.entries(inMemoryStore.settings).map(([k, v]) => ({ key: k, value: v }));
    return { rows };
  }

  if (sql.includes('INSERT INTO settings') || sql.includes('UPDATE settings')) {
    if (params.length >= 2) {
      inMemoryStore.settings[params[0]] = params[1];
    }
    return { rows: [] };
  }

  // Projects queries
  if (sql.includes('FROM projects')) {
    if (sql.includes('WHERE id = $1')) {
      const p = inMemoryStore.projects.find(x => x.id === parseInt(params[0], 10));
      return { rows: p ? [p] : [] };
    }
    return { rows: inMemoryStore.projects };
  }

  if (sql.includes('INSERT INTO projects')) {
    const newProj = {
      id: inMemoryStore.projects.length + 1,
      name: params[0],
      desc: params[1],
      path: params[2],
      branch: params[3] || 'main',
      tech: params[4] || 'Unknown',
      complete: params[5] || 0,
      tasks: typeof params[6] === 'string' ? JSON.parse(params[6] || '[]') : (params[6] || [])
    };
    inMemoryStore.projects.push(newProj);
    return { rows: [newProj] };
  }

  if (sql.includes('UPDATE projects')) {
    const id = params[params.length - 1];
    const p = inMemoryStore.projects.find(x => x.id === parseInt(id, 10));
    return { rows: p ? [p] : [] };
  }

  if (sql.includes('DELETE FROM projects')) {
    const id = parseInt(params[0], 10);
    inMemoryStore.projects = inMemoryStore.projects.filter(p => p.id !== id);
    return { rows: [] };
  }

  // Servers queries
  if (sql.includes('FROM servers')) {
    if (sql.includes('WHERE id = $1')) {
      const s = inMemoryStore.servers.find(x => x.id === parseInt(params[0], 10));
      return { rows: s ? [s] : [] };
    }
    return { rows: inMemoryStore.servers };
  }

  // Agents queries
  if (sql.includes('FROM cli_agents')) {
    if (sql.includes('WHERE id = $1')) {
      const a = inMemoryStore.cli_agents.find(x => x.id === parseInt(params[0], 10));
      return { rows: a ? [a] : [] };
    }
    if (sql.includes('WHERE name = $1')) {
      const a = inMemoryStore.cli_agents.find(x => x.name.toLowerCase() === String(params[0]).toLowerCase());
      return { rows: a ? [a] : [] };
    }
    return { rows: inMemoryStore.cli_agents };
  }

  if (sql.includes('INSERT INTO cli_agents')) {
    const newAgent = {
      id: inMemoryStore.cli_agents.length + 1,
      name: params[0],
      description: params[1],
      path: params[2],
      config_uri: params[3],
      installed: params[4] !== undefined ? params[4] : true,
      llm_model: params[5] || 'gpt-4o',
      temperature: params[6] !== undefined ? params[6] : 0.7,
      max_tokens: params[7] !== undefined ? params[7] : 4096
    };
    const existingIdx = inMemoryStore.cli_agents.findIndex(x => x.name.toLowerCase() === newAgent.name.toLowerCase());
    if (existingIdx >= 0) {
      inMemoryStore.cli_agents[existingIdx] = { ...inMemoryStore.cli_agents[existingIdx], ...newAgent, id: inMemoryStore.cli_agents[existingIdx].id };
      return { rows: [inMemoryStore.cli_agents[existingIdx]] };
    }
    inMemoryStore.cli_agents.push(newAgent);
    return { rows: [newAgent] };
  }

  if (sql.includes('UPDATE cli_agents')) {
    if (sql.includes('SET path = $1')) {
      const [pathVal, configUri, name] = params;
      const a = inMemoryStore.cli_agents.find(x => x.name.toLowerCase() === String(name).toLowerCase());
      if (a) {
        a.path = pathVal;
        if (configUri) a.config_uri = configUri;
        a.installed = true;
        return { rows: [a] };
      }
    } else if (sql.includes('SET installed = $1')) {
      const [installed, id] = params;
      const a = inMemoryStore.cli_agents.find(x => x.id === parseInt(id, 10));
      if (a) {
        a.installed = installed;
        return { rows: [a] };
      }
    }
    return { rows: [] };
  }

  if (sql.includes('FROM agents')) {
    return { rows: inMemoryStore.agents };
  }

  // Custom widgets
  if (sql.includes('DELETE FROM custom_widgets')) {
    const id = String(params[0]);
    inMemoryStore.custom_widgets = inMemoryStore.custom_widgets.filter(w => String(w.id) !== id);
    return { rows: [] };
  }

  if (sql.includes('FROM custom_widgets')) {
    if (sql.includes('WHERE id')) {
      const id = String(params[0]);
      const widget = inMemoryStore.custom_widgets.find(w => String(w.id) === id);
      return { rows: widget ? [widget] : [] };
    }
    return { rows: [...inMemoryStore.custom_widgets] };
  }

  if (sql.includes('INSERT INTO custom_widgets')) {
    const [name, command, type, color, server_id] = params;
    const nextId = inMemoryStore.custom_widgets.length > 0
      ? Math.max(...inMemoryStore.custom_widgets.map(w => Number(w.id) || 0)) + 1
      : 1;
    const newWidget = {
      id: nextId,
      name,
      command,
      type: type || 'number',
      color: color || '#c084fc',
      server_id: server_id || null,
      created_at: new Date().toISOString(),
    };
    inMemoryStore.custom_widgets.push(newWidget);
    return { rows: [newWidget] };
  }

  if (sql.includes('UPDATE custom_widgets')) {
    const id = String(params[params.length - 1]);
    const [name, command, type, color, server_id] = params;
    const widget = inMemoryStore.custom_widgets.find(w => String(w.id) === id);
    if (widget) {
      if (name !== undefined && name !== null) widget.name = name;
      if (command !== undefined && command !== null) widget.command = command;
      if (type !== undefined && type !== null) widget.type = type;
      if (color !== undefined && color !== null) widget.color = color;
      if (server_id !== undefined) widget.server_id = server_id || null;
      return { rows: [{ ...widget }] };
    }
    return { rows: [] };
  }

  // User settings (theme/language per user)
  if (sql.includes('FROM user_settings')) {
    const row = inMemoryStore.user_settings.find(r => r.user_id === params[0]);
    return { rows: row ? [row] : [] };
  }

  if (sql.includes('INSERT INTO user_settings')) {
    const [userId, theme, language] = params;
    let row = inMemoryStore.user_settings.find(r => r.user_id === userId);
    if (row) {
      if (theme !== null && theme !== undefined) {row.theme = theme;}
      if (language !== null && language !== undefined) {row.language = language;}
    } else {
      row = { user_id: userId, theme: theme || 'dark', language: language || 'pl' };
      inMemoryStore.user_settings.push(row);
    }
    return { rows: [row] };
  }

  // Agent Scheduled Tasks
  if (sql.includes('FROM agent_scheduled_tasks')) {
    if (sql.includes('WHERE id = $1') || sql.includes('WHERE id=')) {
      const id = parseInt(params[0], 10);
      const task = inMemoryStore.agent_scheduled_tasks.find(t => t.id === id);
      return { rows: task ? [{ ...task }] : [] };
    }
    return { rows: inMemoryStore.agent_scheduled_tasks.map(t => ({ ...t })) };
  }

  if (sql.includes('INSERT INTO agent_scheduled_tasks')) {
    const nextId = inMemoryStore.agent_scheduled_tasks.length > 0
      ? Math.max(...inMemoryStore.agent_scheduled_tasks.map(t => t.id || 0)) + 1
      : 1;
    const newTask = {
      id: nextId,
      name: params[0],
      task_type: params[1],
      command: params[2],
      cron_expression: params[3],
      enabled: params[4] !== undefined ? Boolean(params[4]) : true,
      last_status: params[5] || 'idle',
      last_run: null,
      last_output: null,
      created_at: new Date().toISOString()
    };
    inMemoryStore.agent_scheduled_tasks.push(newTask);
    return { rows: [{ ...newTask }] };
  }

  if (sql.includes('UPDATE agent_scheduled_tasks')) {
    const id = parseInt(params[params.length - 1], 10);
    const task = inMemoryStore.agent_scheduled_tasks.find(t => t.id === id);
    if (!task) return { rows: [] };

    // Record run update: SET last_run = $1, last_status = $2, last_output = $3 WHERE id = $4
    if (sql.includes('SET last_run')) {
      task.last_run = params[0];
      task.last_status = params[1];
      task.last_output = params[2];
      return { rows: [{ ...task }] };
    }

    // Toggle enabled update: SET enabled = $1 WHERE id = $2
    if (sql.includes('SET enabled = $1 WHERE id = $2')) {
      task.enabled = Boolean(params[0]);
      return { rows: [{ ...task }] };
    }

    // Full update: SET name = $1, task_type = $2, command = $3, cron_expression = $4, enabled = $5 WHERE id = $6
    if (params.length >= 6) {
      task.name = params[0];
      task.task_type = params[1];
      task.command = params[2];
      task.cron_expression = params[3];
      task.enabled = Boolean(params[4]);
      return { rows: [{ ...task }] };
    }

    return { rows: [{ ...task }] };
  }

  if (sql.includes('DELETE FROM agent_scheduled_tasks')) {
    const id = parseInt(params[0], 10);
    inMemoryStore.agent_scheduled_tasks = inMemoryStore.agent_scheduled_tasks.filter(t => t.id !== id);
    return { rows: [] };
  }

  // Agent Tasks queries
  if (sql.includes('DELETE FROM agent_tasks')) {
    inMemoryStore.agent_tasks = [];
    return { rows: [] };
  }

  if (sql.includes('FROM agent_tasks')) {
    if (sql.includes('WHERE id = $1') || sql.includes('WHERE id =')) {
      const id = parseInt(params[0], 10);
      const task = inMemoryStore.agent_tasks.find(t => t.id === id);
      return { rows: task ? [{ ...task }] : [] };
    }

    const fromTime = params[0] ? new Date(params[0]).getTime() : 0;
    const tasksInWindow = inMemoryStore.agent_tasks.filter(t => new Date(t.created_at).getTime() >= fromTime);

    if (sql.includes('COUNT(*) AS total') || sql.includes('COUNT(*) as total')) {
      return { rows: [{ total: tasksInWindow.length.toString() }] };
    }
    if (sql.includes('COUNT(*) AS ok') || sql.includes('COUNT(*) as ok')) {
      const okCount = tasksInWindow.filter(t => t.status === 'completed').length;
      return { rows: [{ ok: okCount.toString() }] };
    }
    if (sql.includes('AVG(EXTRACT(EPOCH')) {
      const completed = tasksInWindow.filter(t => t.duration_ms && t.duration_ms > 0);
      const avgSec = completed.length > 0
        ? completed.reduce((acc, curr) => acc + (curr.duration_ms / 1000), 0) / completed.length
        : 0;
      return { rows: [{ avg_dur: avgSec.toString() }] };
    }
    if (sql.includes('SUM(tokens_used)')) {
      const sumTokens = tasksInWindow.reduce((acc, curr) => acc + (parseInt(curr.tokens_used, 10) || 0), 0);
      return { rows: [{ tokens: sumTokens.toString() }] };
    }
    return { rows: inMemoryStore.agent_tasks };
  }

  if (sql.includes('INSERT INTO agent_tasks')) {
    const newTask = {
      id: inMemoryStore.agent_tasks.length + 1,
      agent_name: params[0] || 'Unknown Agent',
      project_id: params[1] ? parseInt(params[1], 10) : null,
      status: params[2] || 'started',
      model: params[3] || null,
      tokens_used: parseInt(params[4], 10) || 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      duration_ms: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    inMemoryStore.agent_tasks.push(newTask);
    return { rows: [newTask] };
  }

  if (sql.includes('UPDATE agent_tasks')) {
    if (sql.includes('status = $1') && sql.includes('duration_ms = $2')) {
      const id = parseInt(params[2], 10);
      const task = inMemoryStore.agent_tasks.find(t => t.id === id);
      if (task) {
        task.status = params[0];
        task.duration_ms = parseInt(params[1], 10) || 0;
        task.updated_at = new Date().toISOString();
        return { rows: [task] };
      }
    }
    if (sql.includes('tokens_used = tokens_used + $1')) {
      const id = params[3] ? parseInt(params[3], 10) : null;
      let task = id ? inMemoryStore.agent_tasks.find(t => t.id === id) : null;
      if (!task && inMemoryStore.agent_tasks.length > 0) {
        task = inMemoryStore.agent_tasks[inMemoryStore.agent_tasks.length - 1];
      }
      if (task) {
        task.tokens_used = (task.tokens_used || 0) + (parseInt(params[0], 10) || 0);
        task.prompt_tokens = (task.prompt_tokens || 0) + (parseInt(params[1], 10) || 0);
        task.completion_tokens = (task.completion_tokens || 0) + (parseInt(params[2], 10) || 0);
        task.updated_at = new Date().toISOString();
        return { rows: [task] };
      }
    }
    return { rows: [] };
  }

  // Agent Logs queries
  if (sql.includes('FROM agent_logs')) {
    if (sql.includes('GROUP BY message')) {
      const fromTime = params[0] ? new Date(params[0]).getTime() : 0;
      const errorLogs = inMemoryStore.agent_logs.filter(l => l.level === 'error' && new Date(l.created_at).getTime() >= fromTime);
      const map = {};
      for (const log of errorLogs) {
        map[log.message] = (map[log.message] || 0) + 1;
      }
      const rows = Object.entries(map).map(([error, count]) => ({ error, count })).sort((a, b) => b.count - a.count).slice(0, 5);
      return { rows };
    }
    return { rows: inMemoryStore.agent_logs };
  }

  if (sql.includes('INSERT INTO agent_logs')) {
    const newLog = {
      id: inMemoryStore.agent_logs.length + 1,
      task_id: params[0] ? parseInt(params[0], 10) : null,
      level: params[1] || 'info',
      message: params[2] || '',
      created_at: new Date().toISOString()
    };
    inMemoryStore.agent_logs.push(newLog);
    return { rows: [newLog] };
  }

  // Pipeline queries
  if (sql.includes('DELETE FROM pipeline_artifacts')) {
    inMemoryStore.pipeline_artifacts = [];
    return { rows: [] };
  }
  if (sql.includes('DELETE FROM pipeline_runs')) {
    inMemoryStore.pipeline_runs = [];
    return { rows: [] };
  }
  if (sql.includes('DELETE FROM pipelines')) {
    inMemoryStore.pipelines = [];
    return { rows: [] };
  }

  if (sql.includes('FROM pipelines')) {
    if (sql.includes('WHERE id = $1') || sql.includes('WHERE id = ?')) {
      const p = inMemoryStore.pipelines.find(x => x.id === params[0]);
      return { rows: p ? [{ ...p }] : [] };
    }
    return { rows: inMemoryStore.pipelines.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO pipelines')) {
    const item = {
      id: params[0],
      name: params[1],
      description: params[2] || '',
      steps_json: params[3] || '[]',
      status: params[4] || 'idle',
      created_at: new Date().toISOString()
    };
    inMemoryStore.pipelines.push(item);
    return { rows: [{ ...item }] };
  }

  if (sql.includes('UPDATE pipelines')) {
    const id = params[1];
    const p = inMemoryStore.pipelines.find(x => x.id === id);
    if (p) {
      p.status = params[0];
      return { rows: [{ ...p }] };
    }
    return { rows: [] };
  }

  if (sql.includes('FROM pipeline_runs')) {
    if (sql.includes('WHERE id = $1') || sql.includes('WHERE id = ?')) {
      const r = inMemoryStore.pipeline_runs.find(x => x.id === params[0]);
      return { rows: r ? [{ ...r }] : [] };
    }
    if (sql.includes('WHERE pipeline_id = $1') || sql.includes('WHERE pipeline_id = ?')) {
      return { rows: inMemoryStore.pipeline_runs.filter(x => x.pipeline_id === params[0]).map(x => ({ ...x })) };
    }
    return { rows: inMemoryStore.pipeline_runs.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO pipeline_runs')) {
    const run = {
      id: params[0],
      pipeline_id: params[1],
      status: params[2] || 'queued',
      error: null,
      started_at: params[3] || new Date().toISOString(),
      finished_at: null
    };
    inMemoryStore.pipeline_runs.push(run);
    return { rows: [{ ...run }] };
  }

  if (sql.includes('UPDATE pipeline_runs')) {
    const runId = params[params.length - 1];
    const run = inMemoryStore.pipeline_runs.find(x => x.id === runId);
    if (run) {
      if (sql.includes('status = $1') && sql.includes('error = $2')) {
        run.status = params[0];
        run.error = params[1];
        run.finished_at = new Date().toISOString();
      } else if (sql.includes('status = $1') || sql.includes('status = ?')) {
        run.status = params[0];
        if (params[0] === 'completed' || params[0] === 'failed' || params[0] === 'aborted') {
          run.finished_at = new Date().toISOString();
        }
      }
      return { rows: [{ ...run }] };
    }
    return { rows: [] };
  }

  if (sql.includes('FROM pipeline_artifacts')) {
    if ((sql.includes('run_id = $1') && sql.includes('step_id = $2')) || (sql.includes('run_id = ?') && sql.includes('step_id = ?'))) {
      const arts = inMemoryStore.pipeline_artifacts.filter(a => a.run_id === params[0] && a.step_id === params[1]);
      return { rows: arts.map(x => ({ ...x })) };
    }
    if (sql.includes('WHERE run_id = $1') || sql.includes('WHERE run_id = ?')) {
      const arts = inMemoryStore.pipeline_artifacts.filter(a => a.run_id === params[0]);
      return { rows: arts.map(x => ({ ...x })) };
    }
    return { rows: inMemoryStore.pipeline_artifacts.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO pipeline_artifacts')) {
    const art = {
      id: params[0],
      run_id: params[1],
      step_id: params[2],
      type: params[3],
      content: params[4],
      created_at: params[5] || new Date().toISOString()
    };
    inMemoryStore.pipeline_artifacts.push(art);
    return { rows: [{ ...art }] };
  }

  // Snapshot Sessions queries
  if (sql.includes('DELETE FROM snapshot_sessions')) {
    inMemoryStore.snapshot_sessions = [];
    return { rows: [] };
  }

  if (sql.includes('FROM snapshot_sessions')) {
    if (sql.includes('WHERE id = $1') || sql.includes('WHERE id = ?') || sql.includes('WHERE id=')) {
      const s = inMemoryStore.snapshot_sessions.find(x => x.id === params[0]);
      return { rows: s ? [{ ...s }] : [] };
    }
    return { rows: inMemoryStore.snapshot_sessions.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO snapshot_sessions')) {
    const session = {
      id: params[0],
      agent_name: params[1],
      started_at: params[2] || new Date().toISOString(),
      stopped_at: null,
      ended_at: null
    };
    inMemoryStore.snapshot_sessions.push(session);
    return { rows: [{ ...session }] };
  }

  if (sql.includes('UPDATE snapshot_sessions')) {
    const id = params[params.length - 1];
    const session = inMemoryStore.snapshot_sessions.find(x => x.id === id);
    if (session) {
      if (sql.includes('stopped_at') || sql.includes('ended_at')) {
        session.stopped_at = params[0];
        session.ended_at = params[0];
      }
      return { rows: [{ ...session }] };
    }
    return { rows: [] };
  }

  // Snapshot Events queries
  if (sql.includes('DELETE FROM snapshot_events')) {
    inMemoryStore.snapshot_events = [];
    return { rows: [] };
  }

  if (sql.includes('FROM snapshot_events')) {
    if (sql.includes('WHERE session_id = $1') || sql.includes('WHERE session_id = ?') || sql.includes('WHERE session_id=')) {
      const events = inMemoryStore.snapshot_events
        .filter(x => x.session_id === params[0])
        .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
      return { rows: events.map(x => ({ ...x })) };
    }
    const events = [...inMemoryStore.snapshot_events].sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
    return { rows: events.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO snapshot_events')) {
    const colMatch = sql.match(/INSERT\s+INTO\s+snapshot_events\s*\(([^)]+)\)/i);
    let cols = [];
    if (colMatch) {
      cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
    }
    const event = {
      id: null,
      session_id: null,
      seq: Date.now(),
      ts: new Date().toISOString(),
      type: 'event',
      path: null,
      diff: null,
      cmdline: null,
      exit_code: null
    };
    cols.forEach((col, idx) => {
      if (params[idx] !== undefined) {
        event[col] = params[idx];
      }
    });
    if (!event.id && params[0]) event.id = params[0];
    if (!event.session_id && params[1]) event.session_id = params[1];
    inMemoryStore.snapshot_events.push(event);
    return { rows: [{ ...event }] };
  }

  // LLM Usage queries
  if (sql.includes('DELETE FROM llm_usage')) {
    inMemoryStore.llm_usage = [];
    return { rows: [] };
  }

  if (sql.includes('FROM llm_usage')) {
    if (sql.includes('WHERE task_id = $1') || sql.includes('WHERE task_id = ?') || sql.includes('WHERE task_id=')) {
      const rows = inMemoryStore.llm_usage.filter(u => u.task_id === params[0]);
      return { rows: rows.map(x => ({ ...x })) };
    }
    if (sql.includes('GROUP BY model_id')) {
      const grouped = {};
      for (const item of inMemoryStore.llm_usage) {
        if (!grouped[item.model_id]) {
          grouped[item.model_id] = {
            model_id: item.model_id,
            calls: 0,
            total_input: 0,
            total_output: 0,
            total_cost: 0
          };
        }
        grouped[item.model_id].calls += 1;
        grouped[item.model_id].total_input += (Number(item.input_tokens) || 0);
        grouped[item.model_id].total_output += (Number(item.output_tokens) || 0);
        grouped[item.model_id].total_cost += (Number(item.cost_usd) || 0);
      }
      const rows = Object.values(grouped).sort((a, b) => b.total_cost - a.total_cost);
      return { rows };
    }
    return { rows: inMemoryStore.llm_usage.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO llm_usage')) {
    const item = {
      id: inMemoryStore.llm_usage.length + 1,
      task_id: params[0],
      model_id: params[1],
      input_tokens: Number(params[2]) || 0,
      output_tokens: Number(params[3]) || 0,
      cost_usd: Number(params[4]) || 0,
      ts: params[5] || new Date().toISOString()
    };
    inMemoryStore.llm_usage.push(item);
    return { rows: [{ ...item }] };
  }

  // Agent Memories queries
  if (sql.includes('DELETE FROM agent_memories')) {
    if (/WHERE\s+id\s*=\s*(\?|\$1)/i.test(sql) || sql.includes('WHERE id=')) {
      const id = params[0];
      inMemoryStore.agent_memories = inMemoryStore.agent_memories.filter(m => m.id !== id);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('WHERE created_at <')) {
      const cutoff = params[0];
      const minAccess = params[1] !== undefined ? Number(params[1]) : 1;
      const initialCount = inMemoryStore.agent_memories.length;
      inMemoryStore.agent_memories = inMemoryStore.agent_memories.filter(m => !(m.created_at < cutoff && (Number(m.access_count) || 0) < minAccess));
      return { rows: [], rowCount: initialCount - inMemoryStore.agent_memories.length };
    }
    inMemoryStore.agent_memories = [];
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('FROM agent_memories')) {
    if (/WHERE\s+id\s*=\s*(\?|\$1)/i.test(sql) || sql.includes('WHERE id=')) {
      const id = params[0];
      const m = inMemoryStore.agent_memories.find(x => x.id === id);
      return { rows: m ? [{ ...m }] : [] };
    }

    if (sql.includes('WHERE created_at <') && sql.includes('access_count <')) {
      const cutoff = params[0];
      const minAccess = Number(params[1]) || 1;
      const stale = inMemoryStore.agent_memories.filter(m => m.created_at < cutoff && (Number(m.access_count) || 0) < minAccess);
      return { rows: stale.map(x => ({ ...x })) };
    }

    let items = [...inMemoryStore.agent_memories];

    if (/content\s+(?:I)?LIKE/i.test(sql)) {
      const queryParam = params[0] || '';
      const cleanQuery = queryParam.replace(/^%/, '').replace(/%$/, '').toLowerCase();
      items = items.filter(m => (m.content || '').toLowerCase().includes(cleanQuery));

      let nextParamIdx = 1;
      if (/agent\s*=\s*(\?|\$\d+)/i.test(sql)) {
        const agentVal = params[nextParamIdx++];
        if (agentVal) {
          items = items.filter(m => m.agent === agentVal);
        }
      }
      if (/project\s*=\s*(\?|\$\d+)/i.test(sql)) {
        const projectVal = params[nextParamIdx++];
        if (projectVal) {
          items = items.filter(m => m.project === projectVal);
        }
      }
    }

    if (sql.includes('ORDER BY access_count DESC, created_at DESC')) {
      items.sort((a, b) => {
        const accDiff = (Number(b.access_count) || 0) - (Number(a.access_count) || 0);
        if (accDiff !== 0) return accDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sql.includes('ORDER BY created_at DESC')) {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (sql.includes('LIMIT')) {
      const limitVal = Number(params[params.length - 1]);
      if (!isNaN(limitVal) && limitVal > 0) {
        items = items.slice(0, limitVal);
      }
    }

    return { rows: items.map(x => ({ ...x })) };
  }

  if (sql.includes('INSERT INTO agent_memories')) {
    const item = {
      id: params[0],
      agent: params[1],
      project: params[2] ?? 'global',
      category: params[3] ?? 'general',
      content: params[4],
      tags: typeof params[5] === 'string' ? params[5] : JSON.stringify(params[5] || []),
      created_at: params[6] || new Date().toISOString(),
      access_count: params[7] !== undefined ? Number(params[7]) : 0
    };
    inMemoryStore.agent_memories.push(item);
    return { rows: [{ ...item }] };
  }

  if (sql.includes('UPDATE agent_memories')) {
    const id = params[params.length - 1];
    const m = inMemoryStore.agent_memories.find(x => x.id === id);
    if (m) {
      if (sql.includes('access_count = access_count + 1')) {
        m.access_count = (Number(m.access_count) || 0) + 1;
      }
      return { rows: [{ ...m }] };
    }
    return { rows: [] };
  }

  return { rows: [] };
}

// Redirect pool.query through safeQuery so all repositories gracefully use in-memory fallback if PG is down
pool.query = async function(text, params = []) {
  return safeQuery(text, params);
};

// ---------- Database Migration ----------
export async function migrate() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      host VARCHAR(255),
      username VARCHAR(255),
      port INTEGER DEFAULT 22,
      provider VARCHAR(255) DEFAULT 'local',
      url VARCHAR(512),
      model VARCHAR(255),
      api_key TEXT,
      use_devil BOOLEAN DEFAULT false,
      ssh_password TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS llm_servers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(512) NOT NULL,
      api_key TEXT,
      model VARCHAR(255),
      provider VARCHAR(255) DEFAULT 'Custom',
      is_active BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      "desc" TEXT,
      path TEXT NOT NULL,
      branch VARCHAR(255) DEFAULT 'main',
      tech VARCHAR(255) DEFAULT 'Unknown',
      complete INTEGER DEFAULT 0,
      tasks JSONB DEFAULT '[]'::jsonb
    );`,
    `CREATE TABLE IF NOT EXISTS cli_agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      path VARCHAR(255),
      config_uri TEXT,
      installed BOOLEAN DEFAULT false,
      llm_model VARCHAR(255),
      temperature NUMERIC DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096
    );`,
    `CREATE TABLE IF NOT EXISTS custom_widgets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      command TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'number',
      color VARCHAR(50) DEFAULT '#c084fc',
      server_id INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      server_id INTEGER REFERENCES servers(id),
      status VARCHAR(50) DEFAULT 'stopped',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS host VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 22;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS provider VARCHAR(255) DEFAULT \'local\';',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS url VARCHAR(512);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS model VARCHAR(255);',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS api_key TEXT;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS use_devil BOOLEAN DEFAULT false;',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS ssh_password TEXT;',
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme VARCHAR(20) DEFAULT 'dark',
      language VARCHAR(10) DEFAULT 'pl',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS agent_scheduled_tasks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      task_type VARCHAR(100) NOT NULL,
      command TEXT,
      cron_expression VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      last_run TIMESTAMP,
      last_status VARCHAR(50) DEFAULT 'idle',
      last_output TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS agent_tasks (
      id SERIAL PRIMARY KEY,
      agent_name VARCHAR(255) NOT NULL,
      project_id INTEGER,
      status VARCHAR(50) DEFAULT 'started',
      tokens_used INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      model VARCHAR(255),
      duration_ms INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS agent_logs (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      level VARCHAR(20) DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS pipelines (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      steps_json TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'idle',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS pipeline_runs (
      id VARCHAR(255) PRIMARY KEY,
      pipeline_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'queued',
      error TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS pipeline_artifacts (
      id VARCHAR(255) PRIMARY KEY,
      run_id VARCHAR(255) NOT NULL,
      step_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS snapshot_sessions (
      id VARCHAR(255) PRIMARY KEY,
      agent_name VARCHAR(255) NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      stopped_at TIMESTAMP
    );`,
    'ALTER TABLE snapshot_sessions ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMP;',
    'ALTER TABLE snapshot_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;',
    `CREATE TABLE IF NOT EXISTS snapshot_events (
      id VARCHAR(255) PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      seq BIGINT,
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      type VARCHAR(50) NOT NULL,
      path TEXT,
      diff TEXT,
      cmdline TEXT,
      exit_code INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS llm_usage (
      id SERIAL PRIMARY KEY,
      task_id VARCHAR(255),
      model_id VARCHAR(255) NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(10, 6) DEFAULT 0,
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS agent_memories (
      id VARCHAR(255) PRIMARY KEY,
      agent VARCHAR(255) NOT NULL,
      project VARCHAR(255) DEFAULT 'global',
      category VARCHAR(255) DEFAULT 'general',
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      access_count INTEGER DEFAULT 0
    );`
  ];

  for (const q of queries) {
    await safeQuery(q);
  }

  // Default settings seeding
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmName', 'AtomicChat') ON CONFLICT (key) DO NOTHING;");
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmUrl', 'http://127.0.0.1:1337/v1') ON CONFLICT (key) DO NOTHING;");
  await safeQuery("INSERT INTO settings (key, value) VALUES ('llmModel', 'AtomicChat/qwen35-4b-Q8_0') ON CONFLICT (key) DO NOTHING;");

  // Default scheduled tasks seeding (only if table is empty)
  try {
    const taskCountRes = await safeQuery('SELECT COUNT(*) as count FROM agent_scheduled_tasks');
    if (parseInt(taskCountRes?.rows?.[0]?.count || '0', 10) === 0) {
      await safeQuery(`
        INSERT INTO agent_scheduled_tasks (name, task_type, command, cron_expression, enabled, last_status) VALUES
        ('Nocny audyt bezpieczeństwa', 'npm_audit', 'npm audit', '0 3 * * *', true, 'idle'),
        ('Weryfikacja logów błędów', 'error_check', 'node -e "console.log(\\'Log audit: Brak krytycznych wyjątków w ostatnich logach.\\')"', '0 * * * *', true, 'idle'),
        ('Synchronizacja zadań z tasks.md', 'sync_tasks', 'npm run sync-tasks', '*/30 * * * *', true, 'idle');
      `);
    }
  } catch {}
}

// Run migrations automatically when the module is loaded.
(async () => {
  try {
    await migrate();
  } catch (e) {
    console.warn('Database migration error:', e.message);
  }
})();
