import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] ??= rest.join('=').trim();
  }
} catch (_) {}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'citywalk',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initDb() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at VARCHAR(30) NOT NULL
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maps (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      width INT NOT NULL,
      height INT NOT NULL,
      scale DOUBLE DEFAULT NULL,
      thumbnail VARCHAR(255) DEFAULT NULL,
      created_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id VARCHAR(36) PRIMARY KEY,
      map_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS routes (
      id VARCHAR(36) PRIMARY KEY,
      map_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      points TEXT NOT NULL,
      color VARCHAR(20) NOT NULL DEFAULT '#fffb00',
      group_id VARCHAR(36) DEFAULT NULL,
      created_at VARCHAR(30) NOT NULL,
      FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
}

export default pool;
