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
      // Generate basic QR code data URL first as a safe fallback
      const simpleQrDataUrl = await QRCodeLib.toDataURL(url, {
        width: 360,
        margin: 2,
        color: { dark: '#0252c4', light: '#ffffff' },
      });
      setFallbackDataUrl(simpleQrDataUrl);

      // 1. Generate QR Code Matrix on offscreen canvas
      const qrCanvas = document.createElement('canvas');
      await QRCodeLib.toCanvas(qrCanvas, url, {
        width: 480,
        margin: 2,
        color: {
          dark: '#032b69', // Royal DGC Blue for QR modules
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      // 2. Main Template Canvas (800 x 920 px high-res)
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 800;
      const height = 920;
      canvas.width = width;
      canvas.height = height;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // --- Outer Shield / Fan Border Outline ---
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(180, 20);
      ctx.lineTo(620, 20);
      ctx.bezierCurveTo(720, 20, 780, 100, 750, 240);
      ctx.lineTo(680, 840);
      ctx.bezierCurveTo(675, 880, 640, 900, 600, 900);
      ctx.lineTo(200, 900);
      ctx.bezierCurveTo(160, 900, 125, 880, 120, 840);
      ctx.lineTo(50, 240);
      ctx.bezierCurveTo(20, 100, 80, 20, 180, 20);
      ctx.closePath();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // --- TOP HEADER: DGC LOGO ---
      // D
      ctx.fillStyle = '#0252c4';
      ctx.font = '900 85px sans-serif';
      ctx.fillText('D', 260, 120);

      // G
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('G', 355, 120);

      // C
      ctx.fillStyle = '#0252c4';
      ctx.fillText('C', 450, 120);

      // Subtitle Amharic & English
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0252c4';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('ድሬዳዋ መንግስት ኮሙዩኒኬሽን', 400, 160);

      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Dire Dawa Government Communication', 400, 188);

      // --- INNER QR FRAME ---
      const frameX = 140;
      const frameY = 220;
      const frameSize = 520;
      const cornerRadius = 36;

      // Draw Outer Frame Box
      ctx.save();
      safeRoundRect(ctx, frameX, frameY, frameSize, frameSize, cornerRadius);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#0252c4';
      ctx.stroke();

      // Top Gold Accent Bar
      safeRoundRect(ctx, frameX + 30, frameY - 2, frameSize - 60, 12, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.restore();

      // --- DRAW GENERATED QR CODE ---
      const qrOffset = 40;
      const qrDrawSize = frameSize - qrOffset * 2;
      ctx.drawImage(qrCanvas, frameX + qrOffset, frameY + qrOffset, qrDrawSize, qrDrawSize);

      // --- 3 CORNER FINDER BADGES ---
      const drawCustomFinder = (cx: number, cy: number) => {
        ctx.save();
        // Outer Blue Rounded Box
        safeRoundRect(ctx, cx - 36, cy - 36, 72, 72, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#0252c4';
        ctx.stroke();

        // Inner Yellow Dot
        safeRoundRect(ctx, cx - 16, cy - 16, 32, 32, 8);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.restore();
      };

      drawCustomFinder(frameX + 60, frameY + 60); // Top Left
      drawCustomFinder(frameX + frameSize - 60, frameY + 60); // Top Right
      drawCustomFinder(frameX + 60, frameY + frameSize - 60); // Bottom Left

      // --- CENTER CIRCULAR DGC BADGE ---
      const centerX = frameX + frameSize / 2;
      const centerY = frameY + frameSize / 2;
      const badgeRadius = 60;

      ctx.save();
      // Black Background Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1329';
      ctx.fill();

      // Double Gold/Blue Outer Border Ring
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, badgeRadius - 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0252c4';
      ctx.stroke();

      // Center DGC Text
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Mini D, G, C
      ctx.fillStyle = '#0284c7';
      ctx.fillText('D', centerX - 26, centerY - 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('G', centerX, centerY - 6);
      ctx.fillStyle = '#0284c7';
      ctx.fillText('C', centerX + 26, centerY - 6);

      // Mini text underneath logo
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('ድሬዳዋ ኮሙዩኒኬሽን', centerX, centerY + 20);
      ctx.restore();

      // Convert canvas to data URL for download
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
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const currentDownloadUrl = downloadUrl || fallbackDataUrl;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-5 text-center shadow-2xl relative">
      {/* Header Modal Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
          <QrCode className="w-5 h-5 text-amber-400" />
          <span>የድሬዳዋ ኮሙዩኒኬሽን ብራንደድ QR ኮድ</span>
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
        ይህንን ኦፊሴላዊ የድሬዳዋ ኮሙዩኒኬሽን QR ኮድ ዳውንሎድ በማድረግ ለህዝብ ማሰራጨት ወይም በፕሪንት መጠቀም ይችላሉ::
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
