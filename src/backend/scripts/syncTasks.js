#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const targetId = args[0];
  const clearCompleted = args.includes('--clear-completed');

  console.log('🚀 Starting Task Synchronization Engine...');

  const localServicePath = path.resolve(__dirname, '../projects/tasksSyncService.js');

  try {
    if (fs.existsSync(localServicePath)) {
      // Local execution inside the dashboard repository
      const { syncProjectTasks, syncAllProjects } = await import(pathToFileURL(localServicePath).href);

      if (targetId && !targetId.startsWith('--')) {
        const projectId = parseInt(targetId, 10);
        console.log(`📡 Synchronizing Project #${projectId}...`);
        const res = await syncProjectTasks(projectId, { clearCompleted });
        printProjectResult(res);
      } else {
        console.log('📡 Synchronizing all projects across workspaces...');
        const results = await syncAllProjects({ clearCompleted });
        for (const res of results) {
          printProjectResult(res);
        }
      }
    } else {
      // Standalone execution outside dashboard repository (e.g. in target project or remote server)
      const dashboardUrl = (process.env.DASHBOARD_URL || 'http://localhost:3001').replace(/\/+$/, '');
      console.log(`📡 Connecting to Dashboard host at ${dashboardUrl}...`);

      const payload = {
        cwd: process.cwd(),
        projectId: (targetId && !targetId.startsWith('--')) ? parseInt(targetId, 10) : undefined,
        clearCompleted
      };

      const response = await fetch(`${dashboardUrl}/api/projects/sync-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Host returned HTTP ${response.status}: ${response.statusText}`);
      }

      const results = await response.json();
      const list = Array.isArray(results) ? results : [results];
      for (const res of list) {
        printProjectResult(res);
      }
    }
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
}

function printProjectResult(res) {
  if (!res) return;
  if (res.success === false) {
    console.log(`❌ Project #${res.projectId || '?'}: ${res.error}`);
    return;
  }
  console.log(`\n✅ Project: ${res.projectName || 'Current Project'} (#${res.projectId || 'N/A'})`);
  if (typeof res.completePercentage !== 'undefined') {
    console.log(`   - Completion: ${res.completePercentage}% (${res.completedTasks ?? 0}/${res.totalTasks ?? 0})`);
  }
  if (Array.isArray(res.updatedInWorkspace) && res.updatedInWorkspace.length > 0) {
    console.log(`   - Workspace files updated: ${res.updatedInWorkspace.length}`);
    res.updatedInWorkspace.forEach(u => console.log(`     * ${u.title} in ${u.file}`));
  }
  if (Array.isArray(res.updatedInDb) && res.updatedInDb.length > 0) {
    console.log(`   - Database updated: ${res.updatedInDb.length}`);
    res.updatedInDb.forEach(u => console.log(`     * ${u.title} (${u.reason})`));
  }
}

main();
