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

interface SurveyFormProps {
  survey: Survey;
  hasResponded: boolean;
  onBack: () => void;
  onSubmitSuccess: () => void;
  language?: Language;
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

  // Auto-restore saved progress on load
  useEffect(() => {
    try {
      const savedKey = `dgc_survey_progress_${survey.id}`;
      const savedData = localStorage.getItem(savedKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.demographics) setDemographics(parsed.demographics);
        if (parsed.answers && Object.keys(parsed.answers).length > 0) {
          setAnswers(parsed.answers);
          setRestoredProgressNotice(true);
          setTimeout(() => setRestoredProgressNotice(false), 5000);
        }
      }
    } catch (e) {
      console.error('Error restoring progress:', e);
    }
  }, [survey.id]);

  // Auto-save progress to localStorage on answer or demographic update
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      const savedKey = `dgc_survey_progress_${survey.id}`;
      localStorage.setItem(
        savedKey,
        JSON.stringify({
          demographics,
          answers,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  }, [answers, demographics, survey.id]);

  const handleManualSaveProgress = () => {
    const savedKey = `dgc_survey_progress_${survey.id}`;
    localStorage.setItem(
      savedKey,
      JSON.stringify({
        demographics,
        answers,
        updatedAt: new Date().toISOString(),
      })
    );
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

    // Check if browser is offline
    if (!navigator.onLine) {
      saveToOfflineQueue({
        surveyId: survey.id,
        demographics,
        answers: payloadAnswers,
      });
      setIsOfflineSaved(true);
      setSubmittedTicket('DGC-OFFLINE-' + Math.floor(100000 + Math.random() * 900000));
      setIsSubmitting(false);
      onSubmitSuccess();
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        localStorage.removeItem(`dgc_survey_progress_${survey.id}`);
        onSubmitSuccess();
      }
    } catch (err: any) {
      // Save offline on network error
      saveToOfflineQueue({
        surveyId: survey.id,
        demographics,
        answers: payloadAnswers,
      });
      setIsOfflineSaved(true);
      setSubmittedTicket('DGC-OFFLINE-' + Math.floor(100000 + Math.random() * 900000));
      onSubmitSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/#survey-${survey.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (submittedTicket) {
    return (
      <div className="max-w-2xl mx-auto bg-slate-900/90 backdrop-blur-md rounded-3xl p-8 border border-emerald-500/30 shadow-2xl text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner"
        >
          {isOfflineSaved ? <WifiOff className="w-10 h-10 text-amber-400" /> : <CheckCircle2 className="w-10 h-10 animate-bounce" />}
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-100">
            {isOfflineSaved ? t.offlineQueued : t.submittedSuccess}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            {isOfflineSaved
              ? t.offlineSyncNotice
              : t.submittedMessage}
          </p>
        </div>

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 inline-block text-left text-xs text-slate-300 space-y-1.5 shadow-inner">
          <div className="flex items-center space-x-2 text-slate-200 font-bold">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>{t.refCode}</span>
          </div>
          <p className="font-mono text-base text-emerald-400 font-black tracking-widest pl-6">
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
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>{t.giveAnother}</span>
          </button>

          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center space-x-2"
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
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin-slow" />
            <span>{t.progressRestored}</span>
          </div>
          <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-800">Auto-restored</span>
        </div>
      )}

      {/* Save my progress Toast Notification */}
      {showProgressSavedToast && (
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 p-3.5 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-lg">
          <Save className="w-4 h-4 text-amber-400" />
          <span>{t.progressSavedToast}</span>
        </div>
      )}

      {/* Top bar with Back, Save Progress, and Share QR buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all flex items-center space-x-1.5 shadow-md"
        >
          <ArrowLeft className="w-4 h-4 text-blue-400" />
          <span>{t.back}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded-2xl border border-amber-500/30 transition-all flex items-center space-x-2 shadow-md"
          >
            <QrCode className="w-4 h-4" />
            <span>{t.qrAndShare}</span>
          </button>
        </div>
      </div>

      {/* Survey Title Header (Dynamic Theme) */}
      <div className={`${themeStyles.headerBg} text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-3 relative overflow-hidden border`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${themeStyles.badgeBg} text-xs px-3 py-1 rounded-full font-bold border`}>
            {survey.category}
          </span>
          {survey.theme && (
            <span className="text-[11px] font-bold text-slate-300 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-700 uppercase tracking-wide">
              Theme: {survey.theme}
            </span>
          )}
          {survey.start_date && (
            <span className="text-blue-200 text-xs flex items-center gap-1 font-medium bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>የጀመረበት፡ {survey.start_date}</span>
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black leading-snug">{survey.title}</h1>
        <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">{survey.description}</p>
      </div>

      {/* Live Survey Progress System Indicator */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center space-x-2 text-amber-400">
            <BookmarkCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {t.questionProgress} {answeredCount} / {totalQuestions}
            </span>
          </div>
          <span className="text-emerald-400 font-mono text-xs">{progressPercent}% Completed</span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
          <motion.div
            className={`h-full rounded-full ${themeStyles.progressFill}`}
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Mandatory Demographics Section */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-100">{t.demographicSection}</h2>
            <p className="text-[11px] text-slate-400">{t.demographicSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Age Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <span>{t.ageGroup}:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((age) => (
                <button
                  type="button"
                  key={age}
                  onClick={() => setDemographics((p) => ({ ...p, age_group: age }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    demographics.age_group === age
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-105'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <span>{t.gender}:</span>
            </label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setDemographics((p) => ({ ...p, gender: g }))}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    demographics.gender === g
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md scale-105'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {g === 'ወንድ' ? t.male : t.female}
                </button>
              ))}
            </div>
          </div>

          {/* Education Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">{t.education}:</label>
            <select
              value={demographics.education || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, education: e.target.value }))}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="text-xs font-bold text-slate-300">መኖሪያ / ተቋም Category:</label>
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
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="text-xs font-bold text-slate-300">
              የተወሰነ ቦታ/ተቋም ({demographics.residence_category || RESIDENCE_CATEGORIES[0]}):
            </label>
            <select
              value={demographics.residence || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, residence: e.target.value }))}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(demographics.residence_category === 'የሴክተር ተቋማት' || !demographics.residence_category) &&
                SECTOR_INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>
                    🏢 {inst}
                  </option>
                ))}
              {demographics.residence_category === 'ወረዳ' &&
                URBAN_WOREDAS.map((w) => (
                  <option key={w} value={w}>
                    🏙️ {w}
                  </option>
                ))}
              {demographics.residence_category === 'የገጠር ወረዳዎች' &&
                RURAL_WOREDAS.map((rw) => (
                  <option key={rw} value={rw}>
                    🌾 {rw}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Global Accordion Toggle Header */}
      {(survey.questions || []).length > 1 && (
        <div className="flex items-center justify-between bg-slate-900/70 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>{t.questions} ({(survey.questions || []).length})</span>
          </div>
          <button
            type="button"
            onClick={toggleAllCollapse}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1"
          >
            {(survey.questions || []).every((q) => collapsedQuestions[q.id]) ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.expandAll}</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.collapseAll}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-2xl text-xs sm:text-sm flex items-start space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {(survey.questions || []).map((q, idx) => {
          const isCollapsed = !!collapsedQuestions[q.id];
          const hasAnswered = !!answers[q.id]?.text || !!answers[q.id]?.rating;

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-slate-900/70 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden hover:border-slate-700 transition-colors"
            >
              {/* Question Card Header */}
              <div
                onClick={() => toggleQuestionCollapse(q.id)}
                className="p-5 sm:p-6 flex items-center justify-between cursor-pointer select-none bg-slate-900/90 hover:bg-slate-800/60 transition-colors border-b border-transparent"
              >
                <div className="flex items-center space-x-3 pr-2 flex-grow">
                  <span
                    className={`w-8 h-8 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 border transition-colors ${
                      hasAnswered
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <h3 className="text-sm sm:text-base font-black text-slate-100 leading-snug">
                      {q.question_text}
                    </h3>
                    {hasAnswered && (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" /> ተመልሷል
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                    {isCollapsed ? 'ዘርጋ' : 'ሰብስብ'}
                  </span>
                  <div className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
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
                    className="p-6 pt-0 border-t border-slate-800/80"
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
                                  ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-2 ring-blue-500/30 shadow-md'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-semibold">{opt}</span>
                              <div
                                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-600 text-white scale-110'
                                    : 'border-slate-700 bg-slate-900'
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
                                className={`p-3 sm:p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                                  isFilled
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md scale-110'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                                }`}
                              >
                                <Star className={`w-6 h-6 ${isFilled ? 'fill-amber-400 text-amber-400' : ''}`} />
                                <span className="text-xs font-black mt-1">{star}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 px-1 max-w-xs font-medium">
                          <span>1 - በጣም ዝቅተኛ</span>
                          <span>5 - በጣም ከፍተኛ</span>
                        </div>
                      </div>
                    )}

                    {/* Open-ended Text Question */}
                    {q.question_type === 'text' && (
                      <div className="pt-4 relative">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-2">
                          <PenTool className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                          <span>እባክዎ የተሟላ አስተያየትዎን እዚህ ያስፍሩ፡</span>
                        </div>
                        <textarea
                          rows={4}
                          value={answers[q.id]?.text || ''}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          placeholder="አስተያየትዎን እዚህ ይጻፉ..."
                          className="w-full p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
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
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">{t.captchaTitle}</p>
              <p className="text-[11px] text-slate-400">ሀሰተኛ እና አውቶሜትድ ምላሾችን ለመከላከል የተደረገ፡</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm font-black text-amber-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              {numA} + {numB} =
            </span>
            <input
              type="number"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="መልስ"
              className={`w-20 p-2 text-center bg-slate-950 border rounded-xl text-sm font-bold text-white focus:outline-none ${
                captchaError ? 'border-red-500 ring-2 ring-red-500/30' : 'border-slate-800 focus:ring-2 focus:ring-emerald-500'
              }`}
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs sm:text-sm font-bold transition-colors"
          >
            ሰርዝ
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2"
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
