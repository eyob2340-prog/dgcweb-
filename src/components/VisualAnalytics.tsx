import React, { useState, useEffect } from 'react';
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
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/generate-ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setAiReport(data.report);
      }
    } catch (err) {
      console.error('AI Report fetch error:', err);
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

  const handlePrintPdf = () => {
    window.print();
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

        {/* 4 Main Integrated Buttons: Print/PDF, CSV/Excel, Export to Telegram, AI Policy Report */}
        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2 border border-blue-400/30"
            title="የA4 ፕሪንት ያድርጉ ወይም በPDF ያስቀምጡ"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>1. ፕሪንት / PDF</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 rounded-2xl text-xs font-black transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
            title="የጥያቄዎችንና የAI ፖሊሲ ዳታ በExcel/CSV ያውርዱ"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>2. CSV / Excel</span>
          </button>

          <button
            onClick={handleExportTelegram}
            disabled={telegramStatus.loading}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white border border-sky-400/30 rounded-2xl text-xs font-black transition-all shadow-lg shadow-sky-600/20 flex items-center space-x-2 disabled:opacity-50"
            title="የAI ፖሊሲ ሪፖርትና ስቲስቲክሱን ወደ ቴሌግራም ይላኩ"
          >
            <Send className={`w-4 h-4 text-sky-200 ${telegramStatus.loading ? 'animate-spin' : ''}`} />
            <span>3. Telegram (1-Click)</span>
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
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-300/50 shadow-blue-600/30 ring-2 ring-blue-400/50'
                : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 hover:from-blue-800 hover:to-indigo-800 text-blue-100 border-blue-400/30 shadow-blue-900/40'
            }`}
            title="የፖሊሲና የሕዝብ እርካታ ሪፖርት ተመልከት"
          >
            <FileText className={`w-4 h-4 text-amber-300 ${loadingAiReport ? 'animate-spin' : ''}`} />
            <span>
              {loadingAiReport
                ? 'በማዘጋጀት ላይ...'
                : showAiReport
                ? '4. ሪፖርት ደብቅ'
                : '4. የፖሊሲና የሕዝብ እርካታ ሪፖርት'}
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
          {/* Official AI Policy Report Box (Gemini AI Powered) - Shown when toggled */}
          {showAiReport && (
            <div className="bg-white rounded-3xl border-2 border-purple-300 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 relative transition-all duration-300">
              {/* Bureau Letterhead Header */}
              <div className="flex flex-col md:flex-row items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
                <div className="flex items-center space-x-3">
                  <DgcLogo className="scale-90 origin-left shrink-0" />
                  <div>
                    <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                      የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
                    </h1>
                    <p className="text-xs font-bold text-slate-600">
                      DIRE DAWA ADMINISTRATION GOVERNMENT COMMUNICATION AFFAIRS BUREAU
                    </p>
                    <p className="text-[11px] text-slate-500">
                      የህዝብ አስተያየትና የፖሊሲ አናሊቲክስ ዋና ክፍል | DIRE DAWA, ETHIOPIA
                    </p>
                  </div>
                </div>

                {/* Official Ref & Date Badge */}
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-300 text-right space-y-1 shrink-0">
                    <div className="text-[11px] font-mono font-bold text-slate-600 flex items-center justify-end gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>REF: {aiReport?.official_header?.ref_code || 'DGC-POL-RPT-2026'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-800">
                      ቀን: {aiReport?.official_header?.generated_date || new Date().toISOString().split('T')[0]}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAiReport(false)}
                    className="no-print p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                    title="ሪፖርቱን ዝጋ"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Official Report Title & Refresh action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-blue-900/40">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-amber-400/20 border border-amber-400/40 text-amber-300 rounded-xl flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>📑 የፖሊሲና የሕዝብ እርካታ ትንተና ሪፖርት (Official Policy Analysis Report)</span>
                    </h2>
                    <p className="text-xs text-blue-200 mt-0.5">
                      በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የተዘጋጀ የፖሊሲ ማጠቃለያ፣ ዋና ዋና ግኝቶች እና ምክረ ሀሳቦች::
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => fetchAiReport(selectedSurveyId)}
                  disabled={loadingAiReport}
                  className="no-print px-3.5 py-2 bg-white/10 hover:bg-white/20 text-amber-300 rounded-xl text-xs font-bold transition-all border border-amber-400/30 flex items-center space-x-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAiReport ? 'animate-spin' : ''}`} />
                  <span>{loadingAiReport ? 'በማዘጋጀት ላይ...' : 'ሪፖርት እንደገና አዝምን'}</span>
                </button>
              </div>

              {loadingAiReport ? (
                <div className="p-8 text-center bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3 animate-pulse">
                  <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin" />
                  <p className="text-xs font-bold text-slate-700">
                    የድሬዳዋ ነዋሪዎች ምላሽ እየተነተነ ኦፊሴላዊ የፖሊሲና የሕዝብ እርካታ ሪፖርት እያዘጋጀ ነው...
                  </p>
                </div>
              ) : aiReport ? (
                <div className="space-y-6">
                  {/* Score Meter & Executive Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-md">
                      <Award className="w-8 h-8 text-amber-300 mb-1" />
                      <span className="text-[11px] font-black uppercase text-emerald-100 tracking-wider">
                        የሕዝብ እርካታ ደረጃ
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-white mt-1">
                        {aiReport.satisfaction_score}%
                      </div>
                      <span className="text-[10px] text-emerald-100 mt-1 font-bold">Public Satisfaction Score</span>
                    </div>

                    <div className="md:col-span-3 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        1. የፖሊሲ አጭር ማጠቃለያ (Executive Summary)
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                        {aiReport.executive_summary}
                      </p>
                    </div>
                  </div>

                  {/* Key Findings */}
                  <div className="bg-blue-50/60 p-5 rounded-2xl border border-blue-200 space-y-3">
                    <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      2. ዋና ዋና ግኝቶች (Key Findings)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiReport.key_findings.map((kf, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-blue-200/80 shadow-sm flex items-start space-x-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs text-slate-800 font-medium leading-relaxed">{kf}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Policy Recommendations */}
                  <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 space-y-3">
                    <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      3. የፖሊሲ ማሻሻያ ጥቆማዎች (Policy Recommendations)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {aiReport.policy_recommendations.map((pr, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex items-start space-x-2.5">
                          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-800 font-medium leading-relaxed">{pr}</p>
                        </div>
                      ))}
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

