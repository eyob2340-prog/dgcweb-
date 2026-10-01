import { SurveyAnalytics, AiReportResponse } from '../src/types';
import { toEthiopianDate } from '../src/lib/ethiopianDate';
import { generateExecutive24hPdf } from './pdfGenerator';

// User-configured Telegram Bot & Channel
export const DEFAULT_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const DEFAULT_TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

/**
 * Escapes special Markdown characters to prevent Telegram Markdown formatting injections.
 * Prevents user-submitted asterisks, underscores, brackets, and backticks from breaking markdown or creating arbitrary links.
 */
export function escapeMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function formatTelegramChatId(rawId?: string): string {
  if (!rawId) return DEFAULT_TELEGRAM_CHAT_ID;
  const trimmed = rawId.trim();
  if (trimmed.startsWith('100') && trimmed.length >= 12) {
    return `-${trimmed}`;
  }
  return trimmed;
}

/**
 * Send a document/file (CSV, Excel-compatible, PDF) to Telegram via sendDocument
 */
export async function sendTelegramDocument(
  fileContent: string | Buffer,
  fileName: string,
  caption: string,
  botToken?: string,
  chatId?: string,
  mimeType: string = 'text/csv'
): Promise<{ success: boolean; message: string }> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const rawChatId = chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const targetChatId = formatTelegramChatId(rawChatId);

  if (!token || !targetChatId) {
    return {
      success: false,
      message: 'የTelegram Bot Token ወይም Chat ID አልተዋቀረም! (Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)',
    };
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', targetChatId);
    formData.append('caption', caption.substring(0, 1024));
    formData.append('parse_mode', 'Markdown');

    const blobContent = typeof fileContent === 'string' ? fileContent : new Uint8Array(fileContent);
    const blob = new Blob([blobContent], { type: mimeType });
    formData.append('document', blob, fileName);

    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: `ፋይሉ [${fileName}] ወደ Telegram በስኬት ተልኳል!` };
    } else {
      return { success: false, message: `Telegram Error: ${data.description || 'ፋይሉን መላክ አልተቻለም'}` };
    }
  } catch (err: any) {
    return { success: false, message: `ፋይሉን ወደ Telegram ለመላክ አልተቻለም: ${err.message}` };
  }
}

export async function sendTelegramReport(
  analytics: SurveyAnalytics,
  botToken?: string,
  chatId?: string,
  aiReport?: AiReportResponse
): Promise<{ success: boolean; message: string }> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const rawChatId = chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const targetChatId = formatTelegramChatId(rawChatId);

  if (!token || !targetChatId) {
    return {
      success: false,
      message: 'የTelegram Bot Token ወይም Chat ID አልተዋቀረም! (Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)',
    };
  }

  const { survey, total_responses } = analytics;
  const ethDate = toEthiopianDate(new Date());
  const dateAm = ethDate.formattedAmharic;

  // Build CSV Export Document
  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += `"የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - የዳሰሳ ጥናት ሪፖርት"\n`;
  csvContent += `"የጥናቱ ርዕስ:","${(survey.title || '').replace(/"/g, '""')}"\n`;
  csvContent += `"መደብ:","${(survey.category || '').replace(/"/g, '""')}","ቀን:","${dateAm}","ተሳታፊዎች:","${total_responses}"\n\n`;

  csvContent += `"ጥያቄ ቁጥር","የጥያቄው ርዕስ","ዓይነት","አማካኝ/መልሶች"\n`;
  analytics.questions_analytics.forEach((q, idx) => {
    const qText = (q.question_text || '').replace(/"/g, '""');
    let summary = '';
    if (q.question_type === 'radio' && q.radio_data) {
      summary = q.radio_data.map(r => `${r.option}: ${r.count} (${r.percentage}%)`).join(' | ');
    } else if (q.question_type === 'rating') {
      summary = `አማካኝ: ${q.rating_average || 0}/5`;
    } else {
      summary = `ጠቅላላ ጽሑፎች: ${q.total_answers_count}`;
    }
    csvContent += `"${idx + 1}","${qText}","${q.question_type}","${summary.replace(/"/g, '""')}"\n`;
  });

  const fileName = `DGC_Survey_${survey.id}_Report_${ethDate.year}_${ethDate.month}_${ethDate.day}.csv`;
  let caption = `📊 *ኦፊሴላዊ የዳሰሳ ጥናት ዳታ ሪፖርት (Official Document)*\n`;
  caption += `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  caption += `📌 *ርዕስ:* ${escapeMarkdown(survey.title)}\n`;
  caption += `📅 *ቀን:* ${escapeMarkdown(dateAm)} | 👥 *ተሳታፊዎች:* *${total_responses}*\n`;
  if (aiReport?.satisfaction_score) {
    caption += `🌟 *የሕዝብ እርካታ ደረጃ:* *${aiReport.satisfaction_score}%*\n`;
  }
  caption += `📎 *ፋይል:* \`${fileName}\``;

  return await sendTelegramDocument(csvContent, fileName, caption, botToken, chatId, 'text/csv');
}

/**
 * 24-Hour Automated Master Telegram Dispatch:
 * Sends ONLY Official Documents: Executive PDF Report + Raw Spreadsheet (CSV/Excel)
 */
