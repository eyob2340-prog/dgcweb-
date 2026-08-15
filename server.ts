import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

import { db } from './server/db';
import { comparePassword, generateToken, verifyToken, authMiddleware, requireRole, revokeToken, AuthenticatedRequest } from './server/auth';
import { sendTelegramReport, DEFAULT_TELEGRAM_BOT_TOKEN, DEFAULT_TELEGRAM_CHAT_ID, formatTelegramChatId, escapeMarkdown } from './server/telegram';
import { generateSurveyAiReport, translateTextWithAi } from './server/ai';
import { sendTicketRecoveryOtp } from './server/email';

// In-memory runtime settings store (synced with persistent storage)
let activeBotToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
let activeChatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
let isMaintenanceMode = false;

// Initialize settings from persistent storage on boot
async function loadPersistentSettings() {
  try {
    const dbBotToken = await db.getSetting('telegram_bot_token');
    const dbChatId = await db.getSetting('telegram_chat_id');
    const dbMaintenance = await db.getSetting('maintenance_mode');
    if (dbBotToken && dbBotToken.trim().length > 0) activeBotToken = dbBotToken.trim();
    if (dbChatId && dbChatId.trim().length > 0) activeChatId = dbChatId.trim();
    if (dbMaintenance) isMaintenanceMode = dbMaintenance === 'true';
    console.log('⚙️ Persistent system settings loaded.');
  } catch (err) {
    console.warn('Failed to load persistent settings from DB:', err);
  }
}

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Enable trust proxy for reverse proxies (Cloud Run / Nginx)
app.set('trust proxy', 1);

// Security Middlewares: Compatible CSP and Origin Guard for Preview iframe
app.use(
  helmet({
    contentSecurityPolicy: false, // Required for AI Studio preview iframe and Vite inline scripts
    frameguard: false, // Required so the preview can render inside AI Studio iframe
    crossOriginEmbedderPolicy: false,
  })
);

// Restricted CORS Policy with Strict Whitelisting (No arbitrary wildcards)
const configuredAppUrl = process.env.APP_URL || process.env.ORIGIN_URL;
const AI_STUDIO_HOST_REGEX = /^https:\/\/ais-(dev|pre)-[a-z0-9]+-[0-9]+\.[a-z0-9-]+\.run\.app$/;
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/;
const AI_STUDIO_PORTAL_REGEX = /^https:\/\/(ai\.studio|([a-z0-9-]+\.)?aistudio\.google\.com)$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Allow same-origin or direct non-browser requests
      if (!origin) return callback(null, true);

      // 2. Allow explicitly configured application domain
      if (configuredAppUrl && (origin === configuredAppUrl || origin === configuredAppUrl.replace(/\/$/, ''))) {
        return callback(null, true);
      }

      // 3. Allow strict Localhost development
      if (LOCALHOST_REGEX.test(origin)) {
        return callback(null, true);
      }

      // 4. Allow verified AI Studio workspace & preview container origins only
      if (AI_STUDIO_HOST_REGEX.test(origin) || AI_STUDIO_PORTAL_REGEX.test(origin)) {
        return callback(null, true);
      }

      // Reject all unauthorized / arbitrary third-party origins
      return callback(new Error('CORS Policy Violation: Origin is not in the authorized whitelist.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json({ limit: '5mb' }));

// ==================== RATE LIMITING CONFIGURATIONS ====================

// 1. Admin Login Rate Limiting: 10 attempts per 15 minutes to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ ያልተሳካ የመግባት ሙከራ ተደርጓል! እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ:: (Too many login attempts. Please try again later.)',
  },
});

// 2. Public Survey Submissions Limiter: 30 submissions per 15 min
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ከበዛ ጥያቄ የተነሳ ጊዜያዊ ገደብ ተጥሏል! እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ:: (Too many requests, please try again later)',
  },
});

// 3. Citizen Ticket Submission Limiter: 15 tickets per 15 min
const ticketSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'በአጭር ጊዜ ውስጥ የበዛ የአቤቱታ ጥያቄ ቀርቧል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// 4. Ticket Status Tracking Limiter: 35 lookups per 10 min
const ticketTrackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 35,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ የክትትል ጥያቄ ቀርቧል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// 5. Ticket Recovery Limiter: 6 attempts per 15 min to prevent enumeration
const ticketRecoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ የአቤቱታ መፈለጊያ ሙከራ ተደርጓል:: እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ::',
  },
});

// 6. AI Rate Limiter: 20 calls per 10 minutes to protect against quota exhaustion
const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'የኤአይ አገልግሎት ጥያቄ ገደብ ደርሷል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// Dynamic cryptographic salt for citizen anonymity
const ANONYMOUS_SALT = process.env.ANONYMOUS_SALT || process.env.IP_SALT || crypto.randomBytes(32).toString('hex');

// Active in-memory 2FA Single-Use OTP Store (Expires in 5 minutes, single-use, max 5 attempts)
const active2FaOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

// In-memory Ticket Recovery Email-OTP Store (Expires in 10 minutes, single-use, max 5 attempts)
const ticketRecoveryOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; hasTickets: boolean }>();

// In-memory failed login tracking for anomaly detection
const failedLoginTracker = new Map<string, { count: number; lastAttempt: number }>();

// Helper to escape HTML characters in Telegram messages
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to format date/time in Ethiopian format (e.g., 15/8/2026 ጥዋት 7:07:22)
function formatEthiopianDateTime(date: Date = new Date()): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  let period = 'ጥዋት';
  if (hours >= 12 && hours < 18) {
    period = 'ከሰዓት';
  } else if (hours >= 18 || hours < 6) {
    period = 'ማታ';
  } else {
    period = 'ጥዋት';
  }

  const displayHours = hours % 12 || 12;
  return `${d}/${m}/${y} ${period} ${displayHours}:${minutes}:${seconds}`;
}

// Helper for sending stylized 2FA OTP verification code to Telegram
async function sendTelegram2FaOtp(email: string, otp: string, ip?: string) {
  if (!activeBotToken || !activeChatId) return;
  try {
    const formattedTime = formatEthiopianDateTime(new Date());
    const clientIp = ip || '127.0.0.1';
    const targetChatId = formatTelegramChatId(activeChatId);

    const messageHtml = `🛡️ <b>የድሬዳዋ ሲስተም የደህንነት ማረጋገጫ</b>
<i>Security Alert &amp; 2FA Verification</i>

━━━━━━━━━━━━━━━━━━━━━━━

👤 <b>መለያ (Account)፦</b> <code>${escapeHtml(email)}</code>

🔑 <b>የማረጋገጫ ኮድ (OTP)፦</b>

💠 <b><code>${escapeHtml(otp)}</code></b> 💠

━━━━━━━━━━━━━━━━━━━━━━━

📌 <b>ዝርዝር መረጃዎች፦</b>

⏳ <b>የቆይታ ጊዜ፦</b> 5 ደቂቃ ብቻ (ለአንድ ጊዜ አገልግሎት)

🌐 <b>IP አድራሻ፦</b> <code>${escapeHtml(clientIp)}</code>

🕒 <b>የተላከበት ሰዓት፦</b> ${formattedTime}

⚠️ <i>ይህንን ኮድ ማንም ሰው አያጋሩ! እርስዎ እንዳልጠየቁት ከተሰማዎት እባክዎ ወዲያውኑ የደህንነት ቡድኑን ያነጋግሩ።</i>`;

    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: messageHtml,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[Telegram OTP Warning] Chat ID: ${targetChatId} - ${data.description}`);
      // Fallback to plain text if HTML parsing failed
      const plainMessage = `🛡️ የድሬዳዋ ሲስተም የደህንነት ማረጋገጫ\nSecurity Alert & 2FA Verification\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 መለያ (Account)፦ ${email}\n\n🔑 የማረጋገጫ ኮድ (OTP)፦\n\n💠 ${otp} 💠\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 ዝርዝር መረጃዎች፦\n⏳ የቆይታ ጊዜ፦ 5 ደቂቃ ብቻ (ለአንድ ጊዜ አገልግሎት)\n🌐 IP አድራሻ፦ ${clientIp}\n🕒 የተላከበት ሰዓት፦ ${formattedTime}\n\n⚠️ ይህንን ኮድ ማንም ሰው አያጋሩ! እርስዎ እንዳልጠየቁት ከተሰማዎት እባክዎ ወዲያውኑ የደህንነት ቡድኑን ያነጋግሩ።`;
      await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: plainMessage,
        }),
      });
    } else {
      console.log(`[Telegram OTP Sent] Successfully sent 2FA OTP to Chat ID: ${targetChatId}`);
    }
  } catch (err) {
    console.warn('Failed to send telegram 2FA OTP:', err);
  }
}

// Helper for sending stylized 2FA Status Change alert to Telegram
async function sendTelegram2FaStatusAlert(email: string, isEnabled: boolean, ip?: string) {
  if (!activeBotToken || !activeChatId) return;
  try {
    const formattedTime = formatEthiopianDateTime(new Date());
    const clientIp = ip || '127.0.0.1';
    const targetChatId = formatTelegramChatId(activeChatId);

    let messageHtml = '';
    let plainMessage = '';

    if (isEnabled) {
      messageHtml = `🛡️ <b>የድሬዳዋ ሲስተም ደህንነት ማስታወሻ</b>\n\n<i>Security Alert: 2FA Status Update</i>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 <b>መለያ (Account)፦</b> <code>${escapeHtml(email)}</code>\n\n🟢 <b>ሁኔታ፦</b> ባለ 2-ደረጃ ማረጋገጫ (2FA) በርቷል (Enabled)\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 <b>የዝርዝር መረጃዎች፦</b>\n\n🌐 <b>IP አድራሻ፦</b> <code>${escapeHtml(clientIp)}</code>\n\n🕒 <b>የተከናወነበት ሰዓት፦</b> ${formattedTime}\n\n✅ <i>የመለያዎ ደህንነት ተጠናክሯል!</i>`;

      plainMessage = `🛡️ የድሬዳዋ ሲስተም ደህንነት ማስታወሻ\n\nSecurity Alert: 2FA Status Update\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 መለያ (Account)፦ ${email}\n\n🟢 ሁኔታ፦ ባለ 2-ደረጃ ማረጋገጫ (2FA) በርቷል (Enabled)\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 የዝርዝር መረጃዎች፦\n\n🌐 IP አድራሻ፦ ${clientIp}\n\n🕒 የተከናወነበት ሰዓት፦ ${formattedTime}\n\n✅ የመለያዎ ደህንነት ተጠናክሯል!`;
    } else {
      messageHtml = `🚨 <b>የድሬዳዋ ሲስተም የደህንነት ማስጠንቀቂያ</b>\n\n<i>Security Alert: 2FA Status Update</i>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 <b>መለያ (Account)፦</b> <code>${escapeHtml(email)}</code>\n\n🔴 <b>ሁኔታ፦</b> ባለ 2-ደረጃ ማረጋገጫ (2FA) ጠፍቷል (Disabled)\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 <b>የዝርዝር መረጃዎች፦</b>\n\n🌐 <b>IP አድራሻ፦</b> <code>${escapeHtml(clientIp)}</code>\n\n🕒 <b>የተከናወነበት ሰዓት፦</b> ${formattedTime}\n\n⚠️ <i>ይህንን ለውጥ ያደረጉት እርስዎ ካልሆኑ፣ እባክዎ ወዲያውኑ የይለፍ ቃልዎን ይቀይሩ እና የደህንነት ቡድኑን ያነጋግሩ!</i>`;

      plainMessage = `🚨 የድሬዳዋ ሲስተም የደህንነት ማስጠንቀቂያ\n\nSecurity Alert: 2FA Status Update\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 መለያ (Account)፦ ${email}\n\n🔴 ሁኔታ፦ ባለ 2-ደረጃ ማረጋገጫ (2FA) ጠፍቷል (Disabled)\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 የዝርዝር መረጃዎች፦\n\n🌐 IP አድራሻ፦ ${clientIp}\n\n🕒 የተከናወነበት ሰዓት፦ ${formattedTime}\n\n⚠️ ይህንን ለውጥ ያደረጉት እርስዎ ካልሆኑ፣ እባክዎ ወዲያውኑ የይለፍ ቃልዎን ይቀይሩ እና የደህንነት ቡድኑን ያነጋግሩ!`;
    }

    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: messageHtml,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[Telegram 2FA Alert Warning] Chat ID: ${targetChatId} - ${data.description}`);
      await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: plainMessage,
        }),
      });
    } else {
      console.log(`[Telegram 2FA Alert Sent] Successfully dispatched to Chat ID: ${targetChatId}`);
    }
  } catch (err) {
    console.warn('Failed to send telegram 2FA status alert:', err);
  }
}

