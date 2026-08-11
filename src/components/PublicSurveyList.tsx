import React, { useState } from 'react';
import { Search, ArrowRight, Clock, Sparkles, FileSpreadsheet, CheckCircle2, QrCode, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCodeLib from 'qrcode';
import { Survey } from '../types';
import { DgcQrCard } from './DgcQrCard';

interface PublicSurveyListProps {
  surveys: Survey[];
  onSelectSurvey: (surveyId: number) => void;
  loading: boolean;
}

export const PublicSurveyList: React.FC<PublicSurveyListProps> = ({
  surveys,
  onSelectSurvey,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ሁሉም');
  const [qrModalSurvey, setQrModalSurvey] = useState<Survey | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = ['ሁሉም', 'ፖለቲካ እና ኢኮኖሚ', 'መሠረተ ልማት', 'ማህበራዊ ጉዳዮች'];

  // Filter surveys based on search and category
  const filteredSurveys = surveys.filter((survey) => {
    const matchesSearch =
      survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ሁሉም' || survey.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Ensure newest surveys are strictly sorted at the front/top
  const sortedSurveys = [...filteredSurveys].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id - a.id;
  });

  const openQrModal = (e: React.MouseEvent, survey: Survey) => {
    e.stopPropagation();
    setQrModalSurvey(survey);
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?survey=${survey.id}` : `https://dgc.gov.et/?survey=${survey.id}`;
    QRCodeLib.toDataURL(shareUrl, { width: 320, margin: 2, color: { dark: '#022b69', light: '#ffffff' } })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  };

  const copyShareLink = () => {
    if (!qrModalSurvey) return;
    const link = typeof window !== 'undefined' ? `${window.location.origin}/?survey=${qrModalSurvey.id}` : `https://dgc.gov.et/?survey=${qrModalSurvey.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Category Pills & Search Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-slate-800">
        {/* Categories */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/50'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ጥናት ፈልግ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-1/4"></div>
              <div className="h-6 bg-slate-800 rounded w-3/4"></div>
              <div className="h-12 bg-slate-800/50 rounded"></div>
              <div className="h-8 bg-slate-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : sortedSurveys.length === 0 ? (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-12 text-center border border-slate-800 space-y-3 shadow-xl">
          <Sparkles className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">ምንም የተገኘ መጠይቅ የለም</h3>
          <p className="text-xs text-slate-400">እባክዎ የምርጫ መስፈርቱን ቀይረው እንደገና ይሞክሩ::</p>
        </div>
      ) : (
        /* Survey Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedSurveys.map((survey, index) => {
            return (
              <motion.div
                key={survey.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectSurvey(survey.id)}
                className="bg-slate-900/70 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full font-bold border border-blue-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      {survey.category}
                    </span>

                    <button
                      onClick={(e) => openQrModal(e, survey)}
                      className="text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-full text-[11px] font-bold border border-amber-500/30 transition-all flex items-center space-x-1"
                      title="QR ኮድ ማጋሪያ"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR ማጋሪያ</span>
                    </button>
                  </div>

                  <div className="flex items-start space-x-3 pt-1">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-100 group-hover:text-blue-400 transition-colors leading-snug">
                        {survey.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3 pl-12">
                    {survey.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex flex-col text-[11px] text-slate-400 space-y-0.5">
                    <div className="flex items-center space-x-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>የተጀመረበት፡ {survey.start_date || new Date(survey.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSurvey(survey.id)}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/20 group-hover:shadow-blue-500/40 transition-all flex items-center space-x-2"
                  >
                    <span>አስተያየት ይስጡ</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform text-amber-400" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* QR Code Share Modal */}
      <AnimatePresence>
        {qrModalSurvey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setQrModalSurvey(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full"
            >
              <DgcQrCard
                url={`${window.location.origin}/?survey=${qrModalSurvey.id}`}
                surveyTitle={qrModalSurvey.title}
                onClose={() => setQrModalSurvey(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
