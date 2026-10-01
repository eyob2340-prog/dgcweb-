import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Send,
  CheckCircle2,
  AlertTriangle,
  PenTool,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  Lock,
  QrCode,
  Share2,
  Copy,
  UserCheck,
  ShieldCheck,
  Download,
  RefreshCw,
  WifiOff,
  BookmarkCheck,
  Save,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCodeLib from 'qrcode';
import {
  Survey,
  Demographics,
  RESIDENCE_CATEGORIES,
  SECTOR_INSTITUTIONS,
  URBAN_WOREDAS,
  RURAL_WOREDAS,
} from '../types';
import { saveToOfflineQueue } from '../lib/offlineSync';
import { Language, translations } from '../lib/i18n';
import { DgcQrCard } from './DgcQrCard';
import { getAnonymousClientId } from '../lib/clientId';

interface SurveyFormProps {
  survey: Survey;
  hasResponded: boolean;
  onBack: () => void;
  onSubmitSuccess: () => void;
  language?: Language;
  isDarkMode?: boolean;
}

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-65', '65+'];
const GENDERS = ['ወንድ', 'ሴት'];
const EDUCATIONS = [
  'ያልተማረ / መሠረታዊ',
  'የመጀመሪያ ደረጃ (1-8)',
  'ሁለተኛ ደረጃ (9-12)',
  'ዲፕሎማ / ሰርተፊኬት',
  'የመጀመሪያ ዲግሪ',
  'ሁለተኛ ዲግሪና ከዚያ በላይ',
];
const RESIDENCES = [
  'ሳቢያን',
  'አዲስ ከተማ',
  'ግሪክ ካምፕ',
  'ገንደ ቆሬ',
  'መብረት ኃይል',
  'ገንደ ቦዬ',
  'ገንደ ዶቄ',
  'ገንደ ሎኒ',
  'ገንደ ዲፖ',
  'ከዚራ',
  'ነምበር ዋን',
  'ደቻቱ',
  'መጋላ',
  'ቀብረ ጆሌ',
  'ጫት ተራ',
  'ሐፈተ ኢሳ',
  'ለገ ሐሬ',
  'ፖሊስ መሬት',
  'ገንደ ገራዳ',
  'ብሄረ ጽጌ',
  'አላይ በዴ',
  'መላካ ጀብዱ',
  'ገንደ ተስፋ',
  'ገንደ ካባ',
  'ገንደ ሮቃ',
  'ገንደ ጋራ',
  'ገንደ ገበሬ',
  'ሌላ / ከድሬዳዋ ውጭ',
];

