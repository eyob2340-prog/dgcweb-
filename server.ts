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

// In-memory runtime telegram config store
let activeBotToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
let activeChatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
import { generateSurveyAiReport } from './server/ai';

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

// Submit anonymous survey response
app.post('/api/surveys/:id/responses', submissionLimiter, async (req: Request, res: Response) => {
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

// ==================== ADMIN ENDPOINTS ====================

// Admin Login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'እባክዎ ኢሜይል እና ፓስወርድ ያስገቡ' });
    }

    const admin = await db.getAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: 'የተሳሳተ ኢሜይል ወይም ፓስወርድ!' });
    }

    const isMatch = comparePassword(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'የተሳሳተ ኢሜይል ወይም ፓስወርድ!' });
    }

    const token = generateToken({ id: admin.id, email: admin.email });
    await db.addAuditLog(admin.email, 'ADMIN_LOGIN', 'አድሚን ወደ ሲስተሙ በስኬት ገብቷል::', req.ip);

    res.json({
      token,
      admin: { id: admin.id, email: admin.email },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'የመግባት ሂደት አልተሳካም', details: err.message });
  }
});

// Verify Current Admin Token
app.get('/api/admin/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ admin: req.adminUser });
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
        `ለጥናት ID ${surveyId} ("${analytics.survey.title.substring(0, 30)}...") የኤአይ ፖሊሲ ሪፖርት ወደ Telegram ተልኳል::`,
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
      'GENERATE_AI_REPORT',
      `ለጥናት ID ${surveyId} ("${analytics.survey.title.substring(0, 30)}...") የኤአይ ፖሊሲ ሪፖርት ተዘጋጅቷል::`,
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
      csvContent += `--- AI POLICY & ANALYTICS REPORT (Gemini AI Insights) ---\n`;
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
      `ለጥናት ID ${surveyId} AI ፖሊሲ ሪፖርት ያካተተ CSV ዳውንሎድ ተደርጓል::`,
      req.ip
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dgc_survey_${surveyId}_full_report.csv"`);
    res.send('\uFEFF' + csvContent); // Add UTF-8 BOM for Excel compatibility
  } catch (err: any) {
    res.status(500).json({ error: 'CSV ሪፖርት ማዘጋጀት አልተቻለም', details: err.message });
  }
});

// Get current Telegram Config
app.get('/api/admin/telegram-config', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    botToken: activeBotToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
  });
});

// Update Telegram Config dynamically
app.post('/api/admin/telegram-config', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { botToken, chatId } = req.body;
  if (botToken) activeBotToken = botToken.trim();
  if (chatId) activeChatId = chatId.trim();

  res.json({
    success: true,
    message: 'የቴሌግራም ቦት ሴቲንግ በስኬት ተቀይሯል! (Telegram settings saved)',
    botToken: activeBotToken,
    chatId: activeChatId,
    formattedChatId: formatTelegramChatId(activeChatId),
  });
});

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
