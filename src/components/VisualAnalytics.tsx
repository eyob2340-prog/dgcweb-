import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Send,
  FileSpreadsheet,
  Star,
  Search,
  MessageSquare,
  BarChart3,
  PieChart as PieIcon,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
  Building2,
  FileText,
  UserCheck,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Award,
  ShieldCheck,
  Bot,
  X,
} from 'lucide-react';
import { Survey, SurveyAnalytics, AiReportResponse } from '../types';
import { toEthiopianDate } from '../lib/ethiopianDate';
import { DireDawaMapVisual } from './DireDawaMapVisual';
import { DgcLogo } from './DgcLogo';

interface VisualAnalyticsProps {
  surveys: Survey[];
  selectedSurveyId: number | null;
  onSelectSurvey: (id: number) => void;
  adminToken: string;
  initialShowReport?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export const VisualAnalytics: React.FC<VisualAnalyticsProps> = ({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
  adminToken,
  initialShowReport = false,
}) => {
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [textSearch, setTextSearch] = useState<string>('');
  
  // Official Policy Report State
  const [aiReport, setAiReport] = useState<AiReportResponse | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState<boolean>(false);
  const [showAiReport, setShowAiReport] = useState<boolean>(initialShowReport);

  // Progress Bar State for AI Generation & PDF Preparation
  const [reportProgress, setReportProgress] = useState<{
    percentage: number;
    stageLabel: string;
    isPreparing: boolean;
  }>({
    percentage: 0,
    stageLabel: '',
    isPreparing: false,
  });

  // Sync show report state when initialShowReport changes
  useEffect(() => {
    if (initialShowReport) {
      setShowAiReport(true);
      if (!aiReport && selectedSurveyId) {
        fetchAiReport(selectedSurveyId);
      }
    }
  }, [initialShowReport, selectedSurveyId]);

  // Telegram Modal & Export State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [telegramStatus, setTelegramStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Fetch analytics when selected survey changes
  useEffect(() => {
    if (!selectedSurveyId) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      setAiReport(null);
      setShowAiReport(false);
      try {
        const res = await fetch(`/api/admin/surveys/${selectedSurveyId}/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await res.json();
        if (res.ok) {
          setAnalytics(data.analytics);
        }
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedSurveyId, adminToken]);

  const fetchAiReport = async (surveyId: number) => {
    setLoadingAiReport(true);
    setReportProgress({
      isPreparing: true,
      percentage: 20,
      stageLabel: '1/4 የሕዝብ አስተያየቶችና ስነ-ሕዝብ ዳታዎች በመተንተን ላይ...',
    });

    const timer1 = setTimeout(() => {
      setReportProgress((prev) =>
        prev.isPreparing
          ? {
              ...prev,
              percentage: 50,
              stageLabel: '2/4 በGemini AI የኦፊሴላዊ የፖሊሲና የእርካታ ደረጃዎች በመቀመር ላይ...',
            }
          : prev
      );
    }, 900);

    const timer2 = setTimeout(() => {
      setReportProgress((prev) =>
        prev.isPreparing
          ? {
              ...prev,
              percentage: 80,
              stageLabel: '3/4 ባለ 6 ገፅ የA4 ሪፖርት መዋቅርና ኦፊሴላዊ ፎርማሊቲ በመቅረፅ ላይ...',
            }
          : prev
      );
    }, 2000);

    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/generate-ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (res.ok && data.report) {
        setAiReport(data.report);
        setReportProgress({
          isPreparing: false,
          percentage: 100,
          stageLabel: '4/4 ሪፖርቱ በስኬት ተዘጋጅቷል!',
        });
        return data.report;
      } else {
        setReportProgress({
          isPreparing: false,
          percentage: 0,
          stageLabel: 'ሪፖርት ማዘጋጀት አልተቻለም::',
        });
        return null;
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.error('AI Report fetch error:', err);
      setReportProgress({
        isPreparing: false,
        percentage: 0,
        stageLabel: 'ስህተት ተከሰተ::',
      });
      return null;
    } finally {
      setLoadingAiReport(false);
    }
  };

  const handleExportTelegram = async () => {
    if (!selectedSurveyId) return;
    setTelegramStatus({ loading: true });

    try {
      const res = await fetch(`/api/admin/surveys/${selectedSurveyId}/export-telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          botToken: telegramBotToken || undefined,
          chatId: telegramChatId || undefined,
          aiReport: aiReport || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus({
          loading: false,
          success: true,
          message: data.message || 'የኤአይ ፖሊሲ ሪፖርትና ስቲስቲክሱ ወደ Telegram በስኬት ተልኳል!',
        });
      } else {
        setTelegramStatus({
          loading: false,
          success: false,
          message: data.message || data.error || 'ለማላክ አልተቻለም',
        });
      }
    } catch (err: any) {
      setTelegramStatus({ loading: false, success: false, message: err.message });
    }
  };

  const handleDownloadCsv = async () => {
    if (!selectedSurveyId) return;
    try {
      const tokenQuery = adminToken ? `?token=${encodeURIComponent(adminToken)}` : '';
      const res = await fetch(`/api/admin/surveys/${selectedSurveyId}/export-csv${tokenQuery}`, {
        headers: {
          Authorization: adminToken ? `Bearer ${adminToken}` : '',
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'ያልተፈቀደ መግቢያ! እባክዎ እንደገና ይግቡ::');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dgc_survey_${selectedSurveyId}_ai_policy_report.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('CSV Download error:', err);
      alert('CSV ዳውንሎድ በሚደረግበት ወቅት ስህተት ተከሰተ::');
    }
  };

  const getFormalReportHtml = (reportData: any, analyticsData: any): string => {
    const generatedDate = reportData?.official_header?.generated_date || 'ነሐሴ 2018';
    const refCode = reportData?.official_header?.ref_code || 'DGC-RPT-2026';
    const city = reportData?.official_header?.city || 'ድሬዳዋ';
    const surveyTitle = analyticsData?.survey?.title || 'የሕዝብ አስተያየት ጥናት';
    const totalResponses = analyticsData?.total_responses || 0;

    const eduRows = analyticsData?.demographics_analytics?.education_distribution?.map((ed: any) => `
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 12px;">${ed.label}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 12px; text-align: right; font-weight: bold;">${ed.count}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 12px; text-align: right; font-weight: bold; color: #1e40af;">${ed.percentage}%</td>
      </tr>
    `).join('') || '';

    const genderBoxes = analyticsData?.demographics_analytics?.gender_distribution?.map((gd: any) => `
      <div style="background-color: #f8fafc; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center;">
        <span style="font-size: 11px; font-weight: bold; color: #475569; display: block;">${gd.label}</span>
        <span style="font-size: 15px; font-weight: 900; color: #0f172a;">${gd.count} (${gd.percentage}%)</span>
      </div>
    `).join('') || '';

    const posItems = reportData?.positive_feedback?.map((pos: string) => `
      <li style="margin-bottom: 6px; line-height: 1.5; color: #065f46;">▪ ${pos}</li>
    `).join('') || '<li style="font-style: italic; color: #64748b;">አዎንታዊ አስተያየቶች በዳታቤዝ ተመዝግበዋል::</li>';

    const negItems = reportData?.negative_feedback?.map((neg: string) => `
      <li style="margin-bottom: 6px; line-height: 1.5; color: #991b1b;">▪ ${neg}</li>
    `).join('') || '<li style="font-weight: bold; color: #334155;">የሉም (No critical remarks reported)</li>';

    const secAnalyses = reportData?.section_analyses?.map((sec: any) => `
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; background-color: #ffffff;">
        <h3 style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          ${sec.section_number || ''} ${sec.title || ''}
        </h3>
        ${sec.positive_points?.length ? `
          <div style="margin-bottom: 6px;">
            <strong style="font-size: 12px; color: #065f46;">በአውንታ የቀረቡ ሀሳቦች፦</strong>
            <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 12px; color: #1e293b;">
              ${sec.positive_points.map((p: string) => `<li style="margin-bottom: 3px;">${p}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${sec.negative_points?.length ? `
          <div>
            <strong style="font-size: 12px; color: #991b1b;">በአሉታ የቀረቡ ሀሳቦች፦</strong>
            <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 12px; color: #1e293b;">
              ${sec.negative_points.map((n: string) => `<li style="margin-bottom: 3px;">${n}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('') || '';

    const keyFindings = reportData?.key_findings?.map((kf: string) => `
      <li style="margin-bottom: 8px; font-weight: 600; line-height: 1.5; color: #0f172a;">${kf}</li>
    `).join('') || '';

    const policyRecs = reportData?.policy_recommendations?.map((rec: string, i: number) => `
      <div style="display: flex; align-items: flex-start; margin-bottom: 10px; padding: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
        <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 12px; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0;">${i + 1}</div>
        <div style="font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.5;">${rec}</div>
      </div>
    `).join('') || '';

    return `<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8" />
  <title>ኦፊሴላዊ የሕዝብ አስተያየት ሪፖርት - ድሬዳዋ</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.6;
    }
    h1 { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0 0 4px 0; text-align: center; }
    h2 { font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 10px 0; text-align: center; }
    h3 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; }
    .cover-box {
      background-color: #f8fafc;
      border: 2px solid #0f172a;
      border-radius: 10px;
      padding: 14px;
      text-align: center;
      margin: 16px 0;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 0;
      margin-bottom: 16px;
      font-size: 11px;
      font-weight: bold;
      color: #1e293b;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      padding-top: 16px;
      margin-top: 16px;
      border-top: 2px solid #0f172a;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto;">
    
    <!-- PAGE 1: COVER & INTRODUCTION -->
    <div style="text-align: center; border-bottom: 4px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px;">
      <div style="margin-bottom: 8px; font-size: 20px; font-weight: 900; color: #1e3a8a;">🏛️ DGC DIRECTORY</div>
      <h1>ለኢፌድሪ የመንግስት ኮሙኒኬሽን አገልግሎት</h1>
      <h2>የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</h2>

      <div class="cover-box">
        <h3 style="font-size: 14px; margin-bottom: 4px;">
          ${reportData?.official_header?.recipient_service || 'የሀገራዊና የአካባቢያዊ ልማት'} ሂደቱን እንቅስቃሴን በተመለከተ የቀረበ
        </h3>
        <h2 style="font-size: 17px; font-weight: 900; margin: 0;">የሕዝብ አስተያየት ሪፖርት</h2>
        <p style="font-size: 11px; color: #475569; margin-top: 4px; font-weight: bold;">
          [ርዕስ: ${surveyTitle}]
        </p>
      </div>

      <div class="meta-bar">
        <span>ወር/ዓ.ም: ${generatedDate}</span>
        <span>መለያ ቁጥር: ${refCode}</span>
        <span>ከተማ: ${city}</span>
      </div>

      <div style="text-align: left; margin-top: 12px;">
        <h3 style="border-bottom: 2px solid #0f172a; padding-bottom: 4px;">1. መግቢያ</h3>
        <p style="text-align: justify; text-indent: 20px; font-size: 12.5px; line-height: 1.65; color: #1e293b;">
          ${reportData?.introduction || reportData?.executive_summary || ''}
        </p>
      </div>
    </div>

    <!-- PAGE 2: DEMOGRAPHICS & GENERAL SURVEY ANALYSIS -->
    <div class="page-break">
      <h2 style="text-align: left; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
        2. የሕዝብ አስተያየት የሚሰበሰብባቸው ጥያቄዎች እና የምላሽ ሰጪዎች ሁኔታ
      </h2>

      <div style="margin-bottom: 16px;">
        <h3 style="background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #1e3a8a;">
          2.1 የመላሾች አጠቃላይ መረጃ (Total Respondents: ${totalResponses})
        </h3>

        <div style="margin-top: 8px;">
          <h4 style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">የአስተያየት ሰጪ የትምህርት ደረጃ</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 12px;">ደረጃ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px;">ብዛት</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px;">መቶኛ (%)</th>
              </tr>
            </thead>
            <tbody>
              ${eduRows}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 12px;">
          <h4 style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">ፆታ (Gender)</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${genderBoxes}
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <h3 style="background-color: #f1f5f9; padding: 6px 10px; border-left: 4px solid #1e3a8a;">
          2.2 አጠቃላይ የመጠይቁ ትንተና (General Analysis)
        </h3>

        <div style="border: 2px solid #047857; background-color: #ecfdf5; border-radius: 8px; padding: 10px; margin-top: 8px;">
          <h4 style="font-size: 11.5px; font-weight: 900; color: #065f46; margin: 0 0 6px 0; text-transform: uppercase;">
            ✔ በአውንታ የቀረቡ ሀሳብና አስተያየቶች (Positive Feedback)
          </h4>
          <ul style="margin: 0; padding-left: 16px; font-size: 12px;">
            ${posItems}
          </ul>
        </div>

        <div style="border: 2px solid #b91c1c; background-color: #fef2f2; border-radius: 8px; padding: 10px; margin-top: 10px;">
          <h4 style="font-size: 11.5px; font-weight: 900; color: #991b1b; margin: 0 0 6px 0; text-transform: uppercase;">
            ✖ በአሉታ የቀረቡ ሃሳብና አስተያየቶች (Negative Feedback)
          </h4>
          <ul style="margin: 0; padding-left: 16px; font-size: 12px;">
            ${negItems}
          </ul>
        </div>
      </div>
    </div>

    <!-- PAGE 3: CATEGORIZED FEEDBACK & KEY FINDINGS -->
    <div class="page-break">
      <h2 style="text-align: left; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
        3. ዝርዝር የህዝብ አስተያየትና የስሜት ትንተና (Categorized Feedback Analysis)
      </h2>

      ${secAnalyses}

      <div class="avoid-break" style="border: 2px solid #0f172a; border-radius: 8px; padding: 12px; margin-top: 14px; background-color: #f8fafc;">
        <h3 style="border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
          የጥናቱ ዋና ዋና ግኝቶች (Key Findings Summary)
        </h3>
        <ol style="margin: 0; padding-left: 18px; font-size: 12.5px;">
          ${keyFindings}
        </ol>
      </div>
    </div>

    <!-- PAGE 4: POLICY RECOMMENDATIONS, CONCLUSION & SIGNATURES -->
    <div class="page-break">
      <h2 style="text-align: left; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
        4. የፖሊሲ ማሻሻያ ጥቆማዎች (Policy Recommendations)
      </h2>

      <div style="margin-top: 10px;">
        ${policyRecs}
      </div>

      <div style="margin-top: 20px; border-top: 2px solid #0f172a; padding-top: 10px;">
        <h2>5. ማጠቃለያ</h2>
        <p style="text-align: justify; text-indent: 20px; font-size: 12.5px; line-height: 1.65; color: #0f172a;">
          ${reportData?.conclusion || reportData?.executive_summary || ''}
        </p>
      </div>

      <!-- SIGNATURE BLOCK -->
      <div class="avoid-break" style="margin-top: 30px; border-top: 2px solid #0f172a; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold;">
        <div style="width: 48%;">
          <p style="margin: 0 0 4px 0; font-weight: 900;">አዘጋጅ፦</p>
          <p style="margin: 0 0 2px 0; color: #334155;">የህዝብ አስተያየትና ፖሊሲ አናሊቲክስ ዋና ክፍል</p>
          <p style="margin: 0 0 20px 0; color: #475569;">የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</p>
          <p style="margin: 0 0 4px 0;">ፊርማ፦ ______________________</p>
          <p style="margin: 0;">ቀን፦ ______________________</p>
        </div>

        <div style="width: 48%; text-align: right;">
          <p style="margin: 0 0 4px 0; font-weight: 900;">ያረጋገጠው፦</p>
          <p style="margin: 0 0 2px 0; color: #334155;">የቢሮ ኃላፊ / ዋና ዳይሬክተር</p>
          <p style="margin: 0 0 20px 0; color: #475569;">የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</p>
          <p style="margin: 0 0 4px 0;">ማህተም፦ [ የቢሮው ማህተም ]</p>
          <p style="margin: 0;">ድሬዳዋ፣ ኢትዮጵያ</p>
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;
  };

  const handlePrintPdf = async () => {
    setShowAiReport(true);
    let currentReport = aiReport;

    if (!currentReport && selectedSurveyId) {
      currentReport = await fetchAiReport(selectedSurveyId);
    }

    if (!currentReport) {
      alert('የፖሊሲ ሪፖርት መረጃ ማግኘት አልተቻለም::');
      return;
    }

    setReportProgress({
      isPreparing: true,
      percentage: 90,
      stageLabel: 'የA4 ፕሪንት ማስተካከያ በማቀናጀት ላይ...',
    });

    try {
      const htmlContent = getFormalReportHtml(currentReport, analytics);

      // Strategy 1: Try opening a clean printable window
      let printWin: Window | null = null;
      try {
        printWin = window.open('', '_blank', 'width=950,height=1000,scrollbars=yes');
      } catch (e) {
        printWin = null;
      }

      if (printWin && !printWin.closed) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();

        setTimeout(() => {
          try {
            printWin?.focus();
            printWin?.print();
          } catch (e) {
            console.error('Window print error:', e);
          }
        }, 500);
      } else {
        // Strategy 2: Direct DOM print root injection with @media print (100% reliable for iframe/mobile)
        let existingPrintRoot = document.getElementById('printable-print-modal-root');
        if (!existingPrintRoot) {
          existingPrintRoot = document.createElement('div');
          existingPrintRoot.id = 'printable-print-modal-root';
          document.body.appendChild(existingPrintRoot);
        }

        let printStyleTag = document.getElementById('printable-print-style');
        if (!printStyleTag) {
          printStyleTag = document.createElement('style');
          printStyleTag.id = 'printable-print-style';
          printStyleTag.textContent = `
            @media print {
              body > *:not(#printable-print-modal-root) {
                display: none !important;
              }
              #printable-print-modal-root {
                display: block !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 12px !important;
                background: #ffffff !important;
                color: #0f172a !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
            }
            @media screen {
              #printable-print-modal-root {
                display: none !important;
              }
            }
          `;
          document.head.appendChild(printStyleTag);
        }

        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(htmlContent, 'text/html');
        existingPrintRoot.innerHTML = parsedDoc.body.innerHTML;

        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err) {
      console.error('Print execution error:', err);
      window.print();
    } finally {
      setTimeout(() => {
        setReportProgress({ isPreparing: false, percentage: 0, stageLabel: '' });
      }, 800);
    }
  };

  const handleDownloadPdfDirect = async () => {
    setShowAiReport(true);
    let currentReport = aiReport;

    if (!currentReport && selectedSurveyId) {
      currentReport = await fetchAiReport(selectedSurveyId);
    }

    if (!currentReport) {
      alert('የፖሊሲ ሪፖርት መረጃ ማግኘት አልተቻለም::');
      return;
    }

    setReportProgress({
      isPreparing: true,
      percentage: 25,
      stageLabel: 'የPDF ሰነድ አወቃቀርና ዲዛይን በማቀናጀት ላይ...',
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Create an isolated iframe containing pure Hex CSS (NO Tailwind oklch)
    const pdfIframe = document.createElement('iframe');
    pdfIframe.style.position = 'fixed';
    pdfIframe.style.left = '-9999px';
    pdfIframe.style.top = '-9999px';
    pdfIframe.style.width = '850px';
    pdfIframe.style.height = '1400px';
    pdfIframe.style.border = '0';
    document.body.appendChild(pdfIframe);

    try {
      const htmlContent = getFormalReportHtml(currentReport, analytics);
      const doc = pdfIframe.contentDocument || pdfIframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Could not access iframe document');
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setReportProgress({
        isPreparing: true,
        percentage: 55,
        stageLabel: 'የPDF ምስል በከፍተኛ ጥራት በማመንጨት ላይ...',
      });

      await new Promise((resolve) => setTimeout(resolve, 400));

      const targetEl = doc.body;

      const canvas = await html2canvas(targetEl, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      setReportProgress({
        isPreparing: true,
        percentage: 85,
        stageLabel: 'ገፆቹን ወደ A4 PDF በመቀየር ላይ...',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Page 1
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Multi-page slicing
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      setReportProgress({
        isPreparing: true,
        percentage: 100,
        stageLabel: 'PDF ፋይሉ በስኬት ተዘጋጅቷል! በማውረድ ላይ...',
      });

      const fileName = 'Dire_Dawa_Public_Opinion_Report.pdf';

      try {
        pdf.save(fileName);
      } catch (saveErr) {
        console.warn('pdf.save failed, using blob download fallback:', saveErr);
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('PDF ማውረድ አልተሳካም:: እባክዎ "ፕሪንት" የሚለውን ተጠቅመው "Save as PDF" ይምረጡ::');
    } finally {
      if (document.body.contains(pdfIframe)) {
        document.body.removeChild(pdfIframe);
      }
      setTimeout(() => {
        setReportProgress({ isPreparing: false, percentage: 0, stageLabel: '' });
      }, 700);
    }
  };

  if (!selectedSurveyId || surveys.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">እባክዎ አናሊቲክስ ለማየት መጠይቅ ይምረጡ</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 printable-a4-report">
      {/* Top Survey Selector & Export Action Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-grow max-w-md">
          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            የጥናት ርዕስ ይምረጡ (Select Survey for Analytics)
          </label>
          <select
            value={selectedSurveyId}
            onChange={(e) => onSelectSurvey(parseInt(e.target.value, 10))}
            className="w-full py-3 px-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.total_responses || 0} ተሳታፊዎች)
              </option>
            ))}
          </select>
        </div>

        {/* 5 Integrated Action Buttons: PDF Download, Print, CSV/Excel, Telegram, Official Report */}
        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            onClick={handleDownloadPdfDirect}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-2 border border-emerald-400/30"
            title="የA4 PDF ፋይል በስልክዎ/ኮምፒውተርዎ ላይ ያውርዱ"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>1. PDF አውርድ</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2 border border-blue-400/30"
            title="በA4 ወረቀት ፕሪንት ያድርጉ"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>2. ፕሪንት</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-2xl text-xs font-black transition-all shadow-md flex items-center space-x-2"
            title="የጥያቄዎችንና የAI ፖሊሲ ዳታ በExcel/CSV ያውርዱ"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-300" />
            <span>3. CSV / Excel</span>
          </button>

          <button
            onClick={handleExportTelegram}
            disabled={telegramStatus.loading}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border border-sky-400/30 rounded-2xl text-xs font-black transition-all shadow-lg shadow-sky-600/20 flex items-center space-x-2 disabled:opacity-50"
            title="የAI ፖሊሲ ሪፖርትና ስቲስቲክሱን ወደ ቴሌግራም ይላኩ"
          >
            <Send className={`w-4 h-4 text-sky-200 ${telegramStatus.loading ? 'animate-spin' : ''}`} />
            <span>4. Telegram</span>
          </button>

          {/* Official Policy Report Toggle Button */}
          <button
            onClick={() => {
              if (!showAiReport) {
                setShowAiReport(true);
                if (!aiReport) {
                  fetchAiReport(selectedSurveyId);
                }
              } else {
                setShowAiReport(false);
              }
            }}
            disabled={loadingAiReport}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-lg flex items-center space-x-2 border ${
              showAiReport
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20 ring-2 ring-amber-300/50'
                : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 hover:from-blue-800 hover:to-indigo-800 text-blue-100 border-blue-400/30 shadow-blue-900/40'
            }`}
            title="የፖሊሲና የሕዝብ እርካታ ሪፖርት ተመልከት"
          >
            <FileText className={`w-4 h-4 text-amber-300 ${loadingAiReport ? 'animate-spin' : ''}`} />
            <span>
              {loadingAiReport
                ? 'በማዘጋጀት ላይ...'
                : showAiReport
                ? '5. ሪፖርት ደብቅ'
                : '5. ኦፊሴላዊ ሪፖርት'}
            </span>
          </button>
        </div>
      </div>

      {/* Telegram Export Notification Status Toast */}
      {telegramStatus.message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border shadow-sm ${
            telegramStatus.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {telegramStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{telegramStatus.message}</span>
          </div>
          <button
            onClick={() => setTelegramStatus({ loading: false })}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {loading || !analytics ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-32 bg-slate-100 rounded mb-4"></div>
          <p className="text-xs text-slate-500">የጥናት አናሊቲክስ ዳታ በመጫን ላይ...</p>
        </div>
      ) : (
        <>
          {/* Official AI Policy Report Box (Gemini AI Powered) - Shown when toggled or printed */}
          {showAiReport && (
            <div className="bg-white rounded-3xl border-2 border-slate-900 shadow-2xl overflow-hidden p-6 sm:p-10 space-y-8 relative transition-all duration-300">
              {/* Top Action Bar (No Print) */}
              <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-amber-400/20 border border-amber-400/40 text-amber-300 rounded-xl flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
                      <span>ኦፊሴላዊ የሕዝብ አስተያየት ሪፖርት (A4 Document)</span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ ለኢፌድሪ የመንግስት ኮሙኒኬሽን አገልግሎት የቀረበ
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => fetchAiReport(selectedSurveyId)}
                    disabled={loadingAiReport}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-amber-300 rounded-xl text-xs font-bold transition-all border border-amber-400/30 flex items-center space-x-1.5"
                    title="ሪፖርት አዝምን"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAiReport ? 'animate-spin' : ''}`} />
                    <span>{loadingAiReport ? 'በማዘጋጀት ላይ...' : 'አዝምን'}</span>
                  </button>

                  {/* Direct PDF Download Button */}
                  <button
                    onClick={handleDownloadPdfDirect}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
                    title="በPDF ፋይል መልክ አውርድ"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-200" />
                    <span>PDF አውርድ</span>
                  </button>

                  {/* Print Button */}
                  <button
                    onClick={handlePrintPdf}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
                    title="በA4 ወረቀት ፕሪንት አድርግ"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-200" />
                    <span>ፕሪንት</span>
                  </button>

                  <button
                    onClick={() => setShowAiReport(false)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                    title="ሪፖርቱን ዝጋ"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Banner (No Print) */}
              {(loadingAiReport || reportProgress.isPreparing) && (
                <div className="p-6 text-center bg-slate-900 text-white rounded-3xl border-2 border-amber-400/40 space-y-4 shadow-xl no-print">
                  <div className="flex items-center justify-center space-x-3">
                    <RefreshCw className="w-6 h-6 text-amber-400 animate-spin shrink-0" />
                    <span className="text-sm sm:text-base font-black text-amber-300">
                      ኦፊሴላዊ የፖሊሲ ሪፖርትና PDF ማዘጋጃ
                    </span>
                  </div>

                  <div className="max-w-xl mx-auto space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono text-amber-300 font-bold">
                      <span className="text-left">{reportProgress.stageLabel || 'በማዘጋጀት ላይ...'}</span>
                      <span className="text-sm font-black shrink-0 ml-2">{reportProgress.percentage || 15}%</span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-3.5 p-0.5 border border-slate-700 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-amber-400 via-emerald-400 to-blue-500 h-full rounded-full transition-all duration-300 ease-out shadow-md"
                        style={{ width: `${reportProgress.percentage || 15}%` }}
                      ></div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 max-w-lg mx-auto">
                    ይህ ሪፖርት በኢፌድሪ የመንግስት ኮሙኒኬሽን አገልግሎት እና በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ ፎርማሊቲ መሰረት የሚዘጋጅ ባለብዙ ገፅ ኦፊሴላዊ ሰነድ ነው::
                  </p>
                </div>
              )}

              {/* The Printable Report Element (Always rendered when aiReport exists) */}
              {aiReport ? (
                <div
                  id="printable-formal-report-element"
                  className="printable-formal-report space-y-10 text-slate-900 font-serif leading-relaxed bg-white p-4 sm:p-8 rounded-2xl border border-slate-200"
                >
                  
                  {/* PAGE 1 COVER PAGE & HEADER */}
                  <div className="text-center space-y-6 pt-4 pb-8 border-b-4 border-slate-900">
                    <div className="flex justify-center mb-2">
                      <DgcLogo className="scale-125 origin-center" />
                    </div>

                    <div className="space-y-1">
                      <h1 className="text-xl sm:text-2xl font-black tracking-wide text-slate-900 uppercase">
                        ለኢፌድሪ የመንግስት ኮሙኒኬሽን አገልግሎት
                      </h1>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                        የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
                      </h2>
                    </div>

                    <div className="max-w-2xl mx-auto py-6 px-4 bg-slate-50 border-2 border-slate-900 rounded-xl shadow-inner my-6 space-y-3">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                        {aiReport.official_header?.recipient_service || 'የሀገራዊና የአካባቢያዊ ልማት'} ሂደቱን እንቅስቃሴን ቀጣይ ተስፋዎችን በተመለከተ እንደ ድሬዳዋ ተዘጋጅቶ የቀረበ
                      </h3>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 uppercase">
                        የሕዝብ አስተያየት ሪፖርት
                      </h4>
                      <p className="text-xs font-mono font-bold text-slate-600">
                        [ርዕስ: {analytics.survey.title}]
                      </p>
                    </div>

                    <div className="flex items-center justify-between max-w-xl mx-auto text-xs font-bold text-slate-800 border-t border-b border-slate-300 py-2">
                      <span>ወር/ዓ.ም: {aiReport.official_header?.generated_date || 'ነሐሴ 2018'}</span>
                      <span>መለያ ቁጥር: {aiReport.official_header?.ref_code || 'DGC-RPT-2026'}</span>
                      <span>ከተማ: {aiReport.official_header?.city || 'ድሬዳዋ'}</span>
                    </div>

                    {/* SECTION 1: INTRODUCTION */}
                    <div className="text-left space-y-3 pt-6">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 border-b-2 border-slate-800 pb-1">
                        1. መግቢያ
                      </h3>
                      <p className="text-sm sm:text-base text-slate-800 leading-relaxed text-justify indent-8">
                        {aiReport.introduction || aiReport.executive_summary}
                      </p>
                    </div>
                  </div>

                  {/* PAGE 2 BREAK: SECTION 2 - SURVEY QUESTIONS & DEMOGRAPHICS */}
                  <div className="print-page-break space-y-6 pt-6">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 border-b-2 border-slate-900 pb-2">
                      2. የሕዝብ አስተያየት የሚሰበሰብባቸው ጥያቄዎች እና የምላሽ ሰጪዎች ሁኔታ
                    </h2>

                    {/* 2.1 DEMOGRAPHICS OVERVIEW */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-900 bg-slate-100 p-2 border-l-4 border-blue-900">
                        2.1 የመላሾች አጠቃላይ መረጃ (Respondent Demographics)
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                        {/* Education Level Breakdown Table */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                          <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1">የአስተያየት ሰጪ የትምህርት ደረጃ</h4>
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-300">
                                <th className="p-1.5 font-bold">ደረጃ</th>
                                <th className="p-1.5 font-bold text-right">ብዛት</th>
                                <th className="p-1.5 font-bold text-right">መቶኛ (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.demographics_analytics?.education_distribution.map((ed) => (
                                <tr key={ed.label} className="border-b border-slate-100">
                                  <td className="p-1.5">{ed.label}</td>
                                  <td className="p-1.5 text-right font-bold">{ed.count}</td>
                                  <td className="p-1.5 text-right font-bold text-blue-800">{ed.percentage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Gender & Residence Summary Table */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-4">
                          <div>
                            <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">ፆታ (Gender)</h4>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              {analytics.demographics_analytics?.gender_distribution.map((gd) => (
                                <div key={gd.label} className="bg-slate-50 p-2 border border-slate-200 rounded">
                                  <span className="block text-xs font-bold text-slate-600">{gd.label}</span>
                                  <span className="text-base font-black text-slate-900">{gd.count} ({gd.percentage}%)</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">ወረዳ / ክፍለ ከተማ / አከባቢ</h4>
                            <p className="text-xs text-slate-700">
                              አጠቃላይ ከተሳተፉት {analytics.total_responses} ዜጎች ውስጥ ከድሬዳዋ ከተማ ወረዳዎች እና የገጠር ክላስተሮች የተውጣጡ ነዋሪዎች ይገኛሉ::
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2.2 GENERAL SURVEY ANALYSIS */}
                    <div className="space-y-4 pt-4">
                      <h3 className="text-base font-bold text-slate-900 bg-slate-100 p-2 border-l-4 border-blue-900">
                        2.2 አጠቃላይ የመጠይቁ ትንተና (General Analysis)
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed text-justify">
                        በኢትዮጵያና በድሬዳዋ አስተዳደር የሚከናወኑ የህዝብ የምክክርና የልማት መድረኮች፣ የህዝብ አገልግሎቶችና የኮሙኒኬሽን ስራዎችን አስመልክቶ የቀረቡ ጥያቄዎችና የተሰበሰቡ የህዝብ ምላሾች እንደሚከተለው ተተንትነዋል::
                      </p>

                      {/* POSITIVE REMARKS BLOCK */}
                      <div className="border-2 border-emerald-800 rounded-xl p-4 bg-emerald-50/30 space-y-2">
                        <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>በአውንታ የቀረቡ ሀሳብና አስተያየቶች (Positive Feedback & Observations)</span>
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-800">
                          {aiReport.positive_feedback && aiReport.positive_feedback.length > 0 ? (
                            aiReport.positive_feedback.map((pos, i) => (
                              <li key={i} className="flex items-start space-x-2">
                                <span className="text-emerald-700 font-bold shrink-0">▪</span>
                                <span className="leading-relaxed">{pos}</span>
                              </li>
                            ))
                          ) : (
                            <li className="italic text-slate-500">አዎንታዊ አስተያየቶች በዳታቤዝ ተመዝግበዋል::</li>
                          )}
                        </ul>
                      </div>

                      {/* NEGATIVE REMARKS BLOCK */}
                      <div className="border-2 border-red-800 rounded-xl p-4 bg-red-50/30 space-y-2">
                        <h4 className="text-xs font-black text-red-900 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-700" />
                          <span>በአሉታ የቀረቡ ሃሳብና አስተያየቶች (Negative Feedback & Critical Remarks)</span>
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm text-slate-800">
                          {aiReport.negative_feedback && aiReport.negative_feedback.length > 0 ? (
                            aiReport.negative_feedback.map((neg, i) => (
                              <li key={i} className="flex items-start space-x-2">
                                <span className="text-red-700 font-bold shrink-0">▪</span>
                                <span className="leading-relaxed">{neg}</span>
                              </li>
                            ))
                          ) : (
                            <li className="font-bold text-slate-700">የሉም (No significant negative feedback reported)</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* PAGE 3 BREAK: SECTION 3 - CATEGORIZED SECTION ANALYSES */}
                  <div className="print-page-break space-y-6 pt-6">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 border-b-2 border-slate-900 pb-2">
                      3. ዝርዝር የህዝብ አስተያየትና የስሜት ትንተና (Categorized Public Feedback Analysis)
                    </h2>

                    {aiReport.section_analyses && aiReport.section_analyses.length > 0 ? (
                      aiReport.section_analyses.map((sec, idx) => (
                        <div key={idx} className="border border-slate-300 rounded-xl p-4 space-y-3 avoid-page-break">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <span>{sec.section_number} {sec.title}</span>
                          </h3>

                          {sec.positive_points && sec.positive_points.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-emerald-800 block">በአውንታ የቀረቡ ሀሳቦች፦</span>
                              <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-800 space-y-1">
                                {sec.positive_points.map((pp, i) => (
                                  <li key={i}>{pp}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {sec.negative_points && sec.negative_points.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <span className="text-xs font-bold text-red-800 block">በአሉታ የቀረቡ ሀሳቦች፦</span>
                              <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-800 space-y-1">
                                {sec.negative_points.map((np, i) => (
                                  <li key={i}>{np}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="border border-slate-300 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-bold text-slate-900">3.1 የህዝብ አስተያየት አጠቃላይ ትንተና</h3>
                        <p className="text-xs text-slate-800">
                          በድሬዳዋ አስተዳደር ደረጃ የህዝብ አስተያየቶች በይፋ ተተንትነው ለከፍተኛ አመራር ቀርበዋል::
                        </p>
                      </div>
                    )}

                    {/* KEY FINDINGS SUMMARY */}
                    <div className="border-2 border-slate-800 rounded-xl p-4 space-y-3 avoid-page-break">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide border-b border-slate-300 pb-1">
                        የጥናቱ ዋና ዋና ግኝቶች (Key Findings Summary)
                      </h3>
                      <ol className="list-decimal pl-5 text-xs sm:text-sm text-slate-800 space-y-2">
                        {aiReport.key_findings.map((kf, i) => (
                          <li key={i} className="leading-relaxed font-semibold">{kf}</li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* PAGE 4 BREAK: SECTION 4 - POLICY RECOMMENDATIONS & SECTION 5 - CONCLUSION */}
                  <div className="print-page-break space-y-8 pt-6">
                    {/* SECTION 4: POLICY RECOMMENDATIONS */}
                    <div className="space-y-4">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 border-b-2 border-slate-900 pb-2">
                        4. የፖሊሲ ማሻሻያ ጥቆማዎች (Policy Recommendations)
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed text-justify">
                        በጥናቱ የተገኙ የህዝብ ምላሾችን፣ ቅሬታዎችን እና አስተያየቶችን መነሻ በማድረግ በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የቀረቡ ዋና ዋና የፖሊሲ ማሻሻያ ጥቆማዎች፦
                      </p>

                      <div className="space-y-3">
                        {aiReport.policy_recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-300 rounded-xl">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-xs sm:text-sm text-slate-900 font-semibold leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECTION 5: CONCLUSION */}
                    <div className="space-y-4 pt-4 border-t-2 border-slate-800">
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 border-b-2 border-slate-900 pb-2">
                        5. ማጠቃለያ
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-900 leading-relaxed text-justify indent-8">
                        {aiReport.conclusion || aiReport.executive_summary}
                      </p>
                    </div>

                    {/* OFFICIAL SIGNATURE & STAMP BLOCK */}
                    <div className="pt-10 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs font-bold text-slate-900 avoid-page-break">
                      <div className="space-y-12">
                        <div>
                          <p className="uppercase font-black text-slate-900">አዘጋጅ፦</p>
                          <p className="text-slate-700">የህዝብ አስተያየትና ፖሊሲ አናሊቲክስ ዋና ክፍል</p>
                          <p className="text-slate-600">የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</p>
                        </div>
                        <div>
                          <p>ፊርማ፦ ______________________</p>
                          <p>ቀን፦ ______________________</p>
                        </div>
                      </div>

                      <div className="space-y-12 text-right">
                        <div>
                          <p className="uppercase font-black text-slate-900">ያረጋገጠው፦</p>
                          <p className="text-slate-700">የቢሮ ኃላፊ / ዋና ዳይሬክተር</p>
                          <p className="text-slate-600">የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</p>
                        </div>
                        <div>
                          <p>ማህተም፦ [ የቢሮው ማህተም ]</p>
                          <p>ድሬዳዋ፣ ኢትዮጵያ</p>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              ) : null}
            </div>
          )}

          {/* Survey Overview Metadata Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/30">
                {analytics.survey.category}
              </span>
              <h2 className="text-lg sm:text-xl font-bold mt-2">{analytics.survey.title}</h2>
              <p className="text-xs text-slate-300 mt-1">{analytics.survey.description}</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shrink-0 flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center font-bold text-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400">
                  {analytics.total_responses}
                </div>
                <div className="text-xs text-slate-400">አጠቃላይ ተሳታፊዎች (Total Respondents)</div>
              </div>
            </div>
          </div>

          {/* Demographic Breakdown Section */}
          {analytics.demographics_analytics && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  የተሳታፊዎች ስነ-ሕዝብ ማጠቃለያ (Demographic Overview)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Age Distribution */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">ዕድሜ (Age Groups)</h4>
                  <div className="space-y-2">
                    {analytics.demographics_analytics.age_distribution.map((item) => (
                      <div key={item.label} className="text-xs">
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>{item.label}</span>
                          <span>{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${item.percentage}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gender Ratio */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">ፆታ (Gender Ratio)</h4>
                  <div className="space-y-2">
                    {analytics.demographics_analytics.gender_distribution.map((item, idx) => (
                      <div key={item.label} className="text-xs">
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span>{item.label}</span>
                          <span>{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: idx === 0 ? '#3b82f6' : '#ec4899',
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education Distribution */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">ትምህርት ደረጃ (Education)</h4>
                  <div className="space-y-2">
                    {analytics.demographics_analytics.education_distribution.slice(0, 4).map((item) => (
                      <div key={item.label} className="text-xs">
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span className="truncate max-w-[120px]">{item.label}</span>
                          <span>{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${item.percentage}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Residence Distribution */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">ክፍለ ከተማ / መኖሪያ (Residence)</h4>
                  <div className="space-y-2">
                    {analytics.demographics_analytics.residence_distribution.slice(0, 4).map((item) => (
                      <div key={item.label} className="text-xs">
                        <div className="flex justify-between font-semibold text-slate-700 mb-1">
                          <span className="truncate max-w-[120px]">{item.label}</span>
                          <span>{item.count} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${item.percentage}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dire Dawa Interactive Neighborhood Map Component */}
          {analytics.demographics_analytics?.residence_distribution && (
            <DireDawaMapVisual
              residenceData={analytics.demographics_analytics.residence_distribution}
              totalResponses={analytics.total_responses}
            />
          )}

          {/* Question Analytics Cards */}
          <div className="space-y-8">
            {analytics.questions_analytics.map((q, idx) => (
              <div
                key={q.question_id}
                className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6"
              >
                {/* Question Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-start space-x-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {q.question_text}
                      </h3>
                      <span className="text-xs text-slate-400 capitalize">
                        ዓይነት: {q.question_type === 'radio' ? 'ምርጫ (Multiple Choice)' : q.question_type === 'rating' ? 'ደረጃ (Rating 1-5)' : 'ጽሁፍ (Open-ended Text)'}
                      </span>
                    </div>
                  </div>

                  <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium border border-slate-200">
                    {q.total_answers_count} መልሶች
                  </span>
                </div>

                {/* Radio Questions - Pie & Bar Chart */}
                {q.question_type === 'radio' && q.radio_data && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    {/* Pie Chart */}
                    <div className="h-64 sm:h-72 w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                      <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                        <PieIcon className="w-4 h-4 text-emerald-600" />
                        <span>የመልሶች ስርጭት በፓይ ቻርት (Pie Chart)</span>
                      </h4>
                      <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                          <Pie
                            data={q.radio_data}
                            dataKey="count"
                            nameKey="option"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry) => `${entry.percentage}%`}
                          >
                            {q.radio_data.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any, name: any, props: any) => [`${value} መልስ (${props.payload.percentage}%)`, name]} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Breakdown Table & Progress Bars */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-emerald-600" />
                        <span>የመቶኛ (%) እና የቁጥር ዝርዝር (Percentage & Count)</span>
                      </h4>

                      <div className="space-y-2.5">
                        {q.radio_data.map((r, i) => (
                          <div key={r.option} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1.5">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                ></span>
                                {r.option}
                              </span>
                              <span className="text-emerald-700 font-bold">
                                {r.count} መልስ ({r.percentage}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${r.percentage}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Rating Questions - Distribution & Average */}
                {q.question_type === 'rating' && q.rating_distribution && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    {/* Gauge / Average Box */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-2xl text-center space-y-2">
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                        አማካኝ የሕዝብ ደረጃ (Average Rating)
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-amber-600 flex items-center justify-center gap-1">
                        <span>{q.rating_average || 0}</span>
                        <span className="text-lg text-amber-400 font-normal">/ 5</span>
                      </div>
                      <div className="flex items-center justify-center space-x-1 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-5 h-5 ${
                              s <= Math.round(q.rating_average || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Bar Chart Distribution */}
                    <div className="lg:col-span-2 h-60 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={q.rating_distribution}>
                          <XAxis dataKey="value" tickFormatter={(v) => `${v} ⭐`} />
                          <YAxis />
                          <Tooltip formatter={(val: any) => [`${val} ሰዎች`, 'የሰጡት ደረጃ']} />
                          <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Open-Ended Text Questions List */}
                {q.question_type === 'text' && (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="የጽሁፍ አስተያየቶችን ፈልግ..."
                        value={textSearch}
                        onChange={(e) => setTextSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {q.text_responses && q.text_responses.length > 0 ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {q.text_responses
                          .filter((tr) =>
                            tr.answer_text.toLowerCase().includes(textSearch.toLowerCase())
                          )
                          .map((tr) => (
                            <div
                              key={tr.id}
                              className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 space-y-1 relative group"
                            >
                              <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-semibold">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  አስተያየት #{tr.id} •{' '}
                                  {new Date(tr.submitted_at).toLocaleDateString('am-ET')}
                                </span>
                              </div>
                              <p className="text-slate-900 font-normal leading-relaxed pt-1">
                                "{tr.answer_text}"
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">ምንም የጽሁፍ አስተያየት አልተሰጠም::</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Export to Telegram Modal */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-sky-600 text-white p-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Send className="w-5 h-5" />
                <span>Export Analytics to Telegram Bot</span>
              </h3>
              <p className="text-xs text-sky-100 mt-1">
                የተሰበሰበውን የAI ፖሊሲ ሪፖርትና ሙሉ የስቲስቲክስ መረጃ ወደ አድሚን Telegram ቻናል በስኬት ይላኩ::
              </p>
            </div>

            <div className="p-6 space-y-4">
              {telegramStatus.message && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                    telegramStatus.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {telegramStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{telegramStatus.message}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telegram Bot Token (አማራጭ - ባዶ ከሆኑ ከ.env ይወሰዳል)
                  </label>
                  <input
                    type="text"
                    placeholder="1234567890:ABCdef..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telegram Chat ID / Channel ID
                  </label>
                  <input
                    type="text"
                    placeholder="-100123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setIsTelegramModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  ዝጋ (Close)
                </button>

                <button
                  onClick={handleExportTelegram}
                  disabled={telegramStatus.loading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{telegramStatus.loading ? 'በመላክ ላይ...' : 'አሁን ላክ (Send Now)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

