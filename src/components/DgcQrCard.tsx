import React, { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import { Download, Copy, Check, QrCode } from 'lucide-react';

interface DgcQrCardProps {
  url: string;
  surveyTitle?: string;
  onClose?: () => void;
}

// Helper to safely draw rounded rectangles on HTML5 Canvas across all browser engines
const safeRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

export const DgcQrCard: React.FC<DgcQrCardProps> = ({ url, surveyTitle, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const [fallbackDataUrl, setFallbackDataUrl] = useState<string | null>(null);

  useEffect(() => {
    generateBrandedQr();
  }, [url]);

  const generateBrandedQr = async () => {
    setIsGenerating(true);
    try {
      // 1. Generate crisp high-contrast QR Code data URL fallback
      const simpleQrDataUrl = await QRCodeLib.toDataURL(url, {
        width: 400,
        margin: 4,
        color: { dark: '#022b69', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      setFallbackDataUrl(simpleQrDataUrl);

      // 2. Generate pure QR matrix on offscreen canvas
      const qrCanvas = document.createElement('canvas');
      await QRCodeLib.toCanvas(qrCanvas, url, {
        width: 480,
        margin: 4, // Clean 4-module quiet zone
        color: {
          dark: '#022b69', // Deep High-Contrast Royal DGC Blue
          light: '#ffffff', // Pure white background
        },
        errorCorrectionLevel: 'H', // High error correction allowance (up to 30%)
      });

      // 3. Main Poster Canvas (800 x 950 px high-res)
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 800;
      const height = 950;
      canvas.width = width;
      canvas.height = height;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // --- Outer Card Frame Line ---
      ctx.save();
      safeRoundRect(ctx, 24, 24, width - 48, height - 48, 36);
      ctx.strokeStyle = '#0252c4';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Top Gold Accent Stripe
      safeRoundRect(ctx, 40, 24, width - 80, 10, 5);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.restore();

      // --- TOP HEADER: DGC BRANDING ---
      ctx.textAlign = 'center';

      // "D G C" Large Display Logo
      ctx.font = '900 64px sans-serif';
      ctx.textBaseline = 'top';

      // Draw D G C
      ctx.fillStyle = '#0252c4';
      ctx.fillText('D', 330, 52);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('G', 400, 52);
      ctx.fillStyle = '#0252c4';
      ctx.fillText('C', 470, 52);

      // Subtitle Amharic & English
      ctx.fillStyle = '#0252c4';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('ድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ', 400, 132);

      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('DIRE DAWA GOVERNMENT COMMUNICATION AFFAIRS BUREAU', 400, 164);

      // Small Divider Line
      ctx.beginPath();
      ctx.moveTo(150, 192);
      ctx.lineTo(650, 192);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // --- INNER QR FRAME CONTAINER ---
      const frameX = 140;
      const frameY = 210;
      const frameSize = 520;
      const cornerRadius = 28;

      // Outer Frame Box
      ctx.save();
      safeRoundRect(ctx, frameX, frameY, frameSize, frameSize, cornerRadius);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0252c4';
      ctx.stroke();
      ctx.restore();

      // --- DRAW PRISTINE GENERATED QR CODE (DO NOT OVERDRAW CORNER FINDERS!) ---
      const qrOffset = 30;
      const qrDrawSize = frameSize - qrOffset * 2; // 460 x 460
      ctx.drawImage(qrCanvas, frameX + qrOffset, frameY + qrOffset, qrDrawSize, qrDrawSize);

      // --- MINI CENTER LOGO BADGE (Small & safe for Error Correction H) ---
      const centerX = frameX + frameSize / 2;
      const centerY = frameY + frameSize / 2;
      const miniBadgeRadius = 26; // Very small circle (52px in 460px QR = <1.3% area)

      ctx.save();
      // White Base Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, miniBadgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Gold & Blue Outer Border
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, miniBadgeRadius - 3, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0252c4';
      ctx.stroke();

      // Mini "DGC" Text
      ctx.font = '900 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0252c4';
      ctx.fillText('DGC', centerX, centerY);
      ctx.restore();

      // --- BOTTOM CARD FOOTER ---
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('የሕዝብ አስተያየትና የፖሊሲ ጥናት መጠይቅ', 400, 755);

      ctx.fillStyle = '#0252c4';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('📱 በስልክዎ ካሜራ QR ኮዱን ስካን በማድረግ በስነ-ስርዓት ይሳተፉ', 400, 792);

      ctx.fillStyle = '#64748b';
      ctx.font = 'medium 13px sans-serif';
      ctx.fillText('Scan with phone camera or QR reader to participate directly', 400, 820);

      // Convert canvas to high-res PNG
      const dataUrl = canvas.toDataURL('image/png');
      setDownloadUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate branded QR code:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        if (onClose) onClose();
      }, 900);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const handleDownloadClick = () => {
    setTimeout(() => {
      if (onClose) onClose();
    }, 600);
  };

  const currentDownloadUrl = downloadUrl || fallbackDataUrl;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-5 text-center shadow-2xl relative">
      {/* Header Modal Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
          <QrCode className="w-5 h-5 text-amber-400" />
          <span>የድሬዳዋ ኮሙኒኬሽን ብራንደድ QR ኮድ</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-black text-sm p-1 rounded-lg bg-slate-800"
          >
            ✕
          </button>
        )}
      </div>

      {surveyTitle && (
        <p className="text-xs font-bold text-slate-200 line-clamp-2 px-2">{surveyTitle}</p>
      )}

      {/* Rendered Canvas / Fallback Preview */}
      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 inline-block shadow-inner mx-auto max-w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`w-64 sm:w-72 h-auto mx-auto rounded-xl shadow-lg bg-white ${
            downloadUrl ? 'block' : 'hidden'
          }`}
        />
        {!downloadUrl && fallbackDataUrl && (
          <img
            src={fallbackDataUrl}
            alt="Survey QR Code"
            className="w-64 sm:w-72 h-auto mx-auto rounded-xl shadow-lg bg-white p-2"
          />
        )}
        {isGenerating && !downloadUrl && !fallbackDataUrl && (
          <div className="w-64 sm:w-72 h-64 bg-slate-900 flex items-center justify-center text-amber-400 font-bold text-xs animate-pulse">
            ብራንደድ QR ኮድ በመዘጋጀት ላይ...
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-slate-300 font-medium">
        ይህንን ኦፊሴላዊ የድሬዳዋ ኮሙኒኬሽን QR ኮድ ዳውንሎድ በማድረግ ለህዝብ ማሰራጨት ወይም በፕሪንት መጠቀም ይችላሉ::
      </p>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={copyShareLink}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-400" />}
          <span>{copied ? 'ሊንኩ ኮፒ ተደርጓል! ✓' : 'የጥናቱን ሊንክ ኮፒ አድርግ (Copy Link)'}</span>
        </button>

        {currentDownloadUrl && (
          <a
            href={currentDownloadUrl}
            download="DireDawa_Communication_Survey_QR.png"
            onClick={handleDownloadClick}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-slate-700 shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>QR ኮዱን ዳውንሎድ አድርግ (.PNG)</span>
          </a>
        )}
      </div>
    </div>
  );
};
