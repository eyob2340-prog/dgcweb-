import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Plus,
  Trash2,
  Edit3,
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
  MessageSquare,
  Key,
  UserCog,
  Laptop,
  Crown,
  Wrench,
  RefreshCw,
  Bell,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Survey, AuditLog, AdminUser } from '../types';
import { VisualAnalytics } from './VisualAnalytics';
import { SurveyBuilderModal } from './SurveyBuilderModal';
import { TelegramSettings } from './TelegramSettings';
import { AdminTicketsView } from './AdminTicketsView';
import { UserAccountsView } from './UserAccountsView';
import { DeveloperOpaControl } from './DeveloperOpaControl';
import { toEthiopianDate, formatEthiopianDate, formatEthiopianDateTime } from '../lib/ethiopianDate';

interface AdminDashboardProps {
  adminToken: string;
}

interface AdminNotification {
  id: string;
  type: 'ticket_new' | 'ticket_urgent' | 'ticket_status' | 'survey_response' | 'telegram_status';
  title: string;
  description: string;
  time_eth: string;
  priority: 'high' | 'medium' | 'info';
  linkTab: 'tickets' | 'surveys' | 'analytics' | 'telegram';
  refId?: string | number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminToken }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'manage' | 'tickets' | 'users' | 'opa_control' | 'audit' | 'db'>('analytics');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [surveyToEdit, setSurveyToEdit] = useState<Survey | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Notification Center State
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  // 24-Hour Telegram Dispatch State
  const [isSending24hReport, setIsSending24hReport] = useState<boolean>(false);
  const [reportSendFeedback, setReportSendFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const ethCurrentDate = toEthiopianDate(new Date());

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok && data.admin) {
        setCurrentUser(data.admin);
      }
    } catch (err) {
      console.error('Error fetching admin user:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchNotifications();
  }, [adminToken]);

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

  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [isDeletingSurvey, setIsDeletingSurvey] = useState<boolean>(false);

  const confirmDeleteSurvey = async () => {
    if (!surveyToDelete) return;
    setIsDeletingSurvey(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        fetchSurveys();
        if (selectedSurveyId === surveyToDelete.id) {
          setSelectedSurveyId(null);
        }
        setSurveyToDelete(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeletingSurvey(false);
    }
  };

  // Trigger 24-Hour Master Data, PDF & OPA AI Engine Policy Report to Telegram
  const handleSend24hTelegramReport = async () => {
    setIsSending24hReport(true);
    setReportSendFeedback(null);
    try {
      const res = await fetch('/api/admin/telegram/send-24h-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportSendFeedback({
          success: true,
          message: data.message || 'የ24 ሰዓት የPDF ሪፖርት፣ የዳታ ፋይል (Excel/CSV) እና የ OPA AI Engine ትንተና ወደ Telegram በስኬት ተልኳል!',
        });
      } else {
        setReportSendFeedback({
          success: false,
          message: data.error || data.message || 'ወደ Telegram መላክ አልተቻለም። እባክዎ ቦት ሴቲንግ ያረጋግጡ::',
        });
      }
    } catch (err: any) {
      setReportSendFeedback({
        success: false,
        message: 'የኔትወርክ ስህተት አጋጥሟል::',
      });
    } finally {
      setIsSending24hReport(false);
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
      {/* Top Header Row: Ethiopian Date, Notifications, and 24h Telegram Report CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">የኢትዮጵያ ዘመን አቆጣጠር:</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                {ethCurrentDate.formattedAmharic}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ ዲጂታል መድረክ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Notification Center Trigger */}
          <button
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen);
              fetchNotifications();
            }}
            className="relative px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            title="ማሳወቂያ ማዕከል (Notification Center)"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">ማሳወቂያዎች</span>
            {unreadNotifCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* 24-Hour Automated Telegram Dispatch Action Button */}
          <button
            onClick={handleSend24hTelegramReport}
            disabled={isSending24hReport}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-2xl border border-sky-400/30 text-xs font-black shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="የ24 ሰዓት የPDF ሪፖርት፣ የዳታ ፋይል (Excel/CSV) እና የ OPA AI Engine ትንተና አሁኑኑ ወደ Telegram ይላኩ"
          >
            {isSending24hReport ? (
              <RefreshCw className="w-4 h-4 animate-spin text-sky-200" />
            ) : (
              <Send className="w-4 h-4 text-sky-200" />
            )}
            <span>{isSending24hReport ? 'በመላክ ላይ...' : 'የ24h ዳታ ወደ Telegram ላክ'}</span>
          </button>
        </div>
      </div>

      {/* Report Dispatch Feedback Banner */}
      {reportSendFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between gap-3 ${
            reportSendFeedback.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/60 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {reportSendFeedback.success ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{reportSendFeedback.message}</span>
          </div>
          <button
            onClick={() => setReportSendFeedback(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            ዝጋ
          </button>
        </motion.div>
      )}

      {/* Notification Center Modal / Drawer */}
      <AnimatePresence>
        {isNotificationOpen && (
          <div className="fixed inset-0 z-[120] flex items-start justify-end p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-slate-900 border border-slate-700 text-slate-100 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto relative"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black text-white">🔔 የማሳወቂያ ማዕከል (Notification Center)</h3>
                </div>
                <button
                  onClick={() => setIsNotificationOpen(false)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  ዝጋ
                </button>
              </div>

              <div className="space-y-3">
                {loadingNotifs ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>ማሳወቂያዎች በመጫን ላይ...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic">
                    ምንም አዲስ ማሳወቂያ የለም:: ሁሉም ነገር የተረጋጋ ነው::
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (notif.linkTab === 'tickets') setActiveTab('tickets');
                        else if (notif.linkTab === 'surveys') setActiveTab('manage');
                        else if (notif.linkTab === 'telegram') setActiveTab('db');
                        setIsNotificationOpen(false);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer hover:border-amber-400/60 ${
                        notif.priority === 'high'
                          ? 'bg-red-950/30 border-red-500/30 text-red-200'
                          : notif.priority === 'medium'
                          ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-bold text-white">{notif.title}</span>
                        <span className="font-mono text-[10px] text-amber-300">{notif.time_eth}</span>
                      </div>
                      <p className="text-xs text-slate-300">{notif.description}</p>
                      <div className="mt-2 flex items-center justify-end">
                        <span className="text-[10px] text-sky-400 font-bold flex items-center gap-1 hover:underline">
                          <span>ዝርዝሩን ይመልከቱ</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
      <div className="bg-slate-900/90 backdrop-blur-2xl p-2 sm:p-2.5 rounded-2xl border border-slate-800/80 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Sleek Segmented Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {/* Unified Analytics & Policy Intelligence Report */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-sky-300 shrink-0" />
            <span>አናሊቲክስና ሪፖርት</span>
          </button>

          {/* Survey Management */}
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'manage'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
            }`}
          >
            <Vote className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>የጥናቶች ማኔጀር</span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-950/60 text-[10px] text-slate-300 font-mono">
              {surveys.length}
            </span>
          </button>

          {/* Citizen Tickets & Grievances */}
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-amber-300 shrink-0" />
            <span>የዜጎች አቤቱታዎች</span>
          </button>

          {/* User Profile & Security */}
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
            }`}
          >
            <UserCog className="w-4 h-4 text-indigo-300 shrink-0" />
            <span>
              {currentUser?.role === 'admin' ? 'የኔ ፕሮፋይል' : 'አካውንቶችና ደህንነት'}
            </span>
          </button>

          {/* Audit Logs */}
          {(currentUser?.role === 'developer' || currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
              }`}
            >
              <History className="w-4 h-4 text-violet-300 shrink-0" />
              <span>የኦዲት መዝገብ</span>
            </button>
          )}

          {/* Telegram Settings (Developer & Owner) */}
          {(currentUser?.role === 'developer' || currentUser?.role === 'owner') && (
            <button
              onClick={() => setActiveTab('db')}
              title="ቴሌግራም ቦት ሴቲንግ (Telegram Bot Settings)"
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'db'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 border border-sky-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/40'
              }`}
            >
              <Send className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Telegram</span>
            </button>
          )}

          {/* Developer Control Panel */}
          {currentUser?.role === 'developer' && (
            <button
              onClick={() => setActiveTab('opa_control')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'opa_control'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30'
                  : 'bg-purple-950/60 text-purple-300 hover:bg-purple-900 hover:text-white border border-purple-800/40'
              }`}
            >
              <Laptop className="w-4 h-4 text-fuchsia-300 shrink-0" />
              <span>OPA Dev</span>
            </button>
          )}
        </div>

        {/* Create Survey Action CTA */}
        <button
          onClick={() => {
            setSurveyToEdit(null);
            setIsBuilderOpen(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/40 transition-all flex items-center justify-center space-x-2 shrink-0 border border-emerald-400/30 cursor-pointer self-stretch sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ አዲስ መጠይቅ</span>
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
                <h3 className="text-base font-black text-white">የመጠይቆች ዝርዝር እና ማስተካከያ (Survey Management & Editing)</h3>
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
                        {/* Edit Survey Button */}
                        <button
                          onClick={() => {
                            setSurveyToEdit(s);
                            setIsBuilderOpen(true);
                          }}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="መጠይቁን አስተካክል / አርትዕ (Edit Survey)"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>አርትዕ</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSurveyId(s.id);
                            setActiveTab('analytics');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          አናሊቲክስ
                        </button>

                        <button
                          onClick={() => setSurveyToDelete(s)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all cursor-pointer"
                          title="መጠይቁን ሰርዝ (Delete Survey)"
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

        {activeTab === 'tickets' && (
          <motion.div
            key="tickets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <AdminTicketsView adminToken={adminToken} />
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <UserAccountsView adminToken={adminToken} currentUser={currentUser} />
          </motion.div>
        )}

        {activeTab === 'opa_control' && (
          <motion.div
            key="opa_control"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DeveloperOpaControl adminToken={adminToken} currentUser={currentUser} />
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
                    <th className="p-3.5">ሰዓት / ቀን (የኢትዮጵያ ቀን)</th>
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
                          {formatEthiopianDateTime(log.timestamp || log.created_at || new Date().toISOString())}
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

      {/* Survey Builder & Editor Modal */}
      <SurveyBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setSurveyToEdit(null);
        }}
        onSurveyCreated={() => {
          fetchSurveys();
          setSurveyToEdit(null);
        }}
        adminToken={adminToken}
        surveyToEdit={surveyToEdit}
      />

      {/* Survey Delete Confirmation Modal */}
      {surveyToDelete && (
        <AnimatePresence>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-red-500/40 text-slate-100 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">የጥናት መጠይቅ መደለዝ</h3>
                  <p className="text-xs text-red-400 font-mono">መጠይቅ ID: #{surveyToDelete.id}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <p className="font-bold text-slate-200 line-clamp-2">ርዕስ: {surveyToDelete.title}</p>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
                  <span>መደብ: {surveyToDelete.category}</span>
                  <span className="text-amber-400 font-bold">ተሳታፊዎች: {surveyToDelete.total_responses || 0}</span>
                </div>
                <p className="text-red-300 font-semibold pt-1">
                  ⚠️ ይህን መጠይቅ ሲሰርዙ በውስጡ ያሉ ጥያቄዎችና የተሰጡ ምላሾች በሙሉ ከዳታቤዝ ይሰረዛሉ::
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingSurvey}
                  onClick={() => setSurveyToDelete(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  ተመለስ (Cancel)
                </button>
                <button
                  type="button"
                  disabled={isDeletingSurvey}
                  onClick={confirmDeleteSurvey}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl text-xs shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingSurvey ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{isDeletingSurvey ? 'በመሰረዝ ላይ...' : 'አዎ፣ ሰርዝ (Delete)'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};


