const pendingApprovals = new Map();
// Map<id, { resolve, reject, timer, action, description, createdAt, metadata }>

export function requestApproval({ id, action, description, timeoutMs = 30 * 60 * 1000, metadata = {} }) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: 'timeout' });
    }, timeoutMs);

    pendingApprovals.set(id, {
      resolve,
      timer,
      action,
      description,
      metadata,
      createdAt: new Date().toISOString(),
    });
  });
}

export function approve(id) {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: true });
  return true;
}

export function reject(id, reason = 'rejected') {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: false, reason });
  return true;
}

export function getPendingApprovals() {
  return Array.from(pendingApprovals.entries()).map(([id, v]) => ({
    id,
    action: v.action,
    description: v.description,
    metadata: v.metadata,
    createdAt: v.createdAt,
  }));
}

export function clearPendingApprovals() {
  for (const [, v] of pendingApprovals.entries()) {
    clearTimeout(v.timer);
  }
  pendingApprovals.clear();
}
