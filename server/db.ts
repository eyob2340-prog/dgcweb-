/// <reference path="../globals.d.ts" />
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}
import {
  Survey,
  Question,
  SurveyAnalytics,
  QuestionAnalytics,
  RadioBreakdown,
  RatingBreakdown,
} from '../src/types';

// Check for DATABASE_URL & Production Environment
const DATABASE_URL = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production' || process.env.REQUIRE_POSTGRES === 'true';
let pgPool: Pool | null = null;

if (isProduction && !DATABASE_URL) {
  console.error('🚨 [CRITICAL PRODUCTION ERROR] NODE_ENV is "production" but DATABASE_URL is missing!');
  console.error('🚨 The server MUST connect to PostgreSQL. Silent fallback to db.json is strictly disabled in production.');
}

// Global in-memory revoked token cache for ultra-fast instant lookups and fail-closed protection
const memoryRevokedTokens = new Set<string>();

if (DATABASE_URL) {
  try {
    const poolMax = parseInt(process.env.PG_MAX_POOL || '50', 10);
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost')
        ? false
        : {
            rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true',
            // Optional: paste the provider's CA certificate (PEM) to enable full certificate verification safely
            ...(process.env.PG_SSL_CA ? { ca: process.env.PG_SSL_CA.replace(/\\n/g, '\n') } : {}),
          },
      max: poolMax, // Supports 100+ concurrent users without starvation
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pgPool.on('error', (err) => {
      console.error('🚨 Unexpected error on idle PostgreSQL client (recovered):', err);
    });
    console.log(`🔗 PostgreSQL Database configured with DATABASE_URL (Pool Max: ${poolMax}).`);
    initPgDatabase();
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
    if (isProduction) {
      throw new Error(`CRITICAL: PostgreSQL initialization failed in production: ${(err as any)?.message}`);
    }
  }
} else if (isProduction) {
  console.error('🚨 Production mode started without DATABASE_URL! Database operations will fail with 503.');
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

        ALTER TABLE surveys ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

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

        ALTER TABLE responses ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'am';

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

        -- Performance & Concurrency Indexes (Crucial for 100+ concurrent users)
        -- Enforce strict database-level unique constraint to guarantee one response per citizen/device
        CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_survey_ip_unique ON responses(survey_id, ip_hash);
        CREATE INDEX IF NOT EXISTS idx_responses_submitted ON responses(submitted_at DESC);
        CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
        CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);
        CREATE INDEX IF NOT EXISTS idx_tickets_phone_email ON tickets(phone, email);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_revoked_tokens_hash ON revoked_tokens(token_hash);
      `);

      console.log('✅ PostgreSQL Schema Verified: tables and performance indexes are ready for high concurrency.');

      // Seed default developer/admin logins ONLY if they don't already exist
      const initialDevPass = process.env.DEV_PASSWORD;
      const initialAdminPass = process.env.ADMIN_PASSWORD;
      if (!initialDevPass || !initialAdminPass) {
        console.warn('⚠️ [SECURITY] DEV_PASSWORD or ADMIN_PASSWORD not set in environment. Skipping admin seeding.');
      }

      if (initialDevPass && initialAdminPass) {
      const usersToSeed: { email: string; username: string; pass: string; role: 'developer' | 'owner' | 'admin'; mustChange: boolean }[] = [
        { email: 'opa@dgc.gov.et', username: 'opa', pass: initialDevPass, role: 'developer', mustChange: false },
      ];
      // Optional extra developer account, supplied ONLY through the environment (no personal e-mail in source code)
      const extraDevEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      if (extraDevEmail && !usersToSeed.some((u) => u.email === extraDevEmail)) {
        usersToSeed.push({ email: extraDevEmail, username: extraDevEmail.split('@')[0], pass: initialAdminPass, role: 'developer', mustChange: true });
      }

      for (const u of usersToSeed) {
        const uHash = hashPassword(u.pass);
        await client.query(
          `INSERT INTO admins (email, username, password_hash, role, must_change_password, two_factor_enabled)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           ON CONFLICT (email) DO NOTHING`,
          [u.email, u.username, uHash, u.role, u.mustChange]
        );
      }

      }
      console.log('✅ Developer and Admin accounts verified and synchronized with database.');

      // Global 2FA default: true (enforced for high security as requested)
      await client.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ('global_2fa_enabled', 'true')
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true'`
      );

      // Check if surveys exist, if not seed default surveys and rich demographic data
      const checkSurveys = await client.query('SELECT COUNT(*)::int as count FROM surveys');
      if (checkSurveys.rows[0].count === 0) {
        console.log('🌱 Seeding initial surveys, questions, tickets, and rich demographic response data into PostgreSQL...');
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
      `INSERT INTO surveys (id, title, description, category, theme, is_active, created_at, translations) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [s.id, s.title, s.description, s.category, (s as any).theme || 'government', s.is_active, s.created_at, JSON.stringify((s as any).translations || {})]
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
  surveys: {
    id: number;
    title: string;
    description: string;
    category: string;
    theme?: string;
    is_active: boolean;
    created_at: string;
    translations?: Record<string, any>;
  }[];
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
    language?: string;
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
  const initialDevPass = process.env.DEV_PASSWORD;
  const initialOwnerPass = process.env.OWNER_PASSWORD;
  const initialAdminPass = process.env.ADMIN_PASSWORD;

  // Only seed admins whose passwords are explicitly set in environment — never use empty-string fallbacks
  const defaultAdmins: LocalDB['admins'] = [];
  let nextId = 1;
  if (initialDevPass) {
    defaultAdmins.push({ id: nextId++, email: 'opa@dgc.gov.et', username: 'opa', password_hash: hashPassword(initialDevPass), role: 'developer' as const, must_change_password: true, created_at: now });
  }
  if (initialOwnerPass) {
    defaultAdmins.push({ id: nextId++, email: 'owner1@dgc.gov.et', username: 'owner1', password_hash: hashPassword(initialOwnerPass), role: 'owner' as const, must_change_password: true, created_at: now });
  }
  if (initialAdminPass) {
    defaultAdmins.push({ id: nextId++, email: 'admin@dgc.gov.et', username: 'admin', password_hash: hashPassword(initialAdminPass), role: 'admin' as const, must_change_password: true, created_at: now });
  }
  if (defaultAdmins.length === 0) {
    console.warn('⚠️ [SECURITY] No admin passwords set in environment (DEV_PASSWORD, OWNER_PASSWORD, ADMIN_PASSWORD). No default admins will be seeded.');
  }

  if (process.env.ADMIN_EMAIL) {
    const customEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
    if (!defaultAdmins.some(a => a.email.toLowerCase() === customEmail)) {
      defaultAdmins.push({
        id: nextId++,
        email: customEmail,
        username: customEmail.split('@')[0],
        password_hash: hashPassword(process.env.ADMIN_PASSWORD!),
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
        title: 'የድሬደዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - የአስተዳደሩን አዲሱን መንግስት ምስረታ አስመልክቶ ከአመራሩና ከአዲሱ የምክር ቤት ተመራጮች ህዝቡ የሚጠብቃቸውን የልማትና የዲሞክራሲ እንቅስቃሴና ቀጣይ ተስፋዎችን በተመለከተ እንደ ድሬደዋ የሕዝብ አስተያየት ለመሰብሰብ የተዘጋጀ መነሻ መጠይቅ (መስከረም 2019 ዓ.ም)',
        description: '1. መግቢያ፡ በቅርቡ በድሬደዋም ሆነ እንደ ሀገር አሳታፊ፣ ግልጽ፣ ዴሞክራሲያዊ ምርጫ መካሄዱ ይታወቃል። የምርጫዉን ውጤት ተከትሎም የዐዲስ መንግሥት ምሥረታ እተካሄደ ይገኛል፡፡ በዚህም የድሬደዋ አስተዳደር ምክር ቤት መስራች ጉባኤውን ያካሄደ ሲሆን በዚህም የተለያዩ ከፍተኛ አመራሮች ሹመት ተካሂዱዋል። በመሆኑም አዲሱ ምክር ቤትና አመራር በቀጣይ የድሬደዋን ሁለንተናዊ ብልጽግና ለማረጋገጥ በሚሰራቸው ሁሉ አቀፍ እንቅስቃሴና ትኩረት ሊደረግባቸው ይጋብል በሚሉ ጉዳዮች ላይ የህብረተሰቡን ሀሳብና አስተያየት ማሰባሰብ አስፈልጓል። ስለሆነም ለድሬደዋ ልማትና እድገት ይበልጥ መረጋገጥ ሁሉም የድርሻውን እንዲያበረክት የሚጠበቅ ሲሆን ለዚህም እርሶ ሃሳብና አስተያየቶን በመስጠት ለብልጽግና ጉዞው ስኬታማነት የበኩሎን እንዲያበረክቱ በአክብሮት እንጠይቃለን።\n\n2. የዚህ መጠይቅ ዋና አላማ፡ በድሬደዋ አስተዳደር ምክር ቤቱ መስራች ጉባኤውን በማካሄድ የተለያዩ ከፍተኛ አመራሮች ሹመት ተካሂዱዋል። በመሆኑም አዲሱ ምክር ቤትና አመራር በቀጣይ የድሬደዋን ሁለንተናዊ ብልጽግና ለማረጋገጥ በሚሰራቸው ሁሉ አቀፍ እንቅስቃሴ ዙሪያና ከህብረተሱ የሚጠበቁ ጉዳዮችን አስመልክ የተዘጋጀ መጠይቅ ነው፡፡',
        category: 'ፖለቲካ እና ኢኮኖሚ',
        theme: 'government',
        is_active: true,
        created_at: new Date().toISOString(),
        translations: {
          om: {
            title: "Biiroo Dhimmoota Kominikeeshinii Mootummaa Bulchiinsa Dirree Dawaa - Hundeeffama mootummaa haaraa bulchiinsichaa ilaalchisee hooggansaa fi miseensota mana maree haaraa filataman irraa socho'iinsa misoomaa fi dimokraasii ummanni eegu fi abdiilee fuulduraa irratti yaada uummata Dirree Dawaa walitti qabuuf qophaa'e (Fuulbana 2019)",
            description: "1. Seensa: Dhiyeenya kana Dirree Dawaattis ta'ee akka biyyaatti filannoon hirmaachisaa, ifaafi dimokraatawaa ta'e gaggeeffamuun isaa ni beekama. Bu'aa filannichaa hordofuunis hundeeffamni mootummaa haaraa adeemsifamaa jira. Kanaanis Manni Maree Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa kan gaggeesse yoo ta'u, kanaanis muudamni hooggantoota olaanoo adda addaa raawwatameera. Kanaafuu, manni maree fi hooggansi haaraan fuulduratti badhaadhina hundagaleessa Dirree Dawaa mirkaneessuuf socho'iinsa maraa taasisan irratti dhimmoota xiyyeeffannoon kennamuufii qabu jedhaman irratti yaadaa fi ilaalcha uummataa walitti qabuun barbaachiseera. Kanaafuu, misoomaa fi guddina Dirree Dawaa caalaatti mirkaneessuuf hundi gahee isaa akka gumaachu kan eegamu yoo ta'u, kanaafis isinis yaada keessan kennuudhaan milkaa'ina imala badhaadhinaatiif qooda keessan akka gumaachitan kabajaan gaafanna.\n\n2. Kaayyoo Guddaa Gaaffannoo Kanaa: Manni Maree Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa gaggeessuun muudama hooggantoota olaanoo adda addaa raawwateera. Kanaafuu, gaaffannoo kun manni maree fi hooggansi haaraan fuulduratti badhaadhina hundagaleessa Dirree Dawaa mirkaneessuuf socho'iinsa taasisan irratti dhimmoota uummata irraa eegaman ilaalchisee kan qophaa'edha.",
            category: "Poliitikaa fi Dinagdee",
            questions: [
              { id: 1, question_text: "Dhiyeenya kana Itoophiyaan filannoo waliigalaa hirmaachisaa, ifaafi dimokraatawaa ta'ee fi fudhatama uummataa qabu gaggeessiteetti. Bu'aa filannichaa hordofuunis qophii hundeeffama mootummaa haaraa irra jirti. Kanaafuu, mootummaa sadarkaa federaalaatti hundeeffamu irraa abdiilee fi hojiiwwan ijoo eegdan ilaalchisee yaada qabdan nuuf qoodduu?", options: [] },
              { id: 2, question_text: "Hundeeffama mootummaa kanaan walqabatee gaheen uummataa maal ta'uu qaba jettanii yaaddu?", options: [] },
              { id: 3, question_text: "Manni Maree Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa gaggeessuun Af-yaa'ii mana marichaa dabalatee Kantiibaa bulchiinsichaa fi hoogganoota dhaabbilee adda addaa gaggeessan muudeera. Kanaafuu, hoogganoota amma gara aangootti dhufan ilaalchisee yaadaa fi ilaalcha qabdan nuuf ibsuu dandeessuu?", options: [] },
              { id: 4, question_text: "Hooggansi haaraan socho'iinsa nagaa, misoomaa fi dimokraasii Dirree Dawaatti eegalame sadarkaa olaanaatti itti fufsiisuu keessatti maal gochuu qaba jettanii yaaddu? Gama kanaan yaada qabdan nuuf qoodduu?", options: [] },
              { id: 5, question_text: "Manni maree fi hooggansi haaraan fuulduratti badhaadhina hundagaleessa Dirree Dawaa mirkaneessuuf socho'iinsa maraa taasisan keessatti eenyu irraa maal eegama dhimmoota jedhan irratti yaada qabdan nuuf qoodduu?", options: [] },
              { id: 6, question_text: "Waggoota dhufan keessatti Dirree Dawaatti gama hundaan dhimmoota raawwatamuu qabu jettanii yaaddanii fi gahee fi hirmaannaa qooda fudhattoota adda addaa ilaalchisee yaada dabalataa yoo qabaattan nuuf ibsaa?", options: [] }
            ]
          },
          so: {
            title: "Xafiiska Arrimaha Isgaadhsiinta Dawladda Ee Maamulka Diridhaba - Xog-ururin ku saabsan dhismaha dawladda cusub ee maamulka, rajada iyo dhaqdhaqaaqyada horumarineed iyo dimuqraadiyadeed ee ay shacabku ka filayaan hoggaanka cusub iyo xubnaha golaha ee la doortay (Sebtembar 2019)",
            description: "1. Horudhac: Waxaa la wada ogsoon yahay in dhowaan magaalada Diridhaba iyo guud ahaan dalka ay ka qabsoontay doorasho loo dhan yahay, hufan oo dimuqraadi ah. Natiijadii doorashada ka dibna waxaa socda dhismaha dawlad cusub. Golaha Maamulka Diridhaba ayaa qabtay kalfadhigiisii aasaaska, waxaana lagu magacaabay hoggaamiyeyaal sare oo kala duwan. Sidaa darteed, waxaa lagama maarmaan noqotay in la ururiyo fikradaha iyo talooyinka dadweynaha ee ku saabsan dhaqdhaqaaqyada loo dhan yahay iyo arrimaha ay tahay in diiradda la saaro si loo xaqiijiyo barwaaqada guud ee Diridhaba. Sidaas daraaddeed, iyadoo la filayo in qof kastaa doorkiisa ka qaato horumarka Diridhaba, waxaan si xushmad leh idiinka codsaneynaa inaad fikradihiinna iyo talooyinkiinna ku darsataan guusha socdaalka barwaaqada.\n\n2. Ujeeddada Guud Ee Xog-ururintan: Golaha Maamulka Diridhaba wuxuu qabtay kalfadhigii furitaanka waxaana lagu magacaabay mas'uuliyiin sare oo kala duwan. Sidaa darteed, xog-ururintan waxaa loo diyaariyay dhaqdhaqaaqyada guud ee golaha cusub iyo hoggaanku ku xaqiijinayaan barwaaqada Diridhaba iyo arrimaha laga filayo bulshada.",
            category: "Siyaasadda & Dhaqaalaha",
            questions: [
              { id: 1, question_text: "Dhowaan Itoobiya waxay qabatay doorasho guud oo loo dhan yahay, hufan, dimuqraadi ah oo ay bulshadu aqbashay. Natiijadii doorashada ka dibna waxay ku jirtaa diyaarinta dhismaha dawlad cusub. Sidaa darteed, maxay yihiin rajada iyo howlaha ugu waaweyn ee aad ka filaysaan dawladda laga dhisayo heer federaal, ma nala wadaagi kartaa fikraddaada?", options: [] },
              { id: 2, question_text: "Dhismaha dawladdan cusub ee la xidhiidha, maxay kula tahay inuu noqdo doorka shacabku?", options: [] },
              { id: 3, question_text: "Golaha Maamulka Diridhaba isagoo qabtay kalfadhigii furitaanka wuxuu magacaabay Afhayeenka golaha, Duqa maamulka iyo madaxda hay'adaha kala duwan. Sidaa darteed, ma noo sharxi kartaa fikraddaada ku aaddan hoggaamiyeyaasha cusub ee xilka qabtay?", options: [] },
              { id: 4, question_text: "Hoggaanka cusubi maxay kula tahay inay sameeyaan si ay heer sare ugu sii wadaan dhaqdhaqaaqyada nabadda, horumarka iyo dimuqraadiyadda ee laga bilaabay Diridhaba? Ma nala wadaagi kartaa fikraddaada iyo taladaada arrintan ku saabsan?", options: [] },
              { id: 5, question_text: "Golaha cusub iyo hoggaanku si ay mustaqbalka u xaqiijiyaan barwaaqada guud ee Diridhaba, maxaa laga filayaa cid kasta, ma nala wadaagi kartaa fikraddaada?", options: [] },
              { id: 6, question_text: "Sannadaha soo socda arrimaha ay tahay in lagu qabto dhammaan qaybaha kala duwan ee Diridhaba iyo doorka daneeyayaasha kala duwan ma haysaa fikrad ama talo dheeraad ah oo aad noo sheegto?", options: [] }
            ]
          }
        }
      },
      {
        id: 2,
        title: 'የ2018 የፓርላማና የኢኮኖሚ አፈጻጸም የሕዝብ አስተያየት (2026 Parliamentary & Economy Opinion)',
        description: 'በአገራዊ የኢኮኖሚ ማሻሻያ፣ በኑሮ ውድነት ቅናሽ ጥረቶች እና በፓርላማው ቁጥጥር ላይ የተጠቃሚዎች ሚስጥራዊ አስተያየት',
        category: 'ፖለቲካ እና ኢኮኖሚ',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 3,
        title: 'የከተማ መሠረተ ልማት እና የሕዝብ ትራንስፖርት አገልግሎት እርካታ',
        description: 'በትራንስፖርት፣ በንጹህ መጠጥ ውኃ እና የኤሌክትሪክ አገልግሎት ጥራት ላይ የሚሰጥ አጠቃላይ ዳሰሳ',
        category: 'መሠረተ ልማት',
        is_active: true,
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 4,
        title: 'የትምህርትና የጤና ዘርፍ ማሻሻያዎች የሕዝብ ዳሰሳ',
        description: 'በህዝብ ትምህርት ቤቶች እና በሆስፒታሎች አገልግሎት አሰጣጥ ላይ የህብረተሰቡን አስተያየት ለመሰብሰብ የተዘጋጀ',
        category: 'ማህበራዊ ጉዳዮች',
        is_active: true,
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        id: 5,
        title: 'የድሬዳዋ ስማርት ሲቲ እና ዲጂታል አሰራር የሕዝብ እርካታ ዳሰሳ',
        description: 'በኦንላይን የከተማ አገልግሎቶች፣ የመንግስት ኮሙኒኬሽን መረጃ ተዳራሽነት እና የዲጂታል ቴክኖሎጂ ተጠቃሚነት ላይ የተዘጋጀ',
        category: 'ቴክኖሎጂና አሰራር',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    questions: [
      // Survey 1 Questions (Official Government Formation Survey)
      { id: 1, survey_id: 1, question_text: 'በቅርቡ ኢትዮጵያ ያካሄደችዉ አሳታፊ፣ ግልጽና፣ ዴሞክራሲያዊ እና ሕዝባዊ ቅቡልነት ያለዉ ጠቅላላ ምርጫ አካሂዳለች፡፡ የምርጫዉን ውጤት ተከትሎም የአዲስ መንግሥት ምሥረታ ዝግጅት ላይ ናት፡፡ በመሆኑም በፌደራል ደረጃ ከሚመሰረተው መንግስት የሚጠብቁዋቸውን ተስፋዎችና አበይት ተግባራት በተመለከተ ያሎትን ሃሳብ ቢያካፍሉን?', question_type: 'text', options: [] },
      { id: 2, survey_id: 1, question_text: 'ከዚሁ የመንግስት ምስረታ ጋር ተያይዞ የህዝቡስ ድርሻ ምን መሆን ይገባል ብለው ያስባሉ?', question_type: 'text', options: [] },
      { id: 3, survey_id: 1, question_text: 'በድሬደዋ አስተዳደር ምክር ቤት መስራች ጉባኤውን በማካሄድ የምክር ቤቱን አፈጉባኢን ጨምሮ የአስተዳደሩን ከንቲባና የተለያዩ ተቋማትን የሚመሩ ሃላፊዎችን ሹመት አካሂደዋል ። በመሆኑም አሁን ወደ ስልጣን እንዲመጡ የተደረጉ አመራሮች አስመልክቶ ያሎት ሃሳብና አስተያየት ቢገልጹልን?', question_type: 'text', options: [] },
      { id: 4, survey_id: 1, question_text: 'አዲሱ አመራር በድሬደዋ የተጀመሩ የሰላምና፣ የልማት የዲሞክራሲ እንቅስቃሴዎችን በላቀ ደረጃ በማስቀጠል ረገድ ምን ማድረግ ይገባዋል ብለው ያስባሉ? በዚህ ረገድ ያሎትን ሃሳብና አስተያየቶን ቢያካፍሉን?', question_type: 'text', options: [] },
      { id: 5, survey_id: 1, question_text: 'አዲሱ ምክር ቤትና አመራር በቀጣይ የድሬደዋን ሁለንተናዊ ብልጽግና ለማረጋገጥ በሚሰራቸው ሁሉ አቀፍ እንቅስቃሴ ዙሪያ ከማን ምን ይጠበቃል በሚሉ ጉዳዪዮች ዙሪያ ያሎትን ሃሳብና አስተያየት ቢያካፍሉን?', question_type: 'text', options: [] },
      { id: 6, survey_id: 1, question_text: 'በቀጣዮቹ አመታት በድሬደዋ አጠቃላይ በሁሉም ዘርፎች ሊከናወኑ ይገባቸዋል በሚሏቸው ጉዳዮችና የተለያዩ ባለድርሻ አካላት ሚና እና ተሳትፎን በተመለከተ ተጨማሪ ሀሳብና አስተያየት ካሎዎት ይግለፁልን?', question_type: 'text', options: [] },

      // Survey 2 Questions
      { id: 7, survey_id: 2, question_text: 'በአሁኑ ወቅት ያለው የኢኮኖሚ ማሻሻያ እርምጃዎች አቅጣጫ ምን ያህል ተስፋ ሰጪ ነው ብለው ያስባሉ?', question_type: 'radio', options: ['በጣም ተስፋ ሰጪ ነው', 'በከፊል ተስፋ ሰጪ ነው', 'ያልወሰንኩ', 'ተስፋ አስቆራጭ ነው'] },
      { id: 8, survey_id: 2, question_text: 'የመንግስት የኑሮ ውድነትን የመቆጣጠር ስራ እና ድጎማዎችን እንዴት ይገመግሙታል?', question_type: 'rating', options: [] },
      { id: 9, survey_id: 2, question_text: 'ፓርላማው የመንግስት አካላትን በግልጽነትና በተጠያቂነት በመቆጣጠር ረገድ ያለው ሚና እንዴት ነው?', question_type: 'radio', options: ['በጣም ጥሩ', 'መካከለኛ', 'ዝቅተኛ', 'በጣም ዝቅተኛ'] },
      { id: 10, survey_id: 2, question_text: 'ለቀጣይ የፖሊሲ ማሻሻያዎች ለመንግስት የሚያስተላልፉት ዋና ጥቆማ ወይም አስተያየት ካለ በዝርዝር ይፃፉ፡', question_type: 'text', options: [] },

      // Survey 3 Questions
      { id: 11, survey_id: 3, question_text: 'በአካባቢዎ ያለው የህዝብ ትራንስፖርት (አውቶቡስ/ታክሲ) ተaccessibility እና ምቾት እንዴት ያዩታል?', question_type: 'radio', options: ['በጣም ጥሩ', 'አጥጋቢ', 'ችግር አለበት', 'በጣም አስቸጋሪ'] },
      { id: 12, survey_id: 3, question_text: 'የውኃና የኤሌክትሪክ አቅርቦት ዘላቂነትና አስተማማኝነት ደረጃ፡', question_type: 'rating', options: [] },
      { id: 13, survey_id: 3, question_text: 'በመሠረተ ልማት ዝርጋታ ወቅት የሚታዩ መዘግየቶችን ለመቅረፍ ምን መደረግ አለበት?', question_type: 'text', options: [] },

      // Survey 4 Questions
      { id: 14, survey_id: 4, question_text: 'የመንግስት ህክምና ተቋማት እና ሆስፒታሎች የመድኃኒትና የህክምና ቁሳቁስ አቅርቦት ደረጃ፡', question_type: 'rating', options: [] },
      { id: 15, survey_id: 4, question_text: 'ከትምህርት ጥራት ማሻሻያ ጋር ተያይዞ የተወሰዱ እርምጃዎችን ይደግፋሉ?', question_type: 'radio', options: ['ሙሉ በሙሉ እደግፋለሁ', 'በከፊል እደግፋለሁ', 'አልደግፍም', 'አስተያየት የለኝም'] },

      // Survey 5 Questions
      { id: 16, survey_id: 5, question_text: 'የድሬዳዋ አስተዳደር የኦንላይን እና ዲጂታል አገልግሎቶች አሰጣጥ ምቾት እንዴት ይገመግሙታል?', question_type: 'rating', options: [] },
      { id: 17, survey_id: 5, question_text: 'የመንግስት መረጃዎች እና ውሳኔዎች በቴሌግራም እና በሶሻል ሚዲያ ተዳራሽ የመሆናቸው ደረጃ፡', question_type: 'radio', options: ['በጣም ከፍተኛ', 'ከፍተኛ', 'መካከለኛ', 'ዝቅተኛ'] },
    ],
    responses: [
      // ── 10 realistic seed responses ALL on Survey 1 (Official Government Formation Survey) ──
      { id: 1,  survey_id: 1, ip_hash: 'a3f8c2d1e4b7f6a9c2d5e8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1', age_group: '26-35', gender: 'ወንድ',  education: 'ዲግሪ',        residence: 'ሳቢ',          submitted_at: '2026-09-28T09:15:00.000Z' },
      { id: 2,  survey_id: 1, ip_hash: 'b5e9d4f6a1c8b2d7e3f0a6b1c4d9e2f5a8b3c6d1e4f7a2b5c8d3e6f9a0b4c7d2', age_group: '36-45', gender: 'ሴት',   education: 'ማስተርስ',      residence: 'ካቶ ሜሳ',      submitted_at: '2026-09-28T11:30:00.000Z' },
      { id: 3,  survey_id: 1, ip_hash: 'c6f0e5a2d9b3c7e1f4a8b2d6e0f3a7b1c5d9f2a6b0c4d8e1f5a9b3c7d2e6f0a4', age_group: '18-25', gender: 'ወንድ',  education: 'ዲፕሎማ',      residence: 'ሜጋላ',        submitted_at: '2026-09-28T14:45:00.000Z' },
      { id: 4,  survey_id: 1, ip_hash: 'd7a1f6b2e0c5d9f3a4b8e2c6d0f4a9b3c7e1f5a2b6d0e4f8a1b5c9d3e7f0a2b6', age_group: '46-55', gender: 'ሴት',   education: 'ዲግሪ',        residence: 'ገንዴ ቆሬ',     submitted_at: '2026-09-29T08:00:00.000Z' },
      { id: 5,  survey_id: 1, ip_hash: 'e8b2a7c3f1d6e0a4b9c2d5f8a3b7e1c4d8f2a6b0c5d9e3f7a1b4c8d2e6f0a5b9', age_group: '26-35', gender: 'ወንድ',  education: 'ሁለተኛ ደረጃ', residence: 'ቡሌ',          submitted_at: '2026-09-29T10:20:00.000Z' },
      { id: 6,  survey_id: 1, ip_hash: 'f9c3b8d4a2e7f1b5c0d3e6a9f2b6c1d5e8a3b7d0f4a8c2e5b9d3f6a0b4c7e1f5', age_group: '18-25', gender: 'ሴት',   education: 'ዲፕሎማ',      residence: 'ለጌሃሬ',       submitted_at: '2026-09-29T13:10:00.000Z' },
      { id: 7,  survey_id: 1, ip_hash: 'a0d4c9e5b3f8a2c6d1e4f7b2a5c9d3e7f1b5a8c2d6e0f4b9a3c7d2e5f8a1b6c0', age_group: '36-45', gender: 'ወንድ',  education: 'ዲግሪ',        residence: 'ድሬ ዳዋ ማዕከል', submitted_at: '2026-09-30T07:40:00.000Z' },
      { id: 8,  survey_id: 1, ip_hash: 'b1e5d0f6c4a9b2d7e1f3a6c0d4e8f2b7a1c5d9e3f6a0b4c8d2e7f1a5b9c3d6e0', age_group: '26-35', gender: 'ሴት',   education: 'ማስተርስ',      residence: 'አዲስ ቀጠና',    submitted_at: '2026-09-30T09:55:00.000Z' },
      { id: 9,  survey_id: 1, ip_hash: 'c2f6e1a7d5b0c3e8f2a4b8d1e5f9a2b6c0d4e7f1a5b9c3d6e0f4a8b1c5d9e2f7', age_group: '18-25', gender: 'ወንድ',  education: 'ዲፕሎማ',      residence: 'መልካ ጀብዱ',    submitted_at: '2026-10-01T10:05:00.000Z' },
      { id: 10, survey_id: 1, ip_hash: 'd3a8f2b7e4c1d9f3a5b0e6c2d7f1a4b8e0c5d9f2a6b1c4e8f3a7b2c6d0e5f9a3', age_group: '46-55', gender: 'ሴት',   education: 'ዲግሪ',        residence: 'ገንዴ ቆሬ',     submitted_at: '2026-10-01T14:30:00.000Z' },
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
      // ── Participant 1 — Survey 1 — ወንድ 26-35 — ሳቢ — አማርኛ ──
      { id: 1,  response_id: 1, question_id: 1, answer_text: 'አዲሱ መንግስት ኢኮኖሚ ማሻሻያ፣ ሰላምና ፀጥታ ማጠናከሪያ እና ዴሞክራሲያዊ ሂደቱን ቀጣይነት ባለው መልኩ ማስቀጠል ላይ ትኩረት ሊሰጥ ይገባል። ሁሉም ዜጎች እኩል ዕድል የሚያገኙበት ፖሊሲ ቢዘረጋ ትልቅ ለውጥ ያስከትላል።', rating_value: null },
      { id: 2,  response_id: 1, question_id: 2, answer_text: 'ህዝቡ ምርጫን ከድምጽ ሰጪነት አልፎ በፖሊሲ አዘገጃጀትና ትግበራ ላይ ቀጥተኛ ተሳትፎ ሊኖረው ይገባል። በቀበሌ ደረጃ ታዳሚ ስብሰባዎች ቢበዙ ህዝቡ ፍቃደኛ ይሆናል።', rating_value: null },
      { id: 3,  response_id: 1, question_id: 3, answer_text: 'አዲሶቹ አመራሮች ልምድና ብቃት ያላቸው ናቸው ብዬ አምናለሁ። ሆኖም ውጤቱ ከጊዜ ሂደት ጋር ሊታይ ይገባዋል። ለወጣቱ ትውልድ ዕድሎችን ቢፈጥሩ ወሳኝ ነው።', rating_value: null },
      { id: 4,  response_id: 1, question_id: 4, answer_text: 'ወጣቶችን ማሳተፍ፣ ሙስናን ወደ ዜሮ ዝቅ ማድረግ እና ኢንቨስትመንትን ለመሳብ ምቹ ሁኔታ መፍጠር ቅድሚያ ሊሰጣቸው ይገባሉ።', rating_value: null },
      { id: 5,  response_id: 1, question_id: 5, answer_text: 'ዜጎች ግብር ሰጥተው ህጉን ማክበር አለባቸው። ምክር ቤቱ ለህዝብ ጥቅም ሊሰራ ይገባዋል። ነፃ ሚዲያ ለዴሞክራሲ ጤናማነት ወሳኝ ነው።', rating_value: null },
      { id: 6,  response_id: 1, question_id: 6, answer_text: 'ትምህርት ቤቶቹ ይሻሻሉ፣ ጤና ጣቢያዎቹ ዘመናዊ ቁሳቁስ ይኑራቸው፣ የከተማ መንገዶቹም ሊጠናቀቁ ይገባሉ።', rating_value: null },

      // ── Participant 2 — Survey 1 — ሴት 36-45 — ካቶ ሜሳ — Afaan Oromoo ──
      { id: 7,  response_id: 2, question_id: 1, answer_text: 'Mootummaan haaraan gamtaa lammiilee cimsuu, dinagdee fooyyessuu fi nageenyaa mirkaneessuu irratti xiyyeeffachuu qaba. Hojii misooma qonnaa fi industirii babal\'isuun barbaachisaadha.', rating_value: null },
      { id: 8,  response_id: 2, question_id: 2, answer_text: 'Hirmaannaan uummataa filannoo qofa otoo hintaane murtii aangoo irrattis ta\'uu qaba. Yaa\'ii uummataa baay\'isuun murteessaadha, namoonni fedhii qaban dubbachuu dandaa\'u.', rating_value: null },
      { id: 9,  response_id: 2, question_id: 3, answer_text: 'Hooggantoonni haaraan muuxannoo fi dandeettii qabu jedheen amana. Garuu bu\'aan hojii isaanii yeroo dhufutti ni mul\'ata. Dargaggoota dabalachuun barbaachisaadha.', rating_value: null },
      { id: 10, response_id: 2, question_id: 4, answer_text: 'Dargaggoota hojii kennuu, malaammaltummaa dhabamsiisuufi maallaqni biyya alaatii akka dhufu gochuu dursa kennuuf barbaachiisa. Barnootaa fi fayyaa irrattis hojjechuun murteessaadha.', rating_value: null },
      { id: 11, response_id: 2, question_id: 5, answer_text: 'Lammiileen gibira kaffaluufi seeraan jiraachuun dirqama. Manni maree ni deeggarama. Miidiyaan bilisaa ta\'uu qaba, uummatnis odeeffannoo argachuu dandaa\'u.', rating_value: null },
      { id: 12, response_id: 2, question_id: 6, answer_text: 'Mana barumsaa fooyyessuu, hospitaala meeshaa ammayyaa godhuu fi daandii yeroo roobaa cufamu hin qabnetti ijaaruu barbaachisa. Industirii xiqqaas deeggaruun barbaachisaadha.', rating_value: null },

      // ── Participant 3 — Survey 1 — ወንድ 18-25 — ሜጋላ — Af-Soomaali ──
      { id: 13, response_id: 3, question_id: 1, answer_text: 'Dawladda cusuba waa inay diiradda saartaa horumarinta dhaqaalaha, xoojinta nabadda ammaanka iyo sii wadista nidaamka dimuqraadiyadda. Waxaan jeclaan lahaa in la abuuro fursad siman dhammaan shacabka.', rating_value: null },
      { id: 14, response_id: 3, question_id: 2, answer_text: 'Ka qaybgalka shacabku waa inuu ka badan yahay codeynta kaliya. Waa inay ka qaybgalaan siyaasadaha iyo hirgelinta. Shirarka dadweynaha waa in la badiyaa si fikradaha la wadaago.', rating_value: null },
      { id: 15, response_id: 3, question_id: 3, answer_text: 'Hoggaamiyeyaasha cusub waxaan aaminanahay in ay leeyihiin khibrad iyo xirfad. Laakiin natiijahooda waxaa la arki doonaa marka wakhtigu dhaafay. Dhalinyarada fursad siinta muhiim.', rating_value: null },
      { id: 16, response_id: 3, question_id: 4, answer_text: 'Shababka shaqooyinka siinta, musuqmaasuqa xidid ka goynta iyo maalgashiga dibadda jiidashada waa ay muhiim u tahay. Waxaana sidoo kale la xoojin lahaa waxbarashada iyo caafimaadka.', rating_value: null },
      { id: 17, response_id: 3, question_id: 5, answer_text: 'Shacabku waa inay canshuuraha bixiyaan oo shareecada raacaan. Golaha waa la taageero. Warbaahinta xor ha noqoto si macluumaadka loo gaarsiiyo dadweynaha.', rating_value: null },
      { id: 18, response_id: 3, question_id: 6, answer_text: 'Waxaan u baahanahay dugsiyada la horumarinta, isbitaalada alaabada casriga ah leh iyo wadooyinka roobka la go\'aa dib loo dhiso. Xarumaha ganacsiga yar-yar sidoo kale la taageero.', rating_value: null },

      // ── Participant 4 — Survey 1 — ሴት 46-55 — ገንዴ ቆሬ — አማርኛ ──
      { id: 19, response_id: 4, question_id: 1, answer_text: 'የኑሮ ውድነትን መቀነስ፣ የዋጋ ግሽበትን መቆጣጠር እና የፍትህ ስርዓቱን ማጠናከር የፌደራል መንግስት የመጀመሪያ ተግባር ሊሆን ይገባል። ለእናቶችና ህፃናት ድጋፍ ትኩረት እንዲሰጥ እጠይቃለሁ።', rating_value: null },
      { id: 20, response_id: 4, question_id: 2, answer_text: 'ህዝቡ የመልካም አስተዳደር እጦት ሲያጋጥም በጥቆማና በትብብር ከመንግስት ጎን መቆም አለበት። ሰላምን መጠበቅ የሁሉም ዜጋ ኃላፊነት ነው።', rating_value: null },
      { id: 21, response_id: 4, question_id: 3, answer_text: 'አዲሶቹ ተሿሚዎች ለህዝብ ቅርብ ሆነው ቅሬታዎችን በፍጥነት የሚፈቱ እንዲሆኑ ተስፋ አደርጋለሁ። ተጠያቂነት በተግባር ሊታይ ይገባል።', rating_value: null },
      { id: 22, response_id: 4, question_id: 4, answer_text: 'የከተማዋን ጽዳትና ውበት ማስጠበቅ፣ ፍትሃዊ የቤትና የመሬት አቅርቦት ማረጋገጥ እና የስራ አጥነትን መቀነስ ላይ አበክረው ሊሰሩ ይገባል።', rating_value: null },
      { id: 23, response_id: 4, question_id: 5, answer_text: 'ከነጋዴዎች ህጋዊ አሰራር፣ ከመንግስት ሰራተኛው ታማኝ አገልግሎት፣ ከአመራሩ ደግሞ ግልጽነትና ፍትሃዊነት ይጠበቃል።', rating_value: null },
      { id: 24, response_id: 4, question_id: 6, answer_text: 'የሴቶችን ኢኮኖሚያዊ ተጠቃሚነት የሚያሳድጉ የብድርና የስልጠና ዕድሎች በየቀበሌው ቢመቻቹ ለከተማችን ትልቅ ዕድገት ያመጣል።', rating_value: null },

      // ── Participant 5 — Survey 1 — ወንድ 26-35 — ቡሌ — Afaan Oromoo ──
      { id: 25, response_id: 5, question_id: 1, answer_text: 'Mootummaan federaalaa hojii dhabdummaa dargaggootaa furuu fi nageenya naannolee gidduu jiru cimsuu irratti xiyyeeffannoo guddaa akka kennu eegna.', rating_value: null },
      { id: 26, response_id: 5, question_id: 2, answer_text: 'Uummanni seerota eeguu, nageenya kabajuu fi gumaata misoomaaf taasisan cimsanii itti fufuu qabu.', rating_value: null },
      { id: 27, response_id: 5, question_id: 3, answer_text: 'Hooggantoonni muudaman dandeettii fi beekumsa qabaatanis, uummata wajjin mari\'achuun hojjechuun isaaniif filatamaadha.', rating_value: null },
      { id: 28, response_id: 5, question_id: 4, answer_text: 'Mootummaan naannoo misooma industirii fi daldala daangaa cimsanii akka babal\'atan gochuu qabu.', rating_value: null },
      { id: 29, response_id: 5, question_id: 5, answer_text: 'Abbootin qabeenyaa investimantii haaraa uumuun, uummatnis harka qalleeyyii gargaaruun gahee isaanii ba\'uu qabu.', rating_value: null },
      { id: 30, response_id: 5, question_id: 6, answer_text: 'Dhaabbilee barnootaa fi teeknooloojii naannicha keessatti babal\'isuun daran barbaachisaadha.', rating_value: null },

      // ── Participant 6 — Survey 1 — ሴት 18-25 — ለጌሃሬ — Afaan Oromoo ──
      { id: 31, response_id: 6, question_id: 1, answer_text: 'Barnoota olaanoo qulqullina qabu mirkaneessuu fi dargaggoota gara hojiitti galchuun karoora mootummaa ta\'uu qaba.', rating_value: null },
      { id: 32, response_id: 6, question_id: 2, answer_text: 'Dargaggoonni hojii misoomaa keessatti hirmaannaa qooda fudhannaa isaanii guddisuu qabu.', rating_value: null },
      { id: 33, response_id: 6, question_id: 3, answer_text: 'Hoggantoota haaraaf yeroo gahaa kenninee bu\'aa hojii isaanii hordofuu qabna.', rating_value: null },
      { id: 34, response_id: 6, question_id: 4, answer_text: 'Ispoortii fi aadaa dargaggootaa jajjabeessuun nageenya itti fufiinsa qabu mirkaneessuuf gargaara.', rating_value: null },
      { id: 35, response_id: 6, question_id: 5, answer_text: 'Hawaasni maraa tokkummaa fi wal-kabajaa qabaachuun hundee guddinaati.', rating_value: null },
      { id: 36, response_id: 6, question_id: 6, answer_text: 'Iddoowwan bashannana dargaggootaa fi wiirtuulee dandeettii ijaaruun barbaachisaadha.', rating_value: null },

      // ── Participant 7 — Survey 1 — ወንድ 36-45 — ድሬ ዳዋ ማዕከል — አማርኛ ──
      { id: 37, response_id: 7, question_id: 1, answer_text: 'የንግድና የኢንቨስትመንት ማነቆዎችን መፍታት፣ የባንክና የውጭ ምንዛሪ አሰራርን ማሳለጥ እና ሰላምን በዘላቂነት ማረጋገጥ ይጠበቃል።', rating_value: null },
      { id: 38, response_id: 7, question_id: 2, answer_text: 'የንግዱ ማህበረሰብ ፍትሃዊ ዋጋ በመተመን፣ ህብረተሰቡ ደግሞ የመንግስት አገልግሎቶችን በንቃት በመከታተል የበኩላቸውን መወጣት አለባቸው።', rating_value: null },
      { id: 39, response_id: 7, question_id: 3, answer_text: 'አዲሱ ከንቲባና የቢሮ ሃላፊዎች የቀድሞ ጥንካሬዎችን አስቀጥለው ክፍተቶችን በፍጥነት ማረም አለባቸው። ቢሮክራሲን መቀነስ ቅድሚያ ሊሰጠው ይገባል።', rating_value: null },
      { id: 40, response_id: 7, question_id: 4, answer_text: 'የድሬዳዋን የነፃ ንግድ ቀጠና በሙሉ አቅም ስራ ማስጀመር እና የወጪ ንግድን ማበረታታት ላይ በትኩረት ሊሰራ ይገባል።', rating_value: null },
      { id: 41, response_id: 7, question_id: 5, answer_text: 'ከከተማው አመራር ቆራጥ ውሳኔ ሰጪነት፣ ከባለሀብቱ ተጨማሪ የስራ ዕድል መፍጠር፣ ከህዝቡ ደግሞ ደጋፊነት ይጠበቃል።', rating_value: null },
      { id: 42, response_id: 7, question_id: 6, answer_text: 'የባቡርና የትራንስፖርት አገልግሎትን ማዘመን ለድሬዳዋ የኢኮኖሚ ህይወት ወሳኝ በመሆኑ ልዩ ትኩረት ይሰጠው።', rating_value: null },

      // ── Participant 8 — Survey 1 — ሴት 26-35 — አዲስ ቀጠና — Af-Soomaali ──
      { id: 43, response_id: 8, question_id: 1, answer_text: 'Xoojinta adeegyada caafimaadka hooyada iyo dhallaanka, xasiloonida qiimaha badeecadaha iyo ilaalinta xuquuqda muwaadiniinta.', rating_value: null },
      { id: 44, response_id: 8, question_id: 2, answer_text: 'Dadweynuhu waa inay la shaqeeyaan laamaha amniga oo ay ka qaybqaataan fagaarayaasha wadatashiga.', rating_value: null },
      { id: 45, response_id: 8, question_id: 3, answer_text: 'Mas\'uuliyiinta cusub waa inay xafiisyadooda u furaan dadweynaha oo aysan ku koobnaan shaashadaha.', rating_value: null },
      { id: 46, response_id: 8, question_id: 4, answer_text: 'Bixinta biyaha nadiifka ah iyo hagaajinta nadaafadda magaalada waa arrin degdeg ah oo ay tahay in wax laga qabto.', rating_value: null },
      { id: 47, response_id: 8, question_id: 5, answer_text: 'Haweenka, dhalinyarada iyo odayaasha dhaqanka oo dhan waa inay ka shaqeeyaan wadajirka magaalada.', rating_value: null },
      { id: 48, response_id: 8, question_id: 6, answer_text: 'In la kordhiyo xarumaha caafimaadka degmooyinka si loo yareeyo culeyska isbitaalada waaweyn.', rating_value: null },

      // ── Participant 9 — Survey 1 — ወንድ 18-25 — መልካ ጀብዱ — Afaan Oromoo ──
      { id: 49, response_id: 9, question_id: 1, answer_text: 'Mootummaan federaalaa wal-qixxummaa lammiilee mirkaneessuu fi carraa hojii teeknooloojii babal\'isuu qaba.', rating_value: null },
      { id: 50, response_id: 9, question_id: 2, answer_text: 'Hawaasni dhimma misoomaa keessatti humnaa fi beekumsaan gumaachuun murteessaadha.', rating_value: null },
      { id: 51, response_id: 9, question_id: 3, answer_text: 'Hooggantoonni qajeelummaa fi iftoominnaan yoo hojjetan uummanni deeggersa guutuu kennaaf.', rating_value: null },
      { id: 52, response_id: 9, question_id: 4, answer_text: 'Tajaajila mootummaa toora dijitaalaan laachuu fi kaffaltii elektirooniksii babal\'isuun barbaachisaadha.', rating_value: null },
      { id: 53, response_id: 9, question_id: 5, answer_text: 'Qooda fudhattoonni hundi misooma Dirree Dawaa akka waan dhuunfaa isaaniitti ilaaluu qabu.', rating_value: null },
      { id: 54, response_id: 9, question_id: 6, answer_text: 'Wiirtuu daldala bilisaa Melka Jebdu cimsanii itti fayyadamuun dhaloota haaraaf abdii guddaadha.', rating_value: null },

      // ── Participant 10 — Survey 1 — ሴት 46-55 — ገንዴ ቆሬ — አማርኛ ──
      { id: 55, response_id: 10, question_id: 1, answer_text: 'የአረጋውያንና የጡረተኞች ኑሮ እንዲሻሻል ድጎማ ማድረግ እና የጤና መድህን አገልግሎት በስፋት እንዲዳረስ ማድረግ።', rating_value: null },
      { id: 56, response_id: 10, question_id: 2, answer_text: 'ህዝቡ ልጆቹን በስነ-ምግባር በማነጽ እና ለአካባቢው ሰላምና ንጽህና ዘብ በመቆም ሃላፊነቱን መወጣት አለበት።', rating_value: null },
      { id: 57, response_id: 10, question_id: 3, answer_text: 'የተመረጡት አመራሮች ቃላቸውን በተግባር እንዲተረጉሙና ህዝቡን በአክብሮትና በትህትና እንዲያገለግሉ እመክራለሁ።', rating_value: null },
      { id: 58, response_id: 10, question_id: 4, answer_text: 'የውኃ አቅርቦት ችግርን በዘላቂነት መፍታት፣ የጎዳና መብራቶችን ማሟላትና ደህንነትን መጠበቅ ቅድሚያ ይሰጠው።', rating_value: null },
      { id: 59, response_id: 10, question_id: 5, answer_text: 'የሃይማኖት አባቶች፣ የሀገር ሽማግሌዎችና ወጣቶች እጅ ለእጅ ተያይዘው ሰላምና ፍቅርን ማጠናከር አለባቸው።', rating_value: null },
      { id: 60, response_id: 10, question_id: 6, answer_text: 'ድሬዳዋ የቀድሞ የፍቅር፣ የአንድነትና የስልጣኔ ማዕከልነቷን እንድታድስ ሁላችንም በጋራ እንቁም።', rating_value: null },
    ],

      // ── Response 10 — Survey 5 — ሴት 46-55 — ገንዴ ቆሬ — አማርኛ ──
      { id: 37, response_id: 10, question_id: 16, answer_text: null,                 rating_value: 3 },
      { id: 38, response_id: 10, question_id: 17, answer_text: 'መካከለኛ',              rating_value: null },
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
  if (isProduction) {
    throw new Error('CRITICAL CONFIGURATION ERROR: Attempted to read local db.json in production mode! Production systems MUST connect to PostgreSQL. Fallback to local files is prohibited.');
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    writeLocalDB(initial);
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    if (!content || !content.trim()) {
      throw new Error('Local DB file is empty');
    }
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local db file, attempting backup recovery (NO DATA LOSS):', err);
    const backupFile = `${DB_FILE}.bak`;
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, 'utf8');
        return JSON.parse(backupContent);
      } catch (bErr) {
        console.error('Backup read failed:', bErr);
      }
    }
    // Safeguard: Never wipe out corrupt files! Keep timestamped copy for manual recovery
    try {
      fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt.${Date.now()}`);
    } catch {}
    const initial = getInitialData();
    return initial;
  }
}

