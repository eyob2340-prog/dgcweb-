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
}

const TOPICS = ['የኑሮ ውድነት', 'ኢኮኖሚ', 'ግብር አከፋፈል', 'የሥራ ዕድል', 'ሰላምና ደኅንነት', 'የባሕር በር'];

export const FeaturedSurveyBanner: React.FC<FeaturedSurveyBannerProps> = ({ survey, questionCount, onOpen }) => {
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      aria-labelledby="featured-survey-title"
      className="relative overflow-hidden rounded-[2rem] border border-amber-400/40 bg-gradient-to-br from-[#0b1f4a] via-[#0a1733] to-[#140f05] shadow-2xl shadow-amber-500/10"
    >
      {/* Ethiopian flag accent stripe */}
      <div className="absolute inset-x-0 top-0 flex h-1.5">
        <span className="flex-1 bg-emerald-500" />
        <span className="flex-1 bg-amber-400" />
        <span className="flex-1 bg-red-500" />
      </div>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative z-10 grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black text-slate-950 shadow-lg shadow-amber-400/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />
              አዲስ · ዋና መጠይቅ
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-200">
              <Landmark className="h-3.5 w-3.5 text-amber-300" />
              የሕዝብ ተወካዮች ምክር ቤት · ሕዳር 17/2019 ዓ.ም
            </span>
          </div>

          <h2 id="featured-survey-title" className="text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.1rem]">
            {survey.title}
          </h2>

          <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-[15px]">{survey.description}</p>

          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <span key={topic} className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {topic}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            {done ? (
              <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-4 text-sm font-black text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                አስተያየትዎን ሰጥተዋል — እናመሰግናለን!
              </div>
            ) : (
              <button
                onClick={() => onOpen(survey.id)}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-4 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/30 transition-all hover:-translate-y-0.5 hover:shadow-amber-500/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 sm:text-base"
              >
                አሁኑኑ አስተያየት ይስጡ
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            )}
            <button
              onClick={share}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              <Share2 className="h-4 w-4 text-amber-300" />
              {copied ? 'ሊንኩ ተቀድቷል ✓' : 'ለሌሎች ያጋሩ'}
            </button>
            <button
              onClick={() => setShowQr(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              <QrCode className="h-4 w-4" />
              QR ኮድ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat icon={<ListChecks className="h-5 w-5" />} value={`${questionCount || 6}`} label="ክፍት ጥያቄዎች" />
          <Stat icon={<Clock className="h-5 w-5" />} value="~5 ደቂቃ" label="የሚወስደው ጊዜ" />
          <Stat icon={<Users className="h-5 w-5" />} value={`${survey.total_responses ?? 0}`} label="እስካሁን የተሳተፉ" />
          <Stat icon={<Lock className="h-5 w-5" />} value="100%" label="ሚስጥራዊ · ስም አይጠየቅም" />
        </div>
      </div>
      {showQr &&
        createPortal(

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
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

const Stat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">{icon}</div>
    <div className="min-w-0">
      <div className="text-lg font-black leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-slate-400">{label}</div>
    </div>
  </div>
);