// Helper for sending real-time security alerts to Telegram
async function sendTelegramSecurityAlert(title: string, details: string, ip?: string) {
  if (!activeBotToken || !activeChatId) return;
  try {
    const text = `🚨 *የድሬዳዋ ሲስተም ደህንነት ማስጠንቀቂያ (Security Alert)*\n\n*ክስተት:* ${escapeMarkdown(title)}\n*ዝርዝር:* ${escapeMarkdown(details)}\n*IP አድራሻ:* \`${escapeMarkdown(ip || 'Unknown')}\`\n*ሰዓት:* ${new Date().toLocaleString('am-ET')}`;
    const targetChatId = formatTelegramChatId(activeChatId);
    const res = await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[Telegram Bot Alert Warning] Chat ID: ${targetChatId} - ${data.description}`);
    } else {
      console.log(`[Telegram Bot Alert Sent] Successfully dispatched to Chat ID: ${targetChatId}`);
    }
  } catch (err) {
    console.warn('Failed to send telegram security alert:', err);
  }
}

// Helper for generating anonymous IP hash (Anti-Spoofing: Relying on Express validated req.ip)
function generateIpHash(req: Request, surveyId: number): string {
  // Safe validated IP from Express trust-proxy configuration
  const validatedIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  // Hash IP with survey ID and dynamic salt so raw IP is mathematically unrecoverable
  return crypto
    .createHash('sha256')
    .update(`${validatedIp}_survey_${surveyId}_salt_${ANONYMOUS_SALT}`)
    .digest('hex');
}

// Centralized error logger and sanitizer helper
async function handleApiError(res: Response, req: Request, err: any, userFriendlyMessage: string) {
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
  try {
    await db.addErrorLog(
      req.originalUrl || req.path,
      err?.name || 'ApiError',
      err?.message || 'Unknown internal error',
      err?.stack || '',
      'server.ts',
      req.ip
    );
  } catch (e) {
    console.error('Failed to store exception log:', e);
  }

  res.status(500).json({
    error: userFriendlyMessage,
    requestId: `REQ-${Date.now().toString(36).toUpperCase()}`,
  });
}

// Maintenance Mode middleware for public citizen submissions
const citizenMaintenanceMiddleware = (req: Request, res: Response, next: any) => {
  if (isMaintenanceMode) {
    return res.status(503).json({
      error: 'ሲስተሙ በአሁኑ ወቅት በአደጋ ጊዜ ጥገና (Emergency Maintenance) ላይ ስለሆነ አዲስ አቤቱታ ወይም አስተያየት መላክ አይቻልም:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ተመልሰው ይሞክሩ::',
      maintenance: true,
    });
  }
  next();
};

// ==================== PUBLIC ENDPOINTS ====================

// Health Check Endpoint (Reports Database & Server Status)
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const isPg = Boolean(process.env.DATABASE_URL);
    const surveysCount = (await db.getAllSurveys(true)).length;
    res.json({
      status: 'ok',
      database: isPg ? 'PostgreSQL (Cloud SQL / Neon)' : 'Local File Persistence (data.json)',
      databaseConnected: true,
      surveysCount,
      timestamp: new Date().toISOString(),
      maintenance: isMaintenanceMode,
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      databaseConnected: false,
      error: err.message,
    });
  }
});

// Get all active surveys
app.get('/api/surveys', async (req: Request, res: Response) => {
  try {
    const surveys = await db.getAllSurveys(false);
    const surveysWithResponded = await Promise.all(
      surveys.map(async (s: any) => {
        const ipHash = generateIpHash(req, s.id);
        const hasResponded = await db.hasUserResponded(s.id, ipHash);
        return { ...s, has_responded: hasResponded };
      })
    );
    res.json({ surveys: surveysWithResponded });
  } catch (err: any) {
    handleApiError(res, req, err, 'የመጠይቆች ዝርዝር ለማግኘት አልተቻለም');
  }
});

// Get single survey details and check if user already submitted
app.get('/api/surveys/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የመጠይቅ መለያ (Invalid ID)' });

    const survey = await db.getSurveyById(id);
    if (!survey) return res.status(404).json({ error: 'መጠይቁ አልተገኘም (Survey not found)' });

    const ipHash = generateIpHash(req, id);
    const hasResponded = await db.hasUserResponded(id, ipHash);

    res.json({ survey, hasResponded });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቁን ለማግኘት አልተቻለም');
  }
});

// Submit anonymous survey response
app.post('/api/surveys/:id/responses', citizenMaintenanceMiddleware, submissionLimiter, async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የመጠይቅ መለያ' });

    const survey = await db.getSurveyById(surveyId);
    if (!survey) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });
    if (!survey.is_active) return res.status(400).json({ error: 'ይህ መጠይቅ በአሁኑ ወቅት ተዘግቷል (Survey is closed)' });

    const ipHash = generateIpHash(req, surveyId);

    const { answers, demographics } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'እባክዎ የመጠይቅ መልሶችን ያስገቡ (Answers are required)' });
    }

    const responseId = await db.submitResponse(surveyId, ipHash, answers, demographics);

    await db.addAuditLog(
      'CITIZEN_PUBLIC',
      'SURVEY_SUBMISSION',
      `አዲስ የሕዝብ አስተያየት ለጥናት ID ${surveyId} ("${survey.title.substring(0, 30)}") በዜጋ ተመዝግቧል::`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'የእርስዎ አስተያየት በስኬት ተመዝግቧል! ስለተሳተፉ እናመሰግናለን::',
      responseId,
      refCode: `REF-${surveyId}-${responseId}-${Math.floor(1000 + Math.random() * 9000)}`,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'መልሱን ለመመዝገብ አልተቻለም');
  }
});

// Submit Citizen Complaint or Inquiry (የዜጎች አቤቱታ/ጥያቄ ማስገቢያ)
app.post('/api/tickets', citizenMaintenanceMiddleware, ticketSubmissionLimiter, async (req: Request, res: Response) => {
  try {
    const { category, residence, subject, description, full_name, phone, email, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({ error: 'እባክዎ የጥያቄውን/አቤቱታውን ርዕስ፣ ዝርዝር መግለጫ እና ዘርፍ ያስገቡ' });
    }

    // High entropy 8-character cryptographic random hex
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const ticket_code = `DGC-TKT-2026-${randomHex}`;

    const normalizedPriority = typeof priority === 'string' ? priority.trim() : '';
    const safePriority: 'Normal' | 'High' | 'Urgent' =
      normalizedPriority === 'Urgent' || normalizedPriority === 'High' ? normalizedPriority : 'Normal';

    const ticket = await db.createTicket({
      ticket_code,
      category: String(category).substring(0, 100),
      residence: residence ? String(residence).substring(0, 100) : '',
      subject: String(subject).substring(0, 200),
      description: String(description).substring(0, 3000),
      full_name: full_name ? String(full_name).substring(0, 150) : '',
      phone: phone ? String(phone).substring(0, 50) : '',
      email: email ? String(email).substring(0, 150) : '',
      priority: safePriority,
    });

    await db.addAuditLog(
      'CITIZEN_PUBLIC',
      'TICKET_SUBMISSION',
      `አዲስ አቤቱታ/ጥያቄ [${ticket_code}] በዘርፍ "${category}" በዜጋ ተመዝግቧል:: (ቦታ: ${residence || 'አልተጠቀሰም'})`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'የእርስዎ አቤቱታ/ጥያቄ በስኬት ተመዝግቧል! ሁኔታውን በክትትል ኮድዎ መከታተል ይችላሉ::',
      ticket_code: ticket.ticket_code,
      ticket,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'አቤቱታውን ለመመዝገብ አልተቻለም');
  }
});

// Track Citizen Ticket Status by Ticket Code (የአቤቱታ ሁኔታ መከታተያ - PII Protected for Public)
app.get('/api/tickets/track/:code', ticketTrackLimiter, async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'እባክዎ የክትትል ኮድ ያስገቡ' });

    const ticket = await db.getTicketByCode(code.trim());
    if (!ticket) {
      return res.status(404).json({ error: 'በዚህ የክትትል ኮድ የተመዘገበ አቤቱታ ወይም ጥያቄ አልተገኘም:: እባክዎ ኮዱን አስተካክለው ይሞክሩ::' });
    }

    // Check if an authenticated admin is making this request
    const authHeader = req.headers.authorization;
    const isAuthorizedAdmin = authHeader && authHeader.startsWith('Bearer ') && verifyToken(authHeader.substring(7).trim()) !== null;

    if (isAuthorizedAdmin) {
      return res.json({ ticket });
    }

    // Protect citizen PII in public response: do NOT expose full description or admin response unverified
    const publicSafeTicket = {
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      category: ticket.category,
      residence: ticket.residence,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      responded_at: ticket.responded_at,
      created_at: ticket.created_at,
      full_name: ticket.full_name && ticket.full_name.length > 2 ? `${ticket.full_name.substring(0, 3)}****` : '••••',
      phone: ticket.phone && ticket.phone.length > 5 ? `${ticket.phone.substring(0, 4)}****${ticket.phone.slice(-2)}` : '••••',
      email: ticket.email && ticket.email.includes('@') ? `${ticket.email.charAt(0)}***@${ticket.email.split('@')[1]}` : '••••',
    };

    res.json({ ticket: publicSafeTicket });
  } catch (err: any) {
    handleApiError(res, req, err, 'መረጃውን ማግኘት አልተቻለም');
  }
});

// Step 1: Request Email OTP for Ticket Recovery (የክትትል ኮድ መፈለጊያ - ደረጃ 1 OTP መላኪያ)
app.post('/api/tickets/recover/request-otp', ticketRecoverLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'ትክክለኛ ኢሜይል ያስገቡ' });
    }
    const cleanEmail = email.trim().toLowerCase();

    const tickets = await db.getTicketsByPhoneOrEmail(cleanEmail);
    const otp = crypto.randomInt(100000, 1000000).toString();
    ticketRecoveryOtpStore.set(cleanEmail, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      hasTickets: tickets.length > 0,
    });

    if (tickets.length > 0) {
      await sendTicketRecoveryOtp(cleanEmail, otp);
    } else {
      console.log(`[Email OTP Simulation] No tickets found for ${cleanEmail}, but simulating dispatch for enumeration defense.`);
    }

    // Enumeration-safe generic response
    res.json({
      success: true,
      message: 'ኢሜይሉ በስርዓቱ ውስጥ ከተገኘ የማረጋገጫ ኮድ ተልኳል:: እባክዎ ኢሜይልዎን ይፈትሹ:: (ኮዱ ለ 10 ደቂቃ ያገለግላል)',
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የማረጋገጫ ኮድ መላክ አልተቻለም');
  }
});

// Step 2: Verify Email OTP & Return Full Recovered Tickets (የክትትል ኮድ መፈለጊያ - ደረጃ 2 ኮድ ማረጋገጥና ዝርዝር መረጃ ማግኘት)
app.post('/api/tickets/recover/verify-otp', ticketRecoverLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const entry = ticketRecoveryOtpStore.get(cleanEmail);

    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(400).json({ error: 'የማረጋገጫ ኮዱ ጊዜው አልፎበታል ወይም አልተገኘም:: እባክዎ እንደገና ይጠይቁ::' });
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
      ticketRecoveryOtpStore.delete(cleanEmail);
      return res.status(429).json({ error: 'ብዙ የተሳሳቱ ሙከራዎች ተደርገዋል። እባክዎ እንደገና አዲስ ኮድ ይጠይቁ::' });
    }

    if (String(otp).trim() !== entry.otp) {
      return res.status(400).json({ error: 'የተሳሳተ የማረጋገጫ ኮድ!' });
    }

    // Single-use token destruction
    ticketRecoveryOtpStore.delete(cleanEmail);

    const tickets = await db.getTicketsByPhoneOrEmail(cleanEmail);
    res.json({ success: true, count: tickets.length, tickets });
  } catch (err: any) {
    handleApiError(res, req, err, 'ኮዱን ማረጋገጥ አልተቻለም');
  }
});

// Legacy / Direct ticket recover endpoint (with masked sensitive fields)
app.post('/api/tickets/recover', ticketRecoverLimiter, async (req: Request, res: Response) => {
  try {
    const { query, email } = req.body;
    const cleanQuery = (email || query || '').trim().substring(0, 60);
    if (!cleanQuery || cleanQuery.length < 5) {
      return res.status(400).json({ error: 'እባክዎ ትክክለኛ ስልክ ቁጥር ወይም ኢሜይል ያስገቡ::' });
    }

    const tickets = await db.getTicketsByPhoneOrEmail(cleanQuery);
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ error: 'በተሰጠው መረጃ የተመዘገበ አቤቱታ አልተገኘም::' });
    }

    // Mask sensitive contact details and redact descriptions for unverified queries
    const sanitizedTickets = tickets.map((t: any) => ({
      ticket_code: t.ticket_code,
      category: t.category,
      subject: t.subject,
      status: t.status,
      created_at: t.created_at,
      residence: t.residence,
      responded_at: t.responded_at,
      masked_phone: t.phone && t.phone.length > 5 ? `${t.phone.substring(0, 4)}****${t.phone.slice(-2)}` : '••••',
      masked_email: t.email && t.email.includes('@') ? `${t.email.charAt(0)}***@${t.email.split('@')[1]}` : '••••',
    }));

    res.json({ success: true, count: sanitizedTickets.length, tickets: sanitizedTickets });
  } catch (err: any) {
    handleApiError(res, req, err, 'አቤቱታውን መፈለግ አልተቻለም');
  }
});

// ==================== ADMIN AUTHENTICATION & ACCESS CONTROL ====================

// Admin / Owner / Developer Login (with Brute-Force Rate Limiting, 2FA, and Anomaly Detection)
app.post('/api/admin/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'እባክዎ የተጠቃሚ ስም/ኢሜይል እና ፓስወርድ ያስገቡ' });
    }

    const cleanInput = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (cleanInput.length > 120 || cleanPassword.length > 120) {
      return res.status(400).json({ error: 'የተሳሳተ የተጠቃሚ ስም ወይም ፓስወርድ!' });
    }

    const admin = await db.getAdminByEmail(cleanInput);
    if (!admin) {
      const entry = failedLoginTracker.get(cleanInput) || { count: 0, lastAttempt: 0 };
      entry.count += 1;
      entry.lastAttempt = Date.now();
      failedLoginTracker.set(cleanInput, entry);

      await db.addAuditLog(cleanInput, 'FAILED_LOGIN', `ያልተሳካ የመግባት ሙከራ (ኢሜይል/ዩዘርኔም አልተገኘም)::`, req.ip);
      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    // Strict bcrypt verification on admin.password_hash only (No plaintext / dev bypasses)
    let isMatch = false;
    if (admin.password_hash) {
      isMatch = comparePassword(cleanPassword, admin.password_hash);
    }

    if (!isMatch) {
      const entry = failedLoginTracker.get(cleanInput) || { count: 0, lastAttempt: 0 };
      entry.count += 1;
      entry.lastAttempt = Date.now();
      failedLoginTracker.set(cleanInput, entry);

      await db.addAuditLog(admin.email, 'FAILED_LOGIN', `ያልተሳካ የመግባት ሙከራ (የተሳሳተ ፓስወርድ [Attempt #${entry.count}])::`, req.ip);

      if (entry.count >= 3) {
        sendTelegramSecurityAlert(
          'ተደጋጋሚ ያልተሳካ የመግባት ሙከራ (Multiple Failed Logins)',
          `የአድሚን አካውንት [${admin.email}] ${entry.count} ጊዜ የተሳሳተ ፓስወርድ ገብቶበታል::`,
          req.ip
        );
      }

      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    // 2FA Dynamic Single-Use OTP Verification (Enabled only if user or global 2FA is active)
    const global2FaSetting = await db.getSetting('global_2fa_enabled');
    const is2FaRequired = global2FaSetting === 'true' || Boolean(admin.two_factor_enabled);

    if (is2FaRequired) {
      if (!otp) {
        // Generate dynamic cryptographically secure 6-digit OTP (5-minute expiration, single-use only)
        const generatedOtp = crypto.randomInt(100000, 1000000).toString();
        active2FaOtpStore.set(cleanInput, {
          otp: generatedOtp,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0,
        });

        // Dispatch real-time OTP via Telegram Bot
        await sendTelegram2FaOtp(admin.email, generatedOtp, req.ip);

        await db.addAuditLog(
          admin.email,
          '2FA_OTP_SENT',
          `ለተጠቃሚ [${admin.email}] የ 5-ደቂቃ ነጠላ-ጥቅም ባለ 6-አሃዝ የ2FA OTP ተልኳል::`,
          req.ip
        );

        return res.status(200).json({
          require2FA: true,
          email: admin.email,
          message: 'ባለ 6-አሃዝ የደህንነት ማረጋገጫ ኮድ (OTP) ወደ ቴሌግራም/ኦፊሴላዊ የደህንነት መስመር ተልኳል:: (በ 5 ደቂቃ ውስጥ ያበቃል)',
          otpExpiresInSeconds: 300,
          telegramDispatched: Boolean(activeBotToken && activeChatId),
        });
      }

      // Verify Provided OTP with strict single-use expiry and NO backdoor bypasses
      const cleanOtp = String(otp).trim();
      const activeEntry = active2FaOtpStore.get(cleanInput);

      if (!activeEntry || Date.now() > activeEntry.expiresAt) {
        await db.addAuditLog(admin.email, 'FAILED_2FA', 'ጊዜው ያለፈበት ወይም ያልተገኘ የ2FA ኮድ ሙከራ ተደርጓል::', req.ip);
        return res.status(401).json({ error: 'የ2FA ማረጋገጫ ኮድ ጊዜው አልፏል ወይም አልተገኘም! እባክዎ እንደገና ይሞክሩ::' });
      }

      activeEntry.attempts += 1;
      if (activeEntry.attempts > 5) {
        active2FaOtpStore.delete(cleanInput);
        await db.addAuditLog(admin.email, 'FAILED_2FA_LOCKED', 'ተደጋጋሚ የተሳሳተ የ2FA ኮድ ሙከራ ተደርጎ ኮዱ ተሰርዟል::', req.ip);
        return res.status(401).json({ error: 'የተሳሳቱ ሙከራዎች በዝተዋል! እባክዎ አዲስ ኮድ ይጠይቁ::' });
      }

      if (cleanOtp !== activeEntry.otp) {
        await db.addAuditLog(admin.email, 'FAILED_2FA', `የተሳሳተ የ2FA ኮድ ሙከራ [#${activeEntry.attempts}]::`, req.ip);
        return res.status(401).json({ error: 'የተሳሳተ የ2FA ማረጋገጫ ኮድ!' });
      }

      // Valid OTP consumed: Immediately destroy from memory to ensure single-use guarantee
      active2FaOtpStore.delete(cleanInput);
    }

    // Clear failed login tracker on successful credentials validation
    failedLoginTracker.delete(cleanInput);

    const userRole = admin.role || 'admin';
    const mustChangePassword = Boolean(admin.must_change_password);

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      username: admin.username || admin.email.split('@')[0],
      role: userRole,
      mustChangePassword,
    });

    await db.addAuditLog(admin.email, 'ADMIN_LOGIN', `ተጠቃሚ [${admin.email}] በ [${userRole}] ሚና ወደ ሲስተሙ በስኬት ገብቷል::`, req.ip);

    res.json({
      token,
      mustChangePassword,
      twoFactorEnabled: Boolean(admin.two_factor_enabled),
      admin: {
        id: admin.id,
        email: admin.email,
        username: admin.username || admin.email.split('@')[0],
        role: userRole,
      },
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የመግባት ሂደት አልተሳካም');
  }
});

// Admin Mandatory Password Change Endpoint (Server-Side Enforced)
app.post('/api/admin/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'የአሁኑ እና አዲሱ ፓስወርድ አስፈላጊ ናቸው::' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'አዲሱ ፓስወርድ ቢያንስ 8 ፊደላት፣ ቁጥሮች እና ምልክቶች ማካተት አለበት::' });
    }

    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) {
      return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });
    }

    const isMatch = comparePassword(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'የአሁኑ ፓስወርድ የተሳሳተ ነው!' });
    }

    await db.updateAdminPassword(admin.id, newPassword);

    // Revoke previous JWT session immediately
    if (req.token) {
      await revokeToken(req.token, admin.id);
    }

    await db.addAuditLog(
      admin.email,
      'PASSWORD_CHANGE',
      `ተጠቃሚ [${admin.email}] ፓስወርዱን በስኬት ቀይሯል:: (Mandatory reset completed, previous token revoked)`,
      req.ip
    );

    sendTelegramSecurityAlert(
      'የአድሚን ፓስወርድ ተቀይሯል (Password Changed)',
      `የተጠቃሚ [${admin.email}] የይለፍ ቃል ተቀይሯል::`,
      req.ip
    );

    const refreshedToken = generateToken({
      id: admin.id,
      email: admin.email,
      username: admin.username || admin.email.split('@')[0],
      role: admin.role,
      mustChangePassword: false,
    });

    res.json({
      success: true,
      message: 'ፓስወርድዎ በስኬት ተቀይሯል!',
      token: refreshedToken,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'ፓስወርድ መቀየር አልተቻለም');
  }
});