function writeLocalDB(dbData: LocalDB): void {
  if (isProduction) {
    throw new Error('CRITICAL CONFIGURATION ERROR: Attempted to write to local db.json in production mode! Production systems MUST connect to PostgreSQL. Fallback to local files is prohibited.');
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = `${DB_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
  const jsonStr = JSON.stringify(dbData, null, 2);
  
  // Atomic write to prevent file corruption during concurrent operations
  fs.writeFileSync(tempFile, jsonStr, 'utf8');
  if (fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(DB_FILE, `${DB_FILE}.bak`);
    } catch {}
  }
  try {
    fs.renameSync(tempFile, DB_FILE);
  } catch (renameErr) {
    // Fallback for Windows cross-device lock
    fs.copyFileSync(tempFile, DB_FILE);
    try { fs.unlinkSync(tempFile); } catch {}
  }
}

// Data Access API
export const db = {
  // Connection and Health Verification
  async checkConnection(): Promise<{ connected: boolean; engine: 'postgresql' | 'local_json'; error?: string }> {
    const isProduction = process.env.NODE_ENV === 'production';
    if (DATABASE_URL || isProduction) {
      if (!pgPool) {
        return {
          connected: false,
          engine: 'postgresql',
          error: 'PostgreSQL connection pool not initialized (DATABASE_URL missing in environment)',
        };
      }
      try {
        const client = await pgPool.connect();
        try {
          await client.query('SELECT 1');
          return { connected: true, engine: 'postgresql' };
        } finally {
          client.release();
        }
      } catch (err: any) {
        return { connected: false, engine: 'postgresql', error: err.message || 'Connection test query failed' };
      }
    }
    return { connected: true, engine: 'local_json' };
  },

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
      survey.translations = typeof survey.translations === 'string' ? JSON.parse(survey.translations) : (survey.translations || {});

      return survey;
    }

    const local = readLocalDB();
    const survey = local.surveys.find((s) => s.id === id) as any;
    if (!survey) return null;

    const questions = local.questions.filter((q) => q.survey_id === id);
    const total_responses = local.responses.filter((r) => r.survey_id === id).length;

    return {
      ...survey,
      translations: survey.translations || {},
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
    demographics?: { age_group?: string; gender?: string; education?: string; residence?: string },
    language: string = 'am'
  ) {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const respRes = await client.query(
          'INSERT INTO responses (survey_id, ip_hash, age_group, gender, education, residence, language) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [
            surveyId,
            ipHash,
            demographics?.age_group || null,
            demographics?.gender || null,
            demographics?.education || null,
            demographics?.residence || null,
            language || 'am',
          ]
        );
        const responseId = respRes.rows[0].id;

        // Fast batch INSERT for all answers in a single query (dramatically reduces connection hold time)
        if (answers.length > 0) {
          const valueClauses: string[] = [];
          const params: any[] = [];
          let paramIdx = 1;

          for (const ans of answers) {
            valueClauses.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
            params.push(responseId, ans.question_id, ans.answer_text || null, ans.rating_value || null);
          }

          await client.query(
            `INSERT INTO answers (response_id, question_id, answer_text, rating_value) VALUES ${valueClauses.join(', ')}`,
            params
          );
        }

        await client.query('COMMIT');
        return responseId;
      } catch (e: any) {
        await client.query('ROLLBACK');
        if (e?.code === '23505') {
          const duplicateErr: any = new Error('ለዚህ መጠይቅ አስቀድመው መልስ ሰጥተዋል! (Duplicate response rejected)');
          duplicateErr.code = 'DUPLICATE_RESPONSE';
          throw duplicateErr;
        }
        throw e;
      } finally {
        client.release();
      }
    }

    if (isProduction) {
      throw new Error('PostgreSQL database is required in production. Cannot save response to local storage.');
    }

    const local = readLocalDB();
    if (local.responses.some((r) => r.survey_id === surveyId && r.ip_hash === ipHash)) {
      const duplicateErr: any = new Error('ለዚህ መጠይቅ አስቀድመው መልስ ሰጥተዋል! (Duplicate response rejected)');
      duplicateErr.code = 'DUPLICATE_RESPONSE';
      throw duplicateErr;
    }
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
      language: language || 'am',
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

  async getSurveyDetailedResponses(surveyId: number): Promise<Array<{
    id: number;
    survey_id: number;
    age_group: string;
    gender: string;
    education: string;
    residence: string;
    language: string;
    submitted_at: string;
    answers: Array<{
      question_id: number;
      question_text: string;
      question_type: string;
      answer_text?: string;
      rating_value?: number;
    }>;
  }>> {
    if (pgPool) {
      try {
        const respRes = await pgPool.query(
          'SELECT * FROM responses WHERE survey_id = $1 ORDER BY id ASC',
          [surveyId]
        );
        const responses = respRes.rows;
        if (responses.length === 0) return [];

        const respIds = responses.map((r: any) => r.id);
        const ansRes = await pgPool.query(
          `SELECT a.id, a.response_id, a.question_id, a.answer_text, a.rating_value,
                  q.question_text, q.question_type
           FROM answers a
           JOIN questions q ON a.question_id = q.id
           WHERE a.response_id = ANY($1::int[])
           ORDER BY a.response_id ASC, q.id ASC`,
          [respIds]
        );

        const answersByRespId: Record<number, any[]> = {};
        for (const a of ansRes.rows) {
          if (!answersByRespId[a.response_id]) answersByRespId[a.response_id] = [];
          answersByRespId[a.response_id].push({
            question_id: a.question_id,
            question_text: a.question_text,
            question_type: a.question_type,
            answer_text: a.answer_text,
            rating_value: a.rating_value,
          });
        }

        return responses.map((r: any) => ({
          ...r,
          answers: answersByRespId[r.id] || [],
        }));
      } catch (err) {
        console.error('Failed to getSurveyDetailedResponses from pgPool:', err);
      }
    }

    const local = readLocalDB();
    const responses = (local.responses || []).filter((r: any) => r.survey_id === surveyId);
    const questions = (local.questions || []).filter((q: any) => q.survey_id === surveyId);
    const qMap = new Map(questions.map((q: any) => [q.id, q]));

    return responses.map((r: any) => {
      const answers = (local.answers || [])
        .filter((a: any) => a.response_id === r.id)
        .map((a: any) => {
          const q = qMap.get(a.question_id);
          return {
            question_id: a.question_id,
            question_text: q?.question_text || `ጥያቄ ${a.question_id}`,
            question_type: q?.question_type || 'text',
            answer_text: a.answer_text,
            rating_value: a.rating_value,
          };
        });
      return {
        ...r,
        answers,
      };
    });
  },

  async getTodaySurveyStats(surveyId: number, residence?: string): Promise<{
    todaySurveyTotal: number;
    todayWoredaTotal: number;
    allTimeSurveyTotal: number;
  }> {
    if (pgPool) {
      try {
        const res = await pgPool.query(
          `SELECT 
             COUNT(*) FILTER (WHERE submitted_at >= CURRENT_DATE)::int as today_survey_total,
             COUNT(*) FILTER (WHERE submitted_at >= CURRENT_DATE AND LOWER(TRIM(COALESCE(residence, ''))) = LOWER(TRIM(COALESCE($2, ''))))::int as today_woreda_total,
             COUNT(*)::int as all_time_survey_total
           FROM responses
           WHERE survey_id = $1`,
          [surveyId, residence || '']
        );
        const row = res.rows[0] || {};
        return {
          todaySurveyTotal: Math.max(1, Number(row.today_survey_total) || 1),
          todayWoredaTotal: Math.max(1, Number(row.today_woreda_total) || 1),
          allTimeSurveyTotal: Math.max(1, Number(row.all_time_survey_total) || 1),
        };
      } catch (err) {
        console.error('Failed to getTodaySurveyStats from pgPool:', err);
      }
    }

    const local = readLocalDB();
    const respList = (local.responses || []).filter((r: any) => r.survey_id === surveyId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayList = respList.filter((r: any) => new Date(r.submitted_at).getTime() >= startOfDay);
    const normalizedRes = (residence || '').trim().toLowerCase();
    const woredaToday = todayList.filter((r: any) => (r.residence || '').trim().toLowerCase() === normalizedRes);

    return {
      todaySurveyTotal: Math.max(1, todayList.length),
      todayWoredaTotal: Math.max(1, woredaToday.length),
      allTimeSurveyTotal: Math.max(1, respList.length),
    };
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
          const existingQIds = new Set<number>(existingQRes.rows.map((r: any) => r.id as number));
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

  async saveSurveyTranslations(surveyId: number, translations: Record<string, any>) {
    if (pgPool) {
      try {
        await pgPool.query('UPDATE surveys SET translations = $1 WHERE id = $2', [JSON.stringify(translations), surveyId]);
        return true;
      } catch (err) {
        console.error('Error saving survey translations in pgPool:', err);
      }
    }
    const local = readLocalDB();
    const survey = local.surveys.find((s) => s.id === surveyId) as any;
    if (survey) {
      survey.translations = translations;
      writeLocalDB(local);
      return true;
    }
    return false;
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
    const effectiveDefault = key === 'global_2fa_enabled' ? 'true' : defaultValue;
    if (pgPool) {
      try {
        const res = await pgPool.query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [key]);
        if (res.rows.length > 0) {
          return res.rows[0].setting_value;
        }
        return effectiveDefault;
      } catch (err) {
        console.error(`Failed to get setting ${key} from PostgreSQL:`, err);
        return effectiveDefault;
      }
    }

    const local = readLocalDB();
    if (local.settings && local.settings[key] !== undefined) {
      return local.settings[key];
    }
    return effectiveDefault;
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
        return;
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
      return;
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
        return false;
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


