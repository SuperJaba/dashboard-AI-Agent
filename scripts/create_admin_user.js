import bcrypt from 'bcrypt';
import { pool } from '../src/backend/db.js';

async function main() {
  const username = 'admin@test.pl';
  const password = '123456';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  await pool.query(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );

  const res = await pool.query('SELECT id, username, created_at FROM users WHERE username = $1', [username]);
  console.log('SUCCESS_USER:', JSON.stringify(res.rows[0]));
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
