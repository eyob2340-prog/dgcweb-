import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Building2,
  MapPin,
  FileText,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Clock,
} from 'lucide-react';
import {
  CitizenTicket,
  TicketPriority,
  RESIDENCE_CATEGORIES,
  SECTOR_INSTITUTIONS,
  URBAN_WOREDAS,
  RURAL_WOREDAS,
} from '../types';

interface CitizenComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTrackerWithCode?: (code: string) => void;
  isDarkMode?: boolean;
}

const CATEGORIES = [
  { id: 'ንጹህ መጠጥ ውኃ', label: '🚰 ንጹህ መጠጥ ውኃ (Water Supply)' },
  { id: 'መብራትና ኃይል', label: '⚡ መብራትና ኃይል (Electricity & Energy)' },
  { id: 'መንገድና ትራንስፖርት', label: '🛣️ መንገድና ትራንስፖርት (Roads & Transport)' },
  { id: 'ጤናና ሆስፒታል', label: '🏥 ጤናና ሆስፒታል (Health & Hospitals)' },
  { id: 'ትምህርት', label: '🏫 ትምህርትና ስልጠና (Education & Schools)' },
  { id: 'የከተማ መሬትና ፕላን', label: '🏙️ የከተማ መሬትና ፕላን (Land & Urban Planning)' },
  { id: 'የህግና ፍትህ', label: '⚖️ የህግና ፍትህ አገልግሎት (Justice & Legal)' },
  { id: 'አጠቃላይ የመንግስት አገልግሎት', label: '💼 አጠቃላይ የመንግስት አገልግሎት (General Public Service)' },
];

