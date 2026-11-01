/**
 * GitHub CI Failure Monitor
 * Queries GitHub Actions API for failed/timed-out workflow runs and downloads error logs.
 */

export function createCiMonitor(token, { fetchFn = globalThis.fetch } = {}) {
  const defaultHeaders = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'dashboard-ghostops',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  async function getRecentFailures(owner, repo, hoursBack = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?created=%3E%3D${encodeURIComponent(since)}&per_page=50`;

    try {
      const response = await fetchFn(url, { headers: defaultHeaders });
      if (!response || !response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.workflow_runs)) {
        return [];
      }

      return data.workflow_runs
        .filter((run) => ['failure', 'timed_out'].includes(run.conclusion))
        .map((run) => ({
          workflowName: run.name,
          runId: run.id,
          headSha: run.head_sha,
          htmlUrl: run.html_url,
          conclusion: run.conclusion,
        }));
    } catch {
      return [];
    }
  }

  async function getJobLogs(owner, repo, runId) {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`;

    try {
      const response = await fetchFn(url, { headers: defaultHeaders });
      if (!response || !response.ok) {
        return '';
      }

      const text = typeof response.text === 'function' ? await response.text() : String(response);
      return typeof text === 'string' ? text.slice(0, 5000) : '';
    } catch {
      return '';
    }
  }

  return { getRecentFailures, getJobLogs };
}

export async function getRecentFailures(owner, repo, hoursBack = 24, { token = process.env.GITHUB_TOKEN, fetchFn = globalThis.fetch } = {}) {
  const monitor = createCiMonitor(token, { fetchFn });
  return monitor.getRecentFailures(owner, repo, hoursBack);
}

export async function getJobLogs(owner, repo, runId, { token = process.env.GITHUB_TOKEN, fetchFn = globalThis.fetch } = {}) {
  const monitor = createCiMonitor(token, { fetchFn });
  return monitor.getJobLogs(owner, repo, runId);
}
