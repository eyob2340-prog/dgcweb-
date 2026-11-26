import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Clock, Landmark, ListChecks, Lock, QrCode, Share2, Users } from 'lucide-react';
import { Survey } from '../types';
import { DgcQrCard } from './DgcQrCard';

interface FeaturedSurveyBannerProps {
  survey: Survey;
  questionCount: number;
  onOpen: (surveyId: number) => void;
  isDarkMode?: boolean;
}

const TOPICS = ['የኑሮ ውድነት', 'ኢኮኖሚ', 'ግብር አከፋፈል', 'የሥራ ዕድል', 'ሰላምና ደኅንነት', 'የባሕር በር'];

export const FeaturedSurveyBanner: React.FC<FeaturedSurveyBannerProps> = ({ survey, questionCount, onOpen, isDarkMode = false }) => {
  const d = isDarkMode;
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const done = Boolean(survey.has_responded);
  const shareUrl = `${window.location.origin}/?survey=${survey.id}`;

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: survey.title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* user cancelled share */
    }
  };

  const secondaryBtn = d
    ? 'border-white/15 bg-white/5 text-slate-900 hover:bg-white/10'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm';

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      aria-labelledby="featured-survey-title"
      className={`relative overflow-hidden rounded-[2rem] border ${
        d
          ? 'border-blue-500/30 bg-gradient-to-br from-[#0b1f4a] via-[#0a1733] to-[#06261f] shadow-2xl shadow-black/30'
          : 'border-blue-100 bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-xl shadow-blue-900/5'
      }`}
    >
      {/* Ethiopian flag accent stripe */}
      <div className="absolute inset-x-0 top-0 flex h-1.5">
        <span className="flex-1 bg-emerald-500" />
        <span className="flex-1 bg-amber-400" />
        <span className="flex-1 bg-red-500" />
      </div>
      <div className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl ${d ? 'bg-emerald-400/10' : 'bg-emerald-300/30'}`} />
      <div className={`pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full blur-3xl ${d ? 'bg-blue-500/20' : 'bg-sky-300/30'}`} />

      <div className="relative z-10 grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.6fr_1fr] lg:items-center">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 px-3 py-1 text-[11px] font-black text-white shadow-md shadow-blue-600/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              አዲስ · ዋና መጠይቅ
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                d ? 'border-white/15 bg-white/5 text-slate-800' : 'border-blue-100 bg-white text-slate-600'
              }`}
            >
              <Landmark className={`h-3.5 w-3.5 ${d ? 'text-emerald-700' : 'text-blue-600'}`} />
              የሕዝብ ተወካዮች ምክር ቤት · ሕዳር 17/2019 ዓ.ም
            </span>
          </div>

          <h2
            id="featured-survey-title"
            className={`text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[2.1rem] ${d ? 'text-slate-900' : 'text-slate-900'}`}
          >
            {survey.title}
          </h2>

          <p className={`max-w-2xl text-sm leading-relaxed sm:text-[15px] ${d ? 'text-slate-700' : 'text-slate-600'}`}>{survey.description}</p>

          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <span
                key={topic}
                className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                  d ? 'border-slate-300/80 bg-white/60 text-slate-700' : 'border-slate-200 bg-white/80 text-slate-600'
                }`}
              >
                {topic}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            {done ? (
              <div
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-sm font-black ${
                  d ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                አስተያየትዎን ሰጥተዋል — እናመሰግናለን!
              </div>
            ) : (
              <button
                onClick={() => onOpen(survey.id)}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:shadow-blue-600/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/60 sm:text-base cursor-pointer"
              >
                አሁኑኑ አስተያየት ይስጡ
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            )}
            <button
              onClick={share}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-bold transition-colors cursor-pointer ${secondaryBtn}`}
            >
              <Share2 className={`h-4 w-4 ${d ? 'text-emerald-700' : 'text-blue-600'}`} />
              {copied ? 'ሊንኩ ተቀድቷል ✓' : 'ለሌሎች ያጋሩ'}
            </button>
            <button
              onClick={() => setShowQr(true)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 text-sm font-bold transition-colors cursor-pointer ${secondaryBtn}`}
            >
              <QrCode className={`h-4 w-4 ${d ? 'text-emerald-700' : 'text-blue-600'}`} />
              QR ኮድ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat d={d} icon={<ListChecks className="h-5 w-5" />} value={`${questionCount || 6}`} label="ክፍት ጥያቄዎች" />
          <Stat d={d} icon={<Clock className="h-5 w-5" />} value="~5 ደቂቃ" label="የሚወስደው ጊዜ" />
          <Stat d={d} icon={<Users className="h-5 w-5" />} value={`${survey.total_responses ?? 0}`} label="እስካሁን የተሳተፉ" />
          <Stat d={d} icon={<Lock className="h-5 w-5" />} value="100%" label="ሚስጥራዊ · ስም አይጠየቅም" />
        </div>
      </div>
      {showQr &&
        createPortal(
          <div
            className="fixed inset-0 overflow-y-auto z-[100] flex items-center-safe justify-center bg-slate-900/40 p-4 backdrop-blur-md"
            onClick={() => setShowQr(false)}
          >
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <DgcQrCard url={shareUrl} surveyTitle={survey.title} onClose={() => setShowQr(false)} />
            </div>
          </div>,
          document.body
        )}
    </motion.section>
  );
};

const Stat: React.FC<{ d: boolean; icon: React.ReactNode; value: string; label: string }> = ({ d, icon, value, label }) => (
  <div className={`flex items-center gap-3 rounded-2xl border p-4 ${d ? 'border-white/10 bg-slate-50/50' : 'border-white bg-white/90 shadow-sm'}`}>
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
        d ? 'bg-emerald-400/15 text-emerald-700' : 'bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-600'
      }`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div className={`text-lg font-black leading-none ${d ? 'text-slate-900' : 'text-slate-900'}`}>{value}</div>
      <div className={`mt-1 text-[11px] font-semibold ${d ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
    </div>
  </div>
);
