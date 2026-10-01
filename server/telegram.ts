/// <reference path="../globals.d.ts" />
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

/**
 * Classifies a survey answer into positive, negative, or neutral sentiment
 */
export function classifyAnswerSentiment(
  questionType: string,
  answerText?: string | null,
  ratingValue?: number | null
): { sentiment: 'positive' | 'negative' | 'neutral'; labelAm: string } {
  if (ratingValue !== undefined && ratingValue !== null && !isNaN(Number(ratingValue))) {
    const val = Number(ratingValue);
    if (val >= 4) return { sentiment: 'positive', labelAm: 'አውንታዊ (በጎ)' };
    if (val <= 2) return { sentiment: 'negative', labelAm: 'አሉታዊ (ትኩረት የሚሻ)' };
    return { sentiment: 'neutral', labelAm: 'ገለልተኛ (መካከለኛ)' };
  }

  const text = (answerText || '').trim().toLowerCase();
  if (!text) return { sentiment: 'neutral', labelAm: 'ያልተገለጸ' };

  const positiveTerms = [
    'በጣም ተስፋ ሰጪ', 'ተስፋ ሰጪ', 'በጣም ጥሩ', 'ጥሩ', 'ሙሉ በሙሉ እደግፋለሁ', 'እደግፋለሁ',
    'በጣም ከፍተኛ', 'ከፍተኛ', 'አጥጋቢ', 'አመርቂ', 'ደስ ይላል', 'እናመሰግናለን',
    'ተጠናክሮ', 'ይቀጥል', 'በርቱ', 'ስኬታማ', 'በጎ', 'አበረታች', 'ልማት', 'ሰላም', 'ብልጽግና',
    'good', 'great', 'excellent', 'agree', 'satisfied', 'positive'
  ];

  const negativeTerms = [
    'ተስፋ አስቆራጭ', 'በጣም አስቸጋሪ', 'አስቸጋሪ', 'ችግር አለበት', 'አልደግፍም',
    'በጣም ዝቅተኛ', 'ዝቅተኛ', 'ችግር', 'መዘግየት', 'ሙስና', 'ቅሬታ', 'ፍትህ እጦት',
    'ብልሹ', 'አልተሰራም', 'ድክመት', 'ይስተካከል', 'ውድነት', 'መቆራረጥ', 'ክፍተት',
    'bad', 'poor', 'terrible', 'disagree', 'dissatisfied', 'negative'
  ];

  for (const term of positiveTerms) {
    if (text.includes(term.toLowerCase())) {
      return { sentiment: 'positive', labelAm: 'አውንታዊ (በጎ)' };
    }
  }

  for (const term of negativeTerms) {
    if (text.includes(term.toLowerCase())) {
      return { sentiment: 'negative', labelAm: 'አሉታዊ (ትኩረት የሚሻ)' };
    }
  }

  return { sentiment: 'neutral', labelAm: 'ገለልተኛ (ሚዛናዊ)' };
}

