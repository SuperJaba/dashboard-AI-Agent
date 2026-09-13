import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as projectsRepo from './projectsRepository.js';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.gemini',
  '.autohand',
  'coverage',
  '.next',
  'build',
  '.vscode',
  '.idea'
]);

/**
 * Normalizes text for loose title matching (trim, lowercase, collapse whitespace).
 */
export function normalizeTitle(text) {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Recursively find all markdown files in a directory up to maxDepth.
 */
export function findMarkdownFiles(dir, maxDepth = 2, currentDepth = 0) {
  const mdFiles = [];
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return mdFiles;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && currentDepth < maxDepth) {
        mdFiles.push(...findMarkdownFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        mdFiles.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore permission or file read errors
  }

  return mdFiles;
}

/**
 * Extracts checklist items from markdown file contents.
 */
export function extractChecklistItems(filePath, baseDir) {
  const items = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const relFile = path.relative(baseDir, filePath).replace(/\\/g, '/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(\s*(?:[-*+]\s+|\d+\.\s+)?)\[([ xX])\]\s*(.*)$/);
      if (match) {
        const isCompleted = match[2] === 'x' || match[2] === 'X';
        const title = match[3].trim();
        if (title) {
          items.push({
            file: relFile,
            fullPath: filePath,
            lineIndex: i,
            rawLine: line,
            prefix: match[1],
            isCompleted,
            status: isCompleted ? 'completed' : 'pending',
            title
          });
        }
      }
    }
  } catch (err) {
    // Ignore read errors
  }
  return items;
}

/**
 * Updates a checklist item in a markdown file (changes [ ] to [x] or vice versa).
 */
export function updateTaskInWorkspaceFile(projectPath, taskTitle, newStatus, preferredFile = null) {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return { updated: false, error: 'Project directory does not exist' };
  }

  const normalizedTarget = normalizeTitle(taskTitle);
  const targetCompleted = newStatus === 'completed';

  const candidateFiles = [];
  if (preferredFile) {
    const preferredFullPath = path.isAbsolute(preferredFile)
      ? preferredFile
      : path.join(projectPath, preferredFile);
    if (fs.existsSync(preferredFullPath)) {
      candidateFiles.push(preferredFullPath);
    }
  }

  // Also include other markdown files in workspace
  const allMd = findMarkdownFiles(projectPath, 2);
  for (const f of allMd) {
    if (!candidateFiles.includes(f)) {
      candidateFiles.push(f);
    }
  }

  for (const filePath of candidateFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      let fileModified = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\s*(?:[-*+]\s+|\d+\.\s+)?)\[([ xX])\]\s*(.*)$/);
        if (match) {
          const itemTitle = match[3].trim();
          if (normalizeTitle(itemTitle) === normalizedTarget) {
            const currentCompleted = match[2] === 'x' || match[2] === 'X';
            if (currentCompleted !== targetCompleted) {
              const newMark = targetCompleted ? 'x' : ' ';
              lines[i] = `${match[1]}[${newMark}] ${itemTitle}`;
              fileModified = true;
              break;
            }
          }
        }
      }

      if (fileModified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        const relPath = path.relative(projectPath, filePath).replace(/\\/g, '/');
        return { updated: true, file: relPath, fullPath: filePath };
      }
    } catch (err) {
      // Continue searching next files
    }
  }

  return { updated: false };
}

/**
 * Checks git commits for task references to auto-detect finished tasks.
 */
