const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rDG2CyOvXu0Q@ep-solitary-waterfall-b25urrf1-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function checkCounts() {
  try {
    const tables = ['admins', 'surveys', 'questions', 'responses', 'answers', 'tickets', 'audit_logs', 'system_settings'];
    for (const t of tables) {
      const res = await pool.query(`SELECT COUNT(*)::int as c FROM ${t}`);
      console.log(`${t}: ${res.rows[0].c} rows`);
    }
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkCounts();
