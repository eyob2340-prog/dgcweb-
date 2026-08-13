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
} from 'lucide-react';
import { CitizenTicket } from '../types';

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
  const [activeTab, setActiveTab] = useState<'code' | 'recover'>('code');
  const [ticketCode, setTicketCode] = useState<string>(initialCode);
  const [ticket, setTicket] = useState<CitizenTicket | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery State
  const [recoveryQuery, setRecoveryQuery] = useState<string>('');
  const [recoveredTickets, setRecoveredTickets] = useState<CitizenTicket[]>([]);
  const [recovering, setRecovering] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryQuery.trim() || recoveryQuery.trim().length < 3) {
      setRecoveryError('እባክዎ ቢያንስ 3 ፊደላት/ቁጥሮች ያለው የስልክ ቁጥር ወይም ኢሜይል ያስገቡ::');
      return;
    }

    setRecovering(true);
    setRecoveryError(null);
    setRecoveredTickets([]);

    try {
      const res = await fetch('/api/tickets/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: recoveryQuery }),
      });
      const data = await res.json();
      if (res.ok && data.tickets) {
        setRecoveredTickets(data.tickets);
      } else {
        setRecoveryError(data.error || 'በተሰጠው ስልክ ወይም ኢሜይል የተመዘገበ አቤቱታ አልተገኘም::');
      }
    } catch (err: any) {
      setRecoveryError('የኔትወርክ ስህተት አጋጥሟል! እባክዎ እንደገና ይሞክሩ::');
    } finally {
      setRecovering(false);
    }
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
                  <BadgeCheck className="w-4 h-4 text-amber-400" /> የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን
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

          {/* Navigation Tabs (By Code vs Recover Lost Code) */}
          <div className="px-6 pt-4 border-b border-slate-800 flex gap-2">
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
              onClick={() => setActiveTab('recover')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === 'recover'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-300" />
              <span>የተረሳ ኮድ በስልክ/ኢሜይል ፈልግ (Recover Lost Code)</span>
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
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>{loading ? 'በመፈለግ ላይ...' : 'ፈልግ (Search)'}</span>
                    </button>
                  </div>
                </form>

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
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          የክትትል ኮድ (Ticket Code)
                        </span>
                        <span className="text-xl font-black font-mono text-amber-300 tracking-wider">
                          {ticket.ticket_code}
                        </span>
                      </div>

                      <div>{getStatusBadge(ticket.status)}</div>
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
                              የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ኦፊሴላዊ መልስ (Official Response)
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
            ) : (
              /* TAB 2: RECOVER LOST TICKET CODE */
              <div className="space-y-6">
                <div className="bg-blue-950/30 border border-blue-500/30 p-4 rounded-2xl space-y-1">
                  <h4 className="text-sm font-black text-blue-300 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    የተረሳ ወይም የጠፋ የክትትል ኮድ መፈለጊያ
                  </h4>
                  <p className="text-xs text-slate-300">
                    አቤቱታ በላኩበት ወቅት ያሰገቡትን የስልክ ቁጥር ወይም ኢሜይል በማስገባት የተመዘገበውን የክትትል ኮድዎን (Ticket Code) ማግኘት ይችላሉ::
                  </p>
                </div>

                <form onSubmit={handleRecoverSubmit} className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300">
                    የስልክ ቁጥር ወይም ኢሜይል ያስገቡ (Phone Number or Email)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={recoveryQuery}
                      onChange={(e) => setRecoveryQuery(e.target.value)}
                      placeholder="e.g. 0911XXXXXX or email@example.com"
                      className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-mono font-bold tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
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
                      {recovering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>{recovering ? 'በመፈለግ ላይ...' : 'ኮዴን ፈልግ (Recover)'}</span>
                    </button>
                  </div>
                </form>

                {recoveryError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {/* Recovered Tickets List */}
                {recoveredTickets.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      በተሰጠው መረጃ የተገኙ አቤቱታዎች ({recoveredTickets.length})
                    </h5>

                    <div className="space-y-3">
                      {recoveredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black font-mono text-amber-300">{t.ticket_code}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                                {t.category}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-200">{t.subject}</p>
                            <span className="text-[11px] text-slate-500 block">
                              የገባበት፡ {new Date(t.created_at).toLocaleDateString('am-ET')}
                            </span>
                          </div>

                          <button
                            onClick={() => selectRecoveredTicket(t)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1 shrink-0"
                          >
                            <span>ሁኔታውን ይመልከቱ</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
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

