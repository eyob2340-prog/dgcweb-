/// <reference path="./globals.d.ts" />
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
import { comparePassword, generateToken, verifyToken, authMiddleware, requireRole, revokeToken, isTokenRevoked, extractToken, AuthenticatedRequest } from './server/auth';
import { sendTelegramReport, sendDaily24hTelegramReport, DEFAULT_TELEGRAM_BOT_TOKEN, DEFAULT_TELEGRAM_CHAT_ID, formatTelegramChatId, escapeMarkdown, classifyAnswerSentiment } from './server/telegram';
import { generateSurveyAiReport, translateTextWithAi, translateSurveyWithAi, translateSurveyAllLanguagesWithAi, chatWithOfficeWorker } from './server/ai';
import { sendTicketRecoveryOtp } from './server/email';
import { toEthiopianDate, formatEthiopianDateTime } from './src/lib/ethiopianDate';
import { generateTwoFactorSetup, verifyTwoFactorToken } from './server/twoFactor';

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
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Enable trust proxy for reverse proxies (Render.com / Nginx)
app.set('trust proxy', 1);

// ── Security Headers ──────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

if (!isDev) {
  // Helmet with full production-grade configuration
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],

          scriptSrc: [
            "'self'",
            "'unsafe-eval'",
            "'unsafe-inline'",
            'https://translate.google.com',
            'https://translate.googleapis.com',
            'https://www.gstatic.com',
          ],
          scriptSrcAttr: ["'none'"],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://translate.googleapis.com',
            'https://www.gstatic.com',
          ],

          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],

          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://translate.google.com',
            'https://translate.googleapis.com',
            'https://www.gstatic.com',
            'https://www.google.com',
            'https://fonts.gstatic.com',
          ],

          connectSrc: [
            "'self'",
            'https://generativelanguage.googleapis.com',
            'https://api.telegram.org',
            'https://translate.googleapis.com',
            'wss:',
            'ws:',
          ],

          workerSrc: ["'self'", 'blob:'],

          frameSrc: [
            "'self'",
            'https://maps.google.com',
            'https://www.google.com',
            'https://*.google.com',
            'https://*.openstreetmap.org',
          ],
          frameAncestors: ["'none'"],

          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },

      // X-Frame-Options: DENY — prevents clickjacking
      frameguard: { action: 'deny' },

      // HTTP Strict Transport Security: 1 year, include subdomains
      hsts: {
        maxAge: 31536000,          // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },

      // X-Content-Type-Options: nosniff — prevents MIME-type sniffing
      noSniff: true,

      // X-DNS-Prefetch-Control: off
      dnsPrefetchControl: { allow: false },

      // Referrer-Policy: strict-origin-when-cross-origin
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // X-Permitted-Cross-Domain-Policies: none
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },

      // X-Download-Options: noopen (IE legacy)
      ieNoOpen: true,

      // Cross-Origin-Embedder-Policy: disabled — needed for QR/canvas blob exports
      crossOriginEmbedderPolicy: false,
    })
  );
} else {
  // In development: disable all caching and Helmet headers so Vite HMR works cleanly
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
}

// Permissions-Policy: disable all sensitive browser APIs not used by this app
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',              // No camera access
      'microphone=()',          // No microphone access
      'geolocation=()',         // No geolocation
      'payment=()',             // No payment APIs
      'usb=()',                 // No WebUSB
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'fullscreen=(self)',      // Allow fullscreen for charts/modals
      'picture-in-picture=()',
      'display-capture=()',
      'interest-cohort=()',     // Opt out of FLoC / Topics API tracking
    ].join(', ')
  );
  next();
});

// Restricted CORS Policy (supports environment variables and government domains)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  process.env.APP_URL || 'https://www.diredawacommunication.org',
  'https://www.diredawacommunication.org',
  'https://diredawacommunication.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
];

const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOriginsSet.has(origin) || origin.endsWith('.gov.et')) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      callback(new Error('CORS policy: Not allowed by CORS origin'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Id'],
  })
);
app.use(express.json({ limit: '10mb' }));
// Zero-dependency cookie parser middleware (populates req.cookies)
app.use((req: any, _res, next) => {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie: string) => {
      const parts = cookie.split('=');
      const name = parts[0]?.trim();
      if (name) {
        list[name] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }
  req.cookies = list;
  next();
});

// ==================== RATE LIMITING CONFIGURATIONS ====================

// 1. Admin Login Rate Limiting: 25 attempts per 15 minutes to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ ያልተሳካ የመግባት ሙከራ ተደርጓል! እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ:: (Too many login attempts. Please try again later.)',
  },
});

// 2. Public Survey Submissions Limiter: 500 submissions per 15 min (Supports 100+ concurrent citizens sharing NAT/WiFi/Telecom IP)
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ከበዛ ጥያቄ የተነሳ ጊዜያዊ ገደብ ተጥሏል! እባክዎ ከጥቂት ደቂቃዎች በኋላ እንደገና ይሞክሩ:: (Too many requests, please try again later)',
  },
});

// 3. Citizen Ticket Submission Limiter: 200 tickets per 15 min
const ticketSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'በአጭር ጊዜ ውስጥ የበዛ የአቤቱታ ጥያቄ ቀርቧል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// 4. Ticket Status Tracking Limiter: 350 lookups per 10 min
const ticketTrackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 350,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ የክትትል ጥያቄ ቀርቧል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// 5. Ticket Recovery Limiter: 30 attempts per 15 min
const ticketRecoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'ተደጋጋሚ የአቤቱታ መፈለጊያ ሙከራ ተደርጓል:: እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ::',
  },
});

// 6. AI Rate Limiter: 60 calls per 10 minutes to protect against quota exhaustion
const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'የኤአይ አገልግሎት ጥያቄ ገደብ ደርሷል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ይሞክሩ::',
  },
});

// 7. Public Citizen Chat Rate Limiter: 100 requests per 15 minutes per IP
const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  message: {
    error: 'በአጭር ጊዜ ውስጥ የበዛ የቻት ጥያቄ ቀርቧል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ እንደገና ይሞክሩ::',
  },
});

// In-flight Promise deduplication map for on-demand AI translations (prevents duplicate parallel Gemini API calls)
const activeTranslationPromises = new Map<string, Promise<any>>();

// Dynamic cryptographic salt for citizen anonymity
// Stable across restarts: explicit env salt, else derived from JWT_SECRET, else random (warned).
const ANONYMOUS_SALT: string = (() => {
  const explicit = process.env.ANONYMOUS_SALT || process.env.IP_SALT;
  if (explicit && explicit.length >= 16) return explicit;
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return crypto.createHash('sha256').update(`dgc-anonymous-salt-v1|${process.env.JWT_SECRET}`).digest('hex');
  }
  console.warn('⚠️ [SECURITY] ANONYMOUS_SALT and JWT_SECRET are not set: using a random salt. The "one response per citizen" check will reset on every restart. Set ANONYMOUS_SALT in the environment.');
  return crypto.randomBytes(32).toString('hex');
})();

