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
import { comparePassword, generateToken, authMiddleware, AuthenticatedRequest } from './server/auth';
import { sendTelegramReport, DEFAULT_TELEGRAM_BOT_TOKEN, DEFAULT_TELEGRAM_CHAT_ID, formatTelegramChatId } from './server/telegram';

// In-memory runtime settings store
let activeBotToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
let activeChatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
let isMaintenanceMode = false;
import { generateSurveyAiReport, translateTextWithAi } from './server/ai';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Enable trust proxy for reverse proxies (Cloud Run / Nginx)
app.set('trust proxy', 1);

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // allow inline scripts for Vite preview
  })
);
app.use(cors());
app.use(express.json());

// Rate limiting for public submissions to prevent spam attacks
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 submissions per windowMs
  validate: { xForwardedForHeader: false },
  message: { error: 'ከበዛ ጥያቄ የተነሳ ጊዜያዊ ገደብ ተጥሏል! እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ:: (Too many requests, please try again later)' },
});

// Helper for generating anonymous IP hash
function generateIpHash(req: Request, surveyId: number): string {
  const forwarded = req.headers['x-forwarded-for'];
  let rawIp = '127.0.0.1';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    rawIp = forwarded.split(',')[0].trim();
  } else if (req.socket?.remoteAddress) {
    rawIp = req.socket.remoteAddress;
  }

  // Hash IP with survey ID and salt so raw IP is never saved or recoverable
  return crypto
    .createHash('sha256')
    .update(`${rawIp}_survey_${surveyId}_salt_ethiopia_2026_anonymous`)
    .digest('hex');
}

// ==================== PUBLIC ENDPOINTS ====================

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
    res.status(500).json({ error: 'የመጠይቆች ዝርዝር ለማግኘት አልተቻለም', details: err.message });
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
    res.status(500).json({ error: 'መጠይቁን ለማግኘት አልተቻለም', details: err.message });
  }
});

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
    res.status(500).json({ error: 'መልሱን ለመመዝገብ አልተቻለም', details: err.message });
  }
});

// Submit Citizen Complaint or Inquiry (የዜጎች አቤቱታ/ጥያቄ ማስገቢያ)
app.post('/api/tickets', citizenMaintenanceMiddleware, submissionLimiter, async (req: Request, res: Response) => {
  try {
    const { category, residence, subject, description, full_name, phone, email, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({ error: 'እባክዎ የጥያቄውን/አቤቱታውን ርዕስ፣ ዝርዝር መግለጫ እና ዘርፍ ያስገቡ' });
    }

    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticket_code = `DGC-TKT-2026-${randomPart}`;

    const ticket = await db.createTicket({
      ticket_code,
      category,
      residence,
      subject,
      description,
      full_name,
      phone,
      email,
      priority: priority || 'Normal',
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
    res.status(500).json({ error: 'አቤቱታውን ለመመዝገብ አልተቻለም', details: err.message });
  }
});

// Track Citizen Ticket Status by Ticket Code (የአቤቱታ ሁኔታ መከታተያ)
app.get('/api/tickets/track/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    if (!code) return res.status(400).json({ error: 'እባክዎ የክትትል ኮድ ያስገቡ' });

    const ticket = await db.getTicketByCode(code);
    if (!ticket) {
      return res.status(404).json({ error: 'በዚህ የክትትል ኮድ የተመዘገበ አቤቱታ ወይም ጥያቄ አልተገኘም:: እባክዎ ኮዱን አስተካክለው ይሞክሩ::' });
    }

    res.json({ ticket });
  } catch (err: any) {
    res.status(500).json({ error: 'መረጃውን ማግኘት አልተቻለም', details: err.message });
  }
});