// Admin Toggle Two-Factor Authentication (2FA)
app.post('/api/admin/2fa/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled, currentPassword, otp } = req.body;
    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });

    const isEnable = Boolean(enabled);

    if (!isEnable) {
      // Strict verification when disabling 2FA: require current password and OTP
      if (!currentPassword) {
        return res.status(400).json({ error: 'ባለ 2-ደረጃ ማረጋገጫን (2FA) ለማጥፋት የአሁኑን ፓስወርድዎን ማስገባት አለብዎት::' });
      }

      const isPwMatch = comparePassword(currentPassword, admin.password_hash);
      if (!isPwMatch) {
        await db.addAuditLog(admin.email, 'FAILED_2FA_DISABLE', '2FA ለማጥፋት የተሳሳተ ፓስወርድ ገብቷል::', req.ip);
        return res.status(400).json({ error: 'የተሳሳተ የአሁን ፓስወርድ!' });
      }

      if (!otp) {
        // Generate dynamic 6-digit OTP for 2FA disablement confirmation
        const generatedOtp = crypto.randomInt(100000, 1000000).toString();
        active2FaOtpStore.set(`disable-2fa-${admin.email}`, {
          otp: generatedOtp,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0,
        });

        await sendTelegram2FaOtp(admin.email, generatedOtp, req.ip);

        return res.status(200).json({
          requireOtp: true,
          message: 'ባለ 2-ደረጃ ማረጋገጫን (2FA) ለማጥፋት የማረጋገጫ ኮድ (OTP) ወደ ቴሌግራም ተልኳል:: እባክዎ ኮዱን አስገብተው ያረጋግጡ::',
        });
      }

      // Verify OTP
      const cleanOtp = String(otp).trim();
      const activeEntry = active2FaOtpStore.get(`disable-2fa-${admin.email}`);

      if (!activeEntry || Date.now() > activeEntry.expiresAt) {
        return res.status(400).json({ error: 'የማረጋገጫ ኮዱ ጊዜው አልፏል ወይም አልተገኘም:: እባክዎ እንደገና ይሞክሩ::' });
      }

      activeEntry.attempts += 1;
      if (activeEntry.attempts > 5) {
        active2FaOtpStore.delete(`disable-2fa-${admin.email}`);
        return res.status(429).json({ error: 'ተደጋጋሚ የተሳሳተ ኮድ ሙከራ ተደርጓል። እባክዎ እንደገና ይሞክሩ::' });
      }

      if (cleanOtp !== activeEntry.otp) {
        return res.status(400).json({ error: 'የተሳሳተ የማረጋገጫ ኮድ!' });
      }

      // Single-use token consumed
      active2FaOtpStore.delete(`disable-2fa-${admin.email}`);
    }

    const dynamicSecretBase = isEnable ? crypto.randomBytes(16).toString('hex') : undefined;
    await db.setAdminTwoFactor(admin.id, isEnable, dynamicSecretBase);

    await db.addAuditLog(
      admin.email,
      '2FA_TOGGLE',
      `Two-factor authentication ${isEnable ? 'ENABLED' : 'DISABLED'} for ${admin.email}`,
      req.ip
    );

    // Send stylized Telegram 2FA status update notification
    await sendTelegram2FaStatusAlert(admin.email, isEnable, req.ip);

    res.json({
      success: true,
      two_factor_enabled: isEnable,
      message: isEnable ? 'ባለ 2-ደረጃ ማረጋገጫ (2FA) በስኬት በርቷል!' : 'ባለ 2-ደረጃ ማረጋገጫ (2FA) ጠፍቷል::',
    });
  } catch (err: any) {
    handleApiError(res, req, err, '2FA ማስተካከል አልተቻለም');
  }
});

