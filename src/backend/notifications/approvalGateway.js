/**
 * Central approval gateway with timeout-based resolution for human-in-the-loop actions.
 * Allows agents to pause until a human confirms an action via Telegram inline buttons or web UI.
 */

const pendingApprovals = new Map();

/**
 * Requests human approval for an action.
 * @param {object} params
 * @param {string} params.id
 * @param {string} params.action
 * @param {string} params.description
 * @param {object} [params.metadata]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ approved: boolean, reason?: string, metadata?: object }>}
 */
export function requestApproval({ id, action, description, metadata = {}, timeoutMs = 30 * 60 * 1000 }) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: 'timeout' });
    }, timeoutMs);

    pendingApprovals.set(id, {
      id,
      resolve,
      timer,
      action,
      description,
      metadata,
      createdAt: new Date().toISOString(),
    });
  });
}

/**
 * Approves a pending request.
 * @param {string} id
 * @param {object} [extraMetadata]
 * @returns {boolean}
 */
export function approve(id, extraMetadata = {}) {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: true, metadata: { ...pending.metadata, ...extraMetadata } });
  return true;
}

/**
 * Rejects a pending request.
 * @param {string} id
 * @param {string} [reason]
 * @returns {boolean}
 */
export function reject(id, reason = 'rejected') {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: false, reason });
  return true;
}

/**
 * Returns all currently pending approvals.
 * @returns {Array<object>}
 */
export function getPendingApprovals() {
  return Array.from(pendingApprovals.values()).map(v => ({
    id: v.id,
    action: v.action,
    description: v.description,
    metadata: v.metadata,
    createdAt: v.createdAt,
  }));
}

/**
 * Gets a single approval by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getApproval(id) {
  const v = pendingApprovals.get(id);
  if (!v) return null;
  return {
    id: v.id,
    action: v.action,
    description: v.description,
    metadata: v.metadata,
    createdAt: v.createdAt,
  };
}

/**
 * Clears all pending approvals (for test cleanup).
 */
export function clearAllApprovals() {
  for (const v of pendingApprovals.values()) {
    clearTimeout(v.timer);
  }
  pendingApprovals.clear();
}