export const CitizenComplaintModal: React.FC<CitizenComplaintModalProps> = ({
  isOpen,
  onClose,
  onOpenTrackerWithCode,
  isDarkMode = true,
}) => {
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [residenceCategory, setResidenceCategory] = useState<string>(RESIDENCE_CATEGORIES[0]);
  const [residence, setResidence] = useState<string>(SECTOR_INSTITUTIONS[0]);
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [priority, setPriority] = useState<TicketPriority>('Normal');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<CitizenTicket | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('እባክዎ የጥያቄውን/አቤቱታውን ርዕስ እና ዝርዝር መግለጫ ያስገቡ');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          residence,
          subject: subject.trim(),
          description: description.trim(),
          full_name: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          priority,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ticket) {
        setCreatedTicket(data.ticket);
        // Persist to browser localStorage for auto-remembering
        try {
          const savedStr = localStorage.getItem('dgc_my_tickets');
          const savedList: any[] = savedStr ? JSON.parse(savedStr) : [];
          const updatedList = [
            {
              ticket_code: data.ticket.ticket_code,
              subject: data.ticket.subject,
              category: data.ticket.category,
              residence: data.ticket.residence,
              created_at: data.ticket.created_at || new Date().toISOString(),
            },
            ...savedList.filter((item: any) => item.ticket_code !== data.ticket.ticket_code),
          ].slice(0, 25);
          localStorage.setItem('dgc_my_tickets', JSON.stringify(updatedList));
        } catch (e) {
          console.warn('Failed to save ticket to browser storage:', e);
        }
      } else {
        setError(data.error || 'አቤቱታውን መመዝገብ አልተቻለም');
      }
    } catch (err: any) {
      setError('የኔትወርክ ስህተት አጋጥሟል! እባክዎ እንደገና ይሞክሩ::');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdTicket) return;
    navigator.clipboard.writeText(createdTicket.ticket_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleResetAndClose = () => {
    setCreatedTicket(null);
    setSubject('');
    setDescription('');
    setFullName('');
    setPhone('');
    setEmail('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-blue-950/40'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/80'
          }`}
        >
          {/* Header */}
          <div
            className={`px-6 py-5 border-b flex items-center justify-between relative ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-950/90 via-slate-900 to-amber-950/40 border-slate-800'
                : 'bg-gradient-to-r from-blue-50 via-white to-amber-50 border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-500 flex items-center justify-center shadow-lg text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  የዜጎች አቤቱታና ጥያቄ መስኮት
                </h3>
                <p className="text-xs text-amber-500 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን
                </p>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className={`p-2 rounded-full transition-all ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form or Receipt Body */}
          <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            {createdTicket ? (
              /* Success Ticket Receipt Card */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xl sm:text-2xl font-black text-emerald-400">
                    አቤቱታዎ/ጥያቄዎ በስኬት ተመዝግቧል!
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                    አቤቱታዎ ለድሬዳዋ አስተዳደር የሚመለከተው ክፍለ ከተማና መመሪያ በኦፊሴላዊ መዝገብ የተመራ ሲሆን የሚከተለውን የክትትል ኮድ ያስቀምጡ::
                  </p>
                </div>

                {/* Tracking Ticket Code Box */}
                <div
                  className={`p-5 rounded-2xl border shadow-inner max-w-md mx-auto space-y-3 ${
                    isDarkMode ? 'bg-slate-950/80 border-amber-500/40' : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                    የአቤቱታዎ ልዩ የክትትል ኮድ (Ticket Tracking Code)
                  </span>

                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-amber-300 selection:bg-amber-400 selection:text-slate-950">
                      {createdTicket.ticket_code}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow flex items-center gap-1.5 text-xs"
                      title="ኮፒ አድርግ"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'ተኮፒ አድርጓል' : 'ኮፒ'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    በዚህ ኮድ የጥያቄዎን የሂደት ደረጃ እና የአድሚኑን ኦፊሴላዊ መልስ በማንኛውም ጊዜ ከሆምፔጁ ላይ መከታተል ይችላሉ::
                  </p>
                </div>

                {/* Ticket Details Brief */}
                <div
                  className={`p-4 rounded-2xl border text-left text-xs space-y-2 max-w-md mx-auto ${
                    isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-slate-400">ዘርፍ:</span>
                    <span className="font-bold">{createdTicket.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ርዕስ:</span>
                    <span className="font-bold">{createdTicket.subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ሁኔታ:</span>
                    <span className="font-bold text-amber-400">በሂደት ላይ (Pending)</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (onOpenTrackerWithCode && createdTicket) {
                        onOpenTrackerWithCode(createdTicket.ticket_code);
                      }
                      handleResetAndClose();
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-amber-600 hover:from-blue-500 hover:to-amber-500 text-white font-bold text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>ሁኔታውን ቀጥታ ተከታተል (Track Status)</span>
                  </button>

                  <button
                    onClick={handleResetAndClose}
                    className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs transition-all border ${
                      isDarkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    ዝጋ (Close)
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Complaint Submission Form */
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Residence Category & Specific Location */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        የአቤቱታው/ጥያቄው ዘርፍ *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                          isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        የቦታ መደብ (Residence Category) *
                      </label>
                      <select
                        value={residenceCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setResidenceCategory(cat);
                          if (cat === 'የሴክተር ተቋማት') setResidence(SECTOR_INSTITUTIONS[0]);
                          else if (cat === 'ወረዳ') setResidence(URBAN_WOREDAS[0]);
                          else if (cat === 'የገጠር ወረዳዎች') setResidence(RURAL_WOREDAS[0]);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          isDarkMode
                            ? 'bg-slate-950 border-slate-800 text-slate-100'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      >
                        {RESIDENCE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      የተወሰነ ቦታ/ተቋም ({residenceCategory}) *
                    </label>
                    <select
                      value={residence}
                      onChange={(e) => setResidence(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                        isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {residenceCategory === 'የሴክተር ተቋማት' &&
                        SECTOR_INSTITUTIONS.map((inst) => (
                          <option key={inst} value={inst}>
                            🏢 {inst}
                          </option>
                        ))}
                      {residenceCategory === 'ወረዳ' &&
                        URBAN_WOREDAS.map((w) => (
                          <option key={w} value={w}>
                            🏙️ {w}
                          </option>
                        ))}
                      {residenceCategory === 'የገጠር ወረዳዎች' &&
                        RURAL_WOREDAS.map((rw) => (
                          <option key={rw} value={rw}>
                            🌾 {rw}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    የአቤቱታው ወይም የጥያቄው ርዕስ *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ምሳሌ፡ በደቼቱ ቀበሌ 03 የመጠጥ ውኃ መቆራረጥ አቤቱታ"
                    className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ዝርዝር መግለጫ / አቤቱታ * (በአማርኛ፣ ኦሮምኛ፣ ሶማሊኛ ወይም እንግሊዝኛ መፃፍ ይችላሉ)
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="እባክዎን ያጋጠመዎትን ችግር፣ ቦታውን እና የሚፈልጉትን መፍትሔ በዝርዝር ይፃፉ..."
                    className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    የአስቸኳይነት ደረጃ (Priority)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Normal', label: 'መደበኛ (Normal)' },
                      { id: 'High', label: 'ከፍተኛ (High)' },
                      { id: 'Urgent', label: 'አጣዳፊ (Urgent)' },
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPriority(p.id as TicketPriority)}
                        className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all ${
                          priority === p.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : isDarkMode
                            ? 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Citizen Contact Details (Optional) */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <User className="w-3.5 h-3.5" />
                    <span>የአመልካች መረጃ (አማራጭ - ለኦፊሴላዊ ምላሽና ማስታወቂያ)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="ሙሉ ስም (አማራጭ)"
                        className={`w-full px-3 py-2 rounded-xl border text-xs ${
                          isDarkMode
                            ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="ስልክ ቁጥር (ምሳሌ፡ 0915123456)"
                        className={`w-full px-3 py-2 rounded-xl border text-xs ${
                          isDarkMode
                            ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500'
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-600 hover:from-blue-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'አቤቱታው በመመዝገብ ላይ ነው...' : 'አቤቱታውን/ጥያቄውን በኦፊሴላዊ መዝገብ አስገባ'}</span>
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