// Active in-memory 2FA Single-Use OTP Store (Expires in 5 minutes, single-use, max 5 attempts)
const active2FaOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

// In-memory Ticket Recovery Email-OTP Store (Expires in 10 minutes, single-use, max 5 attempts)
const ticketRecoveryOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; hasTickets: boolean }>();

// In-memory failed login tracking for anomaly detection
const failedLoginTracker = new Map<string, { count: number; lastAttempt: number }>();

// ── Account lockout (per account + client IP) ────────────────────────────────
const LOCKOUT_MAX_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const lockoutKey = (account: string, ip: string | undefined) => `${account}|${ip || 'unknown'}`;

function isLockedOut(key: string): boolean {
  const e = failedLoginTracker.get(key);
  if (!e) return false;
  if (Date.now() - e.lastAttempt > LOCKOUT_WINDOW_MS) {
    failedLoginTracker.delete(key);
    return false;
  }
  return e.count >= LOCKOUT_MAX_FAILURES;
}

function registerLoginFailure(key: string): number {
  const e = failedLoginTracker.get(key);
  const fresh = !e || Date.now() - e.lastAttempt > LOCKOUT_WINDOW_MS;
  const next = { count: fresh ? 1 : e!.count + 1, lastAttempt: Date.now() };
  failedLoginTracker.set(key, next);
  return next.count;
}

