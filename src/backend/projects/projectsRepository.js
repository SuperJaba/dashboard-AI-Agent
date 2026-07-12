import { pool } from '../db.js';

export async function getProjects() {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY id ASC');
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

export async function updateProject(id, { tech, tasks, complete, branch }) {
  let query = 'UPDATE projects SET tech = $1, tasks = $2, complete = $3';
  let values = [tech, JSON.stringify(tasks), complete];
  
  if (branch !== undefined) {
    query += ', branch = $4 WHERE id = $5 RETURNING *';
    values.push(branch, id);
  } else {
    query += ' WHERE id = $4 RETURNING *';
    values.push(id);
  }
  
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