export async function sendDaily24hTelegramReport(
  surveysData: {
    surveys: any[];
    responses: any[];
    answers: any[];
    tickets: any[];
  },
  aiSummaryText: string,
  botToken?: string,
  chatId?: string
): Promise<{ success: boolean; message: string; pdfResult?: any; docResult?: any }> {
  const ethDate = toEthiopianDate(new Date());
  const dateAm = ethDate.formattedAmharic;
  
  // 1. Build Comprehensive CSV Data Export
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Amharic support
  csvContent += `"የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - የ24 ሰዓት የዳታ ቋት ሪፖርት"\n`;
  csvContent += `"ቀን (Ethiopian Date):","${dateAm}"\n`;
  csvContent += `"ጠቅላላ ጥናቶች:","${surveysData.surveys.length}","ጠቅላላ ምላሾች:","${surveysData.responses.length}","ጠቅላላ አቤቱታዎች:","${surveysData.tickets.length}"\n\n`;

  csvContent += `"--- የሰርቬዮች ምላሽ ዝርዝር (Survey Responses Breakdown) ---"\n`;
  csvContent += `"Response ID","Survey ID","Survey Title","Age Group","Gender","Education","Residence","Submitted At (ET)"\n`;

  for (const resp of surveysData.responses) {
    const survey = surveysData.surveys.find((s) => s.id === resp.survey_id);
    const surveyTitle = (survey?.title || 'Unknown').replace(/"/g, '""');
    const ethRespDate = toEthiopianDate(resp.submitted_at).formattedAmharic;
    csvContent += `"${resp.id}","${resp.survey_id}","${surveyTitle}","${resp.age_group || 'N/A'}","${resp.gender || 'N/A'}","${resp.education || 'N/A'}","${resp.residence || 'N/A'}","${ethRespDate}"\n`;
  }

  csvContent += `\n"--- የዜጎች አቤቱታዎችና ጥያቄዎች ዝርዝር (Citizen Tickets) ---"\n`;
  csvContent += `"Ticket Code","Category","Priority","Status","Residence","Subject","Submitted At (ET)"\n`;

  for (const t of surveysData.tickets) {
    const ethTicketDate = toEthiopianDate(t.created_at).formattedAmharic;
    const subject = (t.subject || '').replace(/"/g, '""');
    csvContent += `"${t.ticket_code}","${t.category}","${t.priority}","${t.status}","${t.residence || 'N/A'}","${subject}","${ethTicketDate}"\n`;
  }

  const csvFileName = `DGC_24h_Master_Data_${ethDate.year}_${ethDate.month}_${ethDate.day}.csv`;
  const pdfFileName = `DGC_24h_Executive_Report_${ethDate.year}_${ethDate.month}_${ethDate.day}.pdf`;

  // 2. Generate Official PDF Document using pdfGenerator
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = generateExecutive24hPdf(
      surveysData,
      aiSummaryText,
      dateAm,
      `DGC-24H-${ethDate.year}-${ethDate.month}`
    );
  } catch (pdfErr) {
    console.error('Error generating 24h Executive PDF for Telegram:', pdfErr);
  }

  // 3. Prepare Executive PDF Caption
  let pdfCaption = `📄 *ኦፊሴላዊ የ24 ሰዓት የዳሰሳ ጥናትና ፖሊሲ ሪፖርት (Official Executive PDF)*\n`;
  pdfCaption += `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  pdfCaption += `📅 *ቀን:* *${escapeMarkdown(dateAm)}*\n`;
  pdfCaption += `📈 *ጥናቶች:* *${surveysData.surveys.length}* | *ምላሾች:* *${surveysData.responses.length}* | *አቤቱታዎች:* *${surveysData.tickets.length}*\n`;
  pdfCaption += `🤖 *ሲስተም:* OPA AI Engine v4.8 Intelligence Platform\n\n`;
  pdfCaption += `📎 *ፋይል:* \`${pdfFileName}\` (A4 Executive PDF Document)`;

  // 4. Send PDF Document
  let pdfResult: { success: boolean; message: string } = { success: false, message: 'PDF አልተፈጠረም' };
  if (pdfBuffer) {
    pdfResult = await sendTelegramDocument(
      pdfBuffer,
      pdfFileName,
      pdfCaption,
      botToken,
      chatId,
      'application/pdf'
    );
  }

  // 5. Send CSV Spreadsheet Document
  let csvCaption = `📊 *የ24 ሰዓት ጥሬ ዳታ ቋት (Excel/CSV Master Sheet)*\n`;
  csvCaption += `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  csvCaption += `📁 *አባሪ:* \`${csvFileName}\` (Microsoft Excel & CSV Compatible)`;

  const docResult = await sendTelegramDocument(
    csvContent,
    csvFileName,
    csvCaption,
    botToken,
    chatId,
    'text/csv'
  );

  const isSuccess = pdfResult.success || docResult.success;
  return {
    success: isSuccess,
    message: isSuccess
      ? 'የ24 ሰዓት የPDF ሪፖርት እና የExcel/CSV ዳታ ፋይል በስኬት ወደ Telegram ተልኳል!'
      : (pdfResult.message || docResult.message),
    pdfResult,
    docResult,
  };
}