export async function sendTelegramReport(
  analytics: SurveyAnalytics,
  botToken?: string,
  chatId?: string,
  aiReport?: AiReportResponse,
  detailedResponses?: any[]
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

  const { survey, total_responses, questions_analytics, demographics_analytics } = analytics;
  const ethDate = toEthiopianDate(new Date());
  const dateAm = ethDate.formattedAmharic;

  // Track itemized positive and negative feedback
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

  // Build Comprehensive CSV Document
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Amharic support
  csvContent += `"የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - የዳሰሳ ጥናትና የዜጎች ግብረ-መልስ ዝርዝር ሪፖርት"\n`;
  csvContent += `"የጥናቱ ርዕስ:","${(survey.title || '').replace(/"/g, '""')}"\n`;
  csvContent += `"መደብ:","${(survey.category || '').replace(/"/g, '""')}","ቀን:","${dateAm}","ጠቅላላ ተሳታፊዎች:","${total_responses}"\n`;
  if (aiReport?.satisfaction_score) {
    csvContent += `"የሕዝብ እርካታ ደረጃ:","${aiReport.satisfaction_score}%"\n`;
  }
  csvContent += `\n`;

  // 1. INDIVIDUAL CITIZEN RESPONSES (Person-by-Person Q&A)
  csvContent += `"--- ክፍል 1፡ የእያንዳንዱ ተሳታፊ ዝርዝር ጥያቄና መልስ (INDIVIDUAL RESPONDENT BREAKDOWN) ---"\n`;
  csvContent += `"ተሳታፊ (Respondent ID)","ዕድሜ (Age)","ጾታ (Gender)","ትምህርት (Education)","መኖሪያ (Residence)","የተመዘገበበት ቀን","የጥያቄ ቁጥር","ጥያቄ (Question)","ዓይነት (Type)","የተሰጠ መልስ / ውጤት (Given Answer)","የስሜት ምደባ (Sentiment)"\n`;

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
        const qText = (ans.question_text || `ጥያቄ ${ans.question_id || qIdx + 1}`).replace(/"/g, '""');
        const qType = ans.question_type || 'text';
        let ansDisplay = '';
        if (qType === 'rating') {
          ansDisplay = `${ans.rating_value || 0} ኮከብ (ከ 5)`;
        } else {
          ansDisplay = ans.answer_text || 'ባዶ';
        }

        const sentimentInfo = classifyAnswerSentiment(qType, ans.answer_text, ans.rating_value);

        // Collect into categorized lists
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

        csvContent += `"${respId}","${age}","${gender}","${edu}","${res}","${ethRespDate}","${qIdx + 1}","${qText}","${qType}","${ansDisplay.replace(/"/g, '""')}","${sentimentInfo.labelAm}"\n`;
      });
    }
  } else {
    csvContent += `"እስካሁን በዚህ ጥናት ላይ የተመዘገበ የዜጎች ምላሽ የለም:: (No responses submitted yet)"\n`;
  }

  // 2. POSITIVE FEEDBACK SECTION (በአውንታ የቀረቡ ሀሳብና አስተያየቶች)
  csvContent += `\n"--- ክፍል 2፡ በአውንታ የቀረቡ ሀሳብና አስተያየቶች (POSITIVE FEEDBACK & ENDORSEMENTS - ጠቅላላ: ${positiveList.length}) ---"\n`;
  csvContent += `"ተሳታፊ ቁጥር","መኖሪያ","የተሳታፊ ጾታ/ዕድሜ","የጥያቄው ርዕስ","አውንታዊ ግብረ-መልስ / ውጤት","ደረጃ"\n`;
  if (positiveList.length > 0) {
    positiveList.forEach((p) => {
      csvContent += `"${p.respId}","${p.residence}","${p.gender} / ${p.ageGroup}","${p.questionText}","${p.answerDisplay.replace(/"/g, '""')}","🟢 አውንታዊ (በጎ)"\n`;
    });
  } else {
    csvContent += `"ምንም አውንታዊ አስተያየት እስካሁን አልተመዘገበም"\n`;
  }

  // 3. NEGATIVE / CRITICAL CONCERNS SECTION (በአሉታ የቀረቡ ቅሬታዎችና ክፍተቶች)
  csvContent += `\n"--- ክፍል 3፡ በአሉታ የቀረቡ ቅሬታዎችና ትኩረት የሚሹ ጉዳዮች (NEGATIVE & CRITICAL CONCERNS - ጠቅላላ: ${negativeList.length}) ---"\n`;
  csvContent += `"ተሳታፊ ቁጥር","መኖሪያ","የተሳታፊ ጾታ/ዕድሜ","የጥያቄው ርዕስ","አሉታዊ ቅሬታ / ዝቅተኛ ነጥብ / ክፍተት","ደረጃ"\n`;
  if (negativeList.length > 0) {
    negativeList.forEach((n) => {
      csvContent += `"${n.respId}","${n.residence}","${n.gender} / ${n.ageGroup}","${n.questionText}","${n.answerDisplay.replace(/"/g, '""')}","🔴 አሉታዊ (ትኩረት የሚሻ)"\n`;
    });
  } else {
    csvContent += `"ምንም አሉታዊ ቅሬታ እስካሁን አልተመዘገበም"\n`;
  }

  // 4. NEUTRAL & RECOMMENDATIONS SECTION
  if (neutralList.length > 0) {
    csvContent += `\n"--- ክፍል 4፡ ገለልተኛና ሚዛናዊ አስተያየቶች (NEUTRAL & CONSTRUCTIVE FEEDBACK - ጠቅላላ: ${neutralList.length}) ---"\n`;
    csvContent += `"ተሳታፊ ቁጥር","መኖሪያ","የተሳታፊ ጾታ/ዕድሜ","የጥያቄው ርዕስ","ገለልተኛ አስተያየት / ምርጫ","ደረጃ"\n`;
    neutralList.forEach((nu) => {
      csvContent += `"${nu.respId}","${nu.residence}","${nu.gender} / ${nu.ageGroup}","${nu.questionText}","${nu.answerDisplay.replace(/"/g, '""')}","⚪ ገለልተኛ"\n`;
    });
  }

  // 5. DEMOGRAPHICS SUMMARY
  if (demographics_analytics) {
    csvContent += `\n"--- ክፍል 5፡ የተሳታፊው ስነ-ሕዝብ ማጠቃለያ (DEMOGRAPHICS SUMMARY) ---"\n`;
    csvContent += `"ዘርፍ (Category)","ንዑስ ክፍል (Label)","ብዛት (Count)","መቶኛ (Percentage)"\n`;
    (demographics_analytics.age_distribution || []).forEach((item) => {
      csvContent += `"ዕድሜ (Age Group)","${item.label}","${item.count}","${item.percentage}%"\n`;
    });
    (demographics_analytics.gender_distribution || []).forEach((item) => {
      csvContent += `"ጾታ (Gender)","${item.label}","${item.count}","${item.percentage}%"\n`;
    });
    (demographics_analytics.education_distribution || []).forEach((item) => {
      csvContent += `"ትምህርት (Education)","${item.label}","${item.count}","${item.percentage}%"\n`;
    });
    (demographics_analytics.residence_distribution || []).forEach((item) => {
      csvContent += `"መኖሪያ (Residence)","${item.label}","${item.count}","${item.percentage}%"\n`;
    });
  }

  // 6. QUESTION ANALYTICS AGGREGATE
  csvContent += `\n"--- ክፍል 6፡ የጥያቄዎች ማጠቃለያ ስታቲስቲክስ (QUESTION ANALYTICS AGGREGATE) ---"\n`;
  csvContent += `"ጥያቄ ቁጥር","የጥያቄው ርዕስ","ዓይነት","አማካኝ/መልሶች"\n`;
  questions_analytics.forEach((q, idx) => {
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

  const fileName = `DGC_Survey_${survey.id}_Detailed_Responses_${ethDate.year}_${ethDate.month}_${ethDate.day}.csv`;
  
  // Telegram Caption
  let caption = `📊 *ኦፊሴላዊ የዳሰሳ ጥናትና የዜጎች አስተያየት ሪፖርት*\n`;
  caption += `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  caption += `📌 *ርዕስ:* ${escapeMarkdown(survey.title)}\n`;
  caption += `📅 *ቀን:* ${escapeMarkdown(dateAm)} | 👥 *ተሳታፊዎች:* *${total_responses}*\n`;
  if (aiReport?.satisfaction_score) {
    caption += `🌟 *የሕዝብ እርካታ ደረጃ:* *${aiReport.satisfaction_score}%*\n`;
  }

  const totalClassified = positiveList.length + negativeList.length + neutralList.length;
  if (totalClassified > 0) {
    const posPct = Math.round((positiveList.length / totalClassified) * 100);
    const negPct = Math.round((negativeList.length / totalClassified) * 100);
    caption += `\n*የስሜት ትንተና (Sentiment Breakdown):*\n`;
    caption += `🟢 *አውንታዊ ግብረ-መልስ:* *${posPct}%* (${positiveList.length} ምላሾች)\n`;
    caption += `🔴 *አሉታዊና ትኩረት የሚሹ:* *${negPct}%* (${negativeList.length} ቅሬታዎች/ክፍተቶች)\n`;
  }

  caption += `\n📎 *ፋይል:* \`${fileName}\`\n`;
  caption += `(የእያንዳንዱ ተሳታፊ ጥያቄና መልስ + አውንታዊ እና አሉታዊ ዝርዝር የያዘ)`;

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
  
  // Track daily sentiment
  const dailyPosList: any[] = [];
  const dailyNegList: any[] = [];

  // Question map for rapid lookup
  const questionMap = new Map<number, any>();
  for (const s of surveysData.surveys) {
    for (const q of (s.questions || [])) {
      questionMap.set(q.id, { ...q, surveyTitle: s.title });
    }
  }

  // 1. Build Comprehensive CSV Data Export
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Amharic support
  csvContent += `"የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ - የ24 ሰዓት የዳታ ቋትና የዜጎች አስተያየት ሪፖርት"\n`;
  csvContent += `"ቀን (Ethiopian Date):","${dateAm}"\n`;
  csvContent += `"ጠቅላላ ጥናቶች:","${surveysData.surveys.length}","ጠቅላላ ምላሾች:","${surveysData.responses.length}","ጠቅላላ አቤቱታዎች:","${surveysData.tickets.length}"\n\n`;

  csvContent += `"--- ክፍል 1፡ የእያንዳንዱ ተሳታፊ ዝርዝር ጥያቄና መልስ (Individual Citizen Survey Responses) ---"\n`;
  csvContent += `"Response ID","Survey ID","Survey Title","Age Group","Gender","Education","Residence","Submitted At (ET)","Question Text","Question Type","Given Answer","Sentiment"\n`;

  // Map answers to each response
  const answersByRespId: Record<number, any[]> = {};
  for (const ans of (surveysData.answers || [])) {
    if (!answersByRespId[ans.response_id]) answersByRespId[ans.response_id] = [];
    answersByRespId[ans.response_id].push(ans);
  }

  for (const resp of surveysData.responses) {
    const survey = surveysData.surveys.find((s) => s.id === resp.survey_id);
    const surveyTitle = (survey?.title || 'Unknown').replace(/"/g, '""');
    const ethRespDate = toEthiopianDate(resp.submitted_at).formattedAmharic;
    const respAnswers = answersByRespId[resp.id] || [];

    if (respAnswers.length > 0) {
      for (const ans of respAnswers) {
        const qInfo = questionMap.get(ans.question_id);
        const qText = (qInfo?.question_text || `ጥያቄ ${ans.question_id}`).replace(/"/g, '""');
        const qType = qInfo?.question_type || (ans.rating_value ? 'rating' : 'text');
        const ansDisplay = ans.rating_value ? `${ans.rating_value} ኮከብ (ከ 5)` : (ans.answer_text || 'ባዶ');
        const sentiment = classifyAnswerSentiment(qType, ans.answer_text, ans.rating_value);

        if (sentiment.sentiment === 'positive') {
          dailyPosList.push({ respId: resp.id, surveyTitle, residence: resp.residence, qText, ansDisplay });
        } else if (sentiment.sentiment === 'negative') {
          dailyNegList.push({ respId: resp.id, surveyTitle, residence: resp.residence, qText, ansDisplay });
        }

        csvContent += `"${resp.id}","${resp.survey_id}","${surveyTitle}","${resp.age_group || 'N/A'}","${resp.gender || 'N/A'}","${resp.education || 'N/A'}","${resp.residence || 'N/A'}","${ethRespDate}","${qText}","${qType}","${ansDisplay.replace(/"/g, '""')}","${sentiment.labelAm}"\n`;
      }
    } else {
      csvContent += `"${resp.id}","${resp.survey_id}","${surveyTitle}","${resp.age_group || 'N/A'}","${resp.gender || 'N/A'}","${resp.education || 'N/A'}","${resp.residence || 'N/A'}","${ethRespDate}","N/A","N/A","N/A","N/A"\n`;
    }
  }

  // 2. POSITIVE FEEDBACK LIST
  csvContent += `\n"--- ክፍል 2፡ በአውንታ የቀረቡ ሀሳብና አስተያየቶች (Positive Feedback Summary - ጠቅላላ: ${dailyPosList.length}) ---"\n`;
  csvContent += `"Response ID","Survey Title","Residence","Question","Answer / Endorsement","Status"\n`;
  if (dailyPosList.length > 0) {
    dailyPosList.forEach((p) => {
      csvContent += `"${p.respId}","${p.surveyTitle}","${p.residence || 'N/A'}","${p.qText}","${p.ansDisplay.replace(/"/g, '""')}","🟢 አውንታዊ (በጎ)"\n`;
    });
  } else {
    csvContent += `"ምንም አውንታዊ አስተያየት አልተመዘገበም"\n`;
  }

  // 3. NEGATIVE / CRITICAL LIST
  csvContent += `\n"--- ክፍል 3፡ በአሉታ የቀረቡ ቅሬታዎችና ትኩረት የሚሹ ክፍተቶች (Negative & Critical Concerns - ጠቅላላ: ${dailyNegList.length}) ---"\n`;
  csvContent += `"Response ID","Survey Title","Residence","Question","Grievance / Bottleneck / Low Rating","Status"\n`;
  if (dailyNegList.length > 0) {
    dailyNegList.forEach((n) => {
      csvContent += `"${n.respId}","${n.surveyTitle}","${n.residence || 'N/A'}","${n.qText}","${n.ansDisplay.replace(/"/g, '""')}","🔴 አሉታዊ (ትኩረት የሚሻ)"\n`;
    });
  } else {
    csvContent += `"ምንም አሉታዊ ቅሬታ አልተመዘገበም"\n`;
  }

  // 4. CITIZEN TICKETS
  csvContent += `\n"--- ክፍል 4፡ የዜጎች አቤቱታዎችና ጥያቄዎች ዝርዝር (Citizen Tickets) ---"\n`;
  csvContent += `"Ticket Code","Category","Priority","Status","Residence","Subject","Submitted At (ET)"\n`;

  for (const t of (surveysData.tickets || [])) {
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
  if (dailyPosList.length + dailyNegList.length > 0) {
    pdfCaption += `🟢 *አውንታዊ ምላሾች:* *${dailyPosList.length}* | 🔴 *አሉታዊ ቅሬታዎች:* *${dailyNegList.length}*\n`;
  }
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
  csvCaption += `📁 *አባሪ:* \`${csvFileName}\` (የእያንዳንዱ ተሳታፊ ጥያቄና መልስ + አውንታዊ እና አሉታዊ ዝርዝር የያዘ)`;

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

/**
 * Real-time individual survey submission alert sent immediately to Telegram.
 * Delivers respondent demographics, today's participation counts for woreda and survey,
 * and individual Q&A with positive/negative/neutral sentiment indicators.
 */
export async function sendRealtimeSurveySubmissionAlert(params: {
  surveyId: number;
  surveyTitle: string;
  category: string;
  responseId: number;
  demographics: {
    age_group?: string;
    gender?: string;
    education?: string;
    residence?: string;
  };
  answers: Array<{
    question_id: number;
    question_text: string;
    question_type: string;
    answer_text?: string;
    rating_value?: number;
  }>;
  stats: {
    todaySurveyTotal: number;
    todayWoredaTotal: number;
    allTimeSurveyTotal: number;
  };
  botToken?: string;
  chatId?: string;
}): Promise<{ success: boolean; message: string }> {
  const token = params.botToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const rawChatId = params.chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const targetChatId = formatTelegramChatId(rawChatId);

  if (!token || !targetChatId) {
    return {
      success: false,
      message: 'የTelegram Bot Token ወይም Chat ID አልተዋቀረም',
    };
  }

  const escapeHtml = (text?: string | null): string => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const ethDate = toEthiopianDate(new Date());
  const dateAm = ethDate.formattedAmharic;
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const res = params.demographics.residence || 'ያልተገለጸ';
  const age = params.demographics.age_group || 'ያልተገለጸ';
  const gender = params.demographics.gender || 'ያልተገለጸ';
  const edu = params.demographics.education || 'ያልተገለጸ';

  // Format Individual Questions & Answers
  const answersListHtml = (params.answers || []).map((ans, idx) => {
    const sentiment = classifyAnswerSentiment(ans.question_type, ans.answer_text, ans.rating_value);
    const badge =
      sentiment.sentiment === 'positive'
        ? '🟢 አውንታዊ'
        : sentiment.sentiment === 'negative'
        ? '🔴 አሉታዊ'
        : '⚪ ገለልተኛ';

    let displayVal = '';
    if (ans.question_type === 'rating') {
      displayVal = `⭐ <b>${ans.rating_value || 0} / 5</b> (${sentiment.labelAm})`;
    } else {
      const trimmed = (ans.answer_text || 'ባዶ').trim();
      const shortVal = trimmed.length > 300 ? trimmed.substring(0, 300) + '...' : trimmed;
      displayVal = `<b>${escapeHtml(shortVal)}</b> [${badge}]`;
    }

    const shortQ = ans.question_text.length > 120 ? ans.question_text.substring(0, 120) + '...' : ans.question_text;
    return `<b>ጥያቄ ${idx + 1}:</b> <i>${escapeHtml(shortQ)}</i>\n👉 <b>ምላሽ:</b> ${displayVal}`;
  }).join('\n\n');

  let messageHtml = `🔔 <b>አዲስ የዜጋ የሰርቬይ ምላሽ ተመዝግቧል! (Live Submission)</b>\n`;
  messageHtml += `🏢 <b>የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</b>\n`;
  messageHtml += `━━━━━━━━━━━━━━━━━━━━━\n`;
  messageHtml += `📌 <b>ጥናት:</b> <b>${escapeHtml(params.surveyTitle)}</b>\n`;
  messageHtml += `🏷️ <b>መደብ:</b> ${escapeHtml(params.category || 'አጠቃላይ')} | 🆔 <b>መለያ:</b> <code>#${params.responseId}</code>\n\n`;

  messageHtml += `👤 <b>የተሳታፊው ስነ-ሕዝብ (Demographics):</b>\n`;
  messageHtml += `• 📍 <b>መኖሪያ / ወረዳ:</b> <b>${escapeHtml(res)}</b>\n`;
  messageHtml += `• 👥 <b>ዕድሜ:</b> ${escapeHtml(age)} | <b>ጾታ:</b> ${escapeHtml(gender)}\n`;
  messageHtml += `• 🎓 <b>ትምህርት:</b> ${escapeHtml(edu)}\n\n`;

  messageHtml += `📊 <b>የቀን ተሳትፎ ማጠቃለያ (Daily Turnout):</b>\n`;
  messageHtml += `• 📅 <b>ዛሬ የተሳተፉ ጠቅላላ ዜጎች:</b> <b>${params.stats.todaySurveyTotal}</b> ሰዎች\n`;
  messageHtml += `• 📍 <b>ከዚህ ወረዳ (${escapeHtml(res)}) ዛሬ:</b> <b>${params.stats.todayWoredaTotal}</b> ሰዎች ተሳትፈዋል\n`;
  messageHtml += `• 🌐 <b>የዚህ ጥናት ጠቅላላ ተሳታፊ:</b> <b>${params.stats.allTimeSurveyTotal}</b> ሰዎች\n\n`;

  messageHtml += `📝 <b>የዜጋው ዝርዝር መልሶች (Citizen's Answers):</b>\n`;
  messageHtml += `${answersListHtml}\n\n`;

  messageHtml += `🕒 <b>የተመዘገበበት ሰዓት:</b> ${escapeHtml(dateAm)} [${timeStr}]\n`;
  messageHtml += `━━━━━━━━━━━━━━━━━━━━━\n`;
  messageHtml += `🤖 <i>OPA AI Civics Engine • ራስ-ሰር የቀጥታ ማሳወቂያ</i>`;

  // Safe length check (Telegram message limit is 4096)
  if (messageHtml.length > 4000) {
    messageHtml = messageHtml.substring(0, 3950) + '\n\n... <i>(ሙሉው መረጃ በዳታቤዝ ውስጥ ተመዝግቧል)</i>';
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: messageHtml,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true, message: 'የቀጥታ ማሳወቂያ ወደ Telegram በስኬት ተልኳል' };
    } else {
      console.warn('Telegram API error on live alert:', data.description);
      return { success: false, message: `Telegram Error: ${data.description}` };
    }
  } catch (err: any) {
    console.error('Failed to send live alert to Telegram:', err);
    return { success: false, message: err.message };
  }
}



