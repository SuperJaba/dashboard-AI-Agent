import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, exec, execSync } from 'child_process';
import * as projectsRepo from './projectsRepository.js';
import * as settingsRepo from '../settings/settingsRepository.js';
import * as gitService from '../git/gitService.js';
import { getBestAvailableModel } from '../utils/llm.js';

export const projectsRouter = express.Router();

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
  const { name, desc, path: p, branch, tech, complete, tasks } = req.body;
  try {
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
  exec('zenity --file-selection --directory --title="Wybierz folder projektu"', (error, stdout, stderr) => {
    if (error) {
      if (error.code === 1) return res.status(204).send();
      return res.status(500).json({ error: error.message });
    }
    res.json({ path: stdout.trim() });
  });
});

// Init Git
projectsRouter.post('/init-git', (req, res) => {
  let { directory } = req.body;
  if (!directory) return res.status(400).json({ error: 'Missing directory' });
  
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
  if (!directory) return res.status(400).json({ error: 'Missing directory' });
  
  if (directory.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    directory = path.join(home, directory.slice(2));
  }
  
  if (!fs.existsSync(directory)) {
    return res.status(400).json({ error: `Invalid directory: ${directory}` });
  }

  let techStack = 'Unknown';
  let tasks = [];
  
  try {
    const files = fs.readdirSync(directory);
    
    if (files.includes('package.json')) {
      const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.dependencies?.next) techStack = 'Next.js (Node.js)';
      else if (pkg.dependencies?.react || pkg.devDependencies?.vite) techStack = 'React / Vite';
      else if (pkg.dependencies?.express) techStack = 'Node.js Express';
      else techStack = 'Node.js / JS';
    } else if (files.includes('pom.xml')) {
      techStack = 'Java Maven';
    } else if (files.includes('build.gradle')) {
      techStack = 'Java Gradle';
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      techStack = 'Python';
    } else if (files.includes('Cargo.toml')) {
      techStack = 'Rust';
    } else if (files.includes('go.mod')) {
      techStack = 'Go';
    }

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
           if (text.startsWith('//')) text = text.substring(2).trim();
           if (text.startsWith('*')) text = text.substring(1).trim();
           if (text.length > 60) text = text.substring(0, 57) + '...';
           if (text && !tasks.find(t => t.title === text)) {
             tasks.push({ id: idCounter++, title: text, meta: `Code: ${file}`, status: 'pending' });
           }
        }
      });
    } catch(e) {}

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
          })
        });
        if (res.ok) {
          const llmData = await res.json();
          const content = llmData.choices[0].message.content;
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            const aiTasks = JSON.parse(jsonMatch[0]);
            aiTasks.forEach(aiTask => {
              tasks.push({ id: idCounter++, title: aiTask, meta: 'AI Suggestion', status: 'pending' });
            });
          }
        }
      }
    } catch (e) {
      console.error("LLM error in analyze:", e);
    }

    if (tasks.length === 0) {
      tasks.push({ id: 1, title: 'Inicjalizacja środowiska', meta: 'Setup', status: 'pending' });
    }

    let branch = null;
    try {
      const gitStatus = gitService.getStatus(directory);
      branch = gitStatus.branch;
    } catch (e) {
      // Ignore if not a git repo
    }

    res.json({ tech: techStack, tasks, branch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy project using agents
projectsRouter.post('/deploy', (req, res) => {
  const { agent, directory, llmUrl, apiKey, tasks, useBrowserTerminal, remoteServer, remotePrompt } = req.body;
  let targetDir = directory || process.cwd();
  
  if (targetDir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE;
    targetDir = path.join(home, targetDir.slice(2));
  }

  console.log(`Deploying ${agent} in ${targetDir}`);

  try {
    let command = '';
    let args = [];
    let env = { ...process.env };

    if (llmUrl) {
      env.ANTHROPIC_BASE_URL = llmUrl;
    }
    
    if (apiKey) {
      env.ANTHROPIC_API_KEY = apiKey;
      env.OPENAI_API_KEY = apiKey;
    }

    if (tasks && tasks.length > 0) {
      const list = tasks.map(t => {
        const prefix = t.status === 'completed' ? '[REWORK] ' : '';
        return `- [ ] ${prefix}${t.title}`;
      }).join('\n');
      const promptFile = path.join(targetDir, '.ai_tasks.md');
      fs.writeFileSync(promptFile, `# Zadania do wykonania\n\n${list}\n`);
    }

    if (agent === 'claude' || agent === 'agy') {
      if (agent === 'claude' && !env.ANTHROPIC_BASE_URL) {
        env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      }
      
      let agentCmd = '';
      const scriptPath = path.join(targetDir, '.start_agent.sh');
      if (remoteServer) {
        const sshCmdStr = `ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes ${remoteServer.username}@${remoteServer.host} -p ${remoteServer.port || 22}`;
        const promptText = `Jesteś DevOps agentem. Połącz się z serwerem przez SSH używając komendy: '${sshCmdStr}'. Następnie wykonaj zadanie: ${remotePrompt || 'Sprawdź stan serwera i zoptymalizuj go.'}. Wszystkie operacje wykonuj w ramach sesji SSH na zdalnym serwerze. UWAGA: używaj poleceń w pełni zautomatyzowanych, bez interaktywnych promptów (użyliśmy BatchMode=yes).`;
        agentCmd = agent === 'claude' ? `claude "${promptText}"` : `agy -i "${promptText}"`;
      } else {
        const promptArg = (tasks && tasks.length > 0) ? ' "Zrealizuj zadania z pliku .ai_tasks.md. Kiedy skończysz, oznacz je jako wykonane."' : '';
        agentCmd = agent === 'claude' ? `claude${promptArg}` : `agy${tasks && tasks.length > 0 ? ' -i' + promptArg : ''}`;
      }
      
      const scriptContent = `#!/bin/bash
cd "${targetDir}"
echo -e "\\033[1;34m🚀 Initializing AI Agent (${agent})...\\033[0m"
echo -ne "\\033[1;36m📡 Preparing environment: \\033[0m"
for i in {1..20}; do
    echo -ne "█"
    sleep 0.1
done
echo -e " \\033[1;32m[DONE]\\033[0m"

echo -ne "\\033[1;33m🔑 Authenticating with Gemini 3.1 Pro... \\033[0m"
for i in {1..10}; do
    echo -ne "."
    sleep 0.15
done
echo -e " \\033[1;32m[SUCCESS]\\033[0m"

echo -e "\\033[1;35m⏳ Booting agent engine. Please wait, this might take up to 15 seconds...\\033[0m"
${agentCmd}
exec bash
`;
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');
      
      if (useBrowserTerminal) {
        return res.json({ 
          success: true, 
          browserTerminal: true, 
          command: 'bash', 
          args: [scriptPath], 
          cwd: targetDir, 
          env 
        });
      }

      command = 'x-terminal-emulator';
      args = ['-e', scriptPath];
    } else {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    const child = spawn(command, args, {
      env,
      detached: true,
      stdio: 'ignore'
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
    const { directory } = req.body;
    const result = gitService.getStatus(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

projectsRouter.post('/git/github', async (req, res) => {
  try {
    const { directory } = req.body;
    const result = gitService.getGithubPRsAndRuns(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

projectsRouter.post('/git/cancel-ci', async (req, res) => {
  try {
    const { directory } = req.body;
    const result = gitService.cancelCIJobs(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

projectsRouter.post('/git/deploy', async (req, res) => {
  try {
    const { directory } = req.body;
    const result = gitService.autoDeploy(directory);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