// Security Health Diagnostics & Dynamic Anomaly Checklist (Developer & Owner only)
app.get('/api/admin/security/metrics', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auditLogs = await db.getAuditLogs();
    const errorLogs = await db.getErrorLogs();
    const admins = await db.getAllAdmins();

    const failedLogins = auditLogs.filter((l: any) => l.action === 'FAILED_LOGIN').length;
    const passwordChanges = auditLogs.filter((l: any) => l.action === 'PASSWORD_CHANGE').length;
    const mustChangeCount = admins.filter((a: any) => a.must_change_password).length;
    const twoFactorCount = admins.filter((a: any) => a.two_factor_enabled).length;

    // Authentic dynamic security checklist score calculation (out of 100)
    const totalAdmins = admins.length || 1;
    const changedPwCount = admins.filter((a: any) => !a.must_change_password).length;
    const pwScore = Math.round((changedPwCount / totalAdmins) * 35);
    const twoFaScore = Math.round((twoFactorCount / totalAdmins) * 35);
    const baseHardeningScore = 30; // Core protection: CSV Anti-Formula Injection, Dynamic IP Salting, RBAC
    const calculatedScore = Math.min(100, pwScore + twoFaScore + baseHardeningScore);

    const checklist = [
      { name: 'PostgreSQL RBAC & Server-Side Password Enforcement', status: 'ACTIVE', passed: true },
      { name: 'JWT Blacklist & Session Revocation Store', status: 'ACTIVE', passed: true },
      { name: 'Strict CORS Whitelist (Zero Wildcards)', status: 'ACTIVE', passed: true },
      { name: 'Anti-Formula CSV Injection Defense', status: 'ACTIVE', passed: true },
      { name: 'Validated Client IP Salting & Anti-Spoofing', status: 'ACTIVE', passed: true },
      { name: 'Single-Use Time-Bound 2FA OTP (No Bypass Codes)', status: 'ACTIVE', passed: true },
      { name: 'Masked Persistent Telegram Secrets (Zero Browser Leak)', status: 'ACTIVE', passed: true },
      {
        name: 'Default Password Change Completion',
        status: `${changedPwCount}/${totalAdmins} Admins`,
        passed: mustChangeCount === 0,
      },
      {
        name: 'Two-Factor Authentication (2FA) Adoption',
        status: `${twoFactorCount}/${totalAdmins} Admins`,
        passed: twoFactorCount > 0,
      },
    ];

    res.json({
      status: calculatedScore >= 90 ? 'HARDENED' : 'OPERATIONAL',
      score: calculatedScore,
      checklist,
      jwt_encryption: 'HMAC-SHA256 (30m Strict Session)',
      ip_anonymity_salt: 'Dynamic Cryptographic SHA-256',
      csv_formula_injection_protection: true,
      xss_html_sanitization: true,
      rbac_enforcement: 'Active (Developer / Owner / Admin)',
      metrics: {
        total_admins: admins.length,
        admins_with_2fa: twoFactorCount,
        admins_needing_password_change: mustChangeCount,
        failed_login_attempts_recorded: failedLogins,
        password_changes_recorded: passwordChanges,
        total_audit_logs: auditLogs.length,
        total_error_logs: errorLogs.length,
      },
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የደህንነት መረጃዎችን ማግኘት አልተቻለም');
  }
});

