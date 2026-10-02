#!/usr/bin/env node
import { syncProjectTasks, syncAllProjects } from '../projects/tasksSyncService.js';


async function main() {
  const args = process.argv.slice(2);
  const targetId = args[0];
  const clearCompleted = args.includes('--clear-completed');

  console.log('🚀 Starting Task Synchronization Engine...');

  try {
    if (targetId && !targetId.startsWith('--')) {
      const projectId = parseInt(targetId, 10);
      console.log(`📡 Synchronizing Project #${projectId}...`);
      const res = await syncProjectTasks(projectId, { clearCompleted });
      console.log(`\n✅ Project: ${res.projectName} (#${res.projectId})`);
      console.log(`   - Tasks in DB: ${res.totalTasks} (Pending: ${res.pendingTasks}, Completed: ${res.completedTasks})`);
      console.log(`   - Completion: ${res.completePercentage}%`);
      console.log(`   - Updated in Workspace: ${res.updatedInWorkspace.length}`);
      res.updatedInWorkspace.forEach(u => console.log(`     * [x] ${u.title} (${u.file})`));
      console.log(`   - Updated in Database: ${res.updatedInDb.length}`);
      res.updatedInDb.forEach(u => console.log(`     * -> Completed: ${u.title} [${u.reason}]`));
    } else {
      console.log('📡 Synchronizing all projects across workspaces...');
      const results = await syncAllProjects({ clearCompleted });
      for (const res of results) {
        if (!res.success) {
          console.log(`❌ Project #${res.projectId} (${res.projectName}): ${res.error}`);
          continue;
        }
        console.log(`\n✅ Project: ${res.projectName} (#${res.projectId})`);
        console.log(`   - Completion: ${res.completePercentage}% (${res.completedTasks}/${res.totalTasks})`);
        if (res.updatedInWorkspace.length > 0) {
          console.log(`   - Workspace files updated: ${res.updatedInWorkspace.length}`);
          res.updatedInWorkspace.forEach(u => console.log(`     * ${u.title} in ${u.file}`));
        }
        if (res.updatedInDb.length > 0) {
          console.log(`   - Database updated: ${res.updatedInDb.length}`);
          res.updatedInDb.forEach(u => console.log(`     * ${u.title} (${u.reason})`));
        }
      }
    }
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
}

main();
