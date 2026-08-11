import { SurveyAnalytics } from '../src/types';

// Default user-configured Telegram Bot & Channel
export const DEFAULT_TELEGRAM_BOT_TOKEN = '8731468553:AAFk8GM8EKAnt1-_Q8iRjS1ZV7isiBqOFpU';
export const DEFAULT_TELEGRAM_CHAT_ID = '-1002746235318';

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
  chatId?: string
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

  let textMsg = `📊 *የሕዝብ አስተያየት ጥናት ሪፖርት / PUBLIC OPINION REPORT*\n\n`;
  textMsg += `📌 *ርዕስ:* ${survey.title}\n`;
  textMsg += `📁 *መደብ:* ${survey.category}\n`;
  textMsg += `👥 *አጠቃላይ የመለሱ ሰዎች ብዛት:* *${total_responses}*\n`;
  textMsg += `📅 *የተዘጋጀበት ቀን:* ${new Date().toLocaleDateString('am-ET', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
  textMsg += `------------------------------------\n\n`;

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
      const recent = q.text_responses.slice(0, 3);
      if (recent.length > 0) {
        textMsg += `  *ምሳሌዎች:*\n`;
        recent.forEach((t) => {
          textMsg += `  - "${t.answer_text}"\n`;
        });
      }
    }
    textMsg += `\n`;
  });

  textMsg += `🔒 *የድሬዳዋ አስተዳደር የመንግስት ኮሙዩኒኬሽን ጉዳዮች ቢሮ*`;

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
      return { success: true, message: 'ሪፖርቱ ወደ Telegram በስኬት ተልኳል!' };
    } else {
      return { success: false, message: `Telegram Error: ${data.description || 'ለማላክ አልተቻለም'}` };
    }
  } catch (err: any) {
    return { success: false, message: `ለTelegram መላክ አልተቻለም: ${err.message}` };
  }
}