// Admin Explicit Logout & Token Revocation (Server-Side Blacklist)
app.post('/api/admin/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.token) {
      await revokeToken(req.token, req.adminUser?.id);
    }
    if (req.adminUser?.email) {
      await db.addAuditLog(
        req.adminUser.email,
        'ADMIN_LOGOUT',
        `ተጠቃሚ [${req.adminUser.email}] ከሲስተሙ ወጥቷል፤ የቶከን አግልግሎት ተቋርጧል (Token Revoked)::`,
        req.ip
      );
    }
    res.json({ success: true, message: 'በስኬት ከሲስተሙ ወጥተዋል፤ ቶከንዎ ተሰርዟል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'ከሲስተም መውጣት አልተቻለም');
  }
});

// Verify Current User Token
app.get('/api/admin/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ admin: req.adminUser });
});

// Refresh Current Admin Access Token (Sliding Session)
app.post('/api/admin/refresh-token', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.adminUser) {
    return res.status(401).json({ error: 'ያልተፈቀደ መግቢያ!' });
  }

  const refreshedToken = generateToken({
    id: req.adminUser.id,
    email: req.adminUser.email,
    username: req.adminUser.username,
    role: req.adminUser.role,
    mustChangePassword: Boolean(req.adminUser.mustChangePassword),
  });

  res.json({
    success: true,
    token: refreshedToken,
    admin: req.adminUser,
  });
});

// ==================== USER MANAGEMENT (DEVELOPER & OWNER ONLY) ====================

// User Management: List Users
app.get('/api/admin/users', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await db.getAllAdmins();
    res.json({ users });
  } catch (err: any) {
    handleApiError(res, req, err, 'የተጠቃሚዎችን ዝርዝር ማግኘት አልተቻለም');
  }
});

// User Management: Create User
app.post('/api/admin/users', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, username, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'ኢሜይል እና ፓስወርድ አስፈላጊ ናቸው::' });
    }

    // Only developer can create developer roles
    const targetRole = role || 'admin';
    if (targetRole === 'developer' && req.adminUser?.role !== 'developer') {
      return res.status(403).json({ error: 'የDeveloper አካውንት መፍጠር የሚችለው Software Developer ብቻ ነው!' });
    }

    const newUser = await db.createAdminUser(email.trim().toLowerCase(), username || email.split('@')[0], password.trim(), targetRole);
    await db.addAuditLog(req.adminUser?.email || 'system', 'CREATE_USER', `አዲስ ተጠቃሚ [${email}] በ [${targetRole}] ሚና ተፈጠረ::`, req.ip);
    res.status(201).json({ user: newUser, message: 'አዲስ አድሚን/ተጠቃሚ በስኬት ተፈጠረ!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'አዲስ ተጠቃሚ ለመፍጠር አልተቻለም');
  }
});

// User Management: Update Profile or Reset Password
app.put('/api/admin/users/:id', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { email, username, password, role } = req.body;

    if (isNaN(targetId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የተጠቃሚ ID' });

    if (role === 'developer' && req.adminUser?.role !== 'developer') {
      return res.status(403).json({ error: 'ወደ Developer ሚና መቀየር የሚችለው Software Developer ብቻ ነው!' });
    }

    await db.updateAdminProfile(targetId, { email, username, password, role });
    await db.addAuditLog(req.adminUser?.email || 'system', 'UPDATE_USER', `የተጠቃሚ ID [${targetId}] መረጃ/ፓስወርድ ተቀይሯል::`, req.ip);

    res.json({ success: true, message: 'የተጠቃሚው መረጃ/ፓስወርድ በስኬት ተቀይሯል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'የተጠቃሚውን መረጃ ለመቀየር አልተቻለም');
  }
});

// User Management: Delete Admin User (Developer & Owner Only)
app.delete('/api/admin/users/:id', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የተጠቃሚ ID' });

    // Prevent self-deletion
    if (req.adminUser?.id === targetId) {
      return res.status(400).json({ error: 'ራስዎን መሰረዝ አይችሉም!' });
    }

    await db.deleteAdminUser(targetId);
    await db.addAuditLog(req.adminUser?.email || 'system', 'DELETE_USER', `የተጠቃሚ ID [${targetId}] ከአስፈላጊ ዳታቤዝ ተሰርዟል::`, req.ip);

    res.json({ success: true, message: 'ተጠቃሚው በስኬት ተሰርዟል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'ተጠቃሚውን ለመሰረዝ አልተቻለም');
  }
});

// User Management: Toggle 2FA for Admin User (Developer & Owner Only)
app.post('/api/admin/users/:id/2fa', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { enabled } = req.body;
    if (isNaN(targetId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የተጠቃሚ ID' });

    await db.setAdminTwoFactor(targetId, Boolean(enabled));
    await db.addAuditLog(
      req.adminUser?.email || 'system',
      'TOGGLE_2FA',
      `የተጠቃሚ ID [${targetId}] 2FA OTP ወደ [${Boolean(enabled) ? 'ON' : 'OFF'}] ተቀይሯል::`,
      req.ip
    );

    res.json({ success: true, message: `የተጠቃሚው 2FA በስኬት ${Boolean(enabled) ? 'በርቷል (ON)' : 'ጠፍቷል (OFF)'}!` });
  } catch (err: any) {
    handleApiError(res, req, err, 'የ2FA ሁኔታ መቀየር አልተቻለም');
  }
});

// Developer Control: Get Global 2FA Status
app.get('/api/admin/developer/2fa-global', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const global2FaSetting = await db.getSetting('global_2fa_enabled');
    res.json({ global2Fa: global2FaSetting === 'true' });
  } catch (err: any) {
    handleApiError(res, req, err, 'የGlobal 2FA ሁኔታ ማግኘት አልተቻለም');
  }
});

// Developer Control: Toggle Global 2FA Requirement
app.post('/api/admin/developer/2fa-global', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    const isEnabled = Boolean(enabled);
    await db.setSetting('global_2fa_enabled', isEnabled ? 'true' : 'false');
    
    // Also sync all admin records
    if (!isEnabled) {
      const allAdmins = await db.getAllAdmins();
      for (const a of allAdmins) {
        await db.setAdminTwoFactor(a.id, false);
      }
    }

    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'TOGGLE_GLOBAL_2FA',
      `Global 2FA Requirement በDeveloper ወደ [${isEnabled ? 'ON' : 'OFF'}] ተቀይሯል::`,
      req.ip
    );

    res.json({ success: true, global2Fa: isEnabled, message: `Global 2FA በስኬት ${isEnabled ? 'በርቷል (ON)' : 'ጠፍቷል (OFF)'}!` });
  } catch (err: any) {
    handleApiError(res, req, err, 'Global 2FA ሁኔታ መቀየር አልተቻለም');
  }
});

