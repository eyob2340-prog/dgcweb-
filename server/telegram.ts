import { SurveyAnalytics, AiReportResponse } from '../src/types';
import { toEthiopianDate } from '../src/lib/ethiopianDate';

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

    const blob = new Blob([fileContent], { type: mimeType });
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

  const { survey, total_responses, questions_analytics } = analytics;
  const ethDate = toEthiopianDate(new Date());

  let textMsg = `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  textMsg += `📜 *ኦፊሴላዊ የሕዝብ አስተያየትና የፖሊሲ ሪፖርት*\n\n`;

  textMsg += `📌 *የጥናቱ ርዕስ:* ${escapeMarkdown(survey.title)}\n`;
  textMsg += `📁 *መደብ:* ${escapeMarkdown(survey.category)}\n`;
  textMsg += `👥 *የተሳተፉ ዜጎች ብዛት:* *${total_responses}*\n`;
  textMsg += `📅 *የኢትዮጵያ ቀን:* *${escapeMarkdown(ethDate.formattedAmharic)}*\n`;

  if (aiReport) {
    textMsg += `🔢 *የመዝገብ ቁጥር (Ref):* \`${escapeMarkdown(aiReport.official_header.ref_code)}\` \n`;
    textMsg += `🌟 *የሕዝብ እርካታ ደረጃ:* *${aiReport.satisfaction_score}%*\n\n`;

    textMsg += `📝 *[የፖሊሲ ማጠቃለያ]*\n${escapeMarkdown(aiReport.executive_summary)}\n\n`;

    if (aiReport.key_findings && aiReport.key_findings.length > 0) {
      textMsg += `🔑 *[ዋና ዋና ግኝቶች]*\n`;
      aiReport.key_findings.forEach((kf) => {
        textMsg += `  • ${escapeMarkdown(kf)}\n`;
      });
      textMsg += `\n`;
    }

    if (aiReport.policy_recommendations && aiReport.policy_recommendations.length > 0) {
      textMsg += `💡 *[የፖሊሲ ማሻሻያ ጥቆማዎች]*\n`;
      aiReport.policy_recommendations.forEach((pr) => {
        textMsg += `  • ${escapeMarkdown(pr)}\n`;
      });
      textMsg += `\n`;
    }
  }

  textMsg += `------------------------------------\n`;
  textMsg += `📊 *[የጥያቄዎች እና የመልሶች ስቲስቲክስ]*\n\n`;

  questions_analytics.forEach((q, idx) => {
    textMsg += `*${idx + 1}. ${escapeMarkdown(q.question_text)}*\n`;

    if (q.question_type === 'radio' && q.radio_data) {
      q.radio_data.forEach((r) => {
        textMsg += `  • ${escapeMarkdown(r.option)}: *${r.count}* (${r.percentage}%)\n`;
      });
    } else if (q.question_type === 'rating' && q.rating_distribution) {
      textMsg += `  ⭐ *አማካኝ ደረጃ (Average):* *${q.rating_average || 0} / 5*\n`;
      q.rating_distribution.forEach((rd) => {
        textMsg += `  • ${rd.value} ኮከብ: *${rd.count}* (${rd.percentage}%)\n`;
      });
    } else if (q.question_type === 'text' && q.text_responses) {
      textMsg += `  💬 *አጠቃላይ የጽሁፍ አስተያየቶች:* *${q.total_answers_count}*\n`;
      const recent = q.text_responses.slice(0, 2);
      if (recent.length > 0) {
        textMsg += `  *ምሳሌዎች:*\n`;
        recent.forEach((t) => {
          textMsg += `  - "${escapeMarkdown(t.answer_text.substring(0, 80))}..."\n`;
        });
      }
    }
    textMsg += `\n`;
  });

  textMsg += `🔒 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - Dire Dawa, Ethiopia*`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: textMsg,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: 'የኤአይ ፖሊሲ ሪፖርትና ስቲስቲክሱ ወደ Telegram በስኬት ተልኳል!' };
    } else {
      return { success: false, message: `Telegram Error: ${data.description || 'ለማላክ አልተቻለም'}` };
    }
  } catch (err: any) {
    return { success: false, message: `ለTelegram መላክ አልተቻለም: ${err.message}` };
  }
}

/**
 * 24-Hour Automated Master Telegram Dispatch:
 * Sends comprehensive Survey responses spreadsheet (CSV/Excel-ready) + Gemini AI Policy Summary
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
): Promise<{ success: boolean; message: string; docResult?: any }> {
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

  const fileName = `DGC_24h_Survey_Report_${ethDate.year}_${ethDate.month}_${ethDate.day}.csv`;

  // 2. Prepare Executive Caption & AI Insight Summary
  let caption = `📊 *የ24 ሰዓት የዳታ ቋት እና AI የትንተና ሪፖርት*\n`;
  caption += `🏢 *የድሬዳዋ አስተዳደር ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  caption += `📅 *ቀን:* *${escapeMarkdown(dateAm)}*\n`;
  caption += `📈 *ጥናቶች:* *${surveysData.surveys.length}* | *ምላሾች:* *${surveysData.responses.length}* | *አቤቱታዎች:* *${surveysData.tickets.length}*\n\n`;
  caption += `📁 *አባሪ የተደረገው ፋይል:* \`${fileName}\` (Excel & CSV Compatible)\n`;

  // 3. Send Document to Telegram
  const docResult = await sendTelegramDocument(
    csvContent,
    fileName,
    caption,
    botToken,
    chatId,
    'text/csv'
  );

  // 4. Send detailed AI Executive Briefing as Message
  let aiMsg = `🤖 *[የ24 ሰዓት የGemini AI የፖሊሲ እና የህዝብ አስተያየት ጥልቅ ትንተና]*\n\n`;
  aiMsg += `${escapeMarkdown(aiSummaryText)}\n\n`;
  aiMsg += `📅 *የሪፖርት ቀን:* ${escapeMarkdown(dateAm)}\n`;
  aiMsg += `🔒 *ድሬዳዋ አስተዳደር - Dire Dawa Government Communication Affairs Office*`;

  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const rawChatId = chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const targetChatId = formatTelegramChatId(rawChatId);

  if (token && targetChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: aiMsg,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.warn('Failed to send AI summary text to Telegram:', e);
    }
  }

  return {
    success: docResult.success,
    message: docResult.success
      ? 'የ24 ሰዓት የሰርቬይ ዳታ ፋይል (CSV/Excel) እና የGemini AI ትንተና በስኬት ወደ Telegram ተልኳል!'
      : docResult.message,
    docResult,
  };
}

