import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  MapPin,
  FileText,
  User,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Phone,
  Mail,
  Key,
  ArrowRight,
  Landmark,
  BadgeCheck,
  Bookmark,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { CitizenTicket } from '../types';

interface SavedTicketItem {
  ticket_code: string;
  subject: string;
  category: string;
  residence?: string;
  created_at: string;
}

interface TicketTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  isDarkMode?: boolean;
}

export const TicketTrackerModal: React.FC<TicketTrackerModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
  isDarkMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'saved' | 'recover'>('code');
  const [ticketCode, setTicketCode] = useState<string>(initialCode);
  const [ticket, setTicket] = useState<CitizenTicket | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // LocalStorage Saved Tickets State
  const [savedTickets, setSavedTickets] = useState<SavedTicketItem[]>([]);

  // Load saved tickets from localStorage on mount & when modal opens
  const loadSavedTickets = () => {
    try {
      const stored = localStorage.getItem('dgc_my_tickets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedTickets(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading saved tickets from localStorage', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedTickets();
    }
  }, [isOpen]);

  const saveTicketToLocalStorage = (t: CitizenTicket | SavedTicketItem) => {
    try {
      const existingStr = localStorage.getItem('dgc_my_tickets');
      const existing: SavedTicketItem[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [
        {
          ticket_code: t.ticket_code,
          subject: t.subject,
          category: t.category,
          residence: t.residence,
          created_at: t.created_at || new Date().toISOString(),
        },
        ...existing.filter((item) => item.ticket_code !== t.ticket_code),
      ].slice(0, 25);
      localStorage.setItem('dgc_my_tickets', JSON.stringify(updated));
      setSavedTickets(updated);
    } catch (e) {
      console.warn('Error saving ticket to localStorage', e);
    }
  };

  const removeSavedTicket = (codeToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = savedTickets.filter((item) => item.ticket_code !== codeToRemove);
      localStorage.setItem('dgc_my_tickets', JSON.stringify(updated));
      setSavedTickets(updated);
    } catch (e) {
      console.warn('Error removing ticket from localStorage', e);
    }
  };

  const clearAllSavedTickets = () => {
    try {
      localStorage.removeItem('dgc_my_tickets');
      setSavedTickets([]);
    } catch (e) {
      console.warn('Error clearing saved tickets', e);
    }
  };

  const handleCopy = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Recovery Two-Step Flow State
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoveryStep, setRecoveryStep] = useState<'email' | 'otp'>('email');
  const [recoveryOtp, setRecoveryOtp] = useState<string>('');
  const [recoveredTickets, setRecoveredTickets] = useState<CitizenTicket[]>([]);
  const [recovering, setRecovering] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setTicketCode(initialCode);
      fetchTicketStatus(initialCode);
    }
  }, [initialCode]);

  if (!isOpen) return null;

  const fetchTicketStatus = async (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) {
      setError('እባክዎ የክትትል ኮድ ያስገቡ');
      return;
    }

    setLoading(true);
    setError(null);
    setTicket(null);

    try {
      const res = await fetch(`/api/tickets/track/${encodeURIComponent(cleanCode)}`);
      const data = await res.json();
      if (res.ok) {
        setTicket(data.ticket);
        saveTicketToLocalStorage(data.ticket);
      } else {
        setError(data.error || 'አቤቱታው አልተገኘም::');
      }
    } catch (err: any) {
      setError('የኔትወርክ ስህተት አጋጥሟል! እባክዎ እንደገና ይሞክሩ::');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTicketStatus(ticketCode);
  };

  const handleTrackSavedCode = (code: string) => {
    setTicketCode(code);
    setActiveTab('code');
    fetchTicketStatus(code);
  };

  // Step 1: Request Email OTP for Recovery
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setRecoveryError('እባክዎ ትክክለኛ ኢሜይል ያስገቡ::');
      return;
    }

    setRecovering(true);
    setRecoveryError(null);
    setRecoverySuccessMessage(null);

    try {
      const res = await fetch('/api/tickets/recover/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecoverySuccessMessage(data.message || 'የማረጋገጫ ኮድ ወደ ኢሜይልዎ ተልኳል::');
        setRecoveryStep('otp');
      } else {
        setRecoveryError(data.error || 'የማረጋገጫ ኮድ መላክ አልተቻለም::');
      }
    } catch (err: any) {
      setRecoveryError('የኔትወርክ ስህተት አጋጥሟል! እባክዎ እንደገና ይሞክሩ::');
    } finally {
      setRecovering(false);
    }
  };

  // Step 2: Verify OTP and fetch recovered tickets
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryOtp.trim() || recoveryOtp.trim().length < 6) {
      setRecoveryError('እባክዎ ባለ 6-አሃዝ የማረጋገጫ ኮድ ያስገቡ::');
      return;
    }

    setRecovering(true);
    setRecoveryError(null);

    try {
      const res = await fetch('/api/tickets/recover/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
          otp: recoveryOtp.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.tickets) {
        setRecoveredTickets(data.tickets);
        if (data.tickets.length === 0) {
          setRecoveryError('በዚህ ኢሜይል የተመዘገበ ምንም አይነት አቤቱታ አልተገኘም::');
        }
      } else {
        setRecoveryError(data.error || 'የማረጋገጫ ኮዱ የተሳሳተ ነው ወይም ጊዜው አልፏል::');
      }
    } catch (err: any) {
      setRecoveryError('የኔትወርክ ስህተት አጋጥሟል! እባክዎ እንደገና ይሞክሩ::');
    } finally {
      setRecovering(false);
    }
  };

  const handleResetRecovery = () => {
    setRecoveryStep('email');
    setRecoveryOtp('');
    setRecoveryError(null);
    setRecoverySuccessMessage(null);
    setRecoveredTickets([]);
  };

  const selectRecoveredTicket = (t: CitizenTicket) => {
    setTicket(t);
    setTicketCode(t.ticket_code);
    setActiveTab('code');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-black text-xs flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ተመልሷል (Resolved)
          </span>
        );
      case 'Under Review':
        return (
          <span className="px-3.5 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full font-black text-xs flex items-center gap-1.5 shadow-sm">
            <Clock className="w-4 h-4 text-blue-400" /> ምርመራ ላይ (Under Review)
          </span>
        );
      case 'Closed':
        return (
          <span className="px-3.5 py-1.5 bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded-full font-black text-xs flex items-center gap-1.5 shadow-sm">
            <X className="w-4 h-4 text-slate-400" /> ተዘጋ (Closed)
          </span>
        );
      default:
        return (
          <span className="px-3.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full font-black text-xs flex items-center gap-1.5 shadow-sm">
            <Clock className="w-4 h-4 animate-spin text-amber-400" /> በሂደት ላይ (Pending)
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-blue-950/40'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/80'
          }`}
        >
          {/* Top Government Emblem Header */}
          <div
            className={`px-6 py-5 border-b flex items-center justify-between ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-950/90 via-slate-900 to-amber-950/40 border-slate-800'
                : 'bg-gradient-to-r from-blue-50 via-white to-amber-50 border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-blue-600 flex items-center justify-center shadow-lg text-slate-950 shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  የጥያቄዎ/አቤቱታዎ ሁኔታ መከታተያ (Status Tracker)
                </h3>
                <p className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-amber-400" /> የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-all ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs (By Code vs Saved in Browser vs Recover Lost Code) */}
          <div className="px-6 pt-4 border-b border-slate-800 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'code'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>በኮድ ፈልግ (Track Code)</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'saved'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>የእኔ የተቀመጡ አቤቱታዎች (My Saved)</span>
              {savedTickets.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-white text-emerald-800 ml-1">
                  {savedTickets.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('recover')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'recover'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span>በኢሜይል ፈልግ (Recover)</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
            {activeTab === 'code' ? (
              /* TAB 1: SEARCH BY CODE */
              <div className="space-y-6">
                <form onSubmit={handleSearchSubmit} className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300">
                    የክትትል ኮድዎን ያስገቡ (e.g. DGC-TKT-2026-W892)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ticketCode}
                      onChange={(e) => setTicketCode(e.target.value)}
                      placeholder="DGC-TKT-2026-XXXX"
                      className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-mono font-bold tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 uppercase ${
                        isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-amber-300 placeholder-slate-600'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>{loading ? 'በመፈለግ ላይ...' : 'ፈልግ (Search)'}</span>
                    </button>
                  </div>
                </form>

                {/* Quick-Access Chips for Saved Tickets in this browser */}
                {savedTickets.length > 0 && !ticket && (
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                        በዚህ ብሮውዘር በቅርቡ የላኳቸው አቤቱታዎች (Quick Track):
                      </span>
                      <button
                        onClick={() => setActiveTab('saved')}
                        className="text-[11px] text-amber-400 hover:underline font-bold"
                      >
                        ሁሉንም እይ ({savedTickets.length})
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {savedTickets.slice(0, 4).map((st) => (
                        <button
                          key={st.ticket_code}
                          onClick={() => handleTrackSavedCode(st.ticket_code)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/50 rounded-xl text-xs font-mono font-bold text-amber-300 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{st.ticket_code}</span>
                          <span className="text-[10px] text-slate-400 font-sans max-w-[120px] truncate">
                            {st.subject}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Ticket Details View */}
                {ticket && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-3xl border space-y-6 shadow-2xl ${
                      isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Status Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            የክትትል ኮድ (Ticket Code)
                          </span>
                          <button
                            onClick={(e) => handleCopy(ticket.ticket_code, e)}
                            className="p-1 text-slate-400 hover:text-amber-300 transition-colors"
                            title="ኮፒ"
                          >
                            {copiedCode === ticket.ticket_code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-xl font-black font-mono text-amber-300 tracking-wider">
                          {ticket.ticket_code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-bold flex items-center gap-1">
                          <Bookmark className="w-3 h-3" /> በብሮውዘርዎ ተቀምጧል
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>
                    </div>

                    {/* Ticket Metadata */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-lg font-black text-slate-100">{ticket.subject}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" />
                            {ticket.category}
                          </span>
                          {ticket.residence && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                              {ticket.residence}
                            </span>
                          )}
                          <span className="text-slate-500">
                            የገባበት ቀን፡ {new Date(ticket.created_at).toLocaleDateString('am-ET')}
                          </span>
                        </div>
                      </div>

                      {/* Citizen Request Body */}
                      <div
                        className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                          isDarkMode
                            ? 'bg-slate-900/90 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-bold text-slate-400 block mb-1 uppercase text-[10px] tracking-wider">
                          የቀረበው አቤቱታ/ጥያቄ ዝርዝር፡
                        </span>
                        <p className="whitespace-pre-wrap">{ticket.description}</p>
                      </div>
                    </div>

                    {/* Grand Official Government Response Banner */}
                    <div
                      className={`p-6 rounded-3xl border space-y-3 relative overflow-hidden shadow-2xl ${
                        ticket.admin_response
                          ? 'bg-gradient-to-br from-blue-950/90 via-slate-900 to-amber-950/40 border-amber-500/50'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-300">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-sm sm:text-base font-black text-amber-300 tracking-tight">
                              የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ ኦፊሴላዊ መልስ (Official Response)
                            </h5>
                            <p className="text-[10px] text-slate-300 font-semibold">
                              የድሬዳዋ አስተዳደር ነዋሪዎች አቤቱታና ጥያቄ ምላሽ መስጫ ጽህፈት ቤት
                            </p>
                          </div>
                        </div>

                        <BadgeCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                      </div>

                      {ticket.admin_response ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-sm sm:text-base font-semibold text-slate-100 whitespace-pre-wrap leading-relaxed">
                            {ticket.admin_response}
                          </p>
                          {ticket.responded_at && (
                            <div className="text-[11px] text-amber-200/80 font-mono font-medium pt-2 border-t border-blue-500/20 flex items-center justify-between">
                              <span>ኦፊሴላዊ መልሱ የተሰጠበት ቀን፡ {new Date(ticket.responded_at).toLocaleString('am-ET')}</span>
                              <span className="text-emerald-400 font-bold">✓ በህጋዊ መልኩ የተደገፈ</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic pt-1">
                          አቤቱታዎ ለሚመለከተው የመንግስት አካል የተመራ ሲሆን በአሁኑ ወቅት በምርመራ ሂደት ላይ ይገኛል:: ኦፊሴላዊ መልስ እንደተሰጠ በዚህ ገጽ ላይ በጉልህ ይለጠፋል::
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : activeTab === 'saved' ? (
              /* TAB 2: SAVED TICKETS IN THIS BROWSER */
              <div className="space-y-6">
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-emerald-400" />
                      በዚህ ብሮውዘር የተቀመጡ አቤቱታዎች (Saved in this Browser)
                    </h4>
                    <p className="text-xs text-slate-300">
                      በዚህ መሳሪያ ያስገቧቸው ወይም የተከታተሏቸው አቤቱታዎች ያለ ምንም ተጨማሪ ጥረት በራስ-ሰር ይቀመጣሉ::
                    </p>
                  </div>

                  {savedTickets.length > 0 && (
                    <button
                      onClick={clearAllSavedTickets}
                      className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ሁሉንም አጥፋ</span>
                    </button>
                  )}
                </div>

                {savedTickets.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-3xl space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
                      <Bookmark className="w-6 h-6" />
                    </div>
                    <h5 className="text-sm font-bold text-slate-300">ምንም የተቀመጠ አቤቱታ የለም</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      አዲስ አቤቱታ ሲያስገቡ ወይም በኮድ ሲፈልጉ በዚህ ብሮውዘር በራስ-ሰር ይቀመጣል::
                    </p>
                    <button
                      onClick={() => setActiveTab('code')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>በኮድ ፈልግ</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedTickets.map((st) => (
                      <div
                        key={st.ticket_code}
                        className="p-4 sm:p-5 bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl space-y-3 transition-all shadow-md group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              {st.ticket_code}
                            </span>
                            <button
                              onClick={(e) => handleCopy(st.ticket_code, e)}
                              className="p-1 text-slate-400 hover:text-amber-300 transition-colors"
                              title="ኮፒ"
                            >
                              {copiedCode === st.ticket_code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                              {st.category}
                            </span>
                            {st.residence && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {st.residence}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={(e) => removeSavedTicket(st.ticket_code, e)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="ከዝርዝር አስወግድ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs font-bold text-slate-200">{st.subject}</p>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                          <span>የተመዘገበበት ቀን፡ {new Date(st.created_at).toLocaleDateString('am-ET')}</span>
                          <button
                            onClick={() => handleTrackSavedCode(st.ticket_code)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span>ሁኔታውን ተከታተል (Track)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: RECOVER LOST TICKET CODE WITH EMAIL OTP */
              <div className="space-y-6">
                <div className="bg-blue-950/30 border border-blue-500/30 p-4 rounded-2xl space-y-1">
                  <h4 className="text-sm font-black text-blue-300 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    የተረሳ የክትትል ኮድ በኢሜይል ማረጋገጫ መፈለጊያ (Email-OTP Recovery)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    አቤቱታዎን በላኩበት ወቅት የተጠቀሙትን ኢሜይል ያስገቡ። ለደህንነት ሲባል ባለ 6-አሃዝ የማረጋገጫ ኮድ (OTP) ይላክልዎታል፤ ኮዱን ሲያረጋግጡ የክትትል ኮድዎንና የተሰጠውን ምላሽ ሙሉ በሙሉ ያገኛሉ::
                  </p>
                </div>

                {recoveryStep === 'email' ? (
                  /* STEP 1: ENTER EMAIL */
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-amber-400" />
                        <span>ኢሜይልዎን ያስገቡ (Registered Email Address)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="example@gmail.com"
                          className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-bold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                            isDarkMode
                              ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={recovering}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          {recovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          <span>{recovering ? 'በመላክ ላይ...' : 'የማረጋገጫ ኮድ ላክ (Send OTP)'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* STEP 2: ENTER OTP */
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    {recoverySuccessMessage && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{recoverySuccessMessage} ወደ <code>{recoveryEmail}</code> ተልኳል::</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>ባለ 6-አሃዝ የማረጋገጫ ኮድ ያስገቡ (6-Digit OTP)</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleResetRecovery}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                        >
                          ኢሜይል ቀይር / እንደገና ጀምር
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={recoveryOtp}
                          onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className={`flex-1 px-4 py-3 rounded-2xl border text-center text-lg font-mono font-black tracking-[0.5em] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                            isDarkMode
                              ? 'bg-slate-950 border-slate-800 text-emerald-300 placeholder-slate-600'
                              : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                          }`}
                        />
                        <button
                          type="submit"
                          disabled={recovering || recoveryOtp.length < 6}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          {recovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                          <span>{recovering ? 'በማረጋገጥ ላይ...' : 'አረጋግጥና ፈልግ (Verify)'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {recoveryError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {/* Recovered Tickets List with full verified detail access */}
                {recoveredTickets.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        የተገኙ አቤቱታዎች ({recoveredTickets.length})
                      </h5>
                      <span className="text-[11px] text-slate-400 font-bold">
                        ባለቤትነት ተረጋግጧል (Verified Access)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {recoveredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="p-5 bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl space-y-3 transition-all shadow-md"
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                {t.ticket_code}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                                {t.category}
                              </span>
                              {t.residence && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {t.residence}
                                </span>
                              )}
                            </div>
                            {getStatusBadge(t.status)}
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs font-black text-slate-200">{t.subject}</p>
                            {t.description && (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60">
                                {t.description}
                              </p>
                            )}
                          </div>

                          {t.admin_response && (
                            <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl space-y-1">
                              <span className="text-[10px] font-black text-amber-400 block">
                                💬 ኦፊሴላዊ የመንግስት መልስ (Official Response):
                              </span>
                              <p className="text-xs text-slate-200 font-semibold">{t.admin_response}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                            <span>የገባበት ቀን፡ {new Date(t.created_at).toLocaleDateString('am-ET')}</span>
                            <button
                              onClick={() => selectRecoveredTicket(t)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <span>ሙሉ ክትትል ዝርዝር</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

