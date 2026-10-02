import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec, execFile, execSync } from 'child_process';
import * as projectsRepo from './projectsRepository.js';
import * as settingsRepo from '../settings/settingsRepository.js';
import * as agentsRepo from '../agents/agentsRepository.js';
import * as gitService from '../git/gitService.js';
import { getBestAvailableModel } from '../utils/llm.js';
import { updateTaskInWorkspaceFile, syncProjectTasks, syncAllProjects, findMarkdownFiles, extractChecklistItems } from './tasksSyncService.js';
import { detectTechnology } from './techDetector.js';

export const projectsRouter = express.Router();

export function getWslHostIp() {
  if (process.platform !== 'linux') return null;
  try {
    const isWsl = fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    if (!isWsl) return null;
    const route = execSync("ip route show default | awk '{print $3}'", { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (route && /^\d+\.\d+\.\d+\.\d+$/.test(route)) return route;
  } catch {}
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const m = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (m) return m[1];
  } catch {}
  return null;
}

export function getAvailableDrives() {
  if (process.platform !== 'win32') {
    return ['/'];
  }
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    try {
      if (fs.existsSync(drivePath)) {
        drives.push(drivePath);
      }
    } catch  {
      // Ignore drives that are not accessible
    }
  }
  return drives;
}

// List directories for folder picker
projectsRouter.get('/fs/directories', (req, res) => {
  try {
    const isWindows = process.platform === 'win32';
    const rawPath = req.query.path !== undefined ? String(req.query.path).trim() : null;
    const availableDrives = getAvailableDrives();

    // If path is 'DRIVES' (navigating up from drive root or listing root disks)
    if (rawPath && (rawPath.toUpperCase() === 'DRIVES' || rawPath === '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}')) {
      return res.json({
        currentPath: isWindows ? '' : '/',
        parentPath: null,
        directories: availableDrives.map(d => ({
          name: isWindows ? `Dysk (${d.replace(/\\$/, '')})` : 'Root (/)',
          path: d,
          isDrive: true
        })),
        drives: availableDrives
      });
    }

    let targetPath = rawPath && rawPath !== '' ? rawPath : os.homedir();

    // Normalize Windows drive letter inputs like 'c:' or 'C:' or 'c:/' to 'C:\'
    if (isWindows && /^[a-zA-Z]:[/\\]?$/.test(targetPath)) {
      targetPath = targetPath.substring(0, 2).toUpperCase() + '\\';
    }

    targetPath = path.resolve(targetPath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: `Ścieżka nie istnieje: ${targetPath}`, currentPath: targetPath, drives: availableDrives });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }

    // Determine parent path
    let parentPath = null;
    const isDriveRoot = isWindows && /^[a-zA-Z]:\\?$/.test(targetPath);
    if (isWindows && isDriveRoot) {
      parentPath = 'DRIVES';
    } else {
      parentPath = path.dirname(targetPath) !== targetPath ? path.dirname(targetPath) : null;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

    const directories = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // ignore hidden folders
      if (entry.name === 'node_modules') continue;

      try {
        if (entry.isDirectory()) {
          directories.push({
            name: entry.name,
            path: path.join(targetPath, entry.name)
          });
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    res.json({
      currentPath: targetPath,
      parentPath,
      directories,
      drives: availableDrives
    });
  } catch (err) {
    res.status(500).json({ error: err.message, drives: getAvailableDrives() });
  }
});

// Get Projects
projectsRouter.get('/projects', async (req, res) => {
  try {
    const projects = await projectsRepo.getProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Project
projectsRouter.post('/projects', async (req, res) => {
  let { name, desc, path: p, branch, tech, complete, tasks } = req.body;
  try {
    if ((!tech || tech === 'Unknown') && p) {
      const detected = detectTechnology(p);
      if (detected && detected !== 'Unknown') {
        tech = detected;
      }
    }

    if ((!tasks || tasks.length === 0) && p && fs.existsSync(p)) {
      try {
        const mdFiles = findMarkdownFiles(p, 2);
        const allWorkspaceItems = [];
        for (const f of mdFiles) {
          allWorkspaceItems.push(...extractChecklistItems(f, p));
        }
        if (allWorkspaceItems.length > 0) {
          let idCounter = 1;
          tasks = allWorkspaceItems.map(item => ({
            id: idCounter++,
            title: item.title,
            meta: item.file,
            status: item.isCompleted ? 'completed' : 'pending'
          }));
          const active = tasks.filter(t => t.status !== 'archived');
          const completedCount = active.filter(t => t.status === 'completed').length;
          complete = active.length > 0 ? Math.round((completedCount / active.length) * 100) : 0;
        }
      } catch {
        // Fallback to empty tasks
      }
    }

    const row = await projectsRepo.createProject({
      name,
      desc,
      path: p,
      branch,
      tech,
      complete,
      tasks
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Project
projectsRouter.put('/projects/:id', async (req, res) => {
  try {
    const row = await projectsRepo.updateProject(req.params.id, req.body);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update all tasks for a project directly
projectsRouter.put('/projects/:id/tasks', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Field "tasks" must be an array' });
    }
    const activeTasks = tasks.filter(t => t.status !== 'archived');
    const complete = activeTasks.length > 0
      ? Math.round((activeTasks.filter(t => t.status === 'completed').length / activeTasks.length) * 100)
      : 0;
    const row = await projectsRepo.updateProject(req.params.id, { tasks, complete });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a single task within a project
projectsRouter.patch('/projects/:id/tasks/:taskId', async (req, res) => {
  try {
    const projectId = req.params.id;
    const taskId = parseInt(req.params.taskId, 10);
    const projects = await projectsRepo.getProjects();
    const project = projects.find(p => p.id === parseInt(projectId, 10));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const currentTasks = project.tasks || [];
    const taskIndex = currentTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const existingTask = currentTasks[taskIndex];
    currentTasks[taskIndex] = { ...existingTask, ...req.body, id: taskId };
    const activeTasks = currentTasks.filter(t => t.status !== 'archived');
    const complete = activeTasks.length > 0
      ? Math.round((activeTasks.filter(t => t.status === 'completed').length / activeTasks.length) * 100)
      : 0;

    const row = await projectsRepo.updateProject(projectId, { tasks: currentTasks, complete });

    // If status was changed and project has a valid workspace path, sync the markdown checklist in workspace
    let workspaceResult = { updated: false };
    if (req.body.status && project.path && (req.body.status === 'completed' || req.body.status === 'pending')) {
      workspaceResult = updateTaskInWorkspaceFile(project.path, existingTask.title, req.body.status, existingTask.meta);
    }

    res.json({
      ...row,
      workspaceUpdated: workspaceResult.updated,
      workspaceFile: workspaceResult.file || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Synchronize tasks between workspace files and DB for a specific project
projectsRouter.post('/projects/:id/sync-tasks', async (req, res) => {
  try {
    const result = await syncProjectTasks(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Synchronize tasks across all projects
projectsRouter.post('/projects/sync-tasks', async (req, res) => {
  try {
    const results = await syncAllProjects(req.body || {});
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete Project
projectsRouter.delete('/projects/:id', async (req, res) => {
  try {
    const result = await projectsRepo.deleteProject(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pick Folder API
projectsRouter.get('/pick-folder', (req, res) => {
  if (process.platform === 'win32') {
    // Build the dialog script as a here-string to avoid fragile quote-escaping in a
    // one-line command, and force it into the foreground via a hidden TopMost owner
    // form (otherwise FolderBrowserDialog can open behind the browser/terminal window,
    // making it look like nothing happened).
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Add-Type -AssemblyName System.Drawing',
      '$owner = New-Object System.Windows.Forms.Form',
      '$owner.TopMost = $true',
      '$owner.StartPosition = "CenterScreen"',
      '$owner.ShowInTaskbar = $false',
      '$owner.Size = New-Object System.Drawing.Size(0,0)',
      '$owner.Show()',
      '$owner.Activate()',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$d.Description = "Wybierz folder projektu"',
      'try {',
      '  if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }',
      '} finally {',
      '  $owner.Close()',
      '}'
    ].join('; ');

    // -STA is required for WinForms dialogs; run via execFile with an args array
    // instead of a single quoted string to avoid shell-escaping issues.
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Sta', '-Command', psScript], (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        if (error) {
          console.error('pick-folder dialog failed:', error.message, stderr && stderr.trim());
        }
        return res.status(204).send();
      }
      res.json({ path: stdout.trim() });
    });
  } else {
    exec('zenity --file-selection --directory --title="Wybierz folder projektu"', (error, stdout) => {
      if (error) {
        if (error.code === 1) {return res.status(204).send();}
        return res.status(500).json({ error: error.message });
      }
      res.json({ path: stdout.trim() });
    });
  }
});

// Init Git
projectsRouter.post('/init-git', (req, res) => {
  const { directory } = req.body;
  if (!directory) {return res.status(400).json({ error: 'Missing directory' });}
  
  try {
    const result = gitService.initGit(directory);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze project directory
projectsRouter.post('/analyze', async (req, res) => {
  let { directory } = req.body;
  if (!directory) {return res.status(400).json({ error: 'Missing directory' });}
  
  if (directory.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    directory = path.join(home, directory.slice(2));
  }
  
  if (!fs.existsSync(directory)) {
    return res.status(400).json({ error: `Invalid directory: ${directory}` });
  }

  let techStack = detectTechnology(directory);
  const tasks = [];
  
  try {

    let idCounter = 1;

    // 1. Markdown checklists (*.md)
    const allFiles = fs.readdirSync(directory);
    const mdFiles = allFiles.filter(f => f.endsWith('.md') && !f.startsWith('node_modules'));
    for (const mdFile of mdFiles) {
      const mdPath = path.join(directory, mdFile);
      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const match = line.match(/^(?:[-*+]\s+|\d+\.\s+)?\[([ xX])\]\s*(.*)$/);
          if (match) {
            const status = (match[1] === 'x' || match[1] === 'X') ? 'completed' : 'pending';
            const taskTitle = match[2].trim();
            if (taskTitle) {
              tasks.push({ id: idCounter++, title: taskTitle, meta: mdFile, status });
            }
          }
        }
      }
    }

    // 2. Scan for TODO / FIXME in code
    try {
      const stdout = execSync(
        `grep -rnE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.autohand --exclude-dir=.gemini --exclude=SKILL.md "TOD[O]:|FIXM[E]:" "${directory}" | head -n 15`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const lines = stdout.split('\n').filter(Boolean);
      lines.forEach(line => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (match) {
          const file = path.basename(match[1]);
          let text = match[3].replace(/TOD[O]:/g, '').replace(/FIXM[E]:/g, '').trim();
          if (text.startsWith('//')) {text = text.substring(2).trim();}
          if (text.startsWith('*')) {text = text.substring(1).trim();}
          if (text.length > 60) {text = text.substring(0, 57) + '...';}
          if (text && !tasks.find(t => t.title === text)) {
            tasks.push({ id: idCounter++, title: text, meta: `Code: ${file}`, status: 'pending' });
          }
        }
      });
    } catch {}

    // 3. Fallback to Package.json scripts only if no real tasks found
    if (tasks.length === 0 && fs.existsSync(path.join(directory, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.scripts) {
        for (const scriptName of Object.keys(pkg.scripts)) {
          tasks.push({ id: idCounter++, title: `NPM Script: ${scriptName}`, meta: 'Scripts', status: 'pending' });
        }
      }
    }

    // 3. LLM Integration
    try {
      const { llmUrl, apiKey } = await settingsRepo.getLlmCredentials();

      if (llmUrl && apiKey) {
        const url = llmUrl.endsWith('/chat/completions') ? llmUrl : (llmUrl.endsWith('/') ? llmUrl.slice(0, -1) : llmUrl) + '/chat/completions';
        const activeModel = await getBestAvailableModel(llmUrl, apiKey);

        // Create AbortController with 10-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: activeModel,
              messages: [{
                role: 'user',
                content: `Zasugeruj 2 zadania (tablica JSON stringów np. ["Zrób A", "Zrób B"]) dla projektu w technologii: ${techStack}. Pomiń formatowanie i komentarze, wypisz samo JSON.`
              }],
              temperature: 0.3
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const llmData = await res.json();
            const content = llmData?.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[.*\]/s);
            if (jsonMatch) {
              const aiTasks = JSON.parse(jsonMatch[0]);
              aiTasks.forEach(aiTask => {
                tasks.push({ id: idCounter++, title: aiTask, meta: 'AI Suggestion', status: 'pending' });
              });
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            console.warn(`LLM request timed out after 10s for ${llmUrl}`);
          } else {
            console.warn(`LLM connection failed for ${llmUrl}: ${fetchErr.message}`);
          }
        }
      }
    } catch (e) {
      console.error('LLM error in analyze:', e);
    }

    if (tasks.length === 0) {
      tasks.push({ id: 1, title: 'Inicjalizacja środowiska', meta: 'Setup', status: 'pending' });
    }

    let branch = null;
    try {
      const gitStatus = gitService.getStatus(directory);
      branch = gitStatus.branch;
    } catch {
      // Ignore if not a git repo
    }

    res.json({ tech: techStack, tasks, branch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy project using agents
projectsRouter.post('/deploy', async (req, res) => {
  const { agent, directory, tasks, useBrowserTerminal, remoteServer, remotePrompt } = req.body;
  let targetDir = directory || process.cwd();
  
  if (targetDir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(home, targetDir.slice(2));
  }

  try {
    // Load LLM settings from DB as fallbacks/defaults
    const dbSettings = await settingsRepo.getSettings();
    const llmUrl = req.body.llmUrl || dbSettings.llmUrl || '';
    const apiKey = req.body.apiKey || dbSettings.apiKey || '';
    const llmName = req.body.llmName || dbSettings.llmName || 'Gemini 3.6 Flash';
    const llmModel = req.body.llmModel || dbSettings.llmModel || '';

    console.log(`Deploying ${agent} in ${targetDir} [Provider: ${llmName}]`);

    let command = '';
    let args = [];
    // Only pass safe agent environment variables to terminal / worker session.
    // Do NOT leak host system variables like HOME, USER, LOGNAME, PWD, DB passwords, etc.
    const env = {
      ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
      ...(process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {}),
      ...(process.env.GEMINI_API_KEY ? { GEMINI_API_KEY: process.env.GEMINI_API_KEY } : {})
    };

    const wslHostIp = getWslHostIp();
    const formatBaseUrl = (url) => {
      if (!url) return '';
      let cleaned = String(url).trim();
      if (wslHostIp && (cleaned.includes('localhost') || cleaned.includes('127.0.0.1'))) {
        cleaned = cleaned.replace('localhost', wslHostIp).replace('127.0.0.1', wslHostIp);
      } else {
        cleaned = cleaned.replace('127.0.0.1', 'localhost');
      }
      if (!/^https?:\/\//i.test(cleaned)) {
        cleaned = `http://${cleaned}`;
      }
      return cleaned;
    };

    const formatAnthropicBaseUrl = (url) => {
      if (!url) return '';
      const cleaned = formatBaseUrl(url);
      // Claude Code / Anthropic SDK automatically appends /v1/messages,
      // so strip trailing /v1 or /v1/ to prevent /v1/v1/messages which causes API Error (HTTP 200)
      return cleaned.replace(/\/v1\/?$/, '');
    };

    const isRealApiKey = (key) => {
      if (!key || typeof key !== 'string') return false;
      const trimmed = key.trim();
      return trimmed !== '' && trimmed !== 'Brak' && !trimmed.startsWith('http://') && !trimmed.startsWith('https://');
    };

    // Look up agent record from DB if present
    let targetAgent = null;
    try {
      const allAgents = await agentsRepo.getAgents();
      targetAgent = allAgents.find(a => 
        (a.name && a.name.toLowerCase() === String(agent || '').toLowerCase()) || 
        String(a.id) === String(agent)
      );
    } catch (e) {
      console.warn('Failed to query agents repository in deploy handler:', e.message);
    }

    const agentRaw = String(agent || '').toLowerCase();
    const agentName = String(targetAgent?.name || '').toLowerCase();
    const agentPath = targetAgent?.path || '';
    const agentPathLower = agentPath.toLowerCase();

    const isClaude = agentRaw === 'claude' || 
                     agentRaw === 'claude code' || 
                     agentRaw.includes('claude') || 
                     agentName.includes('claude') || 
                     agentPathLower.endsWith('/claude') || 
                     agentPathLower.endsWith('\\claude.cmd') || 
                     agentPathLower.endsWith('\\claude.exe') ||
                     agentPathLower.endsWith('claude');

    const isAntigravity = agentRaw === 'antigravity' || 
                          agentRaw === 'agy' || 
                          agentName.includes('antigravity') || 
                          agentPathLower.endsWith('/agy') || 
                          agentPathLower.endsWith('\\agy.cmd') || 
                          agentPathLower.endsWith('agy');

    const isCodex = agentRaw === 'codex' || 
                    agentName.includes('codex') || 
                    agentPathLower.includes('codex');

    const isGemini = agentRaw.includes('gemini') || 
                     agentName.includes('gemini') || 
                     agentPathLower.includes('gemini');

    const isAider = agentRaw.includes('aider') || 
                    agentName.includes('aider') || 
                    agentPathLower.includes('aider');

    const isOpenCode = agentRaw.includes('opencode') || 
                       agentName.includes('opencode') || 
                       agentPathLower.includes('opencode');

    let binExec = agentPath || '';
    if (!binExec || binExec.includes('/home/seba') || (path.isAbsolute(binExec) && !fs.existsSync(binExec))) {
      if (isClaude) binExec = 'claude';
      else if (isAntigravity) binExec = 'agy';
      else if (isCodex) binExec = 'codex';
      else if (isGemini) binExec = 'gemini';
      else if (isAider) binExec = 'aider';
      else if (isOpenCode) binExec = 'opencode';
      else binExec = agent;
    }

    const hasRealAnthropicKey = isRealApiKey(apiKey) || isRealApiKey(process.env.ANTHROPIC_API_KEY);
    const validAnthropicKey = isRealApiKey(apiKey) ? apiKey : (isRealApiKey(process.env.ANTHROPIC_API_KEY) ? process.env.ANTHROPIC_API_KEY : '');
    const isClaudeModel = typeof llmModel === 'string' && llmModel.toLowerCase().includes('claude');

    if (isClaude) {
      if (llmUrl) {
        const anthropicBaseUrl = formatAnthropicBaseUrl(llmUrl);
        const anthropicToken = validAnthropicKey || apiKey || 'lmstudio';
        env.ANTHROPIC_BASE_URL = anthropicBaseUrl;
        env.ANTHROPIC_AUTH_TOKEN = anthropicToken;
        env.ANTHROPIC_API_KEY = anthropicToken;
        env.CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT = '1';
        if (llmModel) {
          env.ANTHROPIC_MODEL = llmModel;
        }
      } else if (hasRealAnthropicKey && validAnthropicKey) {
        env.ANTHROPIC_API_KEY = validAnthropicKey;
        env.ANTHROPIC_AUTH_TOKEN = validAnthropicKey;
        if (isClaudeModel && llmModel) {
          env.ANTHROPIC_MODEL = llmModel;
        }
      }
    } else {
      if (llmUrl) {
        const formatted = formatBaseUrl(llmUrl);
        env.ANTHROPIC_BASE_URL = formatted;
        env.OPENAI_BASE_URL = formatted;
      }
      const effectiveApiKey = apiKey || (env.ANTHROPIC_API_KEY || (llmUrl ? 'http://localhost:1234/' : ''));
      if (effectiveApiKey) {
        env.ANTHROPIC_API_KEY = effectiveApiKey;
        env.OPENAI_API_KEY = effectiveApiKey;
        env.ANTHROPIC_AUTH_TOKEN = effectiveApiKey;
      }
      if (llmModel) {
        env.ANTHROPIC_MODEL = llmModel;
        env.LLM_MODEL = llmModel;
        env.OPENAI_MODEL = llmModel;
      }
    }

    // Dynamic agent execution
    let agentCmd = '';
    let promptBlock = '';
    
    // Map full names from frontend or DB to CLI commands
    let agentBaseCmd = `"${binExec}"`;
    if (isCodex) {
      const isLocalOss = Boolean(
        (llmUrl && (llmUrl.includes('1234') || llmUrl.includes('11434') || llmUrl.includes('localhost') || llmUrl.includes('127.0.0.1') || (wslHostIp && llmUrl.includes(wslHostIp)))) ||
        (llmName && /lm\s*studio|ollama|local/i.test(llmName))
      );
      if (llmModel) {
        agentBaseCmd = isLocalOss ? `"${binExec}" --oss -m "${llmModel}"` : `"${binExec}" -m "${llmModel}"`;
      } else {
        agentBaseCmd = `"${binExec}"`;
      }
    } else if (isClaude) {
      if (llmModel) {
        agentBaseCmd = `"${binExec}" --model "${llmModel}"`;
      } else {
        agentBaseCmd = `"${binExec}"`;
      }
    }
    
    const scriptPath = path.join(targetDir, '.start_agent.sh');
    
    if (remoteServer) {
      const sshCmdStr = `ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes ${remoteServer.username}@${remoteServer.host} -p ${remoteServer.port || 22}`;
      const promptText = `Jesteś DevOps agentem. Połącz się z serwerem przez SSH używając komendy: '${sshCmdStr}'. Następnie wykonaj zadanie: ${remotePrompt 
      || 'Sprawdź stan serwera i zoptymalizuj go.'}. Wszystkie operacje wykonuj w ramach sesji SSH na zdalnym serwerze. UWAGA: używaj poleceń w pełni zautomatyzowanych, bez interaktywnych promptów (użyliśmy BatchMode=yes).`;
      promptBlock = `AGENT_PROMPT=$(cat << 'EOF_AGENT_PROMPT'\n${promptText}\nEOF_AGENT_PROMPT\n)\n`;
      agentCmd = isAntigravity ? `${agentBaseCmd} -i "$AGENT_PROMPT"` : `${agentBaseCmd} "$AGENT_PROMPT"`;
    } else if (tasks && tasks.length > 0) {
      const taskListStr = tasks.map((t, idx) => `${idx + 1}. [${t.status === 'completed' ? 'REWORK' : 'TODO'}] ${t.title}`).join('\n');
      const promptText = `Zrealizuj poniższe zadania dla tego projektu:\n${taskListStr}\n\nPo ich wykonaniu przedstaw podsumowanie zrobionych prac.`;
      promptBlock = `AGENT_PROMPT=$(cat << 'EOF_AGENT_PROMPT'\n${promptText}\nEOF_AGENT_PROMPT\n)\n`;
      agentCmd = isAntigravity ? `${agentBaseCmd} -i "$AGENT_PROMPT"` : `${agentBaseCmd} "$AGENT_PROMPT"`;
    } else {
      agentCmd = agentBaseCmd;
    }
      
    const exportEnvLines = [
      'unset ANTHROPIC_BASE_URL OPENAI_BASE_URL ANTHROPIC_API_KEY OPENAI_API_KEY ANTHROPIC_MODEL LLM_MODEL OPENAI_MODEL ANTHROPIC_AUTH_TOKEN'
    ];
      
    // Configure environment variables depending on the agent
    if (!isCodex) {
      if (isClaude) {
        if (llmUrl) {
          const anthropicBaseUrl = formatAnthropicBaseUrl(llmUrl);
          const anthropicToken = validAnthropicKey || apiKey || 'lmstudio';
          exportEnvLines.push(`export ANTHROPIC_BASE_URL="${anthropicBaseUrl}"`);
          exportEnvLines.push(`export ANTHROPIC_API_KEY="${anthropicToken}"`);
          exportEnvLines.push('export CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT=1');
          if (llmModel) {
            exportEnvLines.push(`export ANTHROPIC_MODEL="${llmModel}"`);
          }

          // Auto-configure ~/.claude.json to avoid interactive onboarding and API key approval prompts
          try {
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            if (homeDir) {
              const claudeJsonPath = path.join(homeDir, '.claude.json');
              let claudeConfig = {};
              if (fs.existsSync(claudeJsonPath)) {
                try {
                  claudeConfig = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
                } catch {}
              }
              let modified = false;
              if (!claudeConfig.hasCompletedOnboarding) {
                claudeConfig.hasCompletedOnboarding = true;
                modified = true;
              }
              if (!claudeConfig.theme) {
                claudeConfig.theme = 'dark';
                modified = true;
              }
              const keySuffix = anthropicToken.trim().slice(-20);
              if (!claudeConfig.customApiKeyResponses) {
                claudeConfig.customApiKeyResponses = { approved: [], rejected: [] };
              }
              if (!Array.isArray(claudeConfig.customApiKeyResponses.approved)) {
                claudeConfig.customApiKeyResponses.approved = [];
              }
              if (keySuffix && !claudeConfig.customApiKeyResponses.approved.includes(keySuffix)) {
                claudeConfig.customApiKeyResponses.approved.push(keySuffix);
                modified = true;
              }
              if (modified) {
                fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeConfig, null, 2));
              }
            }
          } catch (cfgErr) {
            console.warn('Could not auto-configure ~/.claude.json:', cfgErr.message);
          }
        } else {
          // Claude Code uses its own native OAuth login (~/.claude.json) unless a real Anthropic key is provided
          if (hasRealAnthropicKey && validAnthropicKey) {
            exportEnvLines.push(`export ANTHROPIC_API_KEY="${validAnthropicKey}"`);
          }
          if (isClaudeModel && llmModel) {
            exportEnvLines.push(`export ANTHROPIC_MODEL="${llmModel}"`);
          }
        }
      } else {
        if (llmUrl) {
          const safeUrl = formatBaseUrl(llmUrl);
          exportEnvLines.push(`export ANTHROPIC_BASE_URL="${safeUrl}"`);
          exportEnvLines.push(`export OPENAI_BASE_URL="${safeUrl}"`);
        }
        const effectiveApiKey = apiKey || (env.ANTHROPIC_API_KEY || (llmUrl ? 'http://localhost:1234/' : ''));
        if (effectiveApiKey) {
          exportEnvLines.push(`export ANTHROPIC_API_KEY="${effectiveApiKey}"`);
          exportEnvLines.push(`export OPENAI_API_KEY="${effectiveApiKey}"`);
          exportEnvLines.push(`export ANTHROPIC_AUTH_TOKEN="${effectiveApiKey}"`);
        }
        if (llmModel) {
          exportEnvLines.push(`export ANTHROPIC_MODEL="${llmModel}"`);
          exportEnvLines.push(`export LLM_MODEL="${llmModel}"`);
          exportEnvLines.push(`export OPENAI_MODEL="${llmModel}"`);
        }
      }
    }

    const scriptContent = `#!/bin/bash
cd "${targetDir}" 2>/dev/null || true
stty cols 100 rows 30 2>/dev/null || true
export COLUMNS=100
export LINES=30
export TERM=xterm-256color
${exportEnvLines.join('\n')}
echo -e "\\033[1;34m🚀 Initializing AI Agent (${targetAgent?.name || agent})...\\033[0m"
echo -ne "\\033[1;36m📡 Preparing environment: \\033[0m"
for i in {1..10}; do
    echo -ne "█"
    sleep 0.05
done
echo -e " \\033[1;32m[DONE]\\033[0m"

echo -e "\\033[1;33m🔑 Authenticating Provider (${llmName || 'Custom Provider'}): ${llmModel || 'default model'}... \\033[1;32m[SUCCESS]\\033[0m"
${promptBlock}echo -e "\\033[1;35m⏳ Booting agent engine. Please wait...\\033[0m"
${agentCmd}
exec bash
`;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');
      
    // Always return browserTerminal configuration when requested or running in web mode
    const isBrowserMode = useBrowserTerminal !== false;
    if (isBrowserMode) {
      return res.json({ 
        success: true, 
        browserTerminal: true, 
        command: 'bash', 
        args: [scriptPath], 
        cwd: targetDir, 
        env,
        scriptContent
      });
    }

    if (process.platform === 'win32') {
      const gitBash = [
        'C:\\Program Files\\Git\\git-bash.exe',
        'C:\\Program Files (x86)\\Git\\git-bash.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'git-bash.exe')
      ].find(p => fs.existsSync(p));

      if (gitBash) {
        command = 'cmd.exe';
        args = ['/c', 'start', '""', gitBash, scriptPath];
      } else {
        command = 'cmd.exe';
        args = ['/c', 'start', 'cmd', '/k', 'bash', scriptPath];
      }
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = ['-a', 'Terminal', scriptPath];
    } else {
      command = 'x-terminal-emulator';
      args = ['-e', scriptPath];
    }

    const child = spawn(command, args, {
      env,
      detached: true,
      stdio: 'ignore'
    });

    child.on('error', (err) => {
      console.error('Failed to spawn terminal process:', err);
    });

    child.unref();
    res.json({ success: true, message: `${agent} launched in ${targetDir}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics Route
projectsRouter.get('/analytics', async (req, res) => {
  try {
    const stats = await projectsRepo.getProjectsStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Git status router helpers
projectsRouter.post('/git/status', async (req, res) => {
  try {
    const { directory } = req.body || {};
    if (!directory || !gitService.isGitRepo(directory)) {
      return res.json({ isGitRepo: false, error: 'Not a git repository', branch: '', changes: [], commits: [] });
    }
    const result = gitService.getStatus(directory);
    res.json(result);
  } catch {
    res.json({ isGitRepo: false, error: 'Not a git repository', branch: '', changes: [], commits: [] });
  }
});

projectsRouter.post('/git/github', async (req, res) => {
  try {
    const { directory } = req.body || {};
    if (!directory || !gitService.isGitRepo(directory)) {
      return res.json({ prs: [], latestRun: null });
    }
    const result = await gitService.getGithubPRsAndRuns(directory);
    res.json(result);
  } catch {
    res.json({ prs: [], latestRun: null });
  }
});


projectsRouter.post('/git/cancel-ci', async (req, res) => {
  try {
    const { directory } = req.body || {};
    const result = gitService.cancelCIJobs(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

projectsRouter.post('/git/deploy', async (req, res) => {
  try {
    const { directory } = req.body || {};
    const result = gitService.autoDeploy(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Branches
projectsRouter.post('/git/branches', async (req, res) => {
  try {
    const { directory } = req.body || {};
    if (!directory || !gitService.isGitRepo(directory)) {
      return res.json({ current: '', local: [], remote: [] });
    }
    const result = gitService.getBranches(directory);
    res.json(result);
  } catch {
    res.json({ current: '', local: [], remote: [] });
  }
});

// Git Checkout
projectsRouter.post('/git/checkout', async (req, res) => {
  try {
    const { directory, branch, createNew } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name is required' });
    const result = gitService.checkoutBranch(directory, branch, createNew);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Create Branch
projectsRouter.post('/git/branch', async (req, res) => {
  try {
    const { directory, branch } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name is required' });
    const result = gitService.createBranch(directory, branch);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Delete Branch
projectsRouter.delete('/git/branch', async (req, res) => {
  try {
    const { directory, branch, force } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name is required' });
    const result = gitService.deleteBranch(directory, branch, force);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Diff
projectsRouter.post('/git/diff', async (req, res) => {
  try {
    const { directory, staged, file } = req.body;
    const result = gitService.getDiff(directory, staged, file);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Stage
projectsRouter.post('/git/stage', async (req, res) => {
  try {
    const { directory, files } = req.body;
    const result = gitService.stageFiles(directory, files);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Unstage
projectsRouter.post('/git/unstage', async (req, res) => {
  try {
    const { directory, files } = req.body;
    const result = gitService.unstageFiles(directory, files);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Commit
projectsRouter.post('/git/commit', async (req, res) => {
  try {
    const { directory, message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Commit message is required' });
    const result = gitService.commitChanges(directory, message);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Pull
projectsRouter.post('/git/pull', async (req, res) => {
  try {
    const { directory, remote, branch } = req.body;
    const result = gitService.pullChanges(directory, remote, branch);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Push
projectsRouter.post('/git/push', async (req, res) => {
  try {
    const { directory, remote, branch, force } = req.body;
    const result = gitService.pushChanges(directory, remote, branch, force);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Fetch
projectsRouter.post('/git/fetch', async (req, res) => {
  try {
    const { directory, remote } = req.body;
    const result = gitService.fetchChanges(directory, remote);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git Clone
projectsRouter.post('/git/clone', async (req, res) => {
  try {
    const { repoUrl, targetDir, name, desc } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'Repository URL is required' });
    if (!targetDir) return res.status(400).json({ error: 'Target directory is required' });

    const result = gitService.cloneRepo(repoUrl, targetDir);

    let project = null;
    if (name) {
      project = await projectsRepo.createProject({
        name,
        desc: desc || `Cloned from ${repoUrl}`,
        path: result.directory,
        branch: 'main',
        tech: 'Git Repo',
        complete: 0,
        tasks: []
      });
    }

    res.json({ ...result, project });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