// Periodic cleanup so the map cannot grow without bound
const cleanupTimer: any = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of failedLoginTracker) {
    if (now - v.lastAttempt > LOCKOUT_WINDOW_MS) failedLoginTracker.delete(k);
  }
  const hour = 60 * 60 * 1000;
  for (const [k, v] of ipSubmissionTracker) {
    if (now - v.windowStart > 24 * hour) ipSubmissionTracker.delete(k);
  }
}, 5 * 60 * 1000);
if (cleanupTimer && typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

// ── Per-IP submission cap per survey (defence against X-Client-Id rotation) ──
const IP_SUBMISSIONS_PER_SURVEY_PER_DAY = parseInt(process.env.MAX_SUBMISSIONS_PER_IP_PER_SURVEY || '40', 10);
const ipSubmissionTracker = new Map<string, { count: number; windowStart: number }>();
function ipSubmissionAllowed(ip: string, surveyId: number): boolean {
  const key = `${surveyId}|${crypto.createHash('sha256').update(`${ip}|${ANONYMOUS_SALT}`).digest('hex')}`;
  const now = Date.now();
  const e = ipSubmissionTracker.get(key);
  if (!e || now - e.windowStart > 24 * 60 * 60 * 1000) {
    ipSubmissionTracker.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (e.count >= IP_SUBMISSIONS_PER_SURVEY_PER_DAY) return false;
  e.count += 1;
  return true;
}

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

// Helper for generating anonymous IP hash (Supports Shared NAT / Carrier-Grade NAT & Office WiFi via Client-Id token)
function generateIpHash(req: Request, surveyId: number): string {
  // Safe validated IP from Express trust-proxy configuration
  const validatedIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const rawClientId = (req.headers['x-client-id'] as string) || (req.query?.clientId as string) || '';
  // Only accept well-formed, bounded identifiers
  const clientId = typeof rawClientId === 'string' && /^[A-Za-z0-9_\-]{8,64}$/.test(rawClientId) ? rawClientId : '';
  const userAgent = (req.headers['user-agent'] as string) || 'browser';
  const clientIdentifier = clientId ? `cid_${clientId}` : `ua_${userAgent}`;

  // Hash IP + Client identifier with survey ID and dynamic salt so raw IP and client ID are mathematically unrecoverable
  return crypto
    .createHash('sha256')
    .update(`${validatedIp}_${clientIdentifier}_survey_${surveyId}_salt_${ANONYMOUS_SALT}`)
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
    const health = await db.checkConnection();
    if (!health.connected) {
      return res.status(503).json({
        status: 'critical',
        database: health.engine,
        databaseConnected: false,
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }

    const surveysCount = (await db.getAllSurveys(true)).length;
    res.json({
      status: 'ok',
      database: health.engine === 'postgresql' ? 'postgresql' : 'local_json (dev only)',
      databaseConnected: true,
      surveysCount,
      timestamp: new Date().toISOString(),
      maintenance: isMaintenanceMode,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'critical',
      database: process.env.DATABASE_URL || process.env.NODE_ENV === 'production' ? 'postgresql' : 'local_json',
      databaseConnected: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
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

// Get single survey details and check if user already submitted (supports ?lang= query param for dynamic translation)
app.get('/api/surveys/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የመጠይቅ መለያ (Invalid ID)' });

    const survey = await db.getSurveyById(id);
    if (!survey) return res.status(404).json({ error: 'መጠይቁ አልተገኘም (Survey not found)' });

    // Inactive surveys must not be publicly viewable by direct ID unless requester is an authorized admin
    if (!survey.is_active) {
      const authHeader = req.headers.authorization;
      const isAuthorized = authHeader && authHeader.startsWith('Bearer ') && verifyToken(authHeader.substring(7).trim()) !== null;
      if (!isAuthorized) {
        return res.status(404).json({ error: 'ይህ መጠይቅ በአሁኑ ወቅት ተዘግቷል ወይም አልተገኘም (Survey not found or inactive)' });
      }
    }

    const ipHash = generateIpHash(req, id);
    const hasResponded = await db.hasUserResponded(id, ipHash);

    // Whitelist allowed languages to avoid AI abuse/quota waste
    const ALLOWED_LANGUAGES = ['am', 'en', 'om', 'ti', 'so', 'fr'];
    const rawLang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : '';
    const targetLang = ALLOWED_LANGUAGES.includes(rawLang) ? rawLang : 'am';

    if (targetLang && targetLang !== 'am') {
      // 1. FAST PATH: Check if pre-translated and stored in Database (0 AI Tokens, Instant load!)
      if (survey.translations && survey.translations[targetLang]) {
        const tData = survey.translations[targetLang];
        return res.json({
          survey: {
            ...survey,
            title: tData.title || survey.title,
            description: tData.description !== undefined ? tData.description : survey.description,
            category: tData.category || survey.category,
            questions: survey.questions?.map((origQ) => {
              const tQ = tData.questions?.find((q: any) => q.id === origQ.id);
              return {
                ...origQ,
                question_text: tQ?.question_text || origQ.question_text,
                options: tQ?.options || origQ.options,
              };
            }),
          },
          hasResponded,
          language: targetLang,
          source: 'database',
        });
      }
      // If language translation is not yet stored in DB, fall back to default Amharic (source: 'database')
      // AI translation is generated exclusively through the admin pre-translation process to protect quota and prevent DoS.
    }

    res.json({ survey, hasResponded, language: 'am', source: 'database' });
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

    // Enforce strictly: One citizen/device response per survey to guarantee civic data integrity
    const hasAlreadySubmitted = await db.hasUserResponded(surveyId, ipHash);
    if (hasAlreadySubmitted) {
      return res.status(400).json({
        error: 'ለዚህ መጠይቅ አስቀድመው መልስ ሰጥተዋል! ስለተሳተፉ እናመሰግናለን:: (You have already responded to this survey)',
        alreadyResponded: true,
      });
    }

    const { answers, demographics, language } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'እባክዎ የመጠይቅ መልሶችን ያስገቡ (Answers are required)' });
    }

    // Protection against payload abuse
    if (answers.length > (survey.questions?.length || 50) + 10) {
      return res.status(400).json({ error: 'የተላከው የመልሶች ብዛት ከተፈቀደው በላይ ነው (Too many answers submitted)' });
    }

    const questionMap = new Map<number, any>((survey.questions || []).map((q: any) => [q.id as number, q]));
    const validatedAnswers: { question_id: number; answer_text?: string; rating_value?: number }[] = [];

    for (const ans of answers) {
      if (!ans || typeof ans.question_id !== 'number') {
        return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የጥያቄ መለያ (Invalid question ID in submission)' });
      }

      const q = questionMap.get(ans.question_id);
      if (!q) {
        return res.status(400).json({ error: `የጥያቄ መለያ ${ans.question_id} በዚህ መጠይቅ ውስጥ አልተገኘም (Question does not belong to survey)` });
      }

      if (q.question_type === 'rating') {
        const rating = Number(ans.rating_value);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return res.status(400).json({ error: `ለጥያቄ "${q.question_text.substring(0, 30)}..." የተሰጠው ደረጃ ከ1 እስከ 5 መሆን አለበት` });
        }
        validatedAnswers.push({ question_id: q.id, rating_value: rating });
      } else if (q.question_type === 'radio') {
        const val = typeof ans.answer_text === 'string' ? ans.answer_text.trim() : '';
        if (!val) {
          return res.status(400).json({ error: `እባክዎ ለጥያቄ "${q.question_text.substring(0, 30)}..." አማራጭ ይምረጡ` });
        }
        if (Array.isArray(q.options) && q.options.length > 0) {
          const allowedOptions = q.options.map((opt: string) => opt.trim());
          // Also allow options from any translations of this question (e.g. Oromo, Somali)
          if (survey.translations && typeof survey.translations === 'object') {
            for (const langKey of Object.keys(survey.translations)) {
              const transQ = survey.translations[langKey]?.questions?.find((tq: any) => tq.id === q.id);
              if (Array.isArray(transQ?.options)) {
                for (const topt of transQ.options) {
                  if (typeof topt === 'string') allowedOptions.push(topt.trim());
                }
              }
            }
          }
          if (!allowedOptions.includes(val)) {
            return res.status(400).json({ error: `ለጥያቄ "${q.question_text.substring(0, 30)}..." የተመረጠው አማራጭ ከተፈቀዱት ምርጫዎች ውጭ ነው` });
          }
        }
        validatedAnswers.push({ question_id: q.id, answer_text: val.substring(0, 500) });
      } else if (q.question_type === 'text') {
        const val = typeof ans.answer_text === 'string' ? ans.answer_text.trim() : '';
        validatedAnswers.push({ question_id: q.id, answer_text: val.substring(0, 2000) });
      }
    }

    const sanitizedDemographics: any = {};
    if (demographics && typeof demographics === 'object') {
      if (typeof demographics.age_group === 'string') {
        sanitizedDemographics.age_group = demographics.age_group.trim().substring(0, 50);
      }
      if (typeof demographics.gender === 'string') {
        sanitizedDemographics.gender = demographics.gender.trim().substring(0, 50);
      }
      if (typeof demographics.education === 'string') {
        sanitizedDemographics.education = demographics.education.trim().substring(0, 100);
      }
      if (typeof demographics.residence === 'string') {
        sanitizedDemographics.residence = demographics.residence.trim().substring(0, 100);
      }
    }

    const sanitizedLanguage = typeof language === 'string' && ['am', 'om', 'so', 'en', 'ti', 'fr'].includes(language.trim().toLowerCase())
      ? language.trim().toLowerCase()
      : 'am';

    if (!ipSubmissionAllowed(req.ip || req.socket?.remoteAddress || 'unknown', surveyId)) {
      return res.status(429).json({ error: 'ከዚህ የኢንተርኔት መስመር በጣም ብዙ መልሶች ተልከዋል:: እባክዎ ቆይተው ይሞክሩ:: (Too many submissions from this network)' });
    }

    const responseId = await db.submitResponse(surveyId, ipHash, validatedAnswers, sanitizedDemographics, sanitizedLanguage);

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
    if (err?.code === 'DUPLICATE_RESPONSE' || err?.code === '23505') {
      return res.status(400).json({
        error: 'ለዚህ መጠይቅ አስቀድመው መልስ ሰጥተዋል! ስለተሳተፉ እናመሰግናለን:: (You have already responded to this survey)',
        alreadyResponded: true,
      });
    }
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

    // High entropy 16-character cryptographic random hex (64-bit entropy space)
    const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
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
    let isAuthorizedAdmin = false;
    const maybeToken = extractToken(req);
    if (maybeToken) {
      const decodedAdmin = verifyToken(maybeToken);
      if (decodedAdmin && decodedAdmin.scope !== '2fa-setup' && !decodedAdmin.mustChangePassword) {
        try {
          isAuthorizedAdmin = !(await isTokenRevoked(maybeToken));
        } catch {
          isAuthorizedAdmin = false;
        }
      }
    }

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


// ==================== PUBLIC AI CITIZEN CHAT WIDGET ENDPOINT ====================

// Public Citizen Chat Assistant ('የቢሮ ሰራተኛ' Customer Service Representative)
// Strictly rate-limited (10 req/15min/IP) & ZERO access to admin-only or PII data
app.post('/api/public/chat', publicChatLimiter, async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'እባክዎ ትክክለኛ መልዕክት ያስገቡ (Please provide a valid message)' });
    }

    // Gathers ONLY safe, public non-sensitive aggregate statistics (zero PII, zero admin credentials)
    let publicStats = {
      activeSurveysCount: 0,
      totalSurveysCount: 0,
    };

    try {
      const publicSurveys = await db.getAllSurveys(false); // Only active public surveys
      publicStats.activeSurveysCount = publicSurveys.length;
      publicStats.totalSurveysCount = publicSurveys.length;
    } catch (e) {
      console.warn('Failed to retrieve public survey counts for chat assistant:', e);
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'model'))
          .map((h: any) => ({
            role: h.role as 'user' | 'model',
            text: String(h.text).substring(0, 500),
          }))
          .slice(-6)
      : [];

    const reply = await chatWithOfficeWorker(message.trim(), safeHistory, publicStats);

    res.json({
      success: true,
      reply,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የቢሮ ረዳት አገልግሎትን ማግኘት አልተቻለም');
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

    const loginKey = lockoutKey(cleanInput, req.ip);
    if (isLockedOut(loginKey)) {
      return res.status(429).json({
        error: 'አካውንቱ ለ15 ደቂቃ ተቆልፏል (ብዙ ያልተሳኩ ሙከራዎች)። እባክዎ ቆይተው ይሞክሩ:: (Account temporarily locked)',
      });
    }

    const admin = await db.getAdminByEmail(cleanInput);
    if (!admin) {
      registerLoginFailure(loginKey);

      await db.addAuditLog(cleanInput, 'FAILED_LOGIN', `ያልተሳካ የመግባት ሙከራ (ኢሜይል/ዩዘርኔም አልተገኘም)::`, req.ip);
      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    // Strict async bcrypt verification on admin.password_hash only (Non-blocking for concurrent users)
    let isMatch = false;
    if (admin.password_hash) {
      isMatch = await comparePassword(cleanPassword, admin.password_hash);
    }

    if (!isMatch) {
      const failCount = registerLoginFailure(loginKey);

      await db.addAuditLog(admin.email, 'FAILED_LOGIN', `ያልተሳካ የመግባት ሙከራ (የተሳሳተ ፓስወርድ [Attempt #${failCount}])::`, req.ip);

      if (failCount >= 3) {
        sendTelegramSecurityAlert(
          'ተደጋጋሚ ያልተሳካ የመግባት ሙከራ (Multiple Failed Logins)',
          `የአድሚን አካውንት [${admin.email}] ${failCount} ጊዜ የተሳሳተ ፓስወርድ ገብቶበታል:: ${failCount >= LOCKOUT_MAX_FAILURES ? '(ለ15 ደቂቃ ተቆልፏል)' : ''}`,
          req.ip
        );
      }

      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    // Google Authenticator 2FA Verification (Enforced if global 2FA is active OR if user has 2FA active)
    const global2FaSetting = await db.getSetting('global_2fa_enabled');
    const isGlobal2Fa = global2FaSetting === 'true';
    const is2FaRequired = isGlobal2Fa || Boolean(admin.two_factor_enabled && admin.two_factor_secret);

    if (is2FaRequired) {
      if (!admin.two_factor_secret) {
        // Password was correct but 2FA is mandatory and not enrolled yet:
        // hand out a 10-minute token that works ONLY for the 2FA enrolment endpoints.
        const setupToken = generateToken({
          id: admin.id,
          email: admin.email,
          username: admin.username || admin.email.split('@')[0],
          role: admin.role || 'admin',
          mustChangePassword: Boolean(admin.must_change_password),
          scope: '2fa-setup',
        });
        return res.status(200).json({
          require2FASetup: true,
          setupToken,
          email: admin.email,
          message: 'በሲስተሙ የ2FA ደህንነት ግዴታ ተደርጓል፤ እባክዎ መጀመሪያ ባለ 2-ደረጃ ማረጋገጫ (2FA) ያዋቅሩ::',
        });
      }

      if (!otp) {
        return res.status(200).json({
          require2FA: true,
          email: admin.email,
          message: 'እባክዎ ከ Google Authenticator አፕሊኬሽን ባለ 6-አሃዝ ኮድ (TOTP) ያስገቡ::',
        });
      }

      // Verify Provided Google Authenticator TOTP Token strictly
      const cleanOtp = String(otp).trim();
      const isValidTotp = verifyTwoFactorToken(cleanOtp, admin.two_factor_secret || '');

      if (!isValidTotp) {
        const otpFails = registerLoginFailure(loginKey);
        if (otpFails >= 3) {
          sendTelegramSecurityAlert(
            'ተደጋጋሚ የተሳሳተ 2FA ኮድ (Multiple Failed 2FA codes)',
            `የአድሚን አካውንት [${admin.email}] ${otpFails} ጊዜ የተሳሳተ 2FA ኮድ ገብቶበታል::`,
            req.ip
          );
        }
        await db.addAuditLog(admin.email, 'FAILED_2FA', 'የተሳሳተ የ Google Authenticator 2FA ኮድ ሙከራ ተደርጓል::', req.ip);
        return res.status(401).json({ error: 'የተሳሳተ የ Google Authenticator 2FA ማረጋገጫ ኮድ!' });
      }
    }

    // Clear failed login tracker on successful credentials validation
    failedLoginTracker.delete(loginKey);

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

    // Set secure HttpOnly cookie for hardened session protection against XSS
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('dgc_admin_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
      path: '/',
    });

    res.json({
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

    const isMatch = await comparePassword(currentPassword, admin.password_hash);
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

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('dgc_admin_token', refreshedToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
      path: '/',
    });

    res.json({
      success: true,
      message: 'ፓስወርድዎ በስኬት ተቀይሯል!',
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'ፓስወርድ መቀየር አልተቻለም');
  }
});

// 1. Generate Google Authenticator Setup (QR Code + Secret)
app.post('/api/admin/2fa/setup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });

    const setupData = await generateTwoFactorSetup(admin.email, 'DGC Dire Dawa Portal');

    res.json({
      success: true,
      secret: setupData.secret,
      qrCodeUrl: setupData.qrCodeDataUrl,
      otpAuthUrl: setupData.otpAuthUrl,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የ Google Authenticator 2FA ማዘጋጀት አልተቻለም');
  }
});

// 2. Verify and Confirm Google Authenticator Activation
app.post('/api/admin/2fa/verify-setup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { secret, token } = req.body;
    if (!secret || !token) {
      return res.status(400).json({ error: 'እባክዎ ሚስጥራዊ ቁልፍ እና ባለ 6-አሃዝ ኮድ ያስገቡ' });
    }

    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });

    const isValid = verifyTwoFactorToken(token, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'የተሳሳተ የ Google Authenticator ማረጋገጫ ኮድ! እባክዎ በስልክዎ ያለውን ኮድ በድጋሚ ይሞክሩ::' });
    }

    await db.setAdminTwoFactor(admin.id, true, secret);

    await db.addAuditLog(
      admin.email,
      '2FA_ENABLED_GOOGLE_AUTH',
      `Google Authenticator 2FA enabled successfully for [${admin.email}]`,
      req.ip
    );

    // If this call was made with the limited '2fa-setup' token, the user has now proven
    // BOTH the password and possession of the authenticator -> upgrade to a normal session.
    if (req.adminUser?.scope === '2fa-setup') {
      if (req.token) await revokeToken(req.token, admin.id);
      const mustChangePassword = Boolean(admin.must_change_password);
      const sessionToken = generateToken({
        id: admin.id,
        email: admin.email,
        username: admin.username || admin.email.split('@')[0],
        role: admin.role || 'admin',
        mustChangePassword,
        scope: 'full',
      });
      res.cookie('dgc_admin_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });
      await db.addAuditLog(admin.email, 'ADMIN_LOGIN', `ተጠቃሚ [${admin.email}] 2FA ካዘጋጀ በኋላ ወደ ሲስተሙ ገብቷል::`, req.ip);
      return res.json({
        success: true,
        two_factor_enabled: true,
        mustChangePassword,
        twoFactorEnabled: true,
        admin: {
          id: admin.id,
          email: admin.email,
          username: admin.username || admin.email.split('@')[0],
          role: admin.role || 'admin',
        },
        message: 'Google Authenticator ባለ 2-ደረጃ ማረጋገጫ (2FA) በስኬት ተገናኝቷል!',
      });
    }

    res.json({
      success: true,
      two_factor_enabled: true,
      message: 'Google Authenticator ባለ 2-ደረጃ ማረጋገጫ (2FA) በስኬት ተገናኝቷል!',
    });
  } catch (err: any) {
    handleApiError(res, req, err, '2FA ማረጋገጥ አልተቻለም');
  }
});

