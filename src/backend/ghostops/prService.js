import { execSync } from 'child_process';

/**
 * Builds a structured Markdown PR description in Polish detailing the failed workflow,
 * the extracted error root cause, and the automated agent fix report.
 *
 * @param {object} params
 * @param {string} [params.workflowName]
 * @param {string} [params.runUrl]
 * @param {string} [params.errorSnippet]
 * @param {string} [params.agentOutput]
 * @returns {string} Markdown PR body.
 */
export function buildPrBody({ workflowName, runUrl, errorSnippet, agentOutput }) {
  const rootCause = errorSnippet ? errorSnippet.slice(0, 1500) : 'Brak logów';
  const fixSummary = agentOutput ? agentOutput.slice(0, 2000) : 'Brak opisu naprawy';

  return [
    '## 🤖 Ghost Ops — Automatyczna Naprawa CI',
    '',
    `**Workflow:** ${workflowName || 'Nieznany'}`,
    `**Failed run:** ${runUrl || 'Brak'}`,
    '',
    '### Pierwiastek Błędu (Root Cause)',
    '```',
    rootCause,
    '```',
    '',
    '### Wykonane naprawy',
    fixSummary,
  ].join('\n');
}

/**
 * Creates PR Service instance bound with authentication token and optional dependency injections.
 *
 * @param {string} [token] GitHub personal access token.
 * @param {object} [options]
 * @param {Function} [options.fetchFn] Native fetch or mock.
 * @param {Function} [options.execFn] Child_process execSync or mock.
 */
export function createPrService(token, { fetchFn = globalThis.fetch, execFn = execSync } = {}) {
  const defaultHeaders = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'dashboard-ghostops',
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  async function pushBranchAndCreatePr(owner, repo, branchName, title, body, { repoPath, base = 'master' } = {}) {
    execFn(`git push origin ${branchName}`, { cwd: repoPath });

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: base || 'master',
      }),
    });

    if (!response.ok) {
      const errText = typeof response.text === 'function' ? await response.text() : '';
      throw new Error(`Failed to create PR: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
    }

    const data = await response.json();
    return {
      prUrl: data.html_url,
      prNumber: data.number,
    };
  }

  return { pushBranchAndCreatePr, buildPrBody };
}

export async function pushBranchAndCreatePr(
  owner,
  repo,
  branchName,
  title,
  body,
  { token = process.env.GITHUB_TOKEN, fetchFn = globalThis.fetch, execFn = execSync, repoPath, base = 'master' } = {}
) {
  const service = createPrService(token, { fetchFn, execFn });
  return service.pushBranchAndCreatePr(owner, repo, branchName, title, body, { repoPath, base });
}
