import { SurveyAnalytics, AiReportResponse } from '../src/types';

// User-configured Telegram Bot & Channel
export const DEFAULT_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const DEFAULT_TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export function formatTelegramChatId(rawId?: string): string {
  if (!rawId) return DEFAULT_TELEGRAM_CHAT_ID;
  const trimmed = rawId.trim();
  if (trimmed.startsWith('100') && trimmed.length >= 12) {
    return `-${trimmed}`;
  }
  return trimmed;
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

  let textMsg = `🏢 *የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ*\n`;
  textMsg += `📜 *ኦፊሴላዊ የሕዝብ አስተያየትና የፖሊሲ ሪፖርት*\n\n`;

  textMsg += `📌 *የጥናቱ ርዕስ:* ${survey.title}\n`;
  textMsg += `📁 *መደብ:* ${survey.category}\n`;
  textMsg += `👥 *የተሳተፉ ዜጎች ብዛት:* *${total_responses}*\n`;
  textMsg += `📅 *ቀን:* ${new Date().toLocaleDateString('am-ET', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;

  if (aiReport) {
    textMsg += `🔢 *የመዝገብ ቁጥር (Ref):* \`${aiReport.official_header.ref_code}\` \n`;
    textMsg += `🌟 *የሕዝብ እርካታ ደረጃ:* *${aiReport.satisfaction_score}%*\n\n`;

    textMsg += `📝 *[የፖሊሲ ማጠቃለያ]*\n${aiReport.executive_summary}\n\n`;

    if (aiReport.key_findings && aiReport.key_findings.length > 0) {
      textMsg += `🔑 *[ዋና ዋና ግኝቶች]*\n`;
      aiReport.key_findings.forEach((kf) => {
        textMsg += `  • ${kf}\n`;
      });
      textMsg += `\n`;
    }

    if (aiReport.policy_recommendations && aiReport.policy_recommendations.length > 0) {
      textMsg += `💡 *[የፖሊሲ ማሻሻያ ጥቆማዎች]*\n`;
      aiReport.policy_recommendations.forEach((pr) => {
        textMsg += `  • ${pr}\n`;
      });
      textMsg += `\n`;
    }
  }

  textMsg += `------------------------------------\n`;
  textMsg += `📊 *[የጥያቄዎች እና የመልሶች ስቲስቲክስ]*\n\n`;

  questions_analytics.forEach((q, idx) => {
    textMsg += `*${idx + 1}. ${q.question_text}*\n`;

    if (q.question_type === 'radio' && q.radio_data) {
      q.radio_data.forEach((r) => {
        textMsg += `  • ${r.option}: *${r.count}* (${r.percentage}%)\n`;
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
          textMsg += `  - "${t.answer_text.substring(0, 80)}..."\n`;
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

