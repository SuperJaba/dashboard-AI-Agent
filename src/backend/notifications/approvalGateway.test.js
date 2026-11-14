import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  requestApproval,
  approve,
  reject,
  getPendingApprovals,
  getApproval,
  clearAllApprovals,
} from './approvalGateway.js';

describe('ApprovalGateway', () => {
  beforeEach(() => {
    clearAllApprovals();
    vi.useRealTimers();
  });

  it('registers a pending approval and resolves on approve()', async () => {
    const promise = requestApproval({
      id: 'app-1',
      action: 'merge_pr',
      description: 'Merge PR #42 into main',
      metadata: { prNumber: 42 },
    });

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('app-1');
    expect(pending[0].action).toBe('merge_pr');

    const approval = getApproval('app-1');
    expect(approval).not.toBeNull();
    expect(approval.description).toBe('Merge PR #42 into main');

    const approved = approve('app-1', { mergedBy: 'telegram-user' });
    expect(approved).toBe(true);

    const result = await promise;
    expect(result.approved).toBe(true);
    expect(result.metadata.prNumber).toBe(42);
    expect(result.metadata.mergedBy).toBe('telegram-user');

    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('resolves with approved: false on reject()', async () => {
    const promise = requestApproval({
      id: 'app-2',
      action: 'deploy',
      description: 'Deploy to CT8 production',
    });

    const rejected = reject('app-2', 'Declined by human reviewer');
    expect(rejected).toBe(true);

    const result = await promise;
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Declined by human reviewer');
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('returns false when approving non-existent approval', () => {
    expect(approve('non-existent')).toBe(false);
    expect(reject('non-existent')).toBe(false);
  });

  it('resolves with timeout when timeoutMs expires', async () => {
    vi.useFakeTimers();

    const promise = requestApproval({
      id: 'app-timeout',
      action: 'merge_pr',
      description: 'Timeout test',
      timeoutMs: 1000,
    });

    expect(getPendingApprovals()).toHaveLength(1);

    vi.advanceTimersByTime(1001);

    const result = await promise;
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(getPendingApprovals()).toHaveLength(0);

    vi.useRealTimers();
  });
});
