import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getMailTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export async function sendTicketRecoveryOtp(toEmail: string, otp: string): Promise<boolean> {
  const mailer = getMailTransporter();
  const fromAddress = process.env.SMTP_FROM || '"Dire Dawa Public Survey" <no-reply@dgc.gov.et>';

  if (!mailer) {
    console.log(`\n========================================`);
    console.log(`[DEVELOPMENT EMAIL OTP SIMULATION]`);
    console.log(`To: ${toEmail}`);
    console.log(`Recovery OTP Code: [ ${otp} ]`);
    console.log(`Expiry: 10 minutes (Single-Use)`);
    console.log(`Note: Configure SMTP_USER and SMTP_PASS in .env to send real emails.`);
    console.log(`========================================\n`);
    return true;
  }

  const subject = 'የክትትል ኮድ ማረጋገጫ (Ticket Recovery OTP) - የድሬዳዋ አስተዳደር';
  const textContent = `ሰላም,\n\nለአቤቱታ/ጥያቄ የክትትል ኮድ መፈለጊያ የጠየቁት የማረጋገጫ ኮድ (OTP)፦\n\n${otp}\n\nይህ ኮድ ለ 10 ደቂቃ ብቻ የሚያገለግል ሲሆን ለአንድ ጊዜ አገልግሎት ብቻ ነው። ይህንን ኮድ ለማንም አያጋሩ።\n\nየድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 24px; text-align: center; border-bottom: 1px solid #334155;">
        <h2 style="margin: 0; color: #f59e0b; font-size: 20px; font-weight: 800;">የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን</h2>
        <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">የአቤቱታና ጥያቄ ክትትል ማረጋገጫ (Ticket Recovery OTP)</p>
      </div>
      <div style="padding: 28px 24px; text-align: center;">
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px; line-height: 1.6;">
          የተረሳ የአቤቱታ ወይም የጥያቄ ክትትል ኮድዎን ለማግኘት የጠየቁት ጊዜያዊ የማረጋገጫ ኮድ (OTP) ከዚህ በታች ተዘጋጅቷል፦
        </p>
        <div style="background-color: #1e293b; border: 2px dashed #f59e0b; border-radius: 12px; padding: 18px; margin: 20px 0; display: inline-block; width: 80%;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #38bdf8;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 15px;">
          ⏳ <strong>የቆይታ ጊዜ፦</strong> 10 ደቂቃ ብቻ (ለአንድ ጊዜ አገልግሎት)
        </p>
        <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #ef4444; line-height: 1.5; margin: 0;">
          ⚠️ <strong>ማስጠንቀቂያ፦</strong> ይህንን ኮድ ለማንም ሰው አያጋሩ! ይህንን ጥያቄ እርስዎ ካልጠየቁ እባክዎ ችላ ይበሉት።
        </p>
      </div>
      <div style="background-color: #0b1120; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
        © 2026 Dire Dawa Administration Government Communication. All rights reserved.
      </div>
    </div>
  `;

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('[Email Dispatch Error]:', error);
    return false;
  }
}