// Recover Lost Ticket Code by Phone, Email, or Full Name (የተረሳ የክትትል ኮድ መፈለጊያ)
app.post('/api/tickets/recover', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'እባክዎ ቢያንስ 3 ፊደላት/ቁጥሮች ያለው ስልክ፣ ኢሜይል ወይም ሙሉ ስም ያስገቡ::' });
    }

    const tickets = await db.getTicketsByPhoneOrEmail(query);
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ error: 'በተሰጠው ስልክ ወይም ኢሜይል የተመዘገበ አቤቱታ አልተገኘም::' });
    }

    res.json({ success: true, count: tickets.length, tickets });
  } catch (err: any) {
    res.status(500).json({ error: 'አቤቱታውን መፈለግ አልተቻለም', details: err.message });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Admin / Owner / Developer Login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'እባክዎ የተጠቃሚ ስም/ኢሜይል እና ፓስወርድ ያስገቡ' });
    }

    const cleanInput = (email || '').trim();
    const cleanPassword = (password || '').trim();

    const admin = await db.getAdminByEmail(cleanInput);
    if (!admin) {
      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    let isMatch = false;
    if (admin.password_hash) {
      isMatch = comparePassword(cleanPassword, admin.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'የተሳሳተ የተጠቃሚ ስም/ኢሜይል ወይም ፓስወርድ!' });
    }

    const userRole = admin.role || 'admin';
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      username: admin.username || admin.email.split('@')[0],
      role: userRole,
    });

    await db.addAuditLog(admin.email, 'ADMIN_LOGIN', `ተጠቃሚ [${admin.email}] በ [${userRole}] ሚና ወደ ሲስተሙ በስኬት ገብቷል::`, req.ip);

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        username: admin.username || admin.email.split('@')[0],
        role: userRole,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'የመግባት ሂደት አልተሳካም', details: err.message });
  }
});

// Verify Current User Token
app.get('/api/admin/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ admin: req.adminUser });
});

// User Management: List Users (Developer & Owners)
app.get('/api/admin/users', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await db.getAllAdmins();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: 'የተጠቃሚዎችን ዝርዝር ማግኘት አልተቻለም', details: err.message });
  }
});

// User Management: Create User (Developer & Owners)
app.post('/api/admin/users', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, username, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'ኢሜይል እና ፓስወርድ አስፈላጊ ናቸው::' });
    }
    const newUser = await db.createAdminUser(email, username || email.split('@')[0], password, role || 'admin');
    await db.addAuditLog(req.adminUser?.email || 'system', 'CREATE_USER', `አዲስ አድሚን [${email}] ተፈጠረ::`, req.ip);
    res.status(201).json({ user: newUser, message: 'አዲስ አድሚን/ተጠቃሚ በስኬት ተፈጠረ!' });
  } catch (err: any) {
    res.status(500).json({ error: 'አዲስ ተጠቃሚ ለመፍጠር አልተቻለም', details: err.message });
  }
});

// User Management: Update Profile or Reset Password
app.put('/api/admin/users/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { email, username, password, role } = req.body;

    if (isNaN(targetId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የተጠቃሚ ID' });

    await db.updateAdminProfile(targetId, { email, username, password, role });
    await db.addAuditLog(req.adminUser?.email || 'system', 'UPDATE_USER', `የተጠቃሚ ID [${targetId}] መረጃ/ፓስወርድ ተቀይሯል::`, req.ip);

    res.json({ success: true, message: 'የተጠቃሚው መረጃ/ፓስወርድ በስኬት ተቀይሯል!' });
  } catch (err: any) {
    res.status(500).json({ error: 'የተጠቃሚውን መረጃ ለመቀየር አልተቻለም', details: err.message });
  }
});

// User Management: Delete Admin User (Software Developer & Owners)
app.delete('/api/admin/users/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ የተጠቃሚ ID' });

    if (req.adminUser?.role !== 'developer' && req.adminUser?.role !== 'owner') {
      return res.status(403).json({ error: 'ይህንን ተግባር ለማከናወን የSoftware Developer ወይም Owner ስልጣን ያስፈልጋል!' });
    }

    await db.deleteAdminUser(targetId);
    await db.addAuditLog(req.adminUser?.email || 'system', 'DELETE_USER', `የተጠቃሚ ID [${targetId}] ከአስፈላጊ ዳታቤዝ ተሰርዟል::`, req.ip);

    res.json({ success: true, message: 'ተጠቃሚው በስኬት ተሰርዟል!' });
  } catch (err: any) {
    res.status(500).json({ error: 'ተጠቃሚውን ለመሰረዝ አልተቻለም', details: err.message });
  }
});

