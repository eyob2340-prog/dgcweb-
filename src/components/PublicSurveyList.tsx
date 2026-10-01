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
  isDarkMode?: boolean;
}

export const PublicSurveyList: React.FC<PublicSurveyListProps> = ({
  surveys,
  onSelectSurvey,
  loading,
  isDarkMode = true,
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
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl shadow-xl border transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/85 backdrop-blur-xl border-slate-800 shadow-slate-950/40'
          : 'bg-white/95 backdrop-blur-xl border-slate-200 shadow-slate-200/60'
      }`}>
        {/* Categories */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/50'
                    : isDarkMode
                    ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`} />
          <input
            type="text"
            placeholder="ጥናት ፈልግ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? 'bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-blue-500'
                : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
            }`}
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`p-6 rounded-3xl border animate-pulse space-y-4 ${
                isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`h-4 rounded w-1/4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div className={`h-6 rounded w-3/4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <div className={`h-12 rounded ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}></div>
              <div className={`h-8 rounded w-1/3 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
            </div>
          ))}
        </div>
      ) : sortedSurveys.length === 0 ? (
        <div className={`rounded-3xl p-12 text-center border space-y-3 shadow-xl ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <Sparkles className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
          <h3 className="text-base font-bold">ምንም የተገኘ መጠይቅ የለም</h3>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            እባክዎ የምርጫ መስፈርቱን ቀይረው እንደገና ይሞክሩ::
          </p>
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
                className={`rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden shadow-xl ${
                  isDarkMode
                    ? 'bg-slate-900/85 backdrop-blur-xl border-slate-800/90 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 text-slate-100'
                    : 'bg-white/95 backdrop-blur-xl border-slate-200 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-200/50 hover:-translate-y-1 text-slate-900'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                      isDarkMode
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      {survey.category}
                    </span>

                    <button
                      onClick={(e) => openQrModal(e, survey)}
                      className="text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-full text-[11px] font-black border border-amber-500/30 transition-all flex items-center space-x-1 cursor-pointer"
                      title="QR ኮድ ማጋሪያ"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-500" />
                      <span>QR ማጋሪያ</span>
                    </button>
                  </div>

                  <div className="flex items-start space-x-3 pt-1">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-black transition-colors leading-snug group-hover:text-blue-500 ${
                        isDarkMode ? 'text-white' : 'text-slate-950'
                      }`}>
                        {survey.title}
                      </h3>
                    </div>
                  </div>

                  <p className={`text-xs sm:text-sm leading-relaxed line-clamp-3 pl-12 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {survey.description}
                  </p>
                </div>

                <div className={`pt-6 mt-6 border-t flex items-center justify-between ${
                  isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                }`}>
                  <div className={`flex flex-col text-[11px] space-y-0.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <div className="flex items-center space-x-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>የተጀመረበት፡ {survey.start_date || new Date(survey.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectSurvey(survey.id)}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 group-hover:shadow-blue-500/45 transition-all flex items-center space-x-2 cursor-pointer"
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
