import { createCiMonitor } from './ciMonitor.js';
import { createWorktree, runAgentFix, cleanupWorktree } from './reproService.js';
import { createPrService, buildPrBody } from './prService.js';

/**
 * Creates an orchestrated Ghost Ops Service instance that monitors CI failures,
 * reproduces them in isolated worktrees, generates agent fixes, and opens GitHub PRs.
 *
 * @param {object} [options]
 * @param {object} [options.ciMonitor]
 * @param {object} [options.reproService]
 * @param {object} [options.prService]
 * @param {string} [options.repoPath]
 * @param {string} [options.owner]
 * @param {string} [options.repo]
 * @param {Function|object} [options.telegramNotifier]
 */
export function createGhostopsService({
  ciMonitor,
  reproService,
  prService,
  repoPath = process.cwd(),
  owner = process.env.GITHUB_OWNER || 'owner',
  repo = process.env.GITHUB_REPO || 'dashboard',
  telegramNotifier,
} = {}) {
  const history = [];

  const effectiveCiMonitor = ciMonitor || createCiMonitor(process.env.GITHUB_TOKEN);
  const effectiveReproService = reproService || { createWorktree, runAgentFix, cleanupWorktree };
  const effectivePrService = prService || createPrService(process.env.GITHUB_TOKEN);

  async function runCycle(hoursBack = 24) {
    const failures = await effectiveCiMonitor.getRecentFailures(owner, repo, hoursBack);
    const results = [];

    for (const failure of failures) {
      const branchName = `ghostops/fix-${failure.runId}`;
      let worktreePath = null;
      let status = 'failed';
      let prInfo = null;
      let failureError = null;

      try {
        const errorLogs = await effectiveCiMonitor.getJobLogs(owner, repo, failure.runId);
        worktreePath = await effectiveReproService.createWorktree(repoPath, failure.headSha, branchName);
        const agentOutput = await effectiveReproService.runAgentFix(worktreePath, errorLogs);

        const prTitle = `fix(ci): auto-heal failure in ${failure.workflowName}`;
        const prBody = effectivePrService.buildPrBody
          ? effectivePrService.buildPrBody({
              workflowName: failure.workflowName,
              runUrl: failure.htmlUrl,
              errorSnippet: errorLogs,
              agentOutput,
            })
          : buildPrBody({
              workflowName: failure.workflowName,
              runUrl: failure.htmlUrl,
              errorSnippet: errorLogs,
              agentOutput,
            });

        prInfo = await effectivePrService.pushBranchAndCreatePr(
          owner,
          repo,
          branchName,
          prTitle,
          prBody,
          { repoPath: worktreePath || repoPath }
        );

        status = 'success';

        if (telegramNotifier) {
          try {
            if (typeof telegramNotifier === 'function') {
              await telegramNotifier({
                event: 'agent:completed',
                workflowName: failure.workflowName,
                prUrl: prInfo?.prUrl,
                runId: failure.runId,
              });
            } else if (typeof telegramNotifier.sendTelegram === 'function') {
              await telegramNotifier.sendTelegram(
                {},
                'agent:completed',
                {
                  workflowName: failure.workflowName,
                  prUrl: prInfo?.prUrl,
                  runId: failure.runId,
                }
              );
            } else if (typeof telegramNotifier.notify === 'function') {
              await telegramNotifier.notify({
                event: 'agent:completed',
                workflowName: failure.workflowName,
                prUrl: prInfo?.prUrl,
                runId: failure.runId,
              });
            }
          } catch {
            // Ignore notification dispatch failure to protect cycle
          }
        }
      } catch (err) {
        status = 'error';
        failureError = err.message || String(err);
      } finally {
        if (worktreePath) {
          try {
            effectiveReproService.cleanupWorktree(repoPath, worktreePath);
          } catch {
            // Ignore cleanup failure to protect loop
          }
        }
      }

      const reportItem = {
        runId: failure.runId,
        workflowName: failure.workflowName,
        headSha: failure.headSha,
        branchName,
        status,
        prUrl: prInfo?.prUrl || null,
        prNumber: prInfo?.prNumber || null,
        error: failureError,
        timestamp: new Date().toISOString(),
      };

      results.push(reportItem);
      history.unshift(reportItem);
      if (history.length > 50) {
        history.pop();
      }
    }

    return {
      totalFailures: failures.length,
      processed: results.length,
      successful: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'error').length,
      runs: results,
      timestamp: new Date().toISOString(),
    };
  }

  function getHistory() {
    return [...history];
  }

  return { runCycle, getHistory };
}

export async function runGhostOpsCycle(config = {}) {
  const service = createGhostopsService(config);
  return service.runCycle(config.hoursBack || 24);
}
