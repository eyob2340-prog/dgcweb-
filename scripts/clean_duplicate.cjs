const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_rDG2CyOvXu0Q@ep-solitary-waterfall-b25urrf1-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function cleanAndIndex() {
  try {
    console.log('Cleaning duplicate response id 125...');
    await pool.query('DELETE FROM answers WHERE response_id = 125');
    await pool.query('DELETE FROM responses WHERE id = 125');
    console.log('Creating unique index idx_responses_survey_ip_unique...');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_survey_ip_unique ON responses(survey_id, ip_hash);');
    console.log('✅ Unique index created successfully!');
    await pool.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

cleanAndIndex();
