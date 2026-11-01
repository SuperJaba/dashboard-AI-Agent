import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  requestApproval,
  approve,
  reject,
  getPendingApprovals,
  clearPendingApprovals
} from './approvalGateway.js';

describe('approvalGateway', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPendingApprovals?.();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with approved: true when approve(id) is called', async () => {
    const promise = requestApproval({
      id: 'app-1',
      action: 'deploy_to_prod',
      description: 'Deploy v2.0 to production'
    });

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('app-1');
    expect(pending[0].action).toBe('deploy_to_prod');

    const result = approve('app-1');
    expect(result).toBe(true);

    const outcome = await promise;
    expect(outcome).toEqual({ approved: true });
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('resolves with approved: false and reason when reject(id) is called', async () => {
    const promise = requestApproval({
      id: 'app-2',
      action: 'merge_pr',
      description: 'Merge PR #42'
    });

    const result = reject('app-2', 'Risk too high');
    expect(result).toBe(true);

    const outcome = await promise;
    expect(outcome).toEqual({ approved: false, reason: 'Risk too high' });
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('resolves with approved: false and timeout reason when timer expires', async () => {
    const promise = requestApproval({
      id: 'app-3',
      action: 'reboot_cluster',
      description: 'Cluster reboot',
      timeoutMs: 5000
    });

    vi.advanceTimersByTime(5001);

    const outcome = await promise;
    expect(outcome).toEqual({ approved: false, reason: 'timeout' });
    expect(getPendingApprovals()).toHaveLength(0);
  });

  it('returns false when approving non-existent approval', () => {
    expect(approve('non-existent')).toBe(false);
  });

  it('returns false when rejecting non-existent approval', () => {
    expect(reject('non-existent')).toBe(false);
  });
});