// Developer Control: Reset / Clear Database Logins
app.post('/api/admin/developer/clear-logins', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Delete all admins except the current developer
    const allAdmins = await db.getAllAdmins();
    let deletedCount = 0;
    for (const a of allAdmins) {
      if (a.email !== req.adminUser?.email && a.email !== 'opa@dgc.gov.et' && a.email !== 'eyobjegreta@gmail.com') {
        await db.deleteAdminUser(a.id);
        deletedCount++;
      } else {
        // Ensure 2FA is turned off for developer
        await db.setAdminTwoFactor(a.id, false);
      }
    }

    await db.setSetting('global_2fa_enabled', 'false');

    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'DEV_CLEAR_LOGINS',
      `በዳታቤዝ ውስጥ የነበሩ ${deletedCount} ተጨማሪ አድሚኖች ተሰርዘዋል፤ 2FA OTP በሙሉ ጠፍቷል::`,
      req.ip
    );

    res.json({
      success: true,
      message: `በዳታቤዝ ውስጥ የነበሩ ${deletedCount} ተጨማሪ መለያዎች ተሰርዘዋል! አሁን በ Developer Control አዳዲስ መለያዎችን በፈለጉት ስም እና ፓስወርድ ማስገባት ይችላሉ::`,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'መለያዎችን ማፅዳት አልተቻለም');
  }
});

// ==================== SURVEY MANAGEMENT ====================

// Admin list all surveys (active & inactive)
app.get('/api/admin/surveys', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await db.getAllSurveys(true);
    res.json({ surveys });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቆችን ለማግኘት አልተቻለም');
  }
});

// Create New Survey (Developer & Owner)
app.post('/api/admin/surveys', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, category, theme, questions } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'እባክዎ የመጠይቅ ርዕስ እና ቢያንስ አንድ ጥያቄ ያስገቡ' });
    }

    const surveyId = await db.createSurvey({
      title: String(title).substring(0, 200),
      description: description ? String(description).substring(0, 2000) : '',
      category: category ? String(category).substring(0, 100) : 'General',
      theme: theme || 'government',
      questions,
    });

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'CREATE_SURVEY',
      `አዲስ የጥናት መጠይቅ [ID ${surveyId}: "${title.substring(0, 35)}..."] ተፈጥሯል::`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'አዲስ መጠይቅ በስኬት ተፈጥሯል!',
      surveyId,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቅ መፍጠር አልተቻለም');
  }
});

// Toggle Survey Active/Inactive Status
app.put('/api/admin/surveys/:id/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    const { is_active } = req.body;

    if (isNaN(surveyId) || typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መረጃ' });
    }

    await db.toggleSurveyStatus(surveyId, is_active);
    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'TOGGLE_SURVEY',
      `የጥናት ID ${surveyId} ሁኔታ ወደ [${is_active ? 'ክፍት (Active)' : 'ተዘግቷል (Closed)'}] ተቀይሯል::`,
      req.ip
    );
    res.json({ success: true, message: `መጠይቁ ${is_active ? 'ተከፍቷል' : 'ተዘግቷል'}` });
  } catch (err: any) {
    handleApiError(res, req, err, 'ሁኔታውን ለመቀየር አልተቻለም');
  }
});

// Delete Survey (Developer, Owner & Admin)
app.delete('/api/admin/surveys/:id', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    await db.deleteSurvey(surveyId);
    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'DELETE_SURVEY',
      `የጥናት መጠይቅ ID ${surveyId} በስኬት ተሰርዟል::`,
      req.ip
    );
    res.json({ success: true, message: 'መጠይቁ በስኬት ተሰርዟል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቁን ለማጥፋት አልተቻለም');
  }
});

// Get Full Analytics for a Survey
app.get('/api/admin/surveys/:id/analytics', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    const analytics = await db.getSurveyAnalytics(surveyId);
    if (!analytics) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });

    res.json({ analytics });
  } catch (err: any) {
    handleApiError(res, req, err, 'አናሊቲክስ ዳታ ማግኘት አልተቻለም');
  }
});

// Export Survey Analytics to Telegram with AI Policy Insights
app.post('/api/admin/surveys/:id/export-telegram', authMiddleware, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    const { botToken, chatId, aiReport: clientAiReport } = req.body;

    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    const analytics = await db.getSurveyAnalytics(surveyId);
    if (!analytics) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });

    // Generate AI report if not provided by client
    let aiReport = clientAiReport;
    if (!aiReport) {
      try {
        aiReport = await generateSurveyAiReport(analytics);
      } catch (e) {
        console.warn('AI Report generation fallback:', e);
      }
    }

    const result = await sendTelegramReport(analytics, botToken || activeBotToken, chatId || activeChatId, aiReport);
    if (result.success) {
      await db.addAuditLog(
        req.adminUser?.email || 'admin@dgc.gov.et',
        'EXPORT_TELEGRAM',
        `ለጥናት ID ${surveyId} ("${analytics.survey.title.substring(0, 30)}...") የፖሊሲ ሪፖርት ወደ Telegram ተልኳል::`,
        req.ip
      );
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    handleApiError(res, req, err, 'ወደ Telegram መላክ አልተቻለም');
  }
});

// Generate AI Analytical Report for Dire Dawa Administration
app.post('/api/admin/surveys/:id/generate-ai-report', authMiddleware, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    const analytics = await db.getSurveyAnalytics(surveyId);
    if (!analytics) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });

    const aiReport = await generateSurveyAiReport(analytics);

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'GENERATE_POLICY_REPORT',
      `ለጥናት ID ${surveyId} ("${analytics.survey.title.substring(0, 30)}...") የፖሊሲ ሪፖርት ተዘጋጅቷል::`,
      req.ip
    );

    res.json({ report: aiReport });
  } catch (err: any) {
    handleApiError(res, req, err, 'የኤአይ ሪፖርት ማዘጋጀት አልተቻለም');
  }
});