// DEVELOPER CONTROL: Quick Test Data Generator (5 or 10 Test Grievances)
app.post('/api/admin/developer/seed-tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = Math.min(Math.max(req.body.count || 5, 1), 20);
    const sampleCategories = [
      'የመሬት ልማትና ማኔጅመንት ቢሮ',
      'የድሬዳዋ አስተዳደር ጤና ቢሮ',
      'የንግድና ኢንዱስትሪ ልማት ቢሮ',
      'የከተማ ልማትና ኮንስትራክሽን ቢሮ',
      'የትራንስፖርትና ሎጀስቲክ ባለስልጣን',
      'የድሬዳዋ ፖሊስ ጠቅላይ መመሪያ',
    ];
    const sampleSubjects = [
      'የይዞታ ማረጋገጫ ምስክር ወረቀት መዘግየት',
      'በወረዳ 02 የታየ የንፁህ መጠጥ ውኃ እጥረት አቤቱታ',
      'በንግድ ፈቃድ እድሳት ላይ ያጋጠመ አላስፈላጊ ውጣ ውረድ',
      'የመንገድ ጥገና እና የፍሳሽ ማስወገጃ ችግር',
      'በትራፊክ ፍሰት እና በህዝብ ትራንስፖርት ታሪፍ ላይ የቀረበ ቅሬታ',
    ];
    const sampleNames = ['Abebe Kebede', 'Mulugeta Tadesse', 'Fatima Ahmed', 'Chala Gemechu', 'Khadija Hassan'];

    for (let i = 0; i < count; i++) {
      const cat = sampleCategories[i % sampleCategories.length];
      const subj = sampleSubjects[i % sampleSubjects.length];
      const name = sampleNames[i % sampleNames.length];
      await db.createTicket({
        ticket_code: `DGC-TKT-${Math.floor(100000 + Math.random() * 900000)}`,
        category: cat,
        residence: i % 2 === 0 ? 'ወረዳ 03' : 'የዋሂል ክላስተር ፅህፈት ቤት',
        subject: `${subj} (#${Math.floor(1000 + Math.random() * 9000)})`,
        description: `ይህ በSoftware Developer (OPA) አውቶማቲክ የተፈጠረ የቴስት አቤቱታ ነው:: የተጠቃሚ አቤቱታ ሂደት እና የምላሽ ጊዜ ለመፈተሽ የተዘጋጀ::`,
        full_name: name,
        phone: `0911${Math.floor(100000 + Math.random() * 900000)}`,
        email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
        priority: i % 3 === 0 ? 'Urgent' : i % 2 === 0 ? 'High' : 'Normal',
      });
    }

    await db.addAuditLog(req.adminUser?.email || 'opa', 'DEV_SEED_TICKETS', `${count} የቴስት አቤቱታዎች አውቶማቲክ ተመረቱ::`, req.ip);
    res.json({ success: true, message: `${count} የቴስት አቤቱታዎች በስኬት ተፈብሪከው ዳታቤዝ ውስጥ ገብተዋል!` });
  } catch (err: any) {
    res.status(500).json({ error: 'የቴስት ዳታ ማመንጨት አልተሳካም', details: err.message });
  }
});

// DEVELOPER CONTROL: Full System Data Backup (JSON Export)
app.get('/api/admin/developer/backup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await db.getAllSurveys(true);
    const tickets = await db.getAllTickets();
    const auditLogs = await db.getAuditLogs();
    const users = await db.getAllAdmins();

    const backupData = {
      version: '2026.1.0',
      exported_at: new Date().toISOString(),
      exported_by: req.adminUser?.email || 'opa',
      surveys,
      tickets,
      auditLogs,
      users,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dgc_system_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'የባካፕ ፋይል ማዘጋጀት አልተቻለም', details: err.message });
  }
});

// Admin list all surveys (active & inactive)
app.get('/api/admin/surveys', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await db.getAllSurveys(true);
    res.json({ surveys });
  } catch (err: any) {
    res.status(500).json({ error: 'መጠይቆችን ለማግኘት አልተቻለም', details: err.message });
  }
});

