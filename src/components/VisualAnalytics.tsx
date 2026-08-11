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
} from 'lucide-react';
import { Survey, SurveyAnalytics } from '../types';
import { toEthiopianDate } from '../lib/ethiopianDate';
import { DireDawaMapVisual } from './DireDawaMapVisual';

interface VisualAnalyticsProps {
  surveys: Survey[];
  selectedSurveyId: number | null;
  onSelectSurvey: (id: number) => void;
  adminToken: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export const VisualAnalytics: React.FC<VisualAnalyticsProps> = ({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
  adminToken,
}) => {
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [textSearch, setTextSearch] = useState<string>('');
  
  // Telegram Modal State
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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus({
          loading: false,
          success: true,
          message: data.message || 'ሪፖርቱ በስኬት ወደ ቴሌግራም ተልኳል!',
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
      a.download = `dgc_survey_${selectedSurveyId}_full_report.csv`;
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

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-2 border border-blue-400/30"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>ፕሪንት / PDF አውርድ (Print / Save PDF)</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-black transition-all shadow-sm flex items-center space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>CSV / Excel ማውረጃ</span>
          </button>

          <button
            onClick={handleExportTelegram}
            disabled={telegramStatus.loading}
            className="px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl text-xs font-black transition-all shadow-md flex items-center space-x-2 disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${telegramStatus.loading ? 'animate-spin' : ''}`} />
            <span>{telegramStatus.loading ? 'በመላክ ላይ...' : 'Export to Telegram (1-Click)'}</span>
          </button>
        </div>
      </div>

      {/* Telegram Export Notification Status Toast */}
      {telegramStatus.message && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border shadow-sm ${
            telegramStatus.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}
        >
          <span>{telegramStatus.message}</span>
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
          {/* Survey Summary Banner */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-sky-600 text-white p-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Send className="w-5 h-5" />
                <span>Export Analytics to Telegram Bot</span>
              </h3>
              <p className="text-xs text-sky-100 mt-1">
                የተሰበሰበውን ሙሉ የስቲስቲክስ ሪፖርት ወደ አድሚን Telegram ቻት በስኬት ይላኩ::
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