export const SurveyForm: React.FC<SurveyFormProps> = ({
  survey,
  onBack,
  onSubmitSuccess,
  language = 'am',
  isDarkMode = true,
}) => {
  const t = translations[language] || translations.am;

  // Demographic state
  const [demographics, setDemographics] = useState<Demographics>({
    age_group: '26-35',
    gender: 'ወንድ',
    education: 'የመጀመሪያ ዲግሪ',
    residence: 'አዲስ ከተማ',
  });

  const [answers, setAnswers] = useState<Record<number, { text?: string; rating?: number }>>({});
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [isOfflineSaved, setIsOfflineSaved] = useState<boolean>(false);
  const [showProgressSavedToast, setShowProgressSavedToast] = useState(false);
  const [restoredProgressNotice, setRestoredProgressNotice] = useState(false);

  // In-memory state only (Strictly avoids persisting unencrypted citizen opinions/demographics into shared localStorage)
  useEffect(() => {
    // Clear any legacy survey progress from storage to protect privacy on shared kiosks
    try {
      localStorage.removeItem(`dgc_survey_progress_${survey.id}`);
    } catch {}
  }, [survey.id]);

  const handleManualSaveProgress = () => {
    // No-op for shared kiosk privacy, inform citizen that responses are held safely in memory for this session
    setShowProgressSavedToast(true);
    setTimeout(() => setShowProgressSavedToast(false), 3000);
  };

  // Progress Calculation
  const questionsList = survey.questions || [];
  const totalQuestions = questionsList.length;
  const answeredCount = questionsList.filter((q) => {
    const a = answers[q.id];
    return Boolean(a?.text && a.text.trim()) || Boolean(a?.rating);
  }).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Theme Configs
  const themeKey = survey.theme || 'government';
  const themeStyles = {
    government: {
      headerBg: 'bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 border-blue-800/80',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      progressFill: 'bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-400',
      buttonBg: 'bg-blue-600 hover:bg-blue-500 text-white',
    },
    corporate: {
      headerBg: 'bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 border-emerald-800/80',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      progressFill: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-300',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
    education: {
      headerBg: 'bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 border-indigo-800/80',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      progressFill: 'bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    },
    research: {
      headerBg: 'bg-gradient-to-r from-slate-950 via-teal-950 to-cyan-950 border-teal-800/80',
      badgeBg: 'bg-teal-500/20 text-cyan-300 border-teal-500/30',
      progressFill: 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400',
      buttonBg: 'bg-teal-600 hover:bg-teal-500 text-white',
    },
    modern: {
      headerBg: 'bg-gradient-to-r from-zinc-950 via-rose-950 to-slate-900 border-rose-900/80',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      progressFill: 'bg-gradient-to-r from-rose-500 via-amber-400 to-pink-500',
      buttonBg: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
    minimal: {
      headerBg: 'bg-slate-900 border-slate-700',
      badgeBg: 'bg-slate-800 text-slate-200 border-slate-700',
      progressFill: 'bg-slate-400',
      buttonBg: 'bg-slate-800 hover:bg-slate-700 text-white',
    },
  }[themeKey];

  // Anti-bot Captcha Math challenge
  const [numA, setNumA] = useState(5);
  const [numB, setNumB] = useState(3);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  // QR Code & Share modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    setNumA(a);
    setNumB(b);
    setCaptchaInput('');
    setCaptchaError(false);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    if (showQrModal) {
      const shareUrl = `${window.location.origin}/#survey-${survey.id}`;
      QRCodeLib.toDataURL(shareUrl, { width: 280, margin: 2 })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [showQrModal, survey.id]);

  const toggleQuestionCollapse = (qId: number) => {
    setCollapsedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const toggleAllCollapse = () => {
    const questions = survey.questions || [];
    const allCollapsed = questions.every((q) => collapsedQuestions[q.id]);
    const nextState: Record<number, boolean> = {};
    questions.forEach((q) => {
      nextState[q.id] = !allCollapsed;
    });
    setCollapsedQuestions(nextState);
  };

  const handleRadioSelect = (questionId: number, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text: option },
    }));
  };

  const handleRatingSelect = (questionId: number, rating: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating },
    }));
  };

  const handleTextChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCaptchaError(false);

    // Validate Captcha Math Challenge
    const expectedAnswer = numA + numB;
    if (parseInt(captchaInput, 10) !== expectedAnswer) {
      setCaptchaError(true);
      setErrorMessage(`የቦት መከላከያ ቁጥር መልስ አልተክከለም (${numA} + ${numB} = ?):: እባክዎ በትክክል ይሙሉ!`);
      return;
    }

    // Validate Demographic selections
    if (!demographics.age_group || !demographics.gender || !demographics.education || !demographics.residence) {
      setErrorMessage('እባክዎ መጀመሪያ የጀርባ ስነ-ሕዝብ (ዕድሜ፣ ፆታ፣ ትምህርት እና መኖሪያ ቦታ) መረጃዎችን ይሙሉ::');
      return;
    }

    // Validate questions
    const questions = survey.questions || [];
    for (const q of questions) {
      if (q.question_type === 'radio' && !answers[q.id]?.text) {
        setCollapsedQuestions((prev) => ({ ...prev, [q.id]: false }));
        setErrorMessage(`እባክዎ ለጥያቄ "${q.question_text.slice(0, 30)}..." መልስ ይምረጡ::`);
        return;
      }
      if (q.question_type === 'rating' && !answers[q.id]?.rating) {
        setCollapsedQuestions((prev) => ({ ...prev, [q.id]: false }));
        setErrorMessage(`እባክዎ ለጥያቄ "${q.question_text.slice(0, 30)}..." የደረጃ ቁጥር ይስጡ::`);
        return;
      }
    }

    setIsSubmitting(true);

    const payloadAnswers = questions
      .map((q) => {
        const val = answers[q.id];
        return {
          question_id: q.id,
          answer_text: val?.text || undefined,
          rating_value: val?.rating || undefined,
        };
      })
      .filter((a) => a.answer_text !== undefined || a.rating_value !== undefined);

    // Check if browser is offline - require live connection to protect citizen privacy on shared devices
    if (!navigator.onLine) {
      setErrorMessage('የኢንተርኔት ግኑኝነት አልተገኘም:: የዜጎች መረጃ ሚስጥራዊነትን ለመጠበቅ አስተያየትን በጋራ መሣሪያ ላይ ማስቀመጥ አይፈቀድም፤ እባክዎ ኢንተርኔት ሲያገኙ እንደገና ይሞክሩ:: (Internet connection required for secure submission)');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': getAnonymousClientId(),
        },
        body: JSON.stringify({
          answers: payloadAnswers,
          demographics,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'መልስዎን ለመመዝገብ አልተቻለም::');
      } else {
        const ticketCode = data.refCode || 'DGC-OP-' + Math.floor(100000 + Math.random() * 900000);
        setSubmittedTicket(ticketCode);
        onSubmitSuccess();
      }
    } catch (err: any) {
      setErrorMessage('የኔትወርክ ስህተት አጋጥሟል! እባክዎ መስመርዎን ይፈትሹ እና እንደገና ይሞክሩ::');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedTicket) {
    return (
      <div className={`max-w-2xl mx-auto rounded-3xl p-8 border shadow-2xl text-center space-y-6 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/90 backdrop-blur-md border-emerald-500/30 text-white'
          : 'bg-white/95 backdrop-blur-md border-emerald-500/40 text-slate-900 shadow-slate-200/80'
      }`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner"
        >
          {isOfflineSaved ? <WifiOff className="w-10 h-10 text-amber-400" /> : <CheckCircle2 className="w-10 h-10 animate-bounce" />}
        </motion.div>
        <div className="space-y-2">
          <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
            {isOfflineSaved ? t.offlineQueued : t.submittedSuccess}
          </h2>
          <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {isOfflineSaved
              ? t.offlineSyncNotice
              : t.submittedMessage}
          </p>
        </div>

        <div className={`p-5 rounded-2xl border inline-block text-left text-xs space-y-1.5 shadow-inner ${
          isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className={`flex items-center space-x-2 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>{t.refCode}</span>
          </div>
          <p className="font-mono text-base text-emerald-500 font-black tracking-widest pl-6">
            {submittedTicket}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setSubmittedTicket(null);
              setIsOfflineSaved(false);
              setAnswers({});
              generateCaptcha();
            }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <span>{t.giveAnother}</span>
          </button>

          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>{t.backToSurveys}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Restored Progress Toast Notification */}
      {restoredProgressNotice && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-400 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <span>{t.progressRestored}</span>
          </div>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">Auto-restored</span>
        </div>
      )}

      {/* Save my progress Toast Notification */}
      {showProgressSavedToast && (
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-400 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-lg">
          <Save className="w-4 h-4 text-amber-400" />
          <span>{t.progressSavedToast}</span>
        </div>
      )}

      {/* Top bar with Back, Save Progress, and Share QR buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all flex items-center space-x-1.5 shadow-md cursor-pointer ${
            isDarkMode
              ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4 text-blue-500" />
          <span>{t.back}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 py-2 text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-2xl border border-amber-500/30 transition-all flex items-center space-x-2 shadow-md cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-amber-500" />
            <span>{t.qrAndShare}</span>
          </button>
        </div>
      </div>

      {/* Survey Title Header (Dynamic Theme) */}
      <div className={`p-6 sm:p-8 rounded-3xl shadow-xl space-y-3 relative overflow-hidden border transition-all duration-300 ${
        isDarkMode
          ? 'bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-blue-500/30 text-white'
          : 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 text-white shadow-blue-200/50'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold border border-white/30">
            {survey.category}
          </span>
          {survey.start_date && (
            <span className="text-white/90 text-xs flex items-center gap-1 font-medium bg-black/20 px-2.5 py-1 rounded-full border border-white/20">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>የጀመረበት፡ {survey.start_date}</span>
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black leading-snug">{survey.title}</h1>
        <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal">{survey.description}</p>
      </div>

      {/* Live Survey Progress System Indicator */}
      <div className={`rounded-2xl p-4 border shadow-xl space-y-2 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/90 backdrop-blur-md border-slate-800'
          : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
      }`}>
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center space-x-2 text-amber-500">
            <BookmarkCheck className="w-4 h-4 text-amber-500" />
            <span>
              {t.questionProgress} {answeredCount} / {totalQuestions}
            </span>
          </div>
          <span className="text-blue-500 font-mono text-xs font-black">{progressPercent}% Completed</span>
        </div>

        {/* Visual Progress Bar */}
        <div className={`w-full rounded-full h-3.5 p-0.5 border overflow-hidden shadow-inner ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-500 shadow-sm"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Mandatory Demographics Section */}
      <div className={`rounded-3xl p-6 border shadow-xl space-y-5 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/80 backdrop-blur-md border-slate-800'
          : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
      }`}>
        <div className={`flex items-center space-x-2.5 border-b pb-3 ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className={`p-2 rounded-xl border ${
            isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
          }`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.demographicSection}</h2>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.demographicSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Age Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold flex items-center space-x-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <span>{t.ageGroup}:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((age) => (
                <button
                  type="button"
                  key={age}
                  onClick={() => setDemographics((p) => ({ ...p, age_group: age }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    demographics.age_group === age
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-105'
                      : isDarkMode
                      ? 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold flex items-center space-x-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <span>{t.gender}:</span>
            </label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setDemographics((p) => ({ ...p, gender: g }))}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    demographics.gender === g
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md scale-105'
                      : isDarkMode
                      ? 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {g === 'ወንድ' ? t.male : t.female}
                </button>
              ))}
            </div>
          </div>

          {/* Education Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.education}:</label>
            <select
              value={demographics.education || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, education: e.target.value }))}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {EDUCATIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {/* Residence Category Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>መኖሪያ / ተቋም Category:</label>
            <select
              value={demographics.residence_category || RESIDENCE_CATEGORIES[0]}
              onChange={(e) => {
                const cat = e.target.value;
                let defaultLoc = SECTOR_INSTITUTIONS[0] as string;
                if (cat === 'ወረዳ') defaultLoc = URBAN_WOREDAS[0];
                else if (cat === 'የገጠር ወረዳዎች') defaultLoc = RURAL_WOREDAS[0];
                setDemographics((p) => ({
                  ...p,
                  residence_category: cat,
                  residence: defaultLoc,
                }));
              }}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {RESIDENCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Location Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              የተወሰነ ቦታ/ተቋም ({demographics.residence_category || RESIDENCE_CATEGORIES[0]}):
            </label>
            <select
              value={demographics.residence || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, residence: e.target.value }))}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {(demographics.residence_category === 'የሴክተር ተቋማት' || !demographics.residence_category) &&
                SECTOR_INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>
                    🏢 {inst}
                  </option>
                ))}

              {demographics.residence_category === 'ወረዳ' &&
                URBAN_WOREDAS.map((woreda) => (
                  <option key={woreda} value={woreda}>
                    📍 {woreda}
                  </option>
                ))}

              {demographics.residence_category === 'የገጠር ወረዳዎች' &&
                RURAL_WOREDAS.map((woreda) => (
                  <option key={woreda} value={woreda}>
                    🌾 {woreda}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-4 bg-amber-500/15 border border-amber-500 rounded-2xl text-xs sm:text-sm text-amber-500 font-bold flex items-center space-x-2 animate-shake">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {(survey.questions || []).map((q, index) => {
          const isAnswered = Boolean(answers[q.id]?.text || answers[q.id]?.rating);
          const isCollapsed = Boolean(collapsedQuestions[q.id]);

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden ${
                isDarkMode
                  ? 'bg-slate-900/80 backdrop-blur-md border-slate-800'
                  : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
              }`}
            >
              {/* Question Header */}
              <div
                onClick={() => toggleQuestionCollapse(q.id)}
                className={`p-6 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5 border ${
                      isAnswered
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-bold leading-snug ${
                      isDarkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      {q.question_text}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {isAnswered && (
                    <span className="p-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Collapsible Question Details */}
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`p-6 pt-0 border-t ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}
                  >
                    {/* Radio Choice Question */}
                    {q.question_type === 'radio' && (
                      <div className="space-y-2.5 pt-4">
                        {(q.options || []).map((opt) => {
                          const isSelected = answers[q.id]?.text === opt;
                          return (
                            <label
                              key={opt}
                              onClick={() => handleRadioSelect(q.id, opt)}
                              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? isDarkMode
                                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-2 ring-blue-500/30 shadow-md'
                                    : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/30 shadow-md'
                                  : isDarkMode
                                  ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-semibold">{opt}</span>
                              <div
                                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-600 text-white scale-110'
                                    : isDarkMode
                                    ? 'border-slate-700 bg-slate-900'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Rating Question */}
                    {q.question_type === 'rating' && (
                      <div className="pt-4 space-y-3">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const currentRating = answers[q.id]?.rating || 0;
                            const isFilled = star <= currentRating;
                            return (
                              <button
                                type="button"
                                key={star}
                                onClick={() => handleRatingSelect(q.id, star)}
                                className={`p-3 sm:p-4 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                  isFilled
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-500 shadow-md scale-110'
                                    : isDarkMode
                                    ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                <Star className={`w-6 h-6 ${isFilled ? 'fill-amber-400 text-amber-500' : ''}`} />
                                <span className="text-xs font-black mt-1">{star}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className={`flex justify-between text-xs px-1 max-w-xs font-medium ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <span>1 - በጣም ዝቅተኛ</span>
                          <span>5 - በጣም ከፍተኛ</span>
                        </div>
                      </div>
                    )}

                    {/* Open-ended Text Question */}
                    {q.question_type === 'text' && (
                      <div className="pt-4 relative">
                        <div className={`flex items-center space-x-1.5 text-xs mb-2 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <PenTool className="w-3.5 h-3.5 text-amber-500" />
                          <span>እባክዎ የተሟላ አስተያየትዎን እዚህ ያስፍሩ፡</span>
                        </div>
                        <textarea
                          rows={4}
                          value={answers[q.id]?.text || ''}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          placeholder="አስተያየትዎን እዚህ ይጻፉ..."
                          className={`w-full p-4 rounded-2xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all border ${
                            isDarkMode
                              ? 'bg-slate-950/70 border-slate-800 text-slate-100'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        ></textarea>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Anti-bot Captcha Math Challenge */}
        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 ${
          isDarkMode
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-white/95 border-slate-200 shadow-slate-200/60'
        }`}>
          <div className={`flex items-center space-x-3 text-xs ${
            isDarkMode ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{t.captchaTitle}</p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ሀሰተኛ እና አውቶሜትድ ምላሾችን ለመከላከል የተደረገ፡</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`font-mono text-sm font-black px-3 py-1.5 rounded-xl border ${
              isDarkMode
                ? 'text-amber-400 bg-slate-950 border-slate-800'
                : 'text-amber-600 bg-slate-100 border-slate-200'
            }`}>
              {numA} + {numB} =
            </span>
            <input
              type="number"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="መልስ"
              className={`w-20 p-2 text-center border rounded-xl text-sm font-bold focus:outline-none ${
                captchaError
                  ? 'border-amber-500 ring-2 ring-amber-500/30'
                  : isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-white focus:ring-2 focus:ring-blue-500'
                  : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500'
              }`}
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            ሰርዝ
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>{t.submitting}</span>
            ) : (
              <>
                <Send className="w-4 h-4 text-amber-400" />
                <span>{t.submitFeedback}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* QR Code & Share Modal */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full"
            >
              <DgcQrCard
                url={typeof window !== 'undefined' ? `${window.location.origin}/?survey=${survey.id}` : `https://dgc.gov.et/?survey=${survey.id}`}
                surveyTitle={survey.title}
                onClose={() => setShowQrModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
