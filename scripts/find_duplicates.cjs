const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rDG2CyOvXu0Q@ep-solitary-waterfall-b25urrf1-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function findDuplicates() {
  try {
    const res = await pool.query(`
      SELECT survey_id, ip_hash, COUNT(*) as count, ARRAY_AGG(id) as ids
      FROM responses
      GROUP BY survey_id, ip_hash
      HAVING COUNT(*) > 1;
    `);
    console.log('Duplicate responses in Neon:');
    console.log(res.rows);
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

findDuplicates();