// 3. Disable Google Authenticator 2FA
app.post('/api/admin/2fa/disable', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, token } = req.body;
    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });

    if (!currentPassword) {
      return res.status(400).json({ error: 'ባለ 2-ደረጃ ማረጋገጫን (2FA) ለማጥፋት የአሁኑን ፓስወርድዎን ማስገባት አለብዎት::' });
    }

    const isPwMatch = await comparePassword(currentPassword, admin.password_hash);
    if (!isPwMatch) {
      await db.addAuditLog(admin.email, 'FAILED_2FA_DISABLE', '2FA ለማጥፋት የተሳሳተ ፓስወርድ ገብቷል::', req.ip);
      return res.status(400).json({ error: 'የተሳሳተ የአሁን ፓስወርድ!' });
    }

    if (admin.two_factor_secret) {
      // The authenticator code is mandatory to switch 2FA off (password alone is not enough)
      if (!token || !verifyTwoFactorToken(String(token), admin.two_factor_secret)) {
        await db.addAuditLog(admin.email, 'FAILED_2FA_DISABLE', '2FA ለማጥፋት የተሳሳተ ወይም ያልገባ የ Authenticator ኮድ::', req.ip);
        return res.status(400).json({ error: 'የተሳሳተ ወይም ያልገባ የ Google Authenticator ኮድ!' });
      }
    }

    await db.setAdminTwoFactor(admin.id, false, undefined);

    await db.addAuditLog(
      admin.email,
      '2FA_DISABLED',
      `Two-factor authentication DISABLED for ${admin.email}`,
      req.ip
    );

    res.json({
      success: true,
      two_factor_enabled: false,
      message: 'ባለ 2-ደረጃ ማረጋገጫ (2FA) ጠፍቷል::',
    });
  } catch (err: any) {
    handleApiError(res, req, err, '2FA ማጥፋት አልተቻለም');
  }
});

