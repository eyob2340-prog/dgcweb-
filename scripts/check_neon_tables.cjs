const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rDG2CyOvXu0Q@ep-solitary-waterfall-b25urrf1-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in Neon database:', res.rows.map(r => r.table_name));
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTables();