// Create New Survey
app.post('/api/admin/surveys', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, category, theme, questions } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'እባክዎ የመጠይቅ ርዕስ እና ቢያንስ አንድ ጥያቄ ያስገቡ' });
    }

    const surveyId = await db.createSurvey({
      title,
      description: description || '',
      category: category || 'General',
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
    res.status(500).json({ error: 'መጠይቅ መፍጠር አልተቻለም', details: err.message });
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
    res.status(500).json({ error: 'ሁኔታውን ለመቀየር አልተቻለም', details: err.message });
  }
});

// Delete Survey
app.delete('/api/admin/surveys/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id, 10);
    if (isNaN(surveyId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });

    await db.deleteSurvey(surveyId);
    res.json({ success: true, message: 'መጠይቁ በስኬት ተሰርዟል!' });
  } catch (err: any) {
    res.status(500).json({ error: 'መጠይቁን ለማጥፋት አልተቻለም', details: err.message });
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
    res.status(500).json({ error: 'አናሊቲክስ ዳታ ማግኘት አልተቻለም', details: err.message });
  }
});

// Export Survey Analytics to Telegram with AI Policy Insights
app.post('/api/admin/surveys/:id/export-telegram', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ error: 'ወደ Telegram መላክ አልተቻለም', details: err.message });
  }
});

// Generate AI Analytical Report for Dire Dawa Administration
app.post('/api/admin/surveys/:id/generate-ai-report', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ error: 'የኤአይ ሪፖርት ማዘጋጀት አልተቻለም', details: err.message });
  }
});

// Get Audit Logs
app.get('/api/admin/audit-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'የኦዲት መዝገብ ማግኘት አልተቻለም', details: err.message });
  }
});

// Admin Get All Citizen Tickets (የዜጎች አቤቱታዎች ዝርዝር)
app.get('/api/admin/tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await db.getAllTickets();
    res.json({ tickets });
  } catch (err: any) {
    res.status(500).json({ error: 'የአቤቱታዎችን ዝርዝር ማግኘት አልተቻለም', details: err.message });
  }
});

// Admin Respond / Update Citizen Ticket Status (ለአቤቱታ መልስ መስጫ)
app.put('/api/admin/tickets/:id/respond', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { admin_response, status } = req.body;
    if (isNaN(ticketId)) return res.status(400).json({ error: 'ትክክለኛ ያልሆነ መለያ' });
    if (!status) return res.status(400).json({ error: 'እባክዎ የአቤቱታ ሁኔታ ይምረጡ' });

    const updatedTicket = await db.updateTicketResponse(
      ticketId,
      admin_response || '',
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
    res.status(500).json({ error: 'ምላሹን ለመመዝገብ አልተቻለም', details: err.message });
  }
});

// Admin Delete Citizen Ticket (አቤቱታ ማጥፊያ)
app.delete('/api/admin/tickets/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ error: 'አቤቱታውን ማጥፋት አልተቻለም', details: err.message });
  }
});

