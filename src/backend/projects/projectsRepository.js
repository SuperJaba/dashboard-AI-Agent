import fs from 'fs';
import { pool } from '../db.js';
import { detectTechnology } from './techDetector.js';

export async function getProjects() {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY id ');
  for (const proj of rows) {
    if ((!proj.tech || proj.tech === 'Unknown') && proj.path && fs.existsSync(proj.path)) {
      const detected = detectTechnology(proj.path);
      if (detected && detected !== 'Unknown') {
        proj.tech = detected;
        pool.query('UPDATE projects SET tech = $1 WHERE id = $2', [detected, proj.id]).catch(() => {});
      }
    }
  }
  return rows;
}

export async function deleteProject(id) {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  return { success: true };
}

export async function createProject({ name, desc, path, branch, tech, complete, tasks }) {
  let finalTech = tech;
  if ((!finalTech || finalTech === 'Unknown') && path) {
    const detected = detectTechnology(path);
    if (detected && detected !== 'Unknown') {
      finalTech = detected;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO projects (name, "desc", path, branch, tech, complete, tasks) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      name,
      desc,
      path,
      branch || 'main',
      finalTech || 'Unknown',
      complete || 0,
      JSON.stringify(tasks || [])
    ]
  );
  return rows[0];
}

export async function updateProject(id, { name, desc, path, tech, tasks, complete, branch }) {
  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(name);
  }
  if (desc !== undefined) {
    updates.push(`"desc" = $${paramIdx++}`);
    values.push(desc);
  }
  if (path !== undefined) {
    updates.push(`path = $${paramIdx++}`);
    values.push(path);
  }
  if (tech !== undefined) {
    updates.push(`tech = $${paramIdx++}`);
    values.push(tech);
  }
  if (tasks !== undefined) {
    updates.push(`tasks = $${paramIdx++}`);
    values.push(JSON.stringify(tasks));
  }
  if (complete !== undefined) {
    updates.push(`complete = $${paramIdx++}`);
    values.push(complete);
  }
  if (branch !== undefined) {
    updates.push(`branch = $${paramIdx++}`);
    values.push(branch);
  }

  if (updates.length === 0) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return rows[0];
  }

  values.push(id);
  const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function getProjectsStats() {
  // Auto-detect and heal any 'Unknown' tech projects
  try {
    const { rows } = await pool.query("SELECT id, path, tech FROM projects WHERE tech IS NULL OR tech = 'Unknown'");
    for (const p of rows) {
      if (p.path && fs.existsSync(p.path)) {
        const detected = detectTechnology(p.path);
        if (detected && detected !== 'Unknown') {
          await pool.query('UPDATE projects SET tech = $1 WHERE id = $2', [detected, p.id]);
        }
      }
    }
  } catch {
    // Ignore error
  }

  const totalProjectsRes = await pool.query('SELECT COUNT(*) as count FROM projects');
  const techStatsRes = await pool.query('SELECT tech, COUNT(*) as count FROM projects GROUP BY tech');
  const avgCompleteRes = await pool.query('SELECT AVG(complete) as avg FROM projects');

  return {
    totalProjects: parseInt(totalProjectsRes.rows[0]?.count || 0, 10),
    techStats: (techStatsRes.rows || []).map(r => ({
      tech: r.tech || 'Unknown',
      count: parseInt(r.count, 10)
    })),
    avgComplete: parseFloat(avgCompleteRes.rows[0]?.avg || 0)
  };
}