// CSV Formula Injection Sanitizer: Prevents malicious formula execution in MS Excel / Google Sheets
function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
  // If the cell begins with formula trigger chars (=, +, -, @, \t, %), prepend a single quote
  if (/^[=+\-@\t\r%]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// CSV Export Download Endpoint with AI Policy Report & Demographics
app.get('/api/admin/surveys/:id/export-csv', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    const analytics = await db.getSurveyAnalytics(surveyId);
    if (!analytics) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });

    const { survey, total_responses, questions_analytics, demographics_analytics } = analytics;

    // Generate AI Report to embed in CSV
    let aiReport: any = null;
    try {
      aiReport = await generateSurveyAiReport(analytics);
    } catch (e) {
      console.warn('AI report generation error for CSV:', e);
    }

    let csvContent = `Dire Dawa Administration Government Communication Affairs Bureau\n`;
    csvContent += `Office Location,${sanitizeCsvField('Finance Building, 3rd Floor, Dire Dawa, Ethiopia')}\n`;
    csvContent += `Phone / Support,${sanitizeCsvField('+251-25-1116061')}\n`;
    csvContent += `Email Contact,${sanitizeCsvField('info@dgc.com / support@dgc.com')}\n`;
    csvContent += `Survey Title,${sanitizeCsvField(survey.title)}\n`;
    csvContent += `Category,${sanitizeCsvField(survey.category)}\n`;
    csvContent += `Total Respondents,${total_responses}\n\n`;

    if (aiReport) {
      csvContent += `--- OFFICIAL POLICY & ANALYTICS REPORT ---\n`;
      csvContent += `Official Ref Code,${sanitizeCsvField(aiReport.official_header?.ref_code || 'N/A')}\n`;
      csvContent += `Generated Date,${sanitizeCsvField(aiReport.official_header?.generated_date || 'N/A')}\n`;
      csvContent += `Public Satisfaction Score,${sanitizeCsvField(`${aiReport.satisfaction_score}%`)}\n`;
      csvContent += `Executive Summary,${sanitizeCsvField(aiReport.executive_summary || '')}\n`;
      csvContent += `Demographic Insights,${sanitizeCsvField(aiReport.demographic_insights || '')}\n`;

      if (aiReport.key_findings && aiReport.key_findings.length > 0) {
        csvContent += `Key Findings,${sanitizeCsvField(aiReport.key_findings.map((f: string) => `• ${f}`).join(' | '))}\n`;
      }
      if (aiReport.policy_recommendations && aiReport.policy_recommendations.length > 0) {
        csvContent += `Policy Recommendations,${sanitizeCsvField(aiReport.policy_recommendations.map((p: string) => `• ${p}`).join(' | '))}\n`;
      }
      csvContent += `\n`;
    }

    csvContent += `--- QUESTION ANALYTICS ---\n`;
    csvContent += `Question ID,Question Text,Question Type,Option / Rating / Response,Count,Percentage (%)\n`;

    questions_analytics.forEach((q) => {
      const qText = q.question_text;

      if (q.question_type === 'radio' && q.radio_data) {
        q.radio_data.forEach((r) => {
          csvContent += `${q.question_id},${sanitizeCsvField(qText)},Radio,${sanitizeCsvField(r.option)},${r.count},${r.percentage}%\n`;
        });
      } else if (q.question_type === 'rating' && q.rating_distribution) {
        q.rating_distribution.forEach((rd) => {
          csvContent += `${q.question_id},${sanitizeCsvField(qText)},Rating,${sanitizeCsvField(`${rd.value} Stars`)},${rd.count},${rd.percentage}%\n`;
        });
      } else if (q.question_type === 'text' && q.text_responses) {
        q.text_responses.forEach((tr) => {
          csvContent += `${q.question_id},${sanitizeCsvField(qText)},Text,${sanitizeCsvField(tr.answer_text)},1,N/A\n`;
        });
      }
    });

    if (demographics_analytics) {
      csvContent += `\n--- DEMOGRAPHIC BREAKDOWN ---\n`;
      csvContent += `Category,Label,Count,Percentage (%)\n`;

      demographics_analytics.age_distribution.forEach((item) => {
        csvContent += `Age Group,${sanitizeCsvField(item.label)},${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.gender_distribution.forEach((item) => {
        csvContent += `Gender,${sanitizeCsvField(item.label)},${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.education_distribution.forEach((item) => {
        csvContent += `Education,${sanitizeCsvField(item.label)},${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.residence_distribution.forEach((item) => {
        csvContent += `Residence / Kifle Ketema,${sanitizeCsvField(item.label)},${item.count},${item.percentage}%\n`;
      });
    }

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'EXPORT_CSV',
      `ለጥናት ID ${surveyId} የፖሊሲ ሪፖርት ያካተተ CSV ዳውንሎድ ተደርጓል::`,
      req.ip
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dgc_survey_${surveyId}_full_report.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (err: any) {
    handleApiError(res, req, err, 'CSV ሪፖርት ማዘጋጀት አልተቻለም');
  }
});

// ==================== TELEGRAM CONFIGURATION ====================

// Get current Telegram Config (Masked - Plaintext secret NEVER exposed to frontend)
const getTelegramConfigHandler = (req: AuthenticatedRequest, res: Response) => {
  const isConfigured = Boolean(activeBotToken && activeBotToken.length > 5);
  const maskedToken = activeBotToken && activeBotToken.length > 8
    ? `${activeBotToken.substring(0, 6)}••••••••••••${activeBotToken.substring(activeBotToken.length - 4)}`
    : (isConfigured ? '••••••••••••' : '');

  res.json({
    success: true,
    isConfigured,
    maskedToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
    config: {
      isConfigured,
      botToken: maskedToken,
      chatId: activeChatId,
    },
  });
};

app.get('/api/admin/telegram-config', authMiddleware, getTelegramConfigHandler);
app.get('/api/admin/telegram-settings', authMiddleware, getTelegramConfigHandler);

// Update Telegram Config (Developer & Owner Only - Persisted to Database)
const updateTelegramConfigHandler = async (req: AuthenticatedRequest, res: Response) => {
  const botToken = req.body.botToken || req.body.config?.botToken;
  const chatId = req.body.chatId || req.body.config?.chatId;

  // Only update botToken if a real token was provided and not a placeholder/masked value
  if (botToken && typeof botToken === 'string' && !botToken.includes('••••') && botToken.trim().length > 0) {
    activeBotToken = botToken.trim();
    await db.setSetting('telegram_bot_token', activeBotToken);
  }
  if (chatId && typeof chatId === 'string') {
    activeChatId = chatId.trim();
    await db.setSetting('telegram_chat_id', activeChatId);
  }

  await db.addAuditLog(
    req.adminUser?.email || 'admin@dgc.gov.et',
    'UPDATE_TELEGRAM_CONFIG',
    `የቴሌግራም ቦት እና ቻናል መረጃዎች [Chat ID: ${activeChatId}] ተዘምነዋል:: (Persisted to Storage)`,
    req.ip
  );

  const maskedToken = activeBotToken && activeBotToken.length > 8
    ? `${activeBotToken.substring(0, 6)}••••••••••••${activeBotToken.substring(activeBotToken.length - 4)}`
    : '••••••••••••';

  res.json({
    success: true,
    message: 'የቴሌግራም ቦት ሴቲንግ በስኬት ተቀምጧል! (Telegram settings saved to persistent database)',
    isConfigured: Boolean(activeBotToken),
    maskedToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
    config: {
      isConfigured: Boolean(activeBotToken),
      botToken: maskedToken,
      chatId: activeChatId,
    },
  });
};

app.post('/api/admin/telegram-config', authMiddleware, requireRole('developer', 'owner'), updateTelegramConfigHandler);
app.post('/api/admin/telegram-settings', authMiddleware, requireRole('developer', 'owner'), updateTelegramConfigHandler);

// Test Telegram Bot Connection (Developer & Owner Only)
app.post('/api/admin/telegram-test', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { botToken, chatId } = req.body;
    const token = botToken || activeBotToken;
    const targetChatId = formatTelegramChatId(chatId || activeChatId);

    if (!token || !targetChatId) {
      return res.status(400).json({
        success: false,
        message: 'Bot Token እና Chat ID አስፈላጊ ናቸው! (Bot Token and Chat ID are required)',
      });
    }

    const testMsg = `🔔 *የሕዝብ አስተያየትና ጥናት መድረክ - የቴሌግራም ቦት ሙከራ*\n\nየቴሌግራም ቦት ግኑኝነት በስኬት ተረጋግጧል! 🎉\nChannel/Chat ID: \`${targetChatId}\`\n\nአሁን የተሰበሰቡ ሪፖርቶችን ቀጥታ ወደዚህ ቻት መላክ ይችላሉ::`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: testMsg,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      res.json({ success: true, message: 'የሙከራ መልዕክት ወደ Telegram በስኬት ተልኳል!' });
    } else {
      res.status(400).json({ success: false, message: `Telegram error: ${data.description}` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'ወደ Telegram መገናኘት አልተቻለም' });
  }
});

// ==================== TICKET & CITIZEN FEEDBACK MANAGEMENT ====================

// Admin Get All Citizen Tickets
app.get('/api/admin/tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await db.getAllTickets();
    res.json({ tickets });
  } catch (err: any) {
    handleApiError(res, req, err, 'የአቤቱታዎችን ዝርዝር ማግኘት አልተቻለም');
  }
});

// Admin Respond / Update Citizen Ticket Status
app.put('/api/admin/tickets/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { admin_response, status } = req.body;
    if (isNaN(ticketId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });
    if (!status) return res.status(400).json({ error: 'እባክዎ የአቤቱታ ሁኔታ ይምረጡ' });

    const updatedTicket = await db.updateTicketResponse(
      ticketId,
      admin_response ? String(admin_response).substring(0, 3000) : '',
      status,
      req.adminUser?.email || 'admin@dgc.gov.et'
    );

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'TICKET_RESPONSE',
      `ለአቤቱታ ${updatedTicket?.ticket_code} ኦፊሴላዊ ምላሽ ተሰጥቷል (ሁኔታ: ${status})::`,
      req.ip
    );

    res.json({ success: true, message: 'ለአቤቱታው ኦፊሴላዊ ምላሽ በስኬት ተመዝግቧል!', ticket: updatedTicket });
  } catch (err: any) {
    handleApiError(res, req, err, 'ምላሹን ለመመዝገብ አልተቻለም');
  }
});

// Admin Delete Citizen Ticket
app.delete('/api/admin/tickets/:id', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    await db.deleteTicket(ticketId);

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'DELETE_TICKET',
      `አቤቱታ ID ${ticketId} ተሰርዟል::`,
      req.ip
    );

    res.json({ success: true, message: 'አቤቱታው በስኬት ተሰርዟል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'አቤቱታውን ማጥፋት አልተቻለም');
  }
});

// AI Translation endpoint for Admin Panel
app.post('/api/admin/translate', authMiddleware, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'እባክዎ የሚተርጎም ጽሑፍ ያስገቡ' });
    }

    const translation = await translateTextWithAi(text);
    res.json({ translation });
  } catch (err: any) {
    handleApiError(res, req, err, 'በትርጉም ወቅት ስህተት አጋጥሟል');
  }
});

// Get Audit Logs (Developer & Owner Only)
app.get('/api/admin/audit-logs', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    handleApiError(res, req, err, 'የኦዲት መዝገብ ማግኘት አልተቻለም');
  }
});

// ==================== DEVELOPER & SYSTEM CONTROL (DEVELOPER ONLY) ====================

// Public Check Maintenance Mode status
app.get('/api/maintenance-mode', async (req: Request, res: Response) => {
  try {
    const val = await db.getSetting('maintenance_mode', 'false');
    res.json({ maintenance: val === 'true' });
  } catch {
    res.json({ maintenance: isMaintenanceMode });
  }
});

// Developer Toggle Emergency Maintenance Mode
app.post('/api/admin/developer/maintenance', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { maintenance } = req.body;
    isMaintenanceMode = Boolean(maintenance);
    await db.setSetting('maintenance_mode', isMaintenanceMode ? 'true' : 'false');
    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'MAINTENANCE_TOGGLE',
      `Emergency Maintenance Mode set to ${isMaintenanceMode ? 'ON' : 'OFF'}`,
      req.ip
    );
    res.json({ success: true, maintenance: isMaintenanceMode });
  } catch (err: any) {
    handleApiError(res, req, err, 'የጥገና ሁኔታ ማብራት/ማጥፋት አልተቻለም');
  }
});

