import { pool } from '../db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export async function getServers() {
  const { rows } = await pool.query('SELECT * FROM servers ORDER BY id ');
  // Safe representation (without decrypted/encrypted ssh_password, but with a has_password boolean flag)
  return rows.map(r => ({
    ...r,
    ssh_password: undefined,
    has_password: !!r.ssh_password
  }));
}

export async function getServerById(id, raw = false) {
  const { rows } = await pool.query('SELECT * FROM servers WHERE id = $1', [id]);
  if (rows.length === 0) {return null;}
  
  const server = rows[0];
  if (raw) {
    return server;
  }
  return {
    ...server,
    ssh_password: undefined,
    has_password: !!server.ssh_password
  };
}

export async function createServer({ name, host, username, port, use_devil, ssh_password, provider, url }) {
  const encPass = ssh_password ? encrypt(ssh_password) : null;
  const serverUrl = url || (host ? `http://${host}:${port || 22}` : 'http://localhost');
  const { rows } = await pool.query(
    'INSERT INTO servers (name, host, username, port, use_devil, ssh_password, provider, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [name, host, username, port || 22, use_devil === true, encPass, provider || 'local', serverUrl]
  );
  return {
    ...rows[0],
    ssh_password: undefined,
    has_password: !!encPass
  };
}

export async function updateServer(id, { name, host, username, port, use_devil, ssh_password, provider, url }) {
  const encPass = ssh_password !== undefined ? (ssh_password ? encrypt(ssh_password) : null) : undefined;
  const serverUrl = url || (host ? `http://${host}:${port || 22}` : 'http://localhost');
  const fields = ['name=$2', 'host=$3', 'username=$4', 'port=$5', 'use_devil=$6', 'provider=$7', 'url=$8'];
  const vals = [id, name, host, username, port || 22, use_devil === true, provider || 'local', serverUrl];
  
  if (encPass !== undefined) {
    fields.push(`ssh_password=$${vals.length + 1}`);
    vals.push(encPass);
  }
  
  const { rows } = await pool.query(
    `UPDATE servers SET ${fields.join(',')} WHERE id=$1 RETURNING *`,
    vals
  );
  return {
    ...rows[0],
    ssh_password: undefined,
    has_password: !!rows[0].ssh_password
  };
}

export async function deleteServer(id) {
  await pool.query('DELETE FROM servers WHERE id = $1', [id]);
  return { success: true };
}
