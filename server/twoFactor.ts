/// <reference path="../globals.d.ts" />
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

export interface TwoFactorSetupResult {
  secret: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Generate a new TOTP secret, otpauth:// URI, and Base64 QR code image
 * for Google Authenticator / Microsoft Authenticator enrollment.
 */
export async function generateTwoFactorSetup(
  userEmail: string,
  appName: string = 'DGC Dire Dawa Portal'
): Promise<TwoFactorSetupResult> {
  const secret = generateSecret();
  const otpAuthUrl = generateURI({
    issuer: appName,
    label: userEmail,
    secret,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    width: 256,
  });

  return {
    secret,
    otpAuthUrl,
    qrCodeDataUrl,
  };
}

/**
 * Verify a 6-digit TOTP code against a user's secret
 */
export function verifyTwoFactorToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.toString().trim().replace(/\s+/g, '');
  try {
    const res = verifySync({ token: cleanToken, secret });
    return Boolean(res && res.valid);
  } catch (err) {
    console.error('[2FA Verification Error]:', err);
    return false;
  }
}
