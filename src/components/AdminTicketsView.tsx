import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Search,
  Filter,
  Globe,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  MapPin,
  Send,
  User,
  Phone,
  Mail,
  RefreshCw,
  X,
  FileText,
  Trash2,
} from 'lucide-react';
import { CitizenTicket, TicketStatus, TranslationResult } from '../types';

interface AdminTicketsViewProps {
  adminToken: string;
}

export const AdminTicketsView: React.FC<AdminTicketsViewProps> = ({ adminToken }) => {
  const [tickets, setTickets] = useState<CitizenTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Response Modal state
  const [selectedTicket, setSelectedTicket] = useState<CitizenTicket | null>(null);
  const [responseStatus, setResponseStatus] = useState<TicketStatus>('Under Review');
  const [responseText, setResponseText] = useState<string>('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  // Translation State mapping ticket ID -> TranslationResult
  const [translationsMap, setTranslationsMap] = useState<Record<number, TranslationResult>>({});
  const [translatingTicketId, setTranslatingTicketId] = useState<number | null>(null);
  const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);

  const handleDeleteTicket = async (ticket: CitizenTicket) => {
    if (!window.confirm(`እርግጠኛ ነዎት አቤቱታ ኮድ "${ticket.ticket_code}" መደለዝ/ማጥፋት ይፈልጋሉ?`)) {
      return;
    }
    setDeletingTicketId(ticket.id);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
      } else {
        alert(data.error || 'አቤቱታውን መደለዝ አልተቻለም');
      }
    } catch (err) {
      alert('የኔትወርክ ስህተት አጋጥሟል');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tickets', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
      } else {
        setError(data.error || 'አቤቱታዎችን ማግኘት አልተቻለም');
      }
    } catch (err: any) {
      setError('የኔትወርክ ስህተት አጋጥሟል');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [adminToken]);

  const handleTranslate = async (ticket: CitizenTicket) => {
    setTranslatingTicketId(ticket.id);
    try {
      const fullTextToTranslate = `Subject: ${ticket.subject}\nDescription: ${ticket.description}`;
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ text: fullTextToTranslate }),
      });

      const data = await res.json();
      if (res.ok && data.translation) {
        setTranslationsMap((prev) => ({
          ...prev,
          [ticket.id]: data.translation,
        }));
      }
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslatingTicketId(null);
    }
  };

  const handleOpenResponseModal = (ticket: CitizenTicket) => {
    setSelectedTicket(ticket);
    setResponseStatus(ticket.status || 'Under Review');
    setResponseText(ticket.admin_response || '');
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setIsSubmittingResponse(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          admin_response: responseText.trim(),
          status: responseStatus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedTicket(null);
        fetchTickets();
      } else {
        alert(data.error || 'ምላሹን ማስቀመጥ አልተቻለም');
      }
    } catch (err) {
      alert('የኔትወርክ ስህተት');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Filter logic
  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
    const cleanSearch = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !cleanSearch ||
      t.ticket_code.toLowerCase().includes(cleanSearch) ||
      t.subject.toLowerCase().includes(cleanSearch) ||
      t.description.toLowerCase().includes(cleanSearch) ||
      (t.full_name && t.full_name.toLowerCase().includes(cleanSearch)) ||
      (t.phone && t.phone.toLowerCase().includes(cleanSearch));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-extrabold text-[10px]">አጣዳፊ (Urgent)</span>;
      case 'High':
        return <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full font-extrabold text-[10px]">ከፍተኛ (High)</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-full font-extrabold text-[10px]">መደበኛ (Normal)</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> ተመልሷል</span>;
      case 'Under Review':
        return <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-2xl font-bold text-xs flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ምርመራ ላይ</span>;
      case 'Closed':
        return <span className="px-3 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded-2xl font-bold text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" /> ተዘጋ</span>;
      default:
        return <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl font-bold text-xs flex items-center gap-1"><Clock className="w-3.5 h-3.5 animate-spin" /> በሂደት ላይ</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                የዜጎች አቤቱታዎችና ጥያቄዎች አስተዳደር
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                የመጡ አቤቱታዎችን ይመልከቱ፣ በAI በኦሮምኛ/ሶማሊኛ የተፃፉትን ይተርጉሙ እና ኦፊሴላዊ መልስ ይስጡ
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchTickets}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 transition-all flex items-center gap-2 self-start md:self-auto shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>አድስ (Refresh)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="በኮድ፣ ርዕስ፣ ስም ወይም ስልክ ፈልግ..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="All">ሁሉንም ሁኔታዎች አሳይ (All Statuses)</option>
            <option value="Pending">በሂደት ላይ (Pending)</option>
            <option value="Under Review">ምርመራ ላይ (Under Review)</option>
            <option value="Resolved">ተመልሷል (Resolved)</option>
            <option value="Closed">ተዘጋ (Closed)</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="All">ሁሉንም ዘርፎች አሳይ (All Sectors)</option>
            <option value="ንጹህ መጠጥ ውኃ">ንጹህ መጠጥ ውኃ</option>
            <option value="መብራትና ኃይል">መብራትና ኃይል</option>
            <option value="መንገድና ትራንስፖርት">መንገድና ትራንስፖርት</option>
            <option value="ጤናና ሆስፒታል">ጤናና ሆስፒታል</option>
            <option value="ትምህርት">ትምህርት</option>
            <option value="የከተማ መሬትና ፕላን">የከተማ መሬትና ፕላን</option>
            <option value="የህግና ፍትህ">የህግና ፍትህ</option>
            <option value="አጠቃላይ የመንግስት አገልግሎት">አጠቃላይ የመንግስት አገልግሎት</option>
          </select>
        </div>
      </div>

      {/* Tickets Cards List */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3">
          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">የዜጎች አቤቱታዎች በመጫን ላይ ናቸው...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 space-y-2">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-300">ምንም አቤቱታ አልተገኘም</h4>
          <p className="text-xs text-slate-500">የፍለጋ መስፈርቱን ይቀይሩ ወይም አዲስ አቤቱታ እስኪገባ ይቆዩ::</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.map((t) => {
            const translation = translationsMap[t.id];
            const isTranslating = translatingTicketId === t.id;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 hover:border-slate-700 transition-all shadow-xl"
              >
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                      {t.ticket_code}
                    </span>
                    {getPriorityBadge(t.priority)}
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-slate-400">
                      ቀን፡ {new Date(t.created_at).toLocaleString('am-ET')}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>
                </div>

                {/* Subject & Category */}
                <div>
                  <h3 className="text-base font-black text-slate-100">{t.subject}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" /> {t.category}
                    </span>
                    {t.residence && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" /> {t.residence}
                      </span>
                    )}
                    {t.full_name && (
                      <span className="flex items-center gap-1 text-slate-300 font-semibold">
                        <User className="w-3.5 h-3.5 text-emerald-400" /> {t.full_name}
                      </span>
                    )}
                    {t.phone && (
                      <span className="flex items-center gap-1 font-mono text-amber-400">
                        <Phone className="w-3.5 h-3.5" /> {t.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Original Description */}
                <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-2xl text-xs text-slate-300 leading-relaxed space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">የቀረበው አቤቱታ/ጥያቄ ጽሑፍ፡</span>
                  <p className="whitespace-pre-wrap">{t.description}</p>
                </div>

                {/* AI Translation Badge Box */}
                {translation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/40 rounded-2xl space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <span>በAI የተተረጎመ (Detected Language: {translation.detected_language})</span>
                      </span>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>

                    <div className="space-y-2">
                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-amber-400 block mb-0.5">አማርኛ ትርጉም፡</span>
                        <p className="text-slate-200 font-medium">{translation.translated_amharic}</p>
                      </div>

                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-blue-400 block mb-0.5">English Translation:</span>
                        <p className="text-slate-200 font-medium">{translation.translated_english}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Official Response Preview if answered */}
                {t.admin_response && (
                  <div className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-2xl text-xs text-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 block">የተሰጠ ኦፊሴላዊ መልስ፡</span>
                    <p className="whitespace-pre-wrap">{t.admin_response}</p>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleTranslate(t)}
                    disabled={isTranslating}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-900/80 to-blue-900/80 hover:from-indigo-800 hover:to-blue-800 text-amber-300 border border-indigo-700/50 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTranslating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>{isTranslating ? 'በAI በመተርጎም ላይ...' : 'በAI ተርጉም (Translate)'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteTicket(t)}
                      disabled={deletingTicketId === t.id}
                      className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-2xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      title="አቤቱታውን ሰርዝ/ደልዝ"
                    >
                      {deletingTicketId === t.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span>ሰርዝ (Delete)</span>
                    </button>

                    <button
                      onClick={() => handleOpenResponseModal(t)}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{t.admin_response ? 'ኦፊሴላዊ መልስን አሻሽል' : 'ኦፊሴላዊ መልስ መስጫ (Respond)'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Admin Ticket Response Modal */}
      {selectedTicket && (
        <AnimatePresence>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl relative"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white">ለአቤቱታ ኦፊሴላዊ መልስ መስጫ</h3>
                  <p className="text-xs text-amber-400 font-mono">ኮድ፡ {selectedTicket.ticket_code}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveResponse} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    የአቤቱታው አዲስ ሁኔታ (Status)
                  </label>
                  <select
                    value={responseStatus}
                    onChange={(e) => setResponseStatus(e.target.value as TicketStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="Under Review">ምርመራ ላይ (Under Review)</option>
                    <option value="Resolved">ተመልሷል / መፍትሔ አግኝቷል (Resolved)</option>
                    <option value="Closed">ተዘጋ (Closed)</option>
                    <option value="Pending">በሂደት ላይ (Pending)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ኦፊሴላዊ የመፍትሔ መልስ (ለዜጋው በክትትል ገጽ ላይ የሚታይ) *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="ለአቤቱታ አቅራቢው የሚሰጠውን ኦፊሴላዊ መግለጫ ወይም የመፍትሔ ምላሽ እዚህ ይፃፉ..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold"
                  >
                    ሰርዝ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingResponse}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingResponse ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isSubmittingResponse ? 'በመመዝገብ ላይ...' : 'ምላሹን መዝግብ'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