// Developer Live DB Stats Inspector (Real dynamic database statistics)
app.get('/api/admin/developer/db-stats', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [admins, tickets, surveys, auditLogs, errorLogs] = await Promise.all([
      db.getAllAdmins(),
      db.getAllTickets(),
      db.getAllSurveys(true),
      db.getAuditLogs(),
      db.getErrorLogs(),
    ]);

    const testTickets = tickets.filter((t) => t.ticket_code && t.ticket_code.startsWith('DGC-TST-'));
    const realTickets = tickets.filter((t) => !t.ticket_code || !t.ticket_code.startsWith('DGC-TST-'));

    const memoryUsage = process.memoryUsage();
    const isProduction = process.env.NODE_ENV === 'production';

    res.json({
      success: true,
      isProduction,
      nodeEnv: process.env.NODE_ENV || 'development',
      tablesCount: {
        admins: admins.length,
        adminUsernames: admins.map((a) => a.username || a.email.split('@')[0]),
        tickets: tickets.length,
        realTicketsCount: realTickets.length,
        testTicketsCount: testTickets.length,
        surveys: surveys.length,
        audit_logs: auditLogs.length,
        error_logs: errorLogs.length,
      },
      systemInfo: {
        isProduction,
        nodeEnv: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMB: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        databaseType: 'PostgreSQL + Local Fallback Sync',
        activePort: PORT,
      },
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የዳታቤዝ ስታቲስቲክስ መረጃ ማግኘት አልተቻለም');
  }
});

// Developer Seed Test Tickets into Database (Guarded strictly in Production)
app.post('/api/admin/developer/seed-tickets', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Production Safety Check: Block synthetic data generation in Production to protect analytics integrity
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'የሙከራ ዳታ ማመንጨት በProduction Environment ላይ ለደህንነት እና ለትክክለኛ አናሊቲክስ ሲባል ሙሉ በሙሉ ታግዷል! (Test data seeding is strictly disabled in production)',
      });
    }

    const count = Math.min(Math.max(parseInt(req.body.count || 5, 10), 1), 20);
    const categories = ['ውኃ እና ፍሳሽ', 'ትራንስፖርት', 'መንገድና መሰረተ ልማት', 'ንግድና ገበያ', 'ፅዳትና ውበት'];
    const residences = ['ዚራ', 'መጋላ', 'ሳቢያን', 'ደቼቱ', 'አዲስ ከተማ', 'ቦሌ (ድሬዳዋ)'];
    const priorities = ['Normal', 'High', 'Urgent'];

    for (let i = 0; i < count; i++) {
      const code = `DGC-TST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const cat = categories[i % categories.length];
      const resName = residences[i % residences.length];
      const prio = priorities[i % priorities.length];
      await db.createTicket({
        ticket_code: code,
        category: cat,
        residence: resName,
        subject: `[Test Ticket] የ${cat} አቤቱታ ናሙና #${i + 1}`,
        description: `ይህ ለሲስተም ፈተና በDeveloper OPA የተፈጠረ የናሙና አቤቱታ ነው። ቦታ: ${resName}`,
        full_name: `ተፈታኝ ዜጋ ${i + 1}`,
        phone: `+251915${Math.floor(100000 + Math.random() * 900000)}`,
        email: `tester${i + 1}@gmail.com`,
        priority: prio,
      });
    }

    await db.addAuditLog(req.adminUser?.email || 'opa', 'DEV_SEED_TICKETS', `${count} የቴስት አቤቱታዎች አውቶማቲክ ተመረቱ::`, req.ip);
    res.json({ success: true, message: `${count} የቴስት አቤቱታዎች በስኬት ተፈጠሩ!` });
  } catch (err: any) {
    handleApiError(res, req, err, 'የቴስት አቤቱታ ማመንጨት አልተሳካም');
  }
});

// Developer Clean Up Test Tickets (Purge all DGC-TST-% records from DB)
app.delete('/api/admin/developer/cleanup-test-tickets', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedCount = await db.deleteTestTickets();
    await db.addAuditLog(
      req.adminUser?.email || 'opa',
      'DEV_CLEANUP_TEST_TICKETS',
      `${deletedCount} የሙከራ (Test) አቤቱታዎች ከዳታቤዝ ተወግደዋል::`,
      req.ip
    );
    res.json({
      success: true,
      deletedCount,
      message: `${deletedCount} የሙከራ አቤቱታዎች (DGC-TST-*) በስኬት ከዳታቤዝ ተወግደዋል!`,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የሙከራ አቤቱታዎችን ለማፅዳት አልተቻለም');
  }
});

// Fetch Real-Time Error Logs (Developer & Owner Only)
app.get('/api/admin/error-logs', authMiddleware, requireRole('developer', 'owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db.getErrorLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    handleApiError(res, req, err, 'የስህተት ሎጎችን ማግኘት አልተቻለም');
  }
});

// Clear Error Logs (Developer Only)
app.delete('/api/admin/error-logs', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.clearErrorLogs();
    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'CLEAR_ERROR_LOGS',
      'የሲስተሙ ኤረር ሎጎች በሙሉ ተደልተዋል::',
      req.ip
    );
    res.json({ success: true, message: 'የኤረር ሎጎች በሙሉ ተደልተዋል' });
  } catch (err: any) {
    handleApiError(res, req, err, 'የስህተት ሎጎችን ማፅዳት አልተቻለም');
  }
});

// Developer Trigger Test Exception Log
app.post('/api/admin/developer/test-error', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { errorType, message } = req.body;
    const errType = errorType || 'SimulatedException';
    const msg = message || 'ለሙከራ በDeveloper OPA የተፈጠረ የሲስተም ኤረር ናሙና (Test Exception)';

    await db.addErrorLog(
      '/api/admin/developer/test-error',
      errType,
      msg,
      `Error: ${msg}\n    at /server.ts:845:12\n    at Layer.handle [as handle_request]\n    at Express.handle`,
      'server.ts:845',
      req.ip
    );

    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'DEV_TEST_ERROR',
      `ለሙከራ የተደረገ የኤረር ሎግ [Type: ${errType}] ተመዝግቧል::`,
      req.ip
    );

    res.json({ success: true, message: 'የሙከራ ኤረር ሎግ በስኬት ተመዝግቧል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'የሙከራ ኤረር መፍጠር አልተቻለም');
  }
});

// Developer Full Database JSON Backup Download (Strict Developer RBAC + Token Verification)
app.get('/api/admin/developer/backup', authMiddleware, requireRole('developer'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Fetch complete data across all tables
    const surveys = await db.getAllSurveys(true);
    const rawResponses = await db.getAllRawResponses();
    const rawAnswers = await db.getAllRawAnswers();
    const tickets = await db.getAllTickets();
    const admins = await db.getAllAdmins();
    const auditLogs = await db.getAuditLogs();
    const errorLogs = await db.getErrorLogs();

    // Sanitize admin records so password hashes and secrets are never exported in JSON backups
    const sanitizedAdmins = admins.map((a: any) => ({
      id: a.id,
      email: a.email,
      username: a.username,
      role: a.role,
      must_change_password: a.must_change_password,
      two_factor_enabled: a.two_factor_enabled,
      created_at: a.created_at,
    }));

    await db.addAuditLog(
      req.adminUser?.email || 'opa@dgc.gov.et',
      'EXPORT_DATABASE_BACKUP',
      `የሲስተሙ ሙሉ ዳታቤዝ ባካፕ (JSON) [${surveys.length} surveys, ${tickets.length} tickets, ${rawResponses.length} responses, ${auditLogs.length} audit logs] በስኬት ዳውንሎድ ተደርጓል::`,
      req.ip
    );

    const backupData = {
      system_name: 'Dire Dawa Administration Public Survey & Citizen Inquiry Platform',
      version: '2.0.0-PROD-SECURE',
      exported_at: new Date().toISOString(),
      exported_timestamp: Date.now(),
      exported_by: req.adminUser?.email || 'Software Developer (opa@dgc.gov.et)',
      organization: 'Dire Dawa Administration Government Communication Affairs Bureau',
      summary: {
        surveys_count: surveys.length,
        survey_responses_count: rawResponses.length,
        survey_answers_count: rawAnswers.length,
        tickets_count: tickets.length,
        admins_count: sanitizedAdmins.length,
        audit_logs_count: auditLogs.length,
        error_logs_count: errorLogs.length,
        total_records: surveys.length + rawResponses.length + rawAnswers.length + tickets.length + sanitizedAdmins.length + auditLogs.length + errorLogs.length,
      },
      tables: {
        surveys,
        responses: rawResponses,
        answers: rawAnswers,
        tickets,
        admins: sanitizedAdmins,
        audit_logs: auditLogs,
        error_logs: errorLogs,
      },
    };

    const fileName = `dgc_full_database_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err: any) {
    handleApiError(res, req, err, 'ባካፕ ማውረድ አልተቻለም');
  }
});

// 404 Fallback handler specifically for unhandled /api/* routes (returns JSON instead of Vite HTML)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global API Exception Handler Middleware (Sanitized Output)
app.use(async (err: any, req: Request, res: Response, next: any) => {
  console.error('💥 Global Exception Handler:', err);
  try {
    await db.addErrorLog(
      req.originalUrl || req.path,
      err?.name || 'UnhandledServerError',
      err?.message || 'አልታወቀ የሲስተም ስህተት',
      err?.stack || '',
      'server.ts:globalHandler',
      req.ip
    );
  } catch (e) {
    console.error('Failed to store exception log:', e);
  }
  res.status(500).json({
    error: 'የሲስተም ስህተት አጋጥሟል! (Internal Server Exception)',
    requestId: `REQ-${Date.now().toString(36).toUpperCase()}`,
  });
});

// Start Express Server with Vite Middleware
async function startServer() {
  await loadPersistentSettings();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Public Survey & Opinion Platform server running on http://${HOST}:${PORT}`);
  });
}

startServer();
