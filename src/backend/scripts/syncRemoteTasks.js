#!/usr/bin/env node
import { syncAllRemoteProjects } from '../projects/remoteSyncService.js';

async function main() {
  console.log('🚀 Starting Remote Task Synchronization...');
  try {
    const results = await syncAllRemoteProjects();
    results.forEach(res => {
      if (!res.success) {
        console.error(`❌ Project #${res.projectId} (${res.projectName}): ${res.error}`);
        return;
      }
      console.log(`✅ ${res.projectName} – Total: ${res.totalTasks}, Completed: ${res.completedTasks}`);
      if (res.updatedInDb.length) {
        console.log('   DB updates:');
        res.updatedInDb.forEach(u => console.log(`     • ${u.title} (${u.reason})`));
      }
      if (res.updatedInWorkspace.length) {
        console.log('   Workspace updates:');
        res.updatedInWorkspace.forEach(u => console.log(`     • ${u.title} in ${u.file}`));
      }
    });
  } catch (err) {
    console.error('❌ Remote sync failed:', err.message);
    process.exit(1);
  }
}

main();