// AI Translation endpoint for Admin Panel (Somali, Oromo, Amharic, English)
app.post('/api/admin/translate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'እባክዎ የሚተርጎም ጽሑፍ ያስገቡ' });
    }

    const translation = await translateTextWithAi(text);
    res.json({ translation });
  } catch (err: any) {
    res.status(500).json({ error: 'በትርጉም ወቅት ስህተት አጋጥሟል', details: err.message });
  }
});


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
    csvContent += `Office Location,"Finance Building, 3rd Floor, Dire Dawa, Ethiopia"\n`;
    csvContent += `Phone / Support,"+251-25-1116061"\n`;
    csvContent += `Email Contact,"info@dgc.com / support@dgc.com"\n`;
    csvContent += `Survey Title,"${survey.title.replace(/"/g, '""')}"\n`;
    csvContent += `Category,"${survey.category.replace(/"/g, '""')}"\n`;
    csvContent += `Total Respondents,${total_responses}\n\n`;

    if (aiReport) {
      csvContent += `--- OFFICIAL POLICY & ANALYTICS REPORT ---\n`;
      csvContent += `Official Ref Code,"${aiReport.official_header.ref_code}"\n`;
      csvContent += `Generated Date,"${aiReport.official_header.generated_date}"\n`;
      csvContent += `Public Satisfaction Score,"${aiReport.satisfaction_score}%"\n`;
      csvContent += `Executive Summary,"${aiReport.executive_summary.replace(/"/g, '""').replace(/\n/g, ' ')}"\n`;
      csvContent += `Demographic Insights,"${aiReport.demographic_insights.replace(/"/g, '""').replace(/\n/g, ' ')}"\n`;

      if (aiReport.key_findings && aiReport.key_findings.length > 0) {
        csvContent += `Key Findings,"${aiReport.key_findings.map((f: string) => `• ${f}`).join(' | ').replace(/"/g, '""')}"\n`;
      }
      if (aiReport.policy_recommendations && aiReport.policy_recommendations.length > 0) {
        csvContent += `Policy Recommendations,"${aiReport.policy_recommendations.map((p: string) => `• ${p}`).join(' | ').replace(/"/g, '""')}"\n`;
      }
      csvContent += `\n`;
    }

    csvContent += `--- QUESTION ANALYTICS ---\n`;
    csvContent += `Question ID,Question Text,Question Type,Option / Rating / Response,Count,Percentage (%)\n`;

    questions_analytics.forEach((q) => {
      const qText = q.question_text.replace(/"/g, '""').replace(/\n/g, ' ');

      if (q.question_type === 'radio' && q.radio_data) {
        q.radio_data.forEach((r) => {
          csvContent += `${q.question_id},"${qText}",Radio,"${r.option.replace(/"/g, '""')}",${r.count},${r.percentage}%\n`;
        });
      } else if (q.question_type === 'rating' && q.rating_distribution) {
        q.rating_distribution.forEach((rd) => {
          csvContent += `${q.question_id},"${qText}",Rating,${rd.value} Stars,${rd.count},${rd.percentage}%\n`;
        });
      } else if (q.question_type === 'text' && q.text_responses) {
        q.text_responses.forEach((tr) => {
          const tText = tr.answer_text.replace(/"/g, '""').replace(/\n/g, ' ');
          csvContent += `${q.question_id},"${qText}",Text,"${tText}",1,N/A\n`;
        });
      }
    });

    if (demographics_analytics) {
      csvContent += `\n--- DEMOGRAPHIC BREAKDOWN ---\n`;
      csvContent += `Category,Label,Count,Percentage (%)\n`;

      demographics_analytics.age_distribution.forEach((item) => {
        csvContent += `Age Group,"${item.label}",${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.gender_distribution.forEach((item) => {
        csvContent += `Gender,"${item.label}",${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.education_distribution.forEach((item) => {
        csvContent += `Education,"${item.label}",${item.count},${item.percentage}%\n`;
      });
      demographics_analytics.residence_distribution.forEach((item) => {
        csvContent += `Residence / Kifle Ketema,"${item.label}",${item.count},${item.percentage}%\n`;
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
    res.send('\uFEFF' + csvContent); // Add UTF-8 BOM for Excel compatibility
  } catch (err: any) {
    res.status(500).json({ error: 'CSV ሪፖርት ማዘጋጀት አልተቻለም', details: err.message });
  }
});

// Get current Telegram Config (supports both /telegram-config and /telegram-settings)
const getTelegramConfigHandler = (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    botToken: activeBotToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
    config: {
      botToken: activeBotToken,
      chatId: activeChatId,
    },
  });
};

app.get('/api/admin/telegram-config', authMiddleware, getTelegramConfigHandler);
app.get('/api/admin/telegram-settings', authMiddleware, getTelegramConfigHandler);

// Update Telegram Config dynamically
const updateTelegramConfigHandler = async (req: AuthenticatedRequest, res: Response) => {
  const botToken = req.body.botToken || req.body.config?.botToken;
  const chatId = req.body.chatId || req.body.config?.chatId;

  if (botToken) activeBotToken = String(botToken).trim();
  if (chatId) activeChatId = String(chatId).trim();

  await db.addAuditLog(
    req.adminUser?.email || 'admin@dgc.gov.et',
    'UPDATE_TELEGRAM_CONFIG',
    `የቴሌግራም ቦት እና ቻናል መረጃዎች [Chat ID: ${activeChatId}] ተዘምነዋል::`,
    req.ip
  );

  res.json({
    success: true,
    message: 'የቴሌግራም ቦት ሴቲንግ በስኬት ተቀይሯል! (Telegram settings saved)',
    botToken: activeBotToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
    config: {
      botToken: activeBotToken,
      chatId: activeChatId,
    },
  });
};

app.post('/api/admin/telegram-config', authMiddleware, updateTelegramConfigHandler);
app.post('/api/admin/telegram-settings', authMiddleware, updateTelegramConfigHandler);

// Test Telegram Bot Connection
app.post('/api/admin/telegram-test', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== DEVELOPER & MAINTENANCE ENDPOINTS ====================

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
app.post('/api/admin/developer/maintenance', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
});

// Developer Seed Test Tickets into Database
app.post('/api/admin/developer/seed-tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
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

    res.json({ success: true, message: `${count} የቴስት አቤቱታዎች በስኬት ተፈጠሩ!` });
  } catch (err: any) {
    res.status(500).json({ error: 'የቴስት አቤቱታ ማመንጨት አልተሳካም', details: err.message });
  }
});

// Fetch Real-Time Error Logs
app.get('/api/admin/error-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await db.getErrorLogs();
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch error logs', details: err.message });
  }
});