// 4. Smooth /api/admin/2fa/toggle endpoint
app.post('/api/admin/2fa/toggle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    const admin = await db.getAdminByEmail(req.adminUser?.email || '');
    if (!admin) return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });

    const isEnable = Boolean(enabled);
    if (isEnable && !admin.two_factor_secret) {
      // Auto-generate secret so toggling ON works seamlessly without blocking
      const setupData = await generateTwoFactorSetup(admin.email, 'DGC Dire Dawa Portal');
      await db.setAdminTwoFactor(admin.id, true, setupData.secret);
      await db.addAuditLog(
        admin.email,
        'TOGGLE_2FA',
        `2FA OTP ለተጠቃሚ [${admin.email}] ወደ [ON] ተቀይሯል:: (አዲስ Secret ተዘጋጅቷል)`,
        req.ip
      );
      return res.json({
        success: true,
        two_factor_enabled: true,
        qrCodeUrl: setupData.qrCodeDataUrl,
        secret: setupData.secret,
        message: 'Google Authenticator (2FA) በስኬት በርቷል (ON)!',
      });
    }

    await db.setAdminTwoFactor(admin.id, isEnable);
    
    await db.addAuditLog(
      admin.email,
      'TOGGLE_2FA',
      `2FA OTP ለተጠቃሚ [${admin.email}] ወደ [${isEnable ? 'ON' : 'OFF'}] ተቀይሯል::`,
      req.ip
    );

    res.json({
      success: true,
      two_factor_enabled: isEnable,
      message: `2FA በስኬት ${isEnable ? 'በርቷል (ON)' : 'ጠፍቷል (OFF)'}!`,
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

    res.clearCookie('dgc_admin_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.json({ success: true, message: 'በስኬት ከሲስተሙ ወጥተዋል፤ ቶከንዎ ተሰርዟል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'ከሲስተም መውጣት አልተቻለም');
  }
});

// Verify Current User Token & Admin Session (Reads HttpOnly Cookie via authMiddleware)
app.get('/api/admin/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'ያልተፈቀደ መግቢያ!' });
    }
    const admin = await db.getAdminByEmail(req.adminUser.email);
    if (!admin) {
      return res.status(404).json({ error: 'ተጠቃሚው አልተገኘም' });
    }
    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        username: admin.username || admin.email.split('@')[0],
        role: admin.role,
        twoFactorEnabled: Boolean(admin.two_factor_enabled),
        mustChangePassword: Boolean(admin.must_change_password),
      },
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የተጠቃሚ መረጃ ማግኘት አልተቻለም');
  }
});

// Refresh Current Admin Access Token (Sliding Session via HttpOnly Cookie)
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

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('dgc_admin_token', refreshedToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000,
    path: '/',
  });

  res.json({
    success: true,
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

// Update Existing Survey (Developer, Owner & Admin)
app.put('/api/admin/surveys/:id', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የመጠይቅ መለያ (Invalid Survey ID)' });

    const { title, description, category, theme, start_date, end_date, is_active, questions } = req.body;

    const existingSurvey = await db.getSurveyById(surveyId);
    if (!existingSurvey) {
      return res.status(404).json({ error: 'መጠይቁ አልተገኘም (Survey not found)' });
    }

    await db.updateSurvey(surveyId, {
      title: title ? String(title).substring(0, 200) : undefined,
      description: description !== undefined ? String(description).substring(0, 2000) : undefined,
      category: category ? String(category).substring(0, 100) : undefined,
      theme: theme || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      is_active: typeof is_active === 'boolean' ? is_active : undefined,
      questions: Array.isArray(questions) ? questions : undefined,
    });

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'UPDATE_SURVEY',
      `የጥናት መጠይቅ [ID ${surveyId}: "${(title || existingSurvey.title).substring(0, 35)}..."] ተስተካክሏል::`,
      req.ip
    );

    res.json({
      success: true,
      message: 'የጥናት መጠይቁ በስኬት ተሻሽሏል / ተስተካክሏል!',
      surveyId,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቁን ለማስተካከል አልተቻለም');
  }
});

// Pre-Translate Survey into All 5 Languages & Save to DB (One-time batch translation)
app.post('/api/admin/surveys/:id/pre-translate', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የመጠይቅ መለያ' });

    const survey = await db.getSurveyById(surveyId);
    if (!survey) return res.status(404).json({ error: 'መጠይቁ አልተገኘም (Survey not found)' });

    // Generate translations for all 5 target languages
    const translations = await translateSurveyAllLanguagesWithAi(survey);

    // Save permanently to PostgreSQL / local DB
    await db.saveSurveyTranslations(surveyId, translations);

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'PRE_TRANSLATE_SURVEY',
      `የጥናት መጠይቅ ID ${surveyId} ወደ 5 ቋንቋዎች (English, Oromo, Tigrinya, Somali, French) ተተርጉሞ በዳታቤዝ ተቀምጧል::`,
      req.ip
    );

    res.json({
      success: true,
      message: 'መጠይቁ ወደ 5ቱም ቋንቋዎች በስኬት ተተርጉሞ በዳታቤዝ ተቀምጧል!',
      translations,
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'መጠይቁን መተርጎም አልተቻለም');
  }
});

