import cron from 'node-cron';
import { syncAllRemoteProjects } from '../projects/remoteSyncService.js';
import { logger } from '../utils/logger.js';

/**
 * Starts a cron job that periodically synchronizes remote tasks.
 * The schedule is taken from the REMOTE_SYNC_CRON environment variable
 * (default: every 10 minutes).
 */
export function startRemoteSyncCron() {
  const cronExpression = process.env.REMOTE_SYNC_CRON || '*/10 * * * *';
  logger.info({ cron: cronExpression }, '📅 Starting remote task sync cron');
  cron.schedule(cronExpression, async () => {
    logger.info('Running scheduled remote task synchronization');
    try {
      const results = await syncAllRemoteProjects();
      results.forEach(res => {
        if (res.success) {
          logger.info({ projectId: res.projectId, name: res.projectName, total: res.totalTasks, completed: res.completedTasks }, 'Remote sync completed');
        } else {
          logger.warn({ projectId: res.projectId, error: res.error }, 'Remote sync failed');
        }
      });
    } catch (e) {
      logger.error({ err: e.message }, 'Unexpected error during remote sync cron');
    }
  });
}
