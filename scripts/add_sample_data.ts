import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing in environment variables!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-65', '65+'];
const GENDERS = ['ወንድ', 'ሴት'];
const EDUCATIONS = [
  'የመጀመሪያ ደረጃ (1-8)',
  'ሁለተኛ ደረጃ (9-12)',
  'ዲፕሎማ / ሰርተፊኬት',
  'የመጀመሪያ ዲግሪ',
  'ሁለተኛ ዲግሪና ከዚያ በላይ',
];
const RESIDENCES = [
  'ዚራ',
  'መጋላ',
  'ሳቢያን',
  'ደቼቱ',
  'አዲስ ከተማ',
  'አሰብታ',
  'ቦሌ (ድሬዳዋ)',
  'መላካ',
  'ቀበሌ 01',
  'ቀበሌ 02',
  'ቀበሌ 03',
  'ቀበሌ 04',
  'ቀበሌ 05',
  'ቀበሌ 06',
  'ድሬዳዋ ዙሪያ ገጠር',
];

const TEXT_COMMENTS_SURVEY_1 = [
  'የግብርና ምርቶች አቅርቦት እና የእህል ወፍጮ ዋጋ ቁጥጥር ቢጠናከር መልካም ነው::',
  'የአነስተኛ ነጋዴዎች የግብር ስሌት እንደገና ታይቶ ፍትሃዊ እንዲሆን እንጠይቃለን::',
  'የወጣቶች ስራ እድል ፈጠራ በድሬዳዋ የኢንዱስትሪ ፓርክ በኩል ቢፋጠን::',
  'የልማት ስራዎች ሲከናወኑ የነዋሪውን ድምፅ በቅድሚያ ማዳመጥ አስፈላጊ ነው::',
  'በአጠቃላይ የኢኮኖሚ ማሻሻያው ተስፋ ሰጪ ቢሆንም የኤክስፖርት ገቢ ቢጨምር መልካም ነው::',
  'የመንግስት ድጎማ ለምስኪን አባወራዎች በበቂ ሁኔታ መድረሱን መቆጣጠር ያስፈልጋል::',
  'የምግብ እቃዎች እጥረት እንዳይከሰት ከጎረቤት ክልሎች ጋር ያለው ንግድ ሊስፋፋ ይገባል::',
];

const TEXT_COMMENTS_SURVEY_2 = [
  'የአስፋልትና የኮብልስቶን መንገድ ጥገና በየወቅቱ ቢደረግ ሰፈራችን ይረጋጋል::',
  'የውኃ መቆራረጥን ለመቅረፍ ተጨማሪ የውኃ ጉድጓዶች በድሬዳዋ ዙሪያ ቢቆፈሩ::',
  'የኤሌክትሪክ አውቶቡሶች ቁጥር ቢጨምር የትራንስፖርት እጥረቱ በከፍተኛ ሁኔታ ይቀንሳል::',
  'የጎርፍ መከላከያ ቦዮች በደቼቱ ወንዝ አካባቢ በጊዜ ቢፀዱና ቢገነቡ መልካም ነው::',
  'የህዝብ መብራት (Street Lights) በምሽት በየሰፈሩ ቢበራ ለፀጥታ ይረዳል::',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('🔗 Connected to Neon PostgreSQL Database successfully!');

    // Fetch existing surveys & questions
    const surveyRes = await client.query('SELECT id, title FROM surveys ORDER BY id');
    console.log(`📋 Found ${surveyRes.rows.length} existing surveys.`);

    if (surveyRes.rows.length === 0) {
      console.log('⚠️ No surveys found in database. Make sure server/db.ts runs first!');
      return;
    }

    const questionRes = await client.query('SELECT id, survey_id, question_type, options FROM questions');
    const questionsBySurvey = new Map<number, any[]>();
    for (const q of questionRes.rows) {
      if (!questionsBySurvey.has(q.survey_id)) {
        questionsBySurvey.set(q.survey_id, []);
      }
      questionsBySurvey.get(q.survey_id)!.push(q);
    }

    let totalNewResponses = 0;
    let totalNewAnswers = 0;

    // For each survey, generate 25-35 rich new responses
    for (const survey of surveyRes.rows) {
      const surveyId = survey.id;
      const questions = questionsBySurvey.get(surveyId) || [];
      const numResponsesToGenerate = getRandomInt(25, 35);

      console.log(`🚀 Seeding ${numResponsesToGenerate} realistic responses for Survey ID ${surveyId}: "${survey.title.substring(0, 40)}..."`);

      for (let i = 0; i < numResponsesToGenerate; i++) {
        const age = getRandomItem(AGE_GROUPS);
        const gender = getRandomItem(GENDERS);
        const edu = getRandomItem(EDUCATIONS);
        const residence = getRandomItem(RESIDENCES);
        const randomDaysAgo = getRandomInt(0, 14);
        const randomHoursAgo = getRandomInt(0, 23);
        const randomMinutesAgo = getRandomInt(0, 59);
        const submittedAt = new Date(Date.now() - (randomDaysAgo * 86400000 + randomHoursAgo * 3600000 + randomMinutesAgo * 60000));
        const ipHash = `hash_neon_${surveyId}_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`;

        const respInsert = await client.query(
          `INSERT INTO responses (survey_id, ip_hash, age_group, gender, education, residence, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [surveyId, ipHash, age, gender, edu, residence, submittedAt]
        );

        const responseId = respInsert.rows[0].id;
        totalNewResponses++;

        // Insert answers for each question in this survey
        for (const q of questions) {
          let answerText: string | null = null;
          let ratingVal: number | null = null;

          if (q.question_type === 'radio') {
            const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (Array.isArray(opts) && opts.length > 0) {
              answerText = getRandomItem(opts);
            }
          } else if (q.question_type === 'rating') {
            // Weighted towards ratings 3, 4, 5 for realistic satisfaction
            const ratings = [3, 4, 4, 5, 5, 5, 2, 4, 5, 3];
            ratingVal = getRandomItem(ratings);
          } else if (q.question_type === 'text') {
            if (surveyId === 1) {
              answerText = getRandomItem(TEXT_COMMENTS_SURVEY_1);
            } else if (surveyId === 2) {
              answerText = getRandomItem(TEXT_COMMENTS_SURVEY_2);
            } else {
              answerText = 'አገልግሎቱ አጥጋቢ ነው፤ ይበልጥ ቢፋጠንና ቴክኖሎጂ ቢታከልበት ይበረታታል::';
            }
          }

          await client.query(
            `INSERT INTO answers (response_id, question_id, answer_text, rating_value)
             VALUES ($1, $2, $3, $4)`,
            [responseId, q.id, answerText, ratingVal]
          );
          totalNewAnswers++;
        }
      }
    }

    console.log(`\n🎉 SUCCESS! Inserted ${totalNewResponses} new citizen survey responses and ${totalNewAnswers} answer entries directly into Neon PostgreSQL!`);

    // Fetch and show current counts
    const countResp = await client.query('SELECT COUNT(*)::int as total FROM responses');
    const countAns = await client.query('SELECT COUNT(*)::int as total FROM answers');
    console.log(`📊 TOTAL RECORDS IN NEON POSTGRESQL:`);
    console.log(`   - Responses Table: ${countResp.rows[0].total} records`);
    console.log(`   - Answers Table: ${countAns.rows[0].total} records`);

  } catch (err) {
    console.error('❌ Error seeding responses to Neon:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