export function getRecentGitCommitMessages(projectPath, limit = 50) {
  try {
    const stdout = execSync(`git log -n ${limit} --pretty=format:"%s"`, {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000
    });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Main synchronization engine for a single project.
 * Synchronizes task statuses between workspace markdown files, git commits, and DB.
 */
export async function syncProjectTasks(projectId, options = {}) {
  const projects = await projectsRepo.getProjects();
  const project = projects.find(p => p.id === parseInt(projectId, 10));
  if (!project) {
    throw new Error(`Project #${projectId} not found`);
  }

  const projectPath = project.path;
  const currentTasks = Array.isArray(project.tasks) ? [...project.tasks] : [];
  const updatedInWorkspace = [];
  const updatedInDb = [];

  if (projectPath && fs.existsSync(projectPath)) {
    const mdFiles = findMarkdownFiles(projectPath, 2);
    const allWorkspaceItems = [];
    for (const f of mdFiles) {
      allWorkspaceItems.push(...extractChecklistItems(f, projectPath));
    }

    const commits = getRecentGitCommitMessages(projectPath, 40);

    for (let i = 0; i < currentTasks.length; i++) {
      const task = currentTasks[i];
      const normTitle = normalizeTitle(task.title);

      // Match against workspace checklist items
      const matchingItem = allWorkspaceItems.find(item => normalizeTitle(item.title) === normTitle);

      if (task.status === 'completed') {
        // Task in DB is completed, but workspace checklist is still pending [ ]
        if (matchingItem && !matchingItem.isCompleted) {
          const res = updateTaskInWorkspaceFile(projectPath, task.title, 'completed', matchingItem.fullPath);
          if (res.updated) {
            updatedInWorkspace.push({ title: task.title, file: res.file, status: 'completed' });
            matchingItem.isCompleted = true;
          }
        }
      } else {
        // Task in DB is pending
        // Check 1: workspace checklist is marked [x]
        if (matchingItem && matchingItem.isCompleted) {
          currentTasks[i] = { ...task, status: 'completed' };
          updatedInDb.push({ title: task.title, reason: `Marked [x] in ${matchingItem.file}` });
          continue;
        }

        // Check 2: git commit mentions task title
        if (commits.length > 0 && normTitle.length > 5) {
          const commitMatch = commits.find(c => {
            const normC = normalizeTitle(c);
            return normC.includes(normTitle) || 
                   (normTitle.length > 10 && normC.includes(normTitle.slice(0, 20)));
          });

          if (commitMatch) {
            currentTasks[i] = { ...task, status: 'completed' };
            updatedInDb.push({ title: task.title, reason: `Found commit: "${commitMatch}"` });
            // Also update workspace file if found
            if (matchingItem && !matchingItem.isCompleted) {
              const res = updateTaskInWorkspaceFile(projectPath, task.title, 'completed', matchingItem.fullPath);
              if (res.updated) {
                updatedInWorkspace.push({ title: task.title, file: res.file, status: 'completed' });
                matchingItem.isCompleted = true;
              }
            }
          }
        }
      }
    }

    // Optional: filter out completed tasks if user asked to purge completed from DB
    let finalTasks = currentTasks;
    if (options.clearCompleted) {
      finalTasks = finalTasks.filter(t => t.status !== 'completed');
    }

    const totalCount = finalTasks.length;
    const completedCount = finalTasks.filter(t => t.status === 'completed').length;
    const completePercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const updatedProject = await projectsRepo.updateProject(projectId, {
      tasks: finalTasks,
      complete: completePercentage
    });

    return {
      success: true,
      projectId: parseInt(projectId, 10),
      projectName: project.name,
      updatedInWorkspace,
      updatedInDb,
      totalTasks: totalCount,
      completedTasks: completedCount,
      pendingTasks: totalCount - completedCount,
      completePercentage,
      project: updatedProject
    };
  }

  return {
    success: true,
    projectId: parseInt(projectId, 10),
    projectName: project.name,
    updatedInWorkspace: [],
    updatedInDb: [],
    totalTasks: currentTasks.length,
    completedTasks: currentTasks.filter(t => t.status === 'completed').length,
    pendingTasks: currentTasks.filter(t => t.status !== 'completed').length,
    project
  };
}

/**
 * Synchronize all projects in the database.
 */
export async function syncAllProjects(options = {}) {
  const projects = await projectsRepo.getProjects();
  const results = [];
  for (const project of projects) {
    try {
      const res = await syncProjectTasks(project.id, options);
      results.push(res);
    } catch (err) {
      results.push({
        success: false,
        projectId: project.id,
        projectName: project.name,
        error: err.message
      });
    }
  }
  return results;
}
