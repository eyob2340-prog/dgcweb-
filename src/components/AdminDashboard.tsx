import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Database,
  Users,
  Vote,
  CheckCircle2,
  Search,
  ShieldCheck,
  History,
  FileText,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Survey, AuditLog } from '../types';
import { VisualAnalytics } from './VisualAnalytics';
import { SurveyBuilderModal } from './SurveyBuilderModal';
import { TelegramSettings } from './TelegramSettings';

interface AdminDashboardProps {
  adminToken: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminToken }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'policy_report' | 'manage' | 'audit' | 'db'>('analytics');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/surveys', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSurveys(data.surveys || []);
        if (data.surveys && data.surveys.length > 0 && !selectedSurveyId) {
          setSelectedSurveyId(data.surveys[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching admin surveys:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, [adminToken]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleToggleActive = async (surveyId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        fetchSurveys();
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleDeleteSurvey = async (surveyId: number) => {
    if (!window.confirm('እርግጠኛ ነዎት ይህ መጠይቅ እና መልሶቹ ሙሉ በሙሉ እንዲሰረዙ ይፈልጋሉ?')) return;

    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        fetchSurveys();
        if (selectedSurveyId === surveyId) {
          setSelectedSurveyId(null);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const totalResponsesSum = surveys.reduce((acc, curr) => acc + (curr.total_responses || 0), 0);
  const activeSurveysCount = surveys.filter((s) => s.is_active).length;

  const filteredSurveys = surveys.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Stat Overview Cards with Futuristic Glow & Animations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Vote className="w-3.5 h-3.5 text-blue-400" />
                አጠቃላይ ጥናቶች
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                {surveys.length}
                <span className="text-xs text-slate-400 font-normal">መጠይቆች</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold shadow-inner group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ንቁ ጥናቶች
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight flex items-baseline gap-2">
                {activeSurveysCount}
                <span className="text-xs text-emerald-500/80 font-normal">በስራ ላይ</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center font-bold shadow-inner group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                አጠቃላይ ተሳታፊዎች
              </span>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight flex items-baseline gap-2">
                {totalResponsesSum}
                <span className="text-xs text-amber-400/80 font-normal">ነዋሪዎች</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center font-bold shadow-inner group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Primary Tab Navigation & Action Toolbar */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Animated Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center space-x-2 ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <span>ቻርቶች እና አናሊቲክስ</span>
          </button>

          <button
            onClick={() => setActiveTab('policy_report')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center space-x-2 ${
              activeTab === 'policy_report'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span>የፖሊሲና የሕዝብ እርካታ ሪፖርት</span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center space-x-2 ${
              activeTab === 'manage'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
            }`}
          >
            <Vote className="w-4 h-4 text-amber-300" />
            <span>የጥናቶች ማኔጀር</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
            }`}
          >
            <History className="w-4 h-4 text-amber-300" />
            <span>የኦዲት መዝገብ (Audit Logs)</span>
          </button>

          <button
            onClick={() => setActiveTab('db')}
            title="ቴሌግራም እና ሴቲንግ (Telegram Settings)"
            className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeTab === 'db'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
            }`}
          >
            <Send className="w-4 h-4 text-sky-400" />
            <Settings className="w-4 h-4 text-amber-300" />
          </button>
        </div>

        <button
          onClick={() => setIsBuilderOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/40 transition-all flex items-center justify-center space-x-2 shrink-0 border border-emerald-400/30"
        >
          <Plus className="w-4 h-4" />
          <span>+ አዲስ መጠይቅ ፍጠር</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <VisualAnalytics
              surveys={surveys}
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={(id) => setSelectedSurveyId(id)}
              adminToken={adminToken}
              initialShowReport={false}
            />
          </motion.div>
        )}

        {activeTab === 'policy_report' && (
          <motion.div
            key="policy_report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <VisualAnalytics
              surveys={surveys}
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={(id) => setSelectedSurveyId(id)}
              adminToken={adminToken}
              initialShowReport={true}
            />
          </motion.div>
        )}

        {activeTab === 'manage' && (
          <motion.div
            key="manage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Vote className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">የመጠይቆች ዝርዝር እና ማስተካከያ</h3>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="በስም ወይም መደብ ፈልግ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4">ID</th>
                    <th className="p-4">የመጠይቅ ርዕስ (Title)</th>
                    <th className="p-4">መደብ (Category)</th>
                    <th className="p-4 text-center">ተሳታፊዎች</th>
                    <th className="p-4 text-center">ሁኔታ (Status)</th>
                    <th className="p-4 text-right">ድርጊቶች (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                  {filteredSurveys.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-500">#{s.id}</td>
                      <td className="p-4 font-black text-slate-100 max-w-xs truncate">{s.title}</td>
                      <td className="p-4">
                        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold border border-slate-700/80 text-xs">
                          {s.category}
                        </span>
                      </td>
                      <td className="p-4 text-center font-black text-amber-300">{s.total_responses || 0}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleActive(s.id, s.is_active)}
                          className={`inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full font-black text-xs transition-all ${
                            s.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {s.is_active ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-400" />
                              <span>ክፍት (Active)</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-slate-500" />
                              <span>ተዘግቷል (Closed)</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedSurveyId(s.id);
                            setActiveTab('analytics');
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          አናሊቲክስ ይመልከቱ
                        </button>

                        <button
                          onClick={() => handleDeleteSurvey(s.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all"
                          title="ሰርዝ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4"
          >
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">የአድሚን ሲስተም እንቅስቃሴ መዝገብ (System Audit Logs)</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th className="p-3.5">ሰዓት / ቀን</th>
                    <th className="p-3.5">ተጠቃሚ (Admin)</th>
                    <th className="p-3.5">ድርጊት (Action)</th>
                    <th className="p-3.5">ዝርዝር መግለጫ (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                        ምንም የተቀመጠ የኦዲት መዝገብ የለም::
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('am-ET')}
                        </td>
                        <td className="p-3.5 font-bold text-slate-200">{log.admin_email}</td>
                        <td className="p-3.5">
                          <span className="bg-blue-500/10 text-blue-400 font-mono font-bold px-2.5 py-1 rounded-lg border border-blue-500/20 text-xs">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'db' && (
          <motion.div
            key="db"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TelegramSettings adminToken={adminToken} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Survey Builder Modal */}
      <SurveyBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSurveyCreated={fetchSurveys}
        adminToken={adminToken}
      />
    </div>
  );
};

