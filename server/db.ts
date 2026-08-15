import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import { hashPassword } from './auth';
import {
  Survey,
  Question,
  SurveyAnalytics,
  QuestionAnalytics,
  RadioBreakdown,
  RatingBreakdown,
} from '../src/types';

// Check for DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
let pgPool: Pool | null = null;

// Global in-memory revoked token cache for ultra-fast instant lookups and fail-closed protection
const memoryRevokedTokens = new Set<string>();

if (DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });
    console.log('🔗 PostgreSQL Database configured with DATABASE_URL.');
    initPgDatabase();
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
  }
}

// PostgreSQL Table Initialization & Verification
async function initPgDatabase() {
  if (!pgPool) return;
  try {
    const client = await pgPool.connect();
    try {
      console.log('⚡ Initializing PostgreSQL Schema & Checking Connection...');

      // Test Connection Query
      const testRes = await client.query('SELECT NOW() as now_time, current_database() as db_name');
      console.log(`✅ Connection test successful! Database: "${testRes.rows[0].db_name}", Server time: ${testRes.rows[0].now_time}`);

      // Create Tables with Foreign Key Cascades for Survey Addition/Deletion
      await client.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) UNIQUE,
          password_hash TEXT NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
          must_change_password BOOLEAN DEFAULT FALSE,
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          two_factor_secret VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE admins ADD COLUMN IF NOT EXISTS username VARCHAR(255);
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'admin';
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE admins ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);

        CREATE TABLE IF NOT EXISTS surveys (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category VARCHAR(100),
          theme VARCHAR(50) DEFAULT 'government',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions (
          id SERIAL PRIMARY KEY,
          survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
          question_text TEXT NOT NULL,
          question_type VARCHAR(20) NOT NULL,
          options JSONB DEFAULT '[]'::jsonb
        );

        CREATE TABLE IF NOT EXISTS responses (
          id SERIAL PRIMARY KEY,
          survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
          ip_hash VARCHAR(128) NOT NULL,
          age_group VARCHAR(50),
          gender VARCHAR(50),
          education VARCHAR(100),
          residence VARCHAR(100),
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS answers (
          id SERIAL PRIMARY KEY,
          response_id INT REFERENCES responses(id) ON DELETE CASCADE,
          question_id INT REFERENCES questions(id) ON DELETE CASCADE,
          answer_text TEXT,
          rating_value INT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          admin_email VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(50)
        );

        CREATE TABLE IF NOT EXISTS error_logs (
          id SERIAL PRIMARY KEY,
          api_path VARCHAR(255) NOT NULL,
          error_type VARCHAR(100) NOT NULL,
          message TEXT NOT NULL,
          stack_trace TEXT,
          line_info VARCHAR(100),
          ip_address VARCHAR(50),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tickets (
          id SERIAL PRIMARY KEY,
          ticket_code VARCHAR(50) UNIQUE NOT NULL,
          category VARCHAR(100) NOT NULL,
          residence VARCHAR(100),
          subject TEXT NOT NULL,
          description TEXT NOT NULL,
          full_name VARCHAR(255),
          phone VARCHAR(50),
          email VARCHAR(255),
          priority VARCHAR(20) DEFAULT 'Normal',
          status VARCHAR(30) DEFAULT 'Pending',
          admin_response TEXT,
          responded_at TIMESTAMP,
          responded_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS revoked_tokens (
          id SERIAL PRIMARY KEY,
          token_hash VARCHAR(64) UNIQUE NOT NULL,
          user_id INT,
          revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        );
      `);

      console.log('✅ PostgreSQL Schema Verified: admins, surveys, questions, responses, answers, audit_logs, tickets, system_settings, revoked_tokens tables exist.');

      // Seed default developer/admin logins ONLY if they don't already exist
      const initialDevPass = process.env.DEV_PASSWORD || 'OPA@123';
      const initialAdminPass = process.env.ADMIN_PASSWORD || 'Admin@123456';

      const usersToSeed: { email: string; username: string; pass: string; role: 'developer' | 'owner' | 'admin'; mustChange: boolean }[] = [
        { email: 'opa@dgc.gov.et', username: 'opa', pass: initialDevPass, role: 'developer', mustChange: false },
        { email: 'eyobjegreta@gmail.com', username: 'eyobjegreta', pass: initialAdminPass, role: 'developer', mustChange: false },
      ];

      for (const u of usersToSeed) {
        const uHash = hashPassword(u.pass);
        await client.query(
          `INSERT INTO admins (email, username, password_hash, role, must_change_password, two_factor_enabled)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           ON CONFLICT (email) DO NOTHING`,
          [u.email, u.username, uHash, u.role, u.mustChange]
        );
      }

      // Initialize global_2fa_enabled default only if not set
      await client.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('global_2fa_enabled', 'false')
         ON CONFLICT (setting_key) DO NOTHING`
      );
      console.log('✅ Developer and Admin accounts verified and synchronized with database.');

      // Check if surveys exist, if not seed default surveys and rich demographic data
      const checkSurveys = await client.query('SELECT COUNT(*)::int as count FROM surveys');
      if (checkSurveys.rows[0].count === 0) {
        console.log('🌱 Seeding initial surveys and demographic response data into PostgreSQL...');
        await seedPgInitialData(client);
        console.log('🎉 Default surveys and rich demographic responses successfully seeded into PostgreSQL!');
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ PostgreSQL Schema Initialization Error:', err);
  }
}

async function seedPgInitialData(client: any) {
  const initialData = getInitialData();

  // Insert Surveys and map IDs
  const surveyIdMap = new Map<number, number>();
  for (const s of initialData.surveys) {
    const res = await client.query(
      `INSERT INTO surveys (id, title, description, category, theme, is_active, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [s.id, s.title, s.description, s.category, 'government', s.is_active, s.created_at]
    );
    const insertedId = res.rows.length > 0 ? res.rows[0].id : s.id;
    surveyIdMap.set(s.id, insertedId);
  }
  // Reset survey sequence
  await client.query(`SELECT setval('surveys_id_seq', (SELECT MAX(id) FROM surveys))`);

  // Insert Questions
  const questionIdMap = new Map<number, number>();
  for (const q of initialData.questions) {
    const targetSurveyId = surveyIdMap.get(q.survey_id) || q.survey_id;
    const res = await client.query(
      `INSERT INTO questions (id, survey_id, question_text, question_type, options) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [q.id, targetSurveyId, q.question_text, q.question_type, JSON.stringify(q.options || [])]
    );
    const insertedId = res.rows.length > 0 ? res.rows[0].id : q.id;
    questionIdMap.set(q.id, insertedId);
  }
  await client.query(`SELECT setval('questions_id_seq', (SELECT MAX(id) FROM questions))`);

  // Insert Responses
  const responseIdMap = new Map<number, number>();
  for (const r of initialData.responses) {
    const targetSurveyId = surveyIdMap.get(r.survey_id) || r.survey_id;
    const res = await client.query(
      `INSERT INTO responses (id, survey_id, ip_hash, age_group, gender, education, residence, submitted_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [r.id, targetSurveyId, r.ip_hash, r.age_group, r.gender, r.education, r.residence, r.submitted_at]
    );
    const insertedId = res.rows.length > 0 ? res.rows[0].id : r.id;
    responseIdMap.set(r.id, insertedId);
  }
  await client.query(`SELECT setval('responses_id_seq', (SELECT MAX(id) FROM responses))`);

  // Insert Answers
  for (const a of initialData.answers) {
    const targetResponseId = responseIdMap.get(a.response_id) || a.response_id;
    const targetQuestionId = questionIdMap.get(a.question_id) || a.question_id;
    await client.query(
      `INSERT INTO answers (id, response_id, question_id, answer_text, rating_value) 
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [a.id, targetResponseId, targetQuestionId, a.answer_text || null, a.rating_value || null]
    );
  }
  await client.query(`SELECT setval('answers_id_seq', (SELECT MAX(id) FROM answers))`);

  // Insert initial audit log
  for (const log of initialData.audit_logs) {
    await client.query(
      `INSERT INTO audit_logs (id, admin_email, action, details, timestamp, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [log.id, log.admin_email, log.action, log.details, log.timestamp, log.ip_address || '127.0.0.1']
    );
  }
  await client.query(`SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs))`);

  // Insert initial tickets
  for (const t of initialData.tickets || []) {
    await client.query(
      `INSERT INTO tickets (id, ticket_code, category, residence, subject, description, full_name, phone, email, priority, status, admin_response, responded_at, responded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (ticket_code) DO NOTHING`,
      [
        t.id,
        t.ticket_code,
        t.category,
        t.residence || null,
        t.subject,
        t.description,
        t.full_name || null,
        t.phone || null,
        t.email || null,
        t.priority || 'Normal',
        t.status || 'Pending',
        t.admin_response || null,
        t.responded_at || null,
        t.responded_by || null,
        t.created_at || new Date().toISOString(),
      ]
    );
  }
  await client.query(`SELECT setval('tickets_id_seq', (SELECT MAX(id) FROM tickets))`);
}

// Local JSON File Fallback Store
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface LocalDB {
  admins: {
    id: number;
    email: string;
    username?: string;
    password_hash: string;
    role: 'developer' | 'owner' | 'admin';
    must_change_password?: boolean;
    two_factor_enabled?: boolean;
    two_factor_secret?: string;
    created_at: string;
  }[];
  surveys: { id: number; title: string; description: string; category: string; is_active: boolean; created_at: string }[];
  questions: { id: number; survey_id: number; question_text: string; question_type: 'text' | 'radio' | 'rating'; options: string[] }[];
  responses: {
    id: number;
    survey_id: number;
    ip_hash: string;
    submitted_at: string;
    age_group?: string;
    gender?: string;
    education?: string;
    residence?: string;
  }[];
  answers: { id: number; response_id: number; question_id: number; answer_text?: string; rating_value?: number }[];
  audit_logs: { id: number; admin_email: string; action: string; details: string; timestamp: string; ip_address?: string }[];
  tickets: {
    id: number;
    ticket_code: string;
    category: string;
    residence?: string;
    subject: string;
    description: string;
    full_name?: string;
    phone?: string;
    email?: string;
    priority: 'Normal' | 'High' | 'Urgent';
    status: 'Pending' | 'Under Review' | 'Resolved' | 'Closed';
    admin_response?: string;
    responded_at?: string;
    responded_by?: string;
    created_at: string;
  }[];
  error_logs?: {
    id: number;
    api_path: string;
    error_type: string;
    message: string;
    stack_trace?: string;
    line_info?: string;
    ip_address?: string;
    timestamp: string;
  }[];
  settings?: Record<string, string>;
  revoked_tokens?: {
    id?: number;
    token_hash: string;
    user_id?: number | null;
    revoked_at: string;
    expires_at?: string | null;
  }[];
}

function getInitialData(): LocalDB {
  const now = new Date().toISOString();
  const initialDevPass = process.env.DEV_PASSWORD || 'OPA@123';
  const initialOwnerPass = process.env.OWNER_PASSWORD || 'Owner1@123';
  const initialAdminPass = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const defaultAdmins = [
    { id: 1, email: 'opa@dgc.gov.et', username: 'opa', password_hash: hashPassword(initialDevPass), role: 'developer' as const, must_change_password: true, created_at: now },
    { id: 2, email: 'owner1@dgc.gov.et', username: 'owner1', password_hash: hashPassword(initialOwnerPass), role: 'owner' as const, must_change_password: true, created_at: now },
    { id: 3, email: 'admin@dgc.gov.et', username: 'admin', password_hash: hashPassword(initialAdminPass), role: 'admin' as const, must_change_password: true, created_at: now },
  ];

  if (process.env.ADMIN_EMAIL) {
    const customEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
    if (!defaultAdmins.some(a => a.email.toLowerCase() === customEmail)) {
      defaultAdmins.push({
        id: 4,
        email: customEmail,
        username: customEmail.split('@')[0],
        password_hash: hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123456'),
        role: 'developer',
        must_change_password: false,
        created_at: now,
      });
    }
  }

  return {
    admins: defaultAdmins,
    surveys: [
      {
        id: 1,
        title: 'የ2018 የፓርላማና የኢኮኖሚ አፈጻጸም የሕዝብ አስተያየት (2026 Parliamentary & Economy Opinion)',
        description: 'በአገራዊ የኢኮኖሚ ማሻሻያ፣ በኑሮ ውድነት ቅናሽ ጥረቶች እና በፓርላማው ቁጥጥር ላይ የተጠቃሚዎች ሚስጥራዊ አስተያየት',
        category: 'ፖለቲካ እና ኢኮኖሚ',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 2,
        title: 'የከተማ መሠረተ ልማት እና የሕዝብ ትራንስፖርት አገልግሎት እርካታ',
        description: 'በትራንስፖርት፣ በንጹህ መጠጥ ውኃ እና የኤሌክትሪክ አገልግሎት ጥራት ላይ የሚሰጥ አጠቃላይ ዳሰሳ',
        category: 'መሠረተ ልማት',
        is_active: true,
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 3,
        title: 'የትምህርትና የጤና ዘርፍ ማሻሻያዎች የሕዝብ ዳሰሳ',
        description: 'በህዝብ ትምህርት ቤቶች እና በሆስፒታሎች አገልግሎት አሰጣጥ ላይ የህብረተሰቡን አስተያየት ለመሰብሰብ የተዘጋጀ',
        category: 'ማህበራዊ ጉዳዮች',
        is_active: true,
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 4,
        title: 'የድሬዳዋ ስማርት ሲቲ እና ዲጂታል አሰራር የሕዝብ እርካታ ዳሰሳ',
        description: 'በኦንላይን የከተማ አገልግሎቶች፣ የመንግስት ኮሙኒኬሽን መረጃ ተዳራሽነት እና የዲጂታል ቴክኖሎጂ ተጠቃሚነት ላይ የተዘጋጀ',
        category: 'ቴክኖሎጂና አሰራር',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    questions: [
      // Survey 1 Questions
      { id: 1, survey_id: 1, question_text: 'በአሁኑ ወቅት ያለው የኢኮኖሚ ማሻሻያ እርምጃዎች አቅጣጫ ምን ያህል ተስፋ ሰጪ ነው ብለው ያስባሉ?', question_type: 'radio', options: ['በጣም ተስፋ ሰጪ ነው', 'በከፊል ተስፋ ሰጪ ነው', 'ያልወሰንኩ', 'ተስፋ አስቆራጭ ነው'] },
      { id: 2, survey_id: 1, question_text: 'የመንግስት የኑሮ ውድነትን የመቆጣጠር ስራ እና ድጎማዎችን እንዴት ይገመግሙታል?', question_type: 'rating', options: [] },
      { id: 3, survey_id: 1, question_text: 'ፓርላማው የመንግስት አካላትን በግልጽነትና በተጠያቂነት በመቆጣጠር ረገድ ያለው ሚና እንዴት ነው?', question_type: 'radio', options: ['በጣም ጥሩ', 'መካከለኛ', 'ዝቅተኛ', 'በጣም ዝቅተኛ'] },
      { id: 4, survey_id: 1, question_text: 'ለቀጣይ የፖሊሲ ማሻሻያዎች ለመንግስት የሚያስተላልፉት ዋና ጥቆማ ወይም አስተያየት ካለ በዝርዝር ይፃፉ፡', question_type: 'text', options: [] },

      // Survey 2 Questions
      { id: 5, survey_id: 2, question_text: 'በአካባቢዎ ያለው የህዝብ ትራንስፖርት (አውቶቡስ/ታክሲ) ተaccessibility እና ምቾት እንዴት ያዩታል?', question_type: 'radio', options: ['በጣም ጥሩ', 'አጥጋቢ', 'ችግር አለበት', 'በጣም አስቸጋሪ'] },
      { id: 6, survey_id: 2, question_text: 'የውኃና የኤሌክትሪክ አቅርቦት ዘላቂነትና አስተማማኝነት ደረጃ፡', question_type: 'rating', options: [] },
      { id: 7, survey_id: 2, question_text: 'በመሠረተ ልማት ዝርጋታ ወቅት የሚታዩ መዘግየቶችን ለመቅረፍ ምን መደረግ አለበት?', question_type: 'text', options: [] },

      // Survey 3 Questions
      { id: 8, survey_id: 3, question_text: 'የመንግስት ህክምና ተቋማት እና ሆስፒታሎች የመድኃኒትና የህክምና ቁሳቁስ አቅርቦት ደረጃ፡', question_type: 'rating', options: [] },
      { id: 9, survey_id: 3, question_text: 'ከትምህርት ጥራት ማሻሻያ ጋር ተያይዞ የተወሰዱ እርምጃዎችን ይደግፋሉ?', question_type: 'radio', options: ['ሙሉ በሙሉ እደግፋለሁ', 'በከፊል እደግፋለሁ', 'አልደግፍም', 'አስተያየት የለኝም'] },

      // Survey 4 Questions
      { id: 10, survey_id: 4, question_text: 'የድሬዳዋ አስተዳደር የኦንላይን እና ዲጂታል አገልግሎቶች አሰጣጥ ምቾት እንዴት ይገመግሙታል?', question_type: 'rating', options: [] },
      { id: 11, survey_id: 4, question_text: 'የመንግስት መረጃዎች እና ውሳኔዎች በቴሌግራም እና በሶሻል ሚዲያ ተዳራሽ የመሆናቸው ደረጃ፡', question_type: 'radio', options: ['በጣም ከፍተኛ', 'ከፍተኛ', 'መካከለኛ', 'ዝቅተኛ'] },
    ],
    responses: [
      // Survey 1 Responses (Balanced male & female, age, residence)
      { id: 1, survey_id: 1, ip_hash: 'hash_demo_1', age_group: '26-35', gender: 'ወንድ', education: 'የመጀመሪያ ዲግሪ', residence: 'አዲስ ከተማ', submitted_at: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: 2, survey_id: 1, ip_hash: 'hash_demo_2', age_group: '18-25', gender: 'ሴት', education: 'ሁለተኛ ደረጃ (9-12)', residence: 'ደቼቱ', submitted_at: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 3, survey_id: 1, ip_hash: 'hash_demo_3', age_group: '36-45', gender: 'ወንድ', education: 'ዲፕሎማ / ሰርተፊኬት', residence: 'አሰብታ', submitted_at: new Date(Date.now() - 4 * 86400000).toISOString() },
      { id: 4, survey_id: 1, ip_hash: 'hash_demo_4', age_group: '26-35', gender: 'ሴት', education: 'የመጀመሪያ ዲግሪ', residence: 'መላካ', submitted_at: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: 5, survey_id: 1, ip_hash: 'hash_demo_5', age_group: '46-65', gender: 'ወንድ', education: 'ሁለተኛ ዲግሪና ከዚያ በላይ', residence: 'ቦሌ (ድሬዳዋ)', submitted_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 6, survey_id: 1, ip_hash: 'hash_demo_6', age_group: '18-25', gender: 'ሴት', education: 'ዲፕሎማ / ሰርተፊኬት', residence: 'አዲስ ከተማ', submitted_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: 7, survey_id: 1, ip_hash: 'hash_demo_7', age_group: '26-35', gender: 'ወንድ', education: 'የመጀመሪያ ዲግሪ', residence: 'ደቼቱ', submitted_at: new Date(Date.now() - 12 * 3600000).toISOString() },
      { id: 8, survey_id: 1, ip_hash: 'hash_demo_8', age_group: '36-45', gender: 'ሴት', education: 'የመጀመሪያ ደረጃ (1-8)', residence: 'ድሬዳዋ ዙሪያ ገጠር', submitted_at: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 9, survey_id: 1, ip_hash: 'hash_demo_9', age_group: '18-25', gender: 'ወንድ', education: 'ሁለተኛ ደረጃ (9-12)', residence: 'አሰብታ', submitted_at: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 10, survey_id: 1, ip_hash: 'hash_demo_10', age_group: '26-35', gender: 'ሴት', education: 'የመጀመሪያ ዲግሪ', residence: 'ቦሌ (ድሬዳዋ)', submitted_at: new Date(Date.now() - 30 * 60000).toISOString() },

      // Survey 2 Responses
      { id: 11, survey_id: 2, ip_hash: 'hash_demo_11', age_group: '26-35', gender: 'ወንድ', education: 'የመጀመሪያ ዲግሪ', residence: 'ደቼቱ', submitted_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 12, survey_id: 2, ip_hash: 'hash_demo_12', age_group: '36-45', gender: 'ሴት', education: 'የመጀመሪያ ደረጃ (1-8)', residence: 'ድሬዳዋ ዙሪያ ገጠር', submitted_at: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: 13, survey_id: 2, ip_hash: 'hash_demo_13', age_group: '18-25', gender: 'ወንድ', education: 'ዲፕሎማ / ሰርተፊኬት', residence: 'አዲስ ከተማ', submitted_at: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 14, survey_id: 2, ip_hash: 'hash_demo_14', age_group: '26-35', gender: 'ሴት', education: 'ሁለተኛ ደረጃ (9-12)', residence: 'አሰብታ', submitted_at: new Date(Date.now() - 3 * 3600000).toISOString() },
      { id: 15, survey_id: 2, ip_hash: 'hash_demo_15', age_group: '46-65', gender: 'ወንድ', education: 'ሁለተኛ ዲግሪና ከዚያ በላይ', residence: 'ቦሌ (ድሬዳዋ)', submitted_at: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 16, survey_id: 2, ip_hash: 'hash_demo_16', age_group: '18-25', gender: 'ሴት', education: 'የመጀመሪያ ዲግሪ', residence: 'መላካ', submitted_at: new Date(Date.now() - 20 * 60000).toISOString() },

      // Survey 3 Responses
      { id: 17, survey_id: 3, ip_hash: 'hash_demo_17', age_group: '26-35', gender: 'ሴት', education: 'የመጀመሪያ ዲግሪ', residence: 'ቦሌ (ድሬዳዋ)', submitted_at: new Date(Date.now() - 5 * 3600000).toISOString() },
      { id: 18, survey_id: 3, ip_hash: 'hash_demo_18', age_group: '36-45', gender: 'ወንድ', education: 'ሁለተኛ ዲግሪና ከዚያ በላይ', residence: 'አሰብታ', submitted_at: new Date(Date.now() - 1 * 3600000).toISOString() },
      { id: 19, survey_id: 3, ip_hash: 'hash_demo_19', age_group: '18-25', gender: 'ሴት', education: 'ዲፕሎማ / ሰርተፊኬት', residence: 'ደቼቱ', submitted_at: new Date(Date.now() - 45 * 60000).toISOString() },
      { id: 20, survey_id: 3, ip_hash: 'hash_demo_20', age_group: '26-35', gender: 'ወንድ', education: 'የመጀመሪያ ዲግሪ', residence: 'አዲስ ከተማ', submitted_at: new Date(Date.now() - 15 * 60000).toISOString() },
      { id: 21, survey_id: 3, ip_hash: 'hash_demo_21', age_group: '46-65', gender: 'ሴት', education: 'የመጀመሪያ ደረጃ (1-8)', residence: 'ድሬዳዋ ዙሪያ ገጠር', submitted_at: new Date(Date.now() - 5 * 60000).toISOString() },

      // Survey 4 Responses
      { id: 22, survey_id: 4, ip_hash: 'hash_demo_22', age_group: '18-25', gender: 'ወንድ', education: 'የመጀመሪያ ዲግሪ', residence: 'ደቼቱ', submitted_at: new Date(Date.now() - 30 * 60000).toISOString() },
      { id: 23, survey_id: 4, ip_hash: 'hash_demo_23', age_group: '26-35', gender: 'ሴት', education: 'የመጀመሪያ ዲግሪ', residence: 'አዲስ ከተማ', submitted_at: new Date(Date.now() - 10 * 60000).toISOString() },
      { id: 24, survey_id: 4, ip_hash: 'hash_demo_24', age_group: '18-25', gender: 'ሴት', education: 'ሁለተኛ ደረጃ (9-12)', residence: 'መላካ', submitted_at: new Date(Date.now() - 8 * 60000).toISOString() },
      { id: 25, survey_id: 4, ip_hash: 'hash_demo_25', age_group: '36-45', gender: 'ወንድ', education: 'ዲፕሎማ / ሰርተፊኬት', residence: 'አሰብታ', submitted_at: new Date(Date.now() - 2 * 60000).toISOString() },
      { id: 26, survey_id: 4, ip_hash: 'hash_demo_26', age_group: '26-35', gender: 'ወንድ', education: 'ሁለተኛ ዲግሪና ከዚያ በላይ', residence: 'ቦሌ (ድሬዳዋ)', submitted_at: new Date(Date.now() - 1 * 60000).toISOString() },
    ],
    audit_logs: [
      {
        id: 1,
        admin_email: process.env.ADMIN_EMAIL || 'admin@ethiopia-opinion.gov.et',
        action: 'SYSTEM_STARTUP',
        details: 'የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ዳታቤዝ ሲስተም ተጀምሯል::',
        timestamp: new Date().toISOString(),
        ip_address: '127.0.0.1',
      },
    ],
    answers: [
      // Answers for Survey 1
      { id: 1, response_id: 1, question_id: 1, answer_text: 'በጣም ተስፋ ሰጪ ነው' },
      { id: 2, response_id: 1, question_id: 2, rating_value: 4 },
      { id: 3, response_id: 1, question_id: 3, answer_text: 'በጣም ጥሩ' },
      { id: 4, response_id: 1, question_id: 4, answer_text: 'የግብርና ምርቶች አቅርቦት ላይ ትኩረት ቢደረግ እና የውጭ ምንዛሬ ግብይቱ ቢረጋጋ ጥሩ ነው::' },

      { id: 5, response_id: 2, question_id: 1, answer_text: 'በከፊል ተስፋ ሰጪ ነው' },
      { id: 6, response_id: 2, question_id: 2, rating_value: 3 },
      { id: 7, response_id: 2, question_id: 3, answer_text: 'መካከለኛ' },
      { id: 8, response_id: 2, question_id: 4, answer_text: 'የአነስተኛ እና መካከለኛ ነጋዴዎች የግብር ጫና ቢቀነስ::' },

      { id: 9, response_id: 3, question_id: 1, answer_text: 'በከፊል ተስፋ ሰጪ ነው' },
      { id: 10, response_id: 3, question_id: 2, rating_value: 3 },
      { id: 11, response_id: 3, question_id: 3, answer_text: 'መካከለኛ' },
      { id: 12, response_id: 3, question_id: 4, answer_text: 'የወጣቶች ስራ እድል ፈጠራ በዲጂታል ቴክኖሎጂ ቢደገፍ::' },

      { id: 13, response_id: 4, question_id: 1, answer_text: 'በጣም ተስፋ ሰጪ ነው' },
      { id: 14, response_id: 4, question_id: 2, rating_value: 5 },
      { id: 15, response_id: 4, question_id: 3, answer_text: 'በጣም ጥሩ' },

      { id: 16, response_id: 5, question_id: 1, answer_text: 'ተስፋ አስቆራጭ ነው' },
      { id: 17, response_id: 5, question_id: 2, rating_value: 2 },
      { id: 18, response_id: 5, question_id: 3, answer_text: 'ዝቅተኛ' },

      { id: 19, response_id: 6, question_id: 1, answer_text: 'በከፊል ተስፋ ሰጪ ነው' },
      { id: 20, response_id: 6, question_id: 2, rating_value: 4 },
      { id: 21, response_id: 6, question_id: 3, answer_text: 'መካከለኛ' },

      { id: 22, response_id: 7, question_id: 1, answer_text: 'በጣም ተስፋ ሰጪ ነው' },
      { id: 23, response_id: 7, question_id: 2, rating_value: 5 },
      { id: 24, response_id: 7, question_id: 3, answer_text: 'በጣም ጥሩ' },

      { id: 25, response_id: 8, question_id: 1, answer_text: 'በከፊል ተስፋ ሰጪ ነው' },
      { id: 26, response_id: 8, question_id: 2, rating_value: 4 },

      { id: 27, response_id: 9, question_id: 1, answer_text: 'በጣም ተስፋ ሰጪ ነው' },
      { id: 28, response_id: 9, question_id: 2, rating_value: 4 },

      { id: 29, response_id: 10, question_id: 1, answer_text: 'በከፊል ተስፋ ሰጪ ነው' },
      { id: 30, response_id: 10, question_id: 2, rating_value: 3 },

      // Answers for Survey 2
      { id: 31, response_id: 11, question_id: 5, answer_text: 'አጥጋቢ' },
      { id: 32, response_id: 11, question_id: 6, rating_value: 3 },
      { id: 33, response_id: 11, question_id: 7, answer_text: 'የኮንትራክተሮች ቁጥጥር እና የጊዜ ገደብ በጥብቅ መከበር አለበት::' },

      { id: 34, response_id: 12, question_id: 5, answer_text: 'በጣም ጥሩ' },
      { id: 35, response_id: 12, question_id: 6, rating_value: 4 },
      { id: 36, response_id: 12, question_id: 7, answer_text: 'የስማርት ሲቲ እና ኤሌክትሪክ አውቶቡስ አቅርቦት ቢሰፋ::' },

      { id: 37, response_id: 13, question_id: 5, answer_text: 'በጣም ጥሩ' },
      { id: 38, response_id: 13, question_id: 6, rating_value: 5 },

      { id: 39, response_id: 14, question_id: 5, answer_text: 'አጥጋቢ' },
      { id: 40, response_id: 14, question_id: 6, rating_value: 4 },

      { id: 41, response_id: 15, question_id: 5, answer_text: 'ችግር አለበት' },
      { id: 42, response_id: 15, question_id: 6, rating_value: 2 },

      { id: 43, response_id: 16, question_id: 5, answer_text: 'በጣም ጥሩ' },
      { id: 44, response_id: 16, question_id: 6, rating_value: 4 },

      // Answers for Survey 3
      { id: 45, response_id: 17, question_id: 8, rating_value: 4 },
      { id: 46, response_id: 17, question_id: 9, answer_text: 'ሙሉ በሙሉ እደግፋለሁ' },

      { id: 47, response_id: 18, question_id: 8, rating_value: 5 },
      { id: 48, response_id: 18, question_id: 9, answer_text: 'ሙሉ በሙሉ እደግፋለሁ' },

      { id: 49, response_id: 19, question_id: 8, rating_value: 3 },
      { id: 50, response_id: 19, question_id: 9, answer_text: 'በከፊል እደግፋለሁ' },

      { id: 51, response_id: 20, question_id: 8, rating_value: 4 },
      { id: 52, response_id: 20, question_id: 9, answer_text: 'ሙሉ በሙሉ እደግፋለሁ' },

      { id: 53, response_id: 21, question_id: 8, rating_value: 4 },
      { id: 54, response_id: 21, question_id: 9, answer_text: 'በከፊል እደግፋለሁ' },

      // Answers for Survey 4
      { id: 55, response_id: 22, question_id: 10, rating_value: 5 },
      { id: 56, response_id: 22, question_id: 11, answer_text: 'በጣም ከፍተኛ' },

      { id: 57, response_id: 23, question_id: 10, rating_value: 4 },
      { id: 58, response_id: 23, question_id: 11, answer_text: 'ከፍተኛ' },

      { id: 59, response_id: 24, question_id: 10, rating_value: 5 },
      { id: 60, response_id: 24, question_id: 11, answer_text: 'ከፍተኛ' },

      { id: 61, response_id: 25, question_id: 10, rating_value: 4 },
      { id: 62, response_id: 25, question_id: 11, answer_text: 'መካከለኛ' },

      { id: 63, response_id: 26, question_id: 10, rating_value: 5 },
      { id: 64, response_id: 26, question_id: 11, answer_text: 'በጣም ከፍተኛ' },
    ],
    tickets: [
      {
        id: 1,
        ticket_code: 'DGC-TKT-2026-W892',
        category: 'ንጹህ መጠጥ ውኃ',
        residence: 'ደቼቱ',
        subject: 'የመጠጥ ውኃ መቆራረጥ አቤቱታ',
        description: 'በደቼቱ ቀበሌ 03 አካባቢ ላለፉት 4 ቀናት የንጹህ መጠጥ ውኃ መቆራረጥ አጋጥሟል:: እባክዎን የመጠጥ ውኃ መስመሩ እንዲስተካከልልን::',
        full_name: 'አህመድ መሐመድ',
        phone: '0915123456',
        priority: 'High',
        status: 'Resolved',
        admin_response: 'የውኃና ፍሳሽ ባለስልጣን የቴክኒክ ቡድን የተበላሸውን ዋና መስመር በማስተካከል አገልግሎቱን ወደ ነበረበት መልሷል::',
        responded_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        responded_by: 'admin@dgc.gov.et',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 2,
        ticket_code: 'DGC-TKT-2026-S104',
        category: 'መንገድና ትራንስፖርት',
        residence: 'አዲስ ከተማ',
        subject: 'Cabasho ku saabsan gaadiidka dadweynaha',
        description: 'Waxaan cabasho ka muujinaynaa gaadiidka dadweynaha ee ka shaqeeya Sabian iyo Addada, oo qiimaha khidmada si aan sharciga ahayn u kordhiyay.',
        full_name: 'Axmed Nuur',
        phone: '0922334455',
        priority: 'Normal',
        status: 'Pending',
        created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
      },
      {
        id: 3,
        ticket_code: 'DGC-TKT-2026-O205',
        category: 'ጤናና ሆስፒታል',
        residence: 'አሰብታ',
        subject: "Waa'ee tajaajila kaffaltii bilisaa kan hospitaala Sabiyaan",
        description: "Hospitaala Sabiyaan keessatti qorichi kaffaltii bilisaatiin kennamu muraasa waan ta'eef gargaarsi hatattamaa akka godhamu gaafanna.",
        full_name: 'Caliyyii Galgaloo',
        phone: '0933445566',
        priority: 'Urgent',
        status: 'Under Review',
        admin_response: 'የጤና መመሪያ እና የጥራት ቁጥጥር ቡድናችን ጉዳዩን እየመረመረ ይገኛል::',
        responded_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        responded_by: 'admin@dgc.gov.et',
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
      {
        id: 4,
        ticket_code: 'DGC-TKT-2026-L308',
        category: 'የከተማ መሬትና ፕላን',
        residence: 'ቦሌ (ድሬዳዋ)',
        subject: 'የካርታ እና ይዞታ ማረጋገጫ ጥያቄ',
        description: 'በቦሌ ክፍለ ከተማ ህጋዊ የይዞታ ማረጋገጫ ማውጣት ሂደቱ መዘገየት አሳይቷል::',
        full_name: 'ሰለሞን በቀለ',
        phone: '0911887766',
        priority: 'Normal',
        status: 'Pending',
        created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      },
    ],
    error_logs: [],
    settings: {
      maintenance_mode: 'false',
    },
  };
}

function readLocalDB(): LocalDB {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local db file, resetting:', err);
    const initial = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeLocalDB(db: LocalDB): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Data Access API
export const db = {
  // Admin & User authentication
  async getAdminByEmail(identifier: string) {
    const cleanStr = (identifier || '').toLowerCase().trim();
    if (!cleanStr) return null;

    if (pgPool) {
      try {
        const res = await pgPool.query(
          'SELECT id, email, username, password_hash, role, must_change_password, two_factor_enabled, two_factor_secret, created_at FROM admins WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
          [cleanStr]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.error('Error querying pgPool for admin:', err);
      }
    }

    const local = readLocalDB();
    const found = local.admins.find(
      (a) => a.email.toLowerCase() === cleanStr || (a.username && a.username.toLowerCase() === cleanStr)
    );
    if (found) return found;

    return null;
  },

  async updateAdminPassword(id: number, newPassword: string) {
    const newHash = hashPassword(newPassword);

    if (pgPool) {
      try {
        await pgPool.query(
          'UPDATE admins SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
          [newHash, id]
        );
        return true;
      } catch (err) {
        console.error('Error updating admin password in pgPool:', err);
      }
    }

    const local = readLocalDB();
    const idx = local.admins.findIndex((a) => a.id === id);
    if (idx !== -1) {
      local.admins[idx].password_hash = newHash;
      local.admins[idx].must_change_password = false;
      writeLocalDB(local);
    }
    return true;
  },

  async setAdminTwoFactor(id: number, enabled: boolean, secret?: string) {
    if (pgPool) {
      try {
        if (secret) {
          await pgPool.query(
            'UPDATE admins SET two_factor_enabled = $1, two_factor_secret = $2 WHERE id = $3',
            [enabled, secret, id]
          );
        } else {
          await pgPool.query(
            'UPDATE admins SET two_factor_enabled = $1 WHERE id = $2',
            [enabled, id]
          );
        }
        return true;
      } catch (err) {
        console.error('Error setting 2FA in pgPool:', err);
      }
    }

    const local = readLocalDB();
    const idx = local.admins.findIndex((a) => a.id === id);
    if (idx !== -1) {
      local.admins[idx].two_factor_enabled = enabled;
      if (secret) local.admins[idx].two_factor_secret = secret;
      writeLocalDB(local);
    }
    return true;
  },

  async markPasswordChanged(id: number) {
    if (pgPool) {
      try {
        await pgPool.query('UPDATE admins SET must_change_password = FALSE WHERE id = $1', [id]);
        return true;
      } catch (err) {
        console.error('Error marking password changed in pgPool:', err);
      }
    }

    const local = readLocalDB();
    const idx = local.admins.findIndex((a) => a.id === id);
    if (idx !== -1) {
      local.admins[idx].must_change_password = false;
      writeLocalDB(local);
    }
    return true;
  },

  async getAllAdmins() {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT id, email, username, role, must_change_password, two_factor_enabled, created_at FROM admins ORDER BY id ASC');
        if (res.rows.length > 0) return res.rows;
      } catch (err) {
        console.error('Error fetching admins from pgPool:', err);
      }
    }

    const local = readLocalDB();
    if (!local.admins || local.admins.length === 0) {
      const init = getInitialData();
      return init.admins.map(({ password_hash, ...rest }) => rest);
    }
    return local.admins.map(({ password_hash, ...rest }) => rest);
  },

  async updateAdminProfile(id: number, updates: { email?: string; username?: string; password?: string; role?: 'owner' | 'admin' }) {
    const { email, username, password, role } = updates;
    const newHash = password ? hashPassword(password) : undefined;

    if (pgPool) {
      try {
        const setClauses: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (email) {
          setClauses.push(`email = $${idx++}`);
          params.push(email);
        }
        if (username) {
          setClauses.push(`username = $${idx++}`);
          params.push(username);
        }
        if (newHash) {
          setClauses.push(`password_hash = $${idx++}`);
          params.push(newHash);
        }
        if (role) {
          setClauses.push(`role = $${idx++}`);
          params.push(role);
        }

        if (setClauses.length > 0) {
          params.push(id);
          await pgPool.query(`UPDATE admins SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);
        }
        return true;
      } catch (err) {
        console.error('Error updating admin profile in pgPool:', err);
      }
    }

    const local = readLocalDB();
    const idx = local.admins.findIndex((a) => a.id === id);
    if (idx !== -1) {
      if (email) local.admins[idx].email = email;
      if (username) local.admins[idx].username = username;
      if (newHash) local.admins[idx].password_hash = newHash;
      if (role) local.admins[idx].role = role;
      writeLocalDB(local);
    }
    return true;
  },

  async createAdminUser(email: string, username: string, password: string, role: 'owner' | 'admin' = 'admin') {
    const uHash = hashPassword(password);
    if (pgPool) {
      try {
        const res = await pgPool.query(
          `INSERT INTO admins (email, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, created_at`,
          [email, username, uHash, role]
        );
        return res.rows[0];
      } catch (err) {
        console.error('Error creating admin in pgPool:', err);
      }
    }

    const local = readLocalDB();
    const newId = local.admins.length > 0 ? Math.max(...local.admins.map((a) => a.id)) + 1 : 1;
    const newUser = {
      id: newId,
      email,
      username,
      password_hash: uHash,
      role,
      created_at: new Date().toISOString(),
    };
    local.admins.push(newUser);
    writeLocalDB(local);
    const { password_hash, ...rest } = newUser;
    return rest;
  },

  async deleteAdminUser(id: number) {
    if (pgPool) {
      try {
        await pgPool.query('DELETE FROM admins WHERE id = $1', [id]);
        return true;
      } catch (err) {
        console.error('Error deleting admin from pgPool:', err);
      }
    }
    const local = readLocalDB();
    local.admins = local.admins.filter((a) => a.id !== id);
    writeLocalDB(local);
    return true;
  },

  // Public & Admin Surveys
  async getAllSurveys(includeInactive = false) {
    if (pgPool) {
      const query = includeInactive
        ? `SELECT s.*, COUNT(r.id)::int as total_responses 
           FROM surveys s LEFT JOIN responses r ON s.id = r.survey_id 
           GROUP BY s.id ORDER BY s.created_at DESC`
        : `SELECT s.*, COUNT(r.id)::int as total_responses 
           FROM surveys s LEFT JOIN responses r ON s.id = r.survey_id 
           WHERE s.is_active = true 
           GROUP BY s.id ORDER BY s.created_at DESC`;
      const res = await pgPool.query(query);
      return res.rows;
    }

    const local = readLocalDB();
    const list = includeInactive ? local.surveys : local.surveys.filter((s) => s.is_active);

    const sortedList = [...list].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id - a.id;
    });

    return sortedList.map((s) => {
      const total = local.responses.filter((r) => r.survey_id === s.id).length;
      return { ...s, total_responses: total };
    });
  },

  async getSurveyById(id: number) {
    if (pgPool) {
      const sRes = await pgPool.query('SELECT * FROM surveys WHERE id = $1', [id]);
      if (sRes.rows.length === 0) return null;
      const survey = sRes.rows[0];

      const qRes = await pgPool.query(
        'SELECT * FROM questions WHERE survey_id = $1 ORDER BY id ASC',
        [id]
      );
      survey.questions = qRes.rows.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
      }));

      return survey;
    }

    const local = readLocalDB();
    const survey = local.surveys.find((s) => s.id === id);
    if (!survey) return null;

    const questions = local.questions.filter((q) => q.survey_id === id);
    const total_responses = local.responses.filter((r) => r.survey_id === id).length;

    return {
      ...survey,
      questions,
      total_responses,
    };
  },

  async hasUserResponded(surveyId: number, ipHash: string): Promise<boolean> {
    if (pgPool) {
      const res = await pgPool.query(
        'SELECT id FROM responses WHERE survey_id = $1 AND ip_hash = $2',
        [surveyId, ipHash]
      );
      return res.rows.length > 0;
    }
    const local = readLocalDB();
    return local.responses.some((r) => r.survey_id === surveyId && r.ip_hash === ipHash);
  },

  async submitResponse(
    surveyId: number,
    ipHash: string,
    answers: { question_id: number; answer_text?: string; rating_value?: number }[],
    demographics?: { age_group?: string; gender?: string; education?: string; residence?: string }
  ) {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const respRes = await client.query(
          'INSERT INTO responses (survey_id, ip_hash, age_group, gender, education, residence) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [
            surveyId,
            ipHash,
            demographics?.age_group || null,
            demographics?.gender || null,
            demographics?.education || null,
            demographics?.residence || null,
          ]
        );
        const responseId = respRes.rows[0].id;

        for (const ans of answers) {
          await client.query(
            'INSERT INTO answers (response_id, question_id, answer_text, rating_value) VALUES ($1, $2, $3, $4)',
            [responseId, ans.question_id, ans.answer_text || null, ans.rating_value || null]
          );
        }
        await client.query('COMMIT');
        return responseId;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const local = readLocalDB();
    const newResponseId = local.responses.length > 0 ? Math.max(...local.responses.map((r) => r.id)) + 1 : 1;
    const newResp = {
      id: newResponseId,
      survey_id: surveyId,
      ip_hash: ipHash,
      submitted_at: new Date().toISOString(),
      age_group: demographics?.age_group,
      gender: demographics?.gender,
      education: demographics?.education,
      residence: demographics?.residence,
    };
    local.responses.push(newResp);

    let nextAnsId = local.answers.length > 0 ? Math.max(...local.answers.map((a) => a.id)) + 1 : 1;
    for (const ans of answers) {
      local.answers.push({
        id: nextAnsId++,
        response_id: newResponseId,
        question_id: ans.question_id,
        answer_text: ans.answer_text || undefined,
        rating_value: ans.rating_value || undefined,
      });
    }

    writeLocalDB(local);
    return newResponseId;
  },

  async addAuditLog(adminEmail: string, action: string, details: string, ipAddress?: string) {
    if (pgPool) {
      try {
        await pgPool.query(
          'INSERT INTO audit_logs (admin_email, action, details, ip_address) VALUES ($1, $2, $3, $4)',
          [adminEmail, action, details, ipAddress || '127.0.0.1']
        );
        return;
      } catch (err) {
        console.error('Failed to add audit log to PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    if (!local.audit_logs) local.audit_logs = [];
    const newId = local.audit_logs.length > 0 ? Math.max(...local.audit_logs.map((l) => l.id)) + 1 : 1;
    local.audit_logs.unshift({
      id: newId,
      admin_email: adminEmail,
      action,
      details,
      timestamp: new Date().toISOString(),
      ip_address: ipAddress || '127.0.0.1',
    });
    writeLocalDB(local);
  },

  async getAuditLogs() {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        return res.rows;
      } catch (err) {
        console.error('Failed to get audit logs from PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    return local.audit_logs || [];
  },

  async addErrorLog(
    apiPath: string,
    errorType: string,
    message: string,
    stackTrace?: string,
    lineInfo?: string,
    ipAddress?: string
  ) {
    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO error_logs (api_path, error_type, message, stack_trace, line_info, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [apiPath, errorType, message, stackTrace || null, lineInfo || 'N/A', ipAddress || '127.0.0.1']
        );
        return;
      } catch (err) {
        console.error('Failed to add error log to PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    if (!local.error_logs) local.error_logs = [];
    const newId = local.error_logs.length > 0 ? Math.max(...local.error_logs.map((e: any) => e.id)) + 1 : 1;
    local.error_logs.unshift({
      id: newId,
      api_path: apiPath,
      error_type: errorType,
      message,
      stack_trace: stackTrace || '',
      line_info: lineInfo || 'N/A',
      ip_address: ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString(),
    });
    writeLocalDB(local);
  },

  async getErrorLogs() {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 100');
        return res.rows;
      } catch (err) {
        console.error('Failed to get error logs from PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    return local.error_logs || [];
  },

  async clearErrorLogs() {
    if (pgPool) {
      try {
        await pgPool.query('TRUNCATE TABLE error_logs');
        return;
      } catch (err) {
        console.error('Failed to clear error logs in PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    local.error_logs = [];
    writeLocalDB(local);
  },

  async getAllRawResponses() {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT * FROM responses ORDER BY id ASC');
        return res.rows;
      } catch (err) {
        console.error('Failed to fetch raw responses from PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    return local.responses || [];
  },

  async getAllRawAnswers() {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT * FROM answers ORDER BY id ASC');
        return res.rows;
      } catch (err) {
        console.error('Failed to fetch raw answers from PostgreSQL:', err);
      }
    }

    const local = readLocalDB();
    return local.answers || [];
  },

  async createSurvey(data: {
    title: string;
    description: string;
    category: string;
    theme?: string;
    start_date?: string;
    end_date?: string;
    questions: { question_text: string; question_type: 'text' | 'radio' | 'rating'; options: string[] }[];
  }) {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const sRes = await client.query(
          'INSERT INTO surveys (title, description, category, theme, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id',
          [data.title, data.description, data.category || 'General', data.theme || 'government', data.start_date || null, data.end_date || null]
        );
        const surveyId = sRes.rows[0].id;

        for (const q of data.questions) {
          await client.query(
            'INSERT INTO questions (survey_id, question_text, question_type, options) VALUES ($1, $2, $3, $4)',
            [surveyId, q.question_text, q.question_type, JSON.stringify(q.options || [])]
          );
        }

        await client.query('COMMIT');
        return surveyId;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const local = readLocalDB();
    const newSurveyId = local.surveys.length > 0 ? Math.max(...local.surveys.map((s) => s.id)) + 1 : 1;
    const newSurvey = {
      id: newSurveyId,
      title: data.title,
      description: data.description,
      category: data.category || 'General',
      theme: (data.theme as any) || 'government',
      start_date: data.start_date || undefined,
      end_date: data.end_date || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    local.surveys.unshift(newSurvey);

    let nextQId = local.questions.length > 0 ? Math.max(...local.questions.map((q) => q.id)) + 1 : 1;
    for (const q of data.questions) {
      local.questions.push({
        id: nextQId++,
        survey_id: newSurveyId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || [],
      });
    }

    writeLocalDB(local);
    return newSurveyId;
  },

  async updateSurvey(
    surveyId: number,
    data: {
      title?: string;
      description?: string;
      category?: string;
      theme?: string;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
      questions?: { id?: number; question_text: string; question_type: 'text' | 'radio' | 'rating'; options: string[] }[];
    }
  ) {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        
        const setClauses: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (data.title !== undefined) {
          setClauses.push(`title = $${idx++}`);
          params.push(data.title);
        }
        if (data.description !== undefined) {
          setClauses.push(`description = $${idx++}`);
          params.push(data.description);
        }
        if (data.category !== undefined) {
          setClauses.push(`category = $${idx++}`);
          params.push(data.category);
        }
        if (data.theme !== undefined) {
          setClauses.push(`theme = $${idx++}`);
          params.push(data.theme);
        }
        if (data.start_date !== undefined) {
          setClauses.push(`start_date = $${idx++}`);
          params.push(data.start_date || null);
        }
        if (data.end_date !== undefined) {
          setClauses.push(`end_date = $${idx++}`);
          params.push(data.end_date || null);
        }
        if (data.is_active !== undefined) {
          setClauses.push(`is_active = $${idx++}`);
          params.push(data.is_active);
        }

        if (setClauses.length > 0) {
          params.push(surveyId);
          await client.query(`UPDATE surveys SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);
        }

        // If questions are provided, handle updates and additions
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          // Fetch existing questions
          const existingQRes = await client.query('SELECT id FROM questions WHERE survey_id = $1', [surveyId]);
          const existingQIds = new Set(existingQRes.rows.map((r) => r.id));
          const updatedQIds = new Set<number>();

          for (const q of data.questions) {
            if (q.id && existingQIds.has(q.id)) {
              // Update existing question
              await client.query(
                'UPDATE questions SET question_text = $1, question_type = $2, options = $3 WHERE id = $4 AND survey_id = $5',
                [q.question_text, q.question_type, JSON.stringify(q.options || []), q.id, surveyId]
              );
              updatedQIds.add(q.id);
            } else {
              // Insert new question
              const insertRes = await client.query(
                'INSERT INTO questions (survey_id, question_text, question_type, options) VALUES ($1, $2, $3, $4) RETURNING id',
                [surveyId, q.question_text, q.question_type, JSON.stringify(q.options || [])]
              );
              if (insertRes.rows.length > 0) {
                updatedQIds.add(insertRes.rows[0].id);
              }
            }
          }

          // Delete questions that were removed and don't have responses yet, or delete them cleanly
          for (const oldId of existingQIds) {
            if (!updatedQIds.has(oldId)) {
              await client.query('DELETE FROM answers WHERE question_id = $1', [oldId]);
              await client.query('DELETE FROM questions WHERE id = $1', [oldId]);
            }
          }
        }

        await client.query('COMMIT');
        return true;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const local = readLocalDB();
    const survey = local.surveys.find((s) => s.id === surveyId) as any;
    if (!survey) return false;

    if (data.title !== undefined) survey.title = data.title;
    if (data.description !== undefined) survey.description = data.description;
    if (data.category !== undefined) survey.category = data.category;
    if (data.theme !== undefined) survey.theme = data.theme;
    if (data.start_date !== undefined) survey.start_date = data.start_date;
    if (data.end_date !== undefined) survey.end_date = data.end_date;
    if (data.is_active !== undefined) survey.is_active = data.is_active;

    if (Array.isArray(data.questions) && data.questions.length > 0) {
      const existingQs = local.questions.filter((q) => q.survey_id === surveyId);
      const updatedQIds = new Set<number>();
      let nextQId = local.questions.length > 0 ? Math.max(...local.questions.map((q) => q.id)) + 1 : 1;

      for (const q of data.questions) {
        if (q.id && existingQs.some((eq) => eq.id === q.id)) {
          const target = local.questions.find((eq) => eq.id === q.id);
          if (target) {
            target.question_text = q.question_text;
            target.question_type = q.question_type;
            target.options = q.options || [];
            updatedQIds.add(q.id);
          }
        } else {
          const newId = nextQId++;
          local.questions.push({
            id: newId,
            survey_id: surveyId,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options || [],
          });
          updatedQIds.add(newId);
        }
      }

      // Remove deleted questions from local
      local.questions = local.questions.filter((q) => q.survey_id !== surveyId || updatedQIds.has(q.id));
    }

    writeLocalDB(local);
    return true;
  },

  async toggleSurveyStatus(surveyId: number, isActive: boolean) {
    if (pgPool) {
      await pgPool.query('UPDATE surveys SET is_active = $1 WHERE id = $2', [isActive, surveyId]);
      return;
    }
    const local = readLocalDB();
    const survey = local.surveys.find((s) => s.id === surveyId);
    if (survey) {
      survey.is_active = isActive;
      writeLocalDB(local);
    }
  },

  async deleteSurvey(surveyId: number) {
    if (pgPool) {
      // Cascading foreign keys will automatically delete questions, responses, and answers
      await pgPool.query('DELETE FROM surveys WHERE id = $1', [surveyId]);
      return;
    }
    const local = readLocalDB();
    local.surveys = local.surveys.filter((s) => s.id !== surveyId);
    local.questions = local.questions.filter((q) => q.survey_id !== surveyId);
    const respIds = local.responses.filter((r) => r.survey_id === surveyId).map((r) => r.id);
    local.responses = local.responses.filter((r) => r.survey_id !== surveyId);
    local.answers = local.answers.filter((a) => !respIds.includes(a.response_id));
    writeLocalDB(local);
  },

  async getSurveyAnalytics(surveyId: number): Promise<SurveyAnalytics | null> {
    const survey = await this.getSurveyById(surveyId);
    if (!survey) return null;

    if (pgPool) {
      const respRes = await pgPool.query('SELECT * FROM responses WHERE survey_id = $1', [surveyId]);
      const responses = respRes.rows;
      const totalResponses = responses.length;

      const questionsAnalytics: QuestionAnalytics[] = [];

      for (const q of survey.questions || []) {
        const answersRes = await pgPool.query(
          `SELECT a.*, r.submitted_at 
           FROM answers a 
           JOIN responses r ON a.response_id = r.id 
           WHERE a.question_id = $1`,
          [q.id]
        );

        const qAnswers = answersRes.rows;

        if (q.question_type === 'radio') {
          const counts: Record<string, number> = {};
          (q.options || []).forEach((opt: string) => {
            counts[opt] = 0;
          });

          qAnswers.forEach((ans) => {
            if (ans.answer_text) {
              counts[ans.answer_text] = (counts[ans.answer_text] || 0) + 1;
            }
          });

          const totalForQ = qAnswers.length || 1;
          const radio_data: RadioBreakdown[] = Object.keys(counts).map((opt) => ({
            option: opt,
            count: counts[opt],
            percentage: Math.round((counts[opt] / totalForQ) * 100),
          }));

          questionsAnalytics.push({
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options || [],
            radio_data,
            total_answers_count: qAnswers.length,
          });
        } else if (q.question_type === 'rating') {
          const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          let sum = 0;
          let count = 0;

          qAnswers.forEach((ans) => {
            if (ans.rating_value && ans.rating_value >= 1 && ans.rating_value <= 5) {
              ratingCounts[ans.rating_value]++;
              sum += ans.rating_value;
              count++;
            }
          });

          const totalForQ = count || 1;
          const rating_distribution: RatingBreakdown[] = [1, 2, 3, 4, 5].map((v) => ({
            value: v,
            count: ratingCounts[v],
            percentage: Math.round((ratingCounts[v] / totalForQ) * 100),
          }));

          questionsAnalytics.push({
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: [],
            rating_average: count > 0 ? parseFloat((sum / count).toFixed(1)) : 0,
            rating_distribution,
            total_answers_count: count,
          });
        } else if (q.question_type === 'text') {
          const text_responses = qAnswers
            .filter((ans) => ans.answer_text && ans.answer_text.trim().length > 0)
            .map((ans) => ({
              id: ans.id,
              answer_text: ans.answer_text,
              submitted_at: ans.submitted_at,
            }));

          questionsAnalytics.push({
            question_id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: [],
            text_responses,
            total_answers_count: text_responses.length,
          });
        }
      }

      // Calculate demographic analytics from PG responses
      const ageMap: Record<string, number> = {};
      const genderMap: Record<string, number> = {};
      const eduMap: Record<string, number> = {};
      const resMap: Record<string, number> = {};
      const totalForDemo = responses.length || 1;

      responses.forEach((r) => {
        if (r.age_group) ageMap[r.age_group] = (ageMap[r.age_group] || 0) + 1;
        if (r.gender) genderMap[r.gender] = (genderMap[r.gender] || 0) + 1;
        if (r.education) eduMap[r.education] = (eduMap[r.education] || 0) + 1;
        if (r.residence) resMap[r.residence] = (resMap[r.residence] || 0) + 1;
      });

      const buildBreakdown = (map: Record<string, number>) =>
        Object.keys(map).map((k) => ({
          label: k,
          count: map[k],
          percentage: Math.round((map[k] / totalForDemo) * 100),
        }));

      return {
        survey,
        total_responses: totalResponses,
        questions_analytics: questionsAnalytics,
        demographics_analytics: {
          age_distribution: buildBreakdown(ageMap),
          gender_distribution: buildBreakdown(genderMap),
          education_distribution: buildBreakdown(eduMap),
          residence_distribution: buildBreakdown(resMap),
        },
      };
    }

    // Local DB Analytics calculation
    const local = readLocalDB();
    const responses = local.responses.filter((r) => r.survey_id === surveyId);
    const responseIds = responses.map((r) => r.id);
    const answers = local.answers.filter((a) => responseIds.includes(a.response_id));

    const questionsAnalytics: QuestionAnalytics[] = [];

    for (const q of survey.questions || []) {
      const qAnswers = answers.filter((a) => a.question_id === q.id);

      if (q.question_type === 'radio') {
        const counts: Record<string, number> = {};
        (q.options || []).forEach((opt: any) => {
          counts[opt] = 0;
        });

        qAnswers.forEach((ans) => {
          if (ans.answer_text) {
            counts[ans.answer_text] = (counts[ans.answer_text] || 0) + 1;
          }
        });

        const totalForQ = qAnswers.length || 1;
        const radio_data: RadioBreakdown[] = Object.keys(counts).map((opt) => ({
          option: opt,
          count: counts[opt],
          percentage: Math.round((counts[opt] / totalForQ) * 100),
        }));

        questionsAnalytics.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          radio_data,
          total_answers_count: qAnswers.length,
        });
      } else if (q.question_type === 'rating') {
        const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;
        let count = 0;

        qAnswers.forEach((ans) => {
          if (ans.rating_value && ans.rating_value >= 1 && ans.rating_value <= 5) {
            ratingCounts[ans.rating_value]++;
            sum += ans.rating_value;
            count++;
          }
        });

        const totalForQ = count || 1;
        const rating_distribution: RatingBreakdown[] = [1, 2, 3, 4, 5].map((v) => ({
          value: v,
          count: ratingCounts[v],
          percentage: Math.round((ratingCounts[v] / totalForQ) * 100),
        }));

        questionsAnalytics.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: [],
          rating_average: count > 0 ? parseFloat((sum / count).toFixed(1)) : 0,
          rating_distribution,
          total_answers_count: count,
        });
      } else if (q.question_type === 'text') {
        const text_responses = qAnswers
          .filter((ans) => ans.answer_text && ans.answer_text.trim().length > 0)
          .map((ans) => {
            const resp = responses.find((r) => r.id === ans.response_id);
            return {
              id: ans.id,
              answer_text: ans.answer_text!,
              submitted_at: resp?.submitted_at || new Date().toISOString(),
            };
          });

        questionsAnalytics.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: [],
          text_responses,
          total_answers_count: text_responses.length,
        });
      }
    }

    // Demographic analytics calculation
    const ageMap: Record<string, number> = {};
    const genderMap: Record<string, number> = {};
    const eduMap: Record<string, number> = {};
    const resMap: Record<string, number> = {};

    const totalResp = responses.length || 1;

    responses.forEach((r) => {
      if (r.age_group) ageMap[r.age_group] = (ageMap[r.age_group] || 0) + 1;
      if (r.gender) genderMap[r.gender] = (genderMap[r.gender] || 0) + 1;
      if (r.education) eduMap[r.education] = (eduMap[r.education] || 0) + 1;
      if (r.residence) resMap[r.residence] = (resMap[r.residence] || 0) + 1;
    });

    const buildBreakdown = (map: Record<string, number>) =>
      Object.keys(map).map((k) => ({
        label: k,
        count: map[k],
        percentage: Math.round((map[k] / totalResp) * 100),
      }));

    return {
      survey,
      total_responses: responses.length,
      questions_analytics: questionsAnalytics,
      demographics_analytics: {
        age_distribution: buildBreakdown(ageMap),
        gender_distribution: buildBreakdown(genderMap),
        education_distribution: buildBreakdown(eduMap),
        residence_distribution: buildBreakdown(resMap),
      },
    };
  },

  // Citizen Complaint & Inquiry Tickets API
  async createTicket(data: {
    ticket_code: string;
    category: string;
    residence?: string;
    subject: string;
    description: string;
    full_name?: string;
    phone?: string;
    email?: string;
    priority?: string;
  }) {
    if (pgPool) {
      const res = await pgPool.query(
        `INSERT INTO tickets (ticket_code, category, residence, subject, description, full_name, phone, email, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending') RETURNING *`,
        [
          data.ticket_code,
          data.category,
          data.residence || null,
          data.subject,
          data.description,
          data.full_name || null,
          data.phone || null,
          data.email || null,
          data.priority || 'Normal',
        ]
      );
      return res.rows[0];
    }

    const local = readLocalDB();
    if (!local.tickets) local.tickets = [];
    const newId = local.tickets.length > 0 ? Math.max(...local.tickets.map((t) => t.id)) + 1 : 1;
    const newTicket = {
      id: newId,
      ticket_code: data.ticket_code,
      category: data.category,
      residence: data.residence,
      subject: data.subject,
      description: data.description,
      full_name: data.full_name,
      phone: data.phone,
      email: data.email,
      priority: (data.priority as any) || 'Normal',
      status: 'Pending' as const,
      created_at: new Date().toISOString(),
    };
    local.tickets.unshift(newTicket);
    writeLocalDB(local);
    return newTicket;
  },

  async getTicketByCode(ticketCode: string) {
    const cleanCode = (ticketCode || '').trim().toUpperCase();
    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM tickets WHERE UPPER(ticket_code) = UPPER($1)', [cleanCode]);
      return res.rows.length > 0 ? res.rows[0] : null;
    }

    const local = readLocalDB();
    const tickets = local.tickets || [];
    return tickets.find((t) => t.ticket_code.toUpperCase() === cleanCode) || null;
  },

  async getAllTickets() {
    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM tickets ORDER BY created_at DESC');
      return res.rows;
    }

    const local = readLocalDB();
    const tickets = local.tickets || [];
    return [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getTicketsByPhoneOrEmail(query: string) {
    const cleanQuery = (query || '').trim().toLowerCase();
    if (!cleanQuery) return [];

    if (pgPool) {
      const res = await pgPool.query(
        `SELECT * FROM tickets 
         WHERE LOWER(phone) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(full_name) LIKE $1 
         ORDER BY created_at DESC`,
        [`%${cleanQuery}%`]
      );
      return res.rows;
    }

    const local = readLocalDB();
    const tickets = local.tickets || [];
    return tickets.filter(
      (t) =>
        (t.phone && t.phone.toLowerCase().includes(cleanQuery)) ||
        (t.email && t.email.toLowerCase().includes(cleanQuery)) ||
        (t.full_name && t.full_name.toLowerCase().includes(cleanQuery))
    );
  },

  async updateTicketResponse(
    ticketId: number,
    adminResponse: string,
    status: 'Pending' | 'Under Review' | 'Resolved' | 'Closed',
    adminEmail: string
  ) {
    const nowIso = new Date().toISOString();
    if (pgPool) {
      const res = await pgPool.query(
        `UPDATE tickets 
         SET admin_response = $1, status = $2, responded_at = NOW(), responded_by = $3 
         WHERE id = $4 RETURNING *`,
        [adminResponse, status, adminEmail, ticketId]
      );
      return res.rows[0];
    }

    const local = readLocalDB();
    if (!local.tickets) local.tickets = [];
    const ticket = local.tickets.find((t) => t.id === ticketId);
    if (ticket) {
      ticket.admin_response = adminResponse;
      ticket.status = status;
      ticket.responded_at = nowIso;
      ticket.responded_by = adminEmail;
      writeLocalDB(local);
    }
    return ticket;
  },

  async deleteTicket(ticketId: number) {
    if (pgPool) {
      await pgPool.query('DELETE FROM tickets WHERE id = $1', [ticketId]);
      return;
    }
    const local = readLocalDB();
    if (local.tickets) {
      local.tickets = local.tickets.filter((t) => t.id !== ticketId);
      writeLocalDB(local);
    }
  },

  async deleteTestTickets(): Promise<number> {
    if (pgPool) {
      const res = await pgPool.query("DELETE FROM tickets WHERE ticket_code LIKE 'DGC-TST-%'");
      return res.rowCount || 0;
    }
    const local = readLocalDB();
    if (local.tickets) {
      const initialCount = local.tickets.length;
      local.tickets = local.tickets.filter((t) => !t.ticket_code || !t.ticket_code.startsWith('DGC-TST-'));
      const deletedCount = initialCount - local.tickets.length;
      writeLocalDB(local);
      return deletedCount;
    }
    return 0;
  },

  // System Settings Storage
  async getSetting(key: string, defaultValue = ''): Promise<string> {
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [key]);
        if (res.rows.length > 0) {
          return res.rows[0].setting_value;
        }
      } catch (err) {
        console.error(`Failed to get setting ${key} from PostgreSQL:`, err);
      }
    }

    const local = readLocalDB();
    if (local.settings && local.settings[key] !== undefined) {
      return local.settings[key];
    }
    return defaultValue;
  },

  async setSetting(key: string, value: string): Promise<void> {
    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO system_settings (setting_key, setting_value)
           VALUES ($1, $2)
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2`,
          [key, value]
        );
        return;
      } catch (err) {
        console.error(`Failed to set setting ${key} in PostgreSQL:`, err);
      }
    }

    const local = readLocalDB();
    if (!local.settings) local.settings = {};
    local.settings[key] = value;
    writeLocalDB(local);
  },

  // JWT Revocation & Session Blacklist
  async addRevokedToken(tokenHash: string, userId?: number, expiresAt?: Date): Promise<void> {
    // 1. Instantly record in memory set (synchronous guarantee)
    memoryRevokedTokens.add(tokenHash);

    // 2. Persist to PostgreSQL if connected
    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO revoked_tokens (token_hash, user_id, expires_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (token_hash) DO NOTHING`,
          [tokenHash, userId || null, expiresAt || null]
        );
      } catch (err) {
        console.error('Failed to record revoked token in PostgreSQL:', err);
      }
    }

    // 3. Persist to Local JSON fallback
    const local = readLocalDB();
    if (!local.revoked_tokens) local.revoked_tokens = [];
    if (!local.revoked_tokens.some((r: any) => r.token_hash === tokenHash)) {
      local.revoked_tokens.push({
        token_hash: tokenHash,
        user_id: userId || null,
        revoked_at: new Date().toISOString(),
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      writeLocalDB(local);
    }
  },

  async isTokenRevoked(tokenHash: string): Promise<boolean> {
    // 1. Check in-memory blacklist first (instant O(1))
    if (memoryRevokedTokens.has(tokenHash)) {
      return true;
    }

    // 2. Query PostgreSQL with strict error handling (Fail-Closed)
    if (pgPool) {
      try {
        const res = await pgPool.query(
          `SELECT id FROM revoked_tokens 
           WHERE token_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
          [tokenHash]
        );
        if (res.rows.length > 0) {
          memoryRevokedTokens.add(tokenHash); // Cache in memory
          return true;
        }
      } catch (err) {
        console.error('CRITICAL: Failed to query revoked_tokens in PostgreSQL. Enforcing FAIL-CLOSED policy:', err);
        // Fail-Closed: Return true to prevent unauthorized access when token state cannot be proven valid
        return true;
      }
    }

    // 3. Fallback to Local JSON
    const local = readLocalDB();
    if (!local.revoked_tokens) return false;
    const now = Date.now();
    const isRevokedInLocal = local.revoked_tokens.some((r: any) => {
      if (r.token_hash !== tokenHash) return false;
      if (!r.expires_at) return true;
      return new Date(r.expires_at).getTime() > now;
    });

    if (isRevokedInLocal) {
      memoryRevokedTokens.add(tokenHash);
    }

    return isRevokedInLocal;
  },
};


