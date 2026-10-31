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

function emptyKpiData() {
  return {
    today: {
      tasks: 0,
      successRate: 0,
      avgDuration: 0,
    },
    sevenDays: {
      tasks: 0,
      successRate: 0,
      avgDuration: 0,
    },
    thirtyDays: {
      tasks: 0,
      successRate: 0,
      avgDuration: 0,
    },
    topErrors: [],
    tokenBurn: {
      today: 0,
      week: 0,
    },
    sparkline: [
      { time: '6d', value: 0 },
      { time: '5d', value: 0 },
      { time: '4d', value: 0 },
      { time: '3d', value: 0 },
      { time: '2d', value: 0 },
      { time: '1d', value: 0 },
      { time: 'dziś', value: 0 },
    ],
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

    const todayTokens = parseInt(tokenTodayRes?.rows?.[0]?.tokens ?? '0', 10);
    const weekTokens = parseInt(tokenWeekRes?.rows?.[0]?.tokens ?? '0', 10);

    const sparklineRes = await safeQuery(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM agent_tasks
       WHERE created_at >= $1
       GROUP BY to_char(created_at, 'YYYY-MM-DD')
       ORDER BY day ASC`,
      [sevenDaysAgo]
    ).catch(() => ({ rows: [] }));

    const sparklineMap = {};
    for (const r of sparklineRes?.rows || []) {
      sparklineMap[r.day] = parseInt(r.count, 10);
    }

    const sparkline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      const isoDay = d.toISOString().slice(0, 10);
      const label = i === 0 ? 'dziś' : `${i}d`;
      sparkline.push({
        time: label,
        value: sparklineMap[isoDay] || 0,
      });
    }

    return {
      today,
      sevenDays,
      thirtyDays,
      topErrors: errorsRes?.rows ?? [],
      tokenBurn: {
        today: todayTokens,
        week: weekTokens,
      },
      sparkline,
    };
  } catch {
    return emptyKpiData();
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
