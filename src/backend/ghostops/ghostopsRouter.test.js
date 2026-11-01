import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createGhostopsRouter } from './ghostopsRouter.js';

describe('Ghost Ops Router API', () => {
  let app;
  let mockService;

  beforeEach(() => {
    mockService = {
      getHistory: vi.fn(),
      runCycle: vi.fn(),
    };

    app = express();
    app.use(express.json());
    app.use('/api/ghostops', createGhostopsRouter(mockService));
  });

  describe('GET /api/ghostops/history', () => {
    it('returns history array from ghostopsService', async () => {
      const mockHistory = [
        {
          runId: 101,
          workflowName: 'CI / Test',
          status: 'success',
          prUrl: 'https://github.com/org/repo/pull/1',
          prNumber: 1,
          timestamp: '2026-11-01T02:00:00.000Z',
        },
      ];
      mockService.getHistory.mockReturnValue(mockHistory);

      const res = await request(app).get('/api/ghostops/history');

      expect(res.status).toBe(200);
      expect(res.body.history).toEqual(mockHistory);
      expect(mockService.getHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/ghostops/run', () => {
    it('runs cycle and returns execution result', async () => {
      const mockResult = {
        totalFailures: 1,
        processed: 1,
        successful: 1,
        failed: 0,
        runs: [
          {
            runId: 202,
            workflowName: 'Nightly',
            status: 'success',
            prUrl: 'https://github.com/org/repo/pull/2',
          },
        ],
      };
      mockService.runCycle.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/ghostops/run')
        .send({ hoursBack: 12 });

      expect(res.status).toBe(200);
      expect(mockService.runCycle).toHaveBeenCalledWith(12);
      expect(res.body.successful).toBe(1);
      expect(res.body.runs).toHaveLength(1);
    });

    it('defaults to 24 hoursBack if not specified', async () => {
      mockService.runCycle.mockResolvedValue({
        totalFailures: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        runs: [],
      });

      const res = await request(app).post('/api/ghostops/run').send({});

      expect(res.status).toBe(200);
      expect(mockService.runCycle).toHaveBeenCalledWith(24);
    });

    it('returns 500 when runCycle throws error', async () => {
      mockService.runCycle.mockRejectedValue(new Error('GitHub rate limit reached'));

      const res = await request(app).post('/api/ghostops/run').send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('GitHub rate limit reached');
    });
  });
});
