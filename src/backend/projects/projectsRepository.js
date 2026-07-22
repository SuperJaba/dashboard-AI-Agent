import { pool } from '../db.js';

export async function getProjects() {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY id ');
  return rows;
}

export async function deleteProject(id) {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  return { success: true };
}

export async function createProject({ name, desc, path, branch, tech, complete, tasks }) {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, "desc", path, branch, tech, complete, tasks) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      name,
      desc,
      path,
      branch || 'main',
      tech || 'Unknown',
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
  const totalProjectsRes = await pool.query('SELECT COUNT(*) as count FROM projects');
  const techStatsRes = await pool.query('SELECT tech, COUNT(*) as count FROM projects GROUP BY tech');
  const avgCompleteRes = await pool.query('SELECT AVG(complete) as avg FROM projects');

  return {
    totalProjects: parseInt(totalProjectsRes.rows[0].count || 0),
    techStats: techStatsRes.rows,
    avgComplete: parseFloat(avgCompleteRes.rows[0].avg || 0)
  };
}