// Clear Error Logs
app.delete('/api/admin/error-logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ error: 'Failed to clear error logs', details: err.message });
  }
});

// Developer Trigger Test Exception Log
app.post('/api/admin/developer/test-error', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
    res.status(500).json({ error: 'Failed to simulate error', details: err.message });
  }
});

// Developer Full Database JSON Backup Download (All Tables & Complete Data)
app.get('/api/admin/developer/backup', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token as string) || (req.headers.authorization?.split(' ')[1] as string);
    if (!token) return res.status(401).json({ error: 'Unauthorized token required' });

    // Fetch complete data across all tables
    const surveys = await db.getAllSurveys(true);
    const rawResponses = await db.getAllRawResponses();
    const rawAnswers = await db.getAllRawAnswers();
    const tickets = await db.getAllTickets();
    const admins = await db.getAllAdmins();
    const auditLogs = await db.getAuditLogs();
    const errorLogs = await db.getErrorLogs();

    await db.addAuditLog(
      'opa@dgc.gov.et',
      'EXPORT_DATABASE_BACKUP',
      `የሲስተሙ ሙሉ ዳታቤዝ ባካፕ (JSON) [${surveys.length} surveys, ${tickets.length} tickets, ${rawResponses.length} responses, ${auditLogs.length} audit logs] በስኬት ዳውንሎድ ተደርጓል::`,
      req.ip
    );

    const backupData = {
      system_name: 'Dire Dawa Administration Public Survey & Citizen Inquiry Platform',
      version: '2.0.0-PROD',
      exported_at: new Date().toISOString(),
      exported_timestamp: Date.now(),
      exported_by: 'Software Developer (opa@dgc.gov.et)',
      organization: 'Dire Dawa Administration Government Communication Affairs Bureau',
      summary: {
        surveys_count: surveys.length,
        survey_responses_count: rawResponses.length,
        survey_answers_count: rawAnswers.length,
        tickets_count: tickets.length,
        admins_count: admins.length,
        audit_logs_count: auditLogs.length,
        error_logs_count: errorLogs.length,
        total_records: surveys.length + rawResponses.length + rawAnswers.length + tickets.length + admins.length + auditLogs.length + errorLogs.length,
      },
      tables: {
        surveys,
        responses: rawResponses,
        answers: rawAnswers,
        tickets,
        admins,
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
    res.status(500).json({ error: 'ባካፕ ማውረድ አልተቻለም', details: err.message });
  }
});

// 404 Fallback handler specifically for unhandled /api/* routes (returns JSON instead of Vite HTML)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global API Exception Handler Middleware
app.use(async (err: any, req: Request, res: Response, next: any) => {
  console.error('💥 Unhandled Exception Caught in Server:', err);
  try {
    await db.addErrorLog(
      req.originalUrl || req.path,
      err.name || 'UnhandledServerError',
      err.message || 'አልታወቀ የሲስተም ስህተት',
      err.stack || '',
      'server.ts:middleware',
      req.ip
    );
  } catch (e) {
    console.error('Failed to store exception log:', e);
  }
  res.status(500).json({
    error: 'የሲስተም ስህተት አጋጥሟል! (Internal Server Exception)',
    details: err.message,
  });
});

// Start Express Server with Vite Middleware
async function startServer() {
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
