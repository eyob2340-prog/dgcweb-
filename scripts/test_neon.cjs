const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rDG2CyOvXu0Q@ep-solitary-waterfall-b25urrf1-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function test() {
  try {
    console.log('Connecting to Neon PostgreSQL...');
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now, current_database() as db, version() as ver;');
    console.log('✅ Connection SUCCESSFUL!');
    console.log('Database:', res.rows[0].db);
    console.log('Server time:', res.rows[0].now);
    console.log('Version:', res.rows[0].ver);
    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Connection FAILED:', err);
    process.exit(1);
  }
}

test();
