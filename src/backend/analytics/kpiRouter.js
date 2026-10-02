import express from 'express';
import { safeQuery } from '../db.js';

export const kpiRouter = express.Router();

// Simple in-memory TTL cache (no external deps)
const cache = new Map();
const CACHE_TTL_MS = 30_000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

// Deterministic mock data (seeded so it changes slowly)
function mockData() {
  const seed = Math.floor(Date.now() / 60_000);
  const rng = (n) => ((seed * 9301 + 49297) % 233280) % n;
  return {
    today: {
      tasks: 12 + rng(8),
      successRate: 85 + rng(10),
      avgDuration: 3.2 + (rng(20) / 10),
    },
    sevenDays: {
      tasks: 78 + rng(20),
      successRate: 82 + rng(12),
      avgDuration: 3.5 + (rng(15) / 10),
    },
    thirtyDays: {
      tasks: 310 + rng(50),
      successRate: 80 + rng(15),
      avgDuration: 3.8 + (rng(10) / 10),
    },
    topErrors: [
      { error: 'Timeout', count: 4 + rng(3) },
      { error: 'Auth failure', count: 2 + rng(2) },
      { error: 'Rate limit', count: 1 + rng(2) },
    ],
    tokenBurn: {
      today: 24_000 + rng(5000),
      week: 158_000 + rng(20000),
    },
  };
}

async function buildKpiData() {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 3600 * 1000);

    const buildPeriod = async (from) => {
      const [countRes, successRes, durationRes] = await Promise.all([
        safeQuery(
          'SELECT COUNT(*) AS total FROM agent_tasks WHERE created_at >= $1',
          [from]
        ),
        safeQuery(
          "SELECT COUNT(*) AS ok FROM agent_tasks WHERE created_at >= $1 AND status = 'completed'",
          [from]
        ),
        safeQuery(
          'SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_dur FROM agent_tasks WHERE created_at >= $1 AND updated_at IS NOT NULL',
          [from]
        ),
      ]);

      const total = parseInt(countRes?.rows?.[0]?.total ?? '0', 10);
      const ok = parseInt(successRes?.rows?.[0]?.ok ?? '0', 10);
      const avg = parseFloat(durationRes?.rows?.[0]?.avg_dur ?? '0');

      return {
        tasks: total,
        successRate: total > 0 ? Math.round((ok / total) * 100) : 0,
        avgDuration: isNaN(avg) ? 0 : Math.round(avg * 10) / 10,
      };
    };

    const [today, sevenDays, thirtyDays, errorsRes, tokenTodayRes, tokenWeekRes] =
      await Promise.all([
        buildPeriod(todayStart),
        buildPeriod(sevenDaysAgo),
        buildPeriod(thirtyDaysAgo),
        safeQuery(
          `SELECT message AS error, COUNT(*) AS count
           FROM agent_logs
           WHERE level = 'error' AND created_at >= $1
           GROUP BY message ORDER BY count DESC LIMIT 5`,
          [sevenDaysAgo]
        ),
        safeQuery(
          'SELECT COALESCE(SUM(tokens_used), 0) AS tokens FROM agent_tasks WHERE created_at >= $1',
          [todayStart]
        ),
        safeQuery(
          'SELECT COALESCE(SUM(tokens_used), 0) AS tokens FROM agent_tasks WHERE created_at >= $1',
          [sevenDaysAgo]
        ),
      ]);

    return {
      today,
      sevenDays,
      thirtyDays,
      topErrors: errorsRes?.rows ?? [],
      tokenBurn: {
        today: parseInt(tokenTodayRes?.rows?.[0]?.tokens ?? '0', 10),
        week: parseInt(tokenWeekRes?.rows?.[0]?.tokens ?? '0', 10),
      },
    };
  } catch {
    return mockData();
  }
}

kpiRouter.get('/kpi', async (_req, res) => {
  const CACHE_KEY = 'kpi';
  const cached = getCached(CACHE_KEY);
  if (cached) {
    return res.json(cached);
  }

  const data = await buildKpiData();
  setCache(CACHE_KEY, data);
  return res.json(data);
});