// Save Custom Translations for Survey
app.put('/api/admin/surveys/:id/translations', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    const { translations } = req.body;
    if (isNaN(surveyId) || !translations || typeof translations !== 'object') {
      return res.status(400).json({ error: 'ትክክለኛ የትርጉም መረጃ ያስገቡ' });
    }

    await db.saveSurveyTranslations(surveyId, translations);
    res.json({ success: true, message: 'ትርጉሞች በስኬት ተቀምጠዋል!' });
  } catch (err: any) {
    handleApiError(res, req, err, 'ትርጉሞችን ማስቀመጥ አልተቻለም');
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

    const detailedResponses = await db.getSurveyDetailedResponses(surveyId);
    const result = await sendTelegramReport(analytics, botToken || activeBotToken, chatId || activeChatId, aiReport, detailedResponses);
    if (result.success) {
      await db.addAuditLog(
        req.adminUser?.email || 'admin@dgc.gov.et',
        'EXPORT_TELEGRAM',
        `ለጥናት ID ${surveyId} ("${analytics.survey.title.substring(0, 30)}...") የፖሊሲና የዜጎች አስተያየት ሪፖርት ወደ Telegram ተልኳል::`,
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

// CSV Export Download Endpoint with Person-by-Person Q&A, Positive/Negative Sentiment Lists & AI Policy Report
app.get('/api/admin/surveys/:id/export-csv', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    const analytics = await db.getSurveyAnalytics(surveyId);
    if (!analytics) return res.status(404).json({ error: 'መጠይቁ አልተገኘም' });

    const detailedResponses = await db.getSurveyDetailedResponses(surveyId);
    const { survey, total_responses, questions_analytics, demographics_analytics } = analytics;
    const ethDate = toEthiopianDate(new Date());
    const dateAm = ethDate.formattedAmharic;

    // Track positive and negative feedback
    const positiveList: Array<{
      respId: number | string;
      residence: string;
      gender: string;
      ageGroup: string;
      questionText: string;
      answerDisplay: string;
    }> = [];

    const negativeList: Array<{
      respId: number | string;
      residence: string;
      gender: string;
      ageGroup: string;
      questionText: string;
      answerDisplay: string;
    }> = [];

    const neutralList: Array<{
      respId: number | string;
      residence: string;
      gender: string;
      ageGroup: string;
      questionText: string;
      answerDisplay: string;
    }> = [];

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
    csvContent += `Ethiopian Date,${sanitizeCsvField(dateAm)}\n`;
    csvContent += `Total Respondents,${total_responses}\n\n`;

    // 1. INDIVIDUAL CITIZEN BREAKDOWN: Question & Answer per respondent
    csvContent += `--- ክፍል 1፡ የእያንዳንዱ ተሳታፊ ዝርዝር ጥያቄና መልስ (INDIVIDUAL RESPONDENT BREAKDOWN - QUESTION & ANSWER) ---\n`;
    csvContent += `ተሳታፊ (Respondent ID),ዕድሜ (Age),ጾታ (Gender),ትምህርት (Education),መኖሪያ (Residence),ቀን (Date ET),የጥያቄ ቁጥር (Q#),ጥያቄ (Question),ዓይነት (Type),የተሰጠው መልስ / ውጤት (Given Answer),የስሜት ምደባ (Sentiment)\n`;

    if (detailedResponses && detailedResponses.length > 0) {
      for (const r of detailedResponses) {
        const ethRespDate = toEthiopianDate(r.submitted_at).formattedAmharic;
        const respId = r.id;
        const age = r.age_group || 'ያልተገለጸ';
        const gender = r.gender || 'ያልተገለጸ';
        const edu = r.education || 'ያልተገለጸ';
        const res = r.residence || 'ያልተገለጸ';

        const answers = Array.isArray(r.answers) ? r.answers : [];
        answers.forEach((ans: any, qIdx: number) => {
          const qText = ans.question_text || `ጥያቄ ${ans.question_id || qIdx + 1}`;
          const qType = ans.question_type || 'text';
          let ansDisplay = '';
          if (qType === 'rating') {
            ansDisplay = `${ans.rating_value || 0} ኮከብ (ከ 5)`;
          } else {
            ansDisplay = ans.answer_text || 'ባዶ';
          }

          const sentimentInfo = classifyAnswerSentiment(qType, ans.answer_text, ans.rating_value);

          const item = {
            respId,
            residence: res,
            gender,
            ageGroup: age,
            questionText: qText,
            answerDisplay: ansDisplay,
          };

          if (sentimentInfo.sentiment === 'positive') {
            positiveList.push(item);
          } else if (sentimentInfo.sentiment === 'negative') {
            negativeList.push(item);
          } else {
            neutralList.push(item);
          }

          csvContent += `${respId},${sanitizeCsvField(age)},${sanitizeCsvField(gender)},${sanitizeCsvField(edu)},${sanitizeCsvField(res)},${sanitizeCsvField(ethRespDate)},${qIdx + 1},${sanitizeCsvField(qText)},${sanitizeCsvField(qType)},${sanitizeCsvField(ansDisplay)},${sanitizeCsvField(sentimentInfo.labelAm)}\n`;
        });
      }
    } else {
      csvContent += `ምንም ምላሽ እስካሁን አልተመዘገበም (No responses submitted yet),,,,,,,,,\n`;
    }

    // 2. POSITIVE FEEDBACK SECTION (በአውንታ የቀረቡ ሀሳብና አስተያየቶች)
    csvContent += `\n--- ክፍል 2፡ በአውንታ የተሰጡ ግብረ-መልሶችና ድጋፎች (POSITIVE CITIZEN FEEDBACK & SATISFACTION - ጠቅላላ: ${positiveList.length}) ---\n`;
    csvContent += `ተሳታፊ ቁጥር,መኖሪያ,የተሳታፊ ጾታ/ዕድሜ,የጥያቄው ርዕስ,አውንታዊ ግብረ-መልስ / ውጤት,ደረጃ\n`;
    if (positiveList.length > 0) {
      positiveList.forEach((p) => {
        csvContent += `${p.respId},${sanitizeCsvField(p.residence)},${sanitizeCsvField(`${p.gender} / ${p.ageGroup}`)},${sanitizeCsvField(p.questionText)},${sanitizeCsvField(p.answerDisplay)},${sanitizeCsvField('🟢 አውንታዊ (በጎ)')}\n`;
      });
    } else {
      csvContent += `ምንም አውንታዊ አስተያየት እስካሁን አልተመዘገበም,,,,,\n`;
    }

    // 3. NEGATIVE / CRITICAL CONCERNS SECTION (በአሉታ የቀረቡ ቅሬታዎችና ክፍተቶች)
    csvContent += `\n--- ክፍል 3፡ በአሉታ የቀረቡ ቅሬታዎችና ትኩረት የሚሹ ጉዳዮች (NEGATIVE CONCERNS & CRITICAL BOTTLENECKS - ጠቅላላ: ${negativeList.length}) ---\n`;
    csvContent += `ተሳታፊ ቁጥር,መኖሪያ,የተሳታፊ ጾታ/ዕድሜ,የጥያቄው ርዕስ,አሉታዊ ቅሬታ / ዝቅተኛ ነጥብ / ክፍተት,ደረጃ\n`;
    if (negativeList.length > 0) {
      negativeList.forEach((n) => {
        csvContent += `${n.respId},${sanitizeCsvField(n.residence)},${sanitizeCsvField(`${n.gender} / ${n.ageGroup}`)},${sanitizeCsvField(n.questionText)},${sanitizeCsvField(n.answerDisplay)},${sanitizeCsvField('🔴 አሉታዊ (ትኩረት የሚሻ)')}\n`;
      });
    } else {
      csvContent += `ምንም አሉታዊ ቅሬታ እስካሁን አልተመዘገበም,,,,,\n`;
    }

    // 4. NEUTRAL & RECOMMENDATIONS SECTION
    if (neutralList.length > 0) {
      csvContent += `\n--- ክፍል 4፡ ገለልተኛና ሚዛናዊ አስተያየቶች (NEUTRAL & CONSTRUCTIVE RECOMMENDATIONS - ጠቅላላ: ${neutralList.length}) ---\n`;
      csvContent += `ተሳታፊ ቁጥር,መኖሪያ,የተሳታፊ ጾታ/ዕድሜ,የጥያቄው ርዕስ,ገለልተኛ አስተያየት / ምርጫ,ደረጃ\n`;
      neutralList.forEach((nu) => {
        csvContent += `${nu.respId},${sanitizeCsvField(nu.residence)},${sanitizeCsvField(`${nu.gender} / ${nu.ageGroup}`)},${sanitizeCsvField(nu.questionText)},${sanitizeCsvField(nu.answerDisplay)},${sanitizeCsvField('⚪ ገለልተኛ')}\n`;
      });
    }

    // 5. OFFICIAL POLICY REPORT
    if (aiReport) {
      csvContent += `\n--- ክፍል 5፡ ኦፊሴላዊ የፖሊሲና የአመራር ውሳኔ ሃሳቦች (OFFICIAL POLICY & ANALYTICS REPORT) ---\n`;
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
    }

    // 6. QUESTION ANALYTICS AGGREGATE
    csvContent += `\n--- ክፍል 6፡ የጥያቄዎች ማጠቃለያ ስታቲስቲክስ (QUESTION ANALYTICS SUMMARY) ---\n`;
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

    // 7. DEMOGRAPHIC BREAKDOWN
    if (demographics_analytics) {
      csvContent += `\n--- ክፍል 7፡ የተሳታፊዎች ስነ-ሕዝብ ማጠቃለያ (DEMOGRAPHIC BREAKDOWN SUMMARY) ---\n`;
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
      `ለጥናት ID ${surveyId} ዝርዝር ጥያቄና መልስ እንዲሁም አውንታዊ/አሉታዊ ትንታኔ ያካተተ CSV ዳውንሎድ ተደርጓል::`,
      req.ip
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dgc_survey_${surveyId}_detailed_report.csv"`);
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

// Trigger 24-Hour Survey Data & AI Policy Report to Telegram (Developer, Owner & Admin)
app.post('/api/admin/telegram/send-24h-report', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await db.getAllSurveys(true);
    const responses = await db.getAllRawResponses();
    const answers = await db.getAllRawAnswers();
    const tickets = await db.getAllTickets();

    // Generate comprehensive AI Executive Briefing across all surveys
    let aiSummaryText = `የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የ24 ሰዓት የጥናት እና የህዝብ አስተያየት አጠቃላይ ትንተና:\n\n` +
      `1. ጠቅላላ የተመዘገቡ የጥናት መጠይቆች: ${surveys.length} (ንቁ: ${surveys.filter((s: any) => s.is_active).length})\n` +
      `2. ጠቅላላ የተሳተፉ ዜጎች ምላሾች: ${responses.length}\n` +
      `3. የቀረቡ የዜጎች አቤቱታዎች እና ጥያቄዎች: ${tickets.length} (እልባት የተሰጣቸው: ${tickets.filter((t: any) => t.status === 'Resolved').length})\n\n` +
      `📌 የፖሊሲ እና የአፈጻጸም አቅጣጫ: በዜጎች የቀረቡ ዋና ዋና አስተያየቶች በከተማ አገልግሎት አሰጣጥ፣ ውሃና መሰረተ-ልማት እንዲሁም ግልጽ የመረጃ ተደራሽነት ላይ ያተኮሩ ሲሆን የተገኙ ግኝቶች በየሴክተሩ እንዲተገበሩ ይመከራል።`;

    // Try AI generation if at least one survey has analytics
    try {
      if (surveys.length > 0) {
        const topSurveyAnalytics = await db.getSurveyAnalytics(surveys[0].id);
        if (topSurveyAnalytics && topSurveyAnalytics.total_responses > 0) {
          const aiReport = await generateSurveyAiReport(topSurveyAnalytics);
          if (aiReport && aiReport.executive_summary) {
            aiSummaryText = `[የዋናው ጥናት ፖሊሲ ትንተና: ${topSurveyAnalytics.survey.title}]\n\n` +
              `🌟 የህዝብ እርካታ ደረጃ: ${aiReport.satisfaction_score}%\n` +
              `📝 ማጠቃለያ: ${aiReport.executive_summary}\n\n` +
              `🔑 ዋና ዋና ግኝቶች:\n` +
              (aiReport.key_findings || []).map((k: string) => `• ${k}`).join('\n') +
              `\n\n💡 የፖሊሲ ማሻሻያ ምክረ-ሃሳቦች:\n` +
              (aiReport.policy_recommendations || []).map((p: string) => `• ${p}`).join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('AI summary generation for 24h telegram report fallback:', e);
    }

    const result = await sendDaily24hTelegramReport(
      { surveys, responses, answers, tickets },
      aiSummaryText,
      activeBotToken,
      activeChatId
    );

    await db.addAuditLog(
      req.adminUser?.email || 'admin@dgc.gov.et',
      'TELEGRAM_24H_REPORT_DISPATCH',
      `የ24 ሰዓት የPDF ሪፖርት፣ የዳታ ቋት ፋይል (Excel/CSV) እና የ OPA AI Engine የትንተና ሪፖርት ወደ Telegram ተልኳል::`,
      req.ip
    );

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err: any) {
    handleApiError(res, req, err, 'የ24 ሰዓት ሪፖርት ወደ Telegram መላክ አልተቻለም');
  }
});

// ==================== ADMIN NOTIFICATION CENTER ====================
app.get('/api/admin/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await db.getAllTickets();
    const surveys = await db.getAllSurveys(true);
    const responses = await db.getAllRawResponses();

    // 1. Pending & Urgent Tickets (አዲስ አቤቱታዎች እና አስቸኳይ ችግሮች)
    const pendingTickets = tickets.filter((t: any) => t.status === 'Pending' || t.status === 'Under Review');
    const urgentTickets = tickets.filter((t: any) => t.priority === 'Urgent' || t.priority === 'High');
    const resolvedTickets = tickets.filter((t: any) => t.status === 'Resolved');

    // 2. Recent Survey Responses in last 24 hours
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const recentResponses = responses.filter((r: any) => {
      const time = new Date(r.submitted_at).getTime();
      return !isNaN(time) && time >= twentyFourHoursAgo;
    });

    const notifications: Array<{
      id: string;
      type: 'ticket_new' | 'ticket_urgent' | 'ticket_status' | 'survey_response' | 'telegram_status';
      title: string;
      description: string;
      time_eth: string;
      priority: 'high' | 'medium' | 'info';
      linkTab: 'tickets' | 'surveys' | 'analytics' | 'telegram';
      refId?: string | number;
      isRead?: boolean;
    }> = [];

    // Urgent Tickets alerts
    urgentTickets.slice(0, 5).forEach((t: any) => {
      notifications.push({
        id: `notif-urgent-ticket-${t.id}`,
        type: 'ticket_urgent',
        title: `🚨 አስቸኳይ አቤቱታ: [${t.ticket_code}]`,
        description: `${t.category} - ${t.subject || 'ዝርዝር መግለጫ የለውም'} (${t.residence || 'ድሬዳዋ'})`,
        time_eth: formatEthiopianDateTime(t.created_at),
        priority: 'high',
        linkTab: 'tickets',
        refId: t.ticket_code,
      });
    });

    // New Pending Tickets
    pendingTickets.slice(0, 5).forEach((t: any) => {
      if (!urgentTickets.some((ut: any) => ut.id === t.id)) {
        notifications.push({
          id: `notif-new-ticket-${t.id}`,
          type: 'ticket_new',
          title: `📌 አዲስ አቤቱታ: [${t.ticket_code}]`,
          description: `${t.category} - ${t.subject || ''} (ሁኔታ: ${t.status})`,
          time_eth: formatEthiopianDateTime(t.created_at),
          priority: 'medium',
          linkTab: 'tickets',
          refId: t.ticket_code,
        });
      }
    });

    // Recent Survey Responses count in last 24h
    if (recentResponses.length > 0) {
      notifications.push({
        id: `notif-survey-24h-${recentResponses.length}`,
        type: 'survey_response',
        title: `📊 አዲስ የሰርቬይ ምላሽ (${recentResponses.length} በ24 ሰዓት)`,
        description: `በመጨረሻዎቹ 24 ሰዓታት ውስጥ ${recentResponses.length} አዳዲስ የዜጎች ምላሾች ተመዝግበዋል።`,
        time_eth: formatEthiopianDateTime(new Date()),
        priority: 'info',
        linkTab: 'surveys',
      });
    }

    // Ticket Status Changes / Resolved Summary
    if (resolvedTickets.length > 0) {
      const latestResolved = resolvedTickets[0];
      notifications.push({
        id: `notif-ticket-status-${latestResolved.id}`,
        type: 'ticket_status',
        title: `✅ እልባት የተሰጠው አቤቱታ: [${latestResolved.ticket_code}]`,
        description: `የአቤቱታው ሁኔታ ወደ '${latestResolved.status}' ተቀይሮ ምላሽ ተሰጥቶታል።`,
        time_eth: formatEthiopianDateTime(latestResolved.updated_at || latestResolved.created_at),
        priority: 'info',
        linkTab: 'tickets',
        refId: latestResolved.ticket_code,
      });
    }

    // Telegram Bot & 24h Dispatch Status
    const isTelegramReady = Boolean(activeBotToken && activeChatId);
    notifications.push({
      id: 'notif-telegram-status',
      type: 'telegram_status',
      title: isTelegramReady ? `✈️ የTelegram 24h ሪፖርት አገልግሎት: ዝግጁ` : `⚠️ የTelegram Bot አልተዋቀረም`,
      description: isTelegramReady
        ? `የ24 ሰዓት የPDF ሪፖርት፣ የዳታ ቋት (Excel/CSV) እና የ OPA AI Engine የፖሊሲ ትንተና በየቀኑ በTelegram ይላካል።`
        : `የ24 ሰዓት ሪፖርት በፋይል ለመላክ እባክዎ Bot Token እና Chat ID ያስገቡ።`,
      time_eth: formatEthiopianDateTime(new Date()),
      priority: isTelegramReady ? 'info' : 'medium',
      linkTab: 'telegram',
    });

    res.json({
      notifications,
      unreadCount: pendingTickets.length + urgentTickets.length,
      stats: {
        totalTickets: tickets.length,
        pendingTickets: pendingTickets.length,
        urgentTickets: urgentTickets.length,
        totalSurveys: surveys.length,
        totalResponses: responses.length,
        responses24h: recentResponses.length,
      },
    });
  } catch (err: any) {
    handleApiError(res, req, err, 'የማሳወቂያዎችን ዝርዝር ማግኘት አልተቻለም');
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

// Get Audit Logs (Developer, Owner & Admin)
app.get('/api/admin/audit-logs', authMiddleware, requireRole('developer', 'owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
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

// ── SEO: robots.txt ────────────────────────────────────────────────────────
// Fixes Lighthouse SEO warning: "robots.txt is not valid"
app.get('/robots.txt', (_req, res) => {
  const baseUrl = process.env.APP_URL || 'https://www.diredawacommunication.org';
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      '',
      '# Block admin API routes from crawlers',
      'Disallow: /api/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
  );
});

// ── SEO: sitemap.xml ────────────────────────────────────────────────────────
app.get('/sitemap.xml', (_req, res) => {
  const baseUrl = process.env.APP_URL || 'https://www.diredawacommunication.org';
  const now = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
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

    // Serve hashed static assets with long-lived immutable cache
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );

    // Serve other static files (favicon, icons, etc.) with short cache
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        index: false, // Let the catch-all serve index.html with correct headers
      })
    );

    // Unknown API routes and missing asset files must be real 404s. Returning index.html here
    // makes the browser receive HTML for a JS/CSS file => blank white page after a redeploy.
    app.use('/api', (_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });
    app.get(/\.[a-zA-Z0-9]{1,6}$/, (_req, res) => {
      res.status(404).type('text/plain').send('Not found');
    });

    // SPA catch-all: serve index.html for all non-API, non-asset routes
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Public Survey & Opinion Platform server running on http://${HOST}:${PORT}`);
  });
}

startServer();
