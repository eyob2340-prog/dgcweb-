import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

interface PolicyModalProps {
  type: 'privacy' | 'terms' | null;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const FooterModals: React.FC<PolicyModalProps> = ({ type, onClose, isDarkMode = true }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
      <div className={`rounded-3xl max-w-xl w-full shadow-2xl border overflow-hidden relative ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-6 text-white relative ${type === 'privacy' ? 'bg-gradient-to-r from-blue-900 to-blue-950' : 'bg-gradient-to-r from-slate-900 to-blue-900'}`}>
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              {type === 'privacy' ? <ShieldCheck className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black">
                {type === 'privacy' ? 'የሚስጥራዊነት ፖሊሲ (Privacy Policy)' : 'የአጠቃቀም ህጎች (Terms of Use)'}
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ ህጋዊ መመሪያዎች
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {type === 'privacy' ? (
            <div className="space-y-5">
              <div className={`border rounded-2xl p-4 flex items-start space-x-3 ${
                isDarkMode ? 'bg-blue-950/40 border-blue-900/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-950'
              }`}>
                <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">
                  ይህ የህዝብ አስተያየትና ጥናት መድረክ የዜጎችን ማንነት ሙሉ በሙሉ በሚስጥር ለመጠበቅ የታቀደ የመንግስት ዲጂታል መድረክ ነው::
                </p>
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 text-blue-500 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>1. የተጠበቀ ማንነት (Confidential Participation)</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    በመጠይቁ በሚሳተፉበት ወቅት የግል ማንነትዎን የሚገልጽ ስም፣ ኢሜይል ወይም ስልክ ቁጥር አይጠየቅም፤ አስተያየትዎ በነፃነት እንዲሰጥ የተጠበቀ ነው::
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 text-blue-500 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>2. የመረጃ ደህንነት (Data Security)</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    የዜጎች መረጃ በከፍተኛ ጥንቃቄ የተጠበቀ ነው። የመሳሪያዎ IP አድራሻ ዳታቤዝ ላይ የሚቀመጠው ሲስተሙን ከተንኮል አዘል ስፓም (Spam Prevention) ለመጠበቅ በማይገለበጥ ክሪፕቶግራፊክ ሐሽ (One-way Cryptographic Hash) ብቻ ነው::
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 text-blue-500 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>3. የመረጃ አጠቃቀም (Data Utilization)</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    የተሰበሰቡ አስተያየቶች ለመንግስት የፖሊሲ እና የስራ አፈፃፀም ማሻሻያ ግብአትነት ብቻ ውሎ ይውላሉ።
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className={`border rounded-2xl p-4 flex items-start space-x-3 ${
                isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed font-medium">
                  የህዝብ አስተያየት መድረኩን ሲጠቀሙ የሚከተሉትን ህጎችና ደንቦች ማክበር ግዴታ ነው::
                </p>
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 font-bold text-sm text-blue-500">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>1. እውነተኛ እና ግንቢ አስተያየት</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    ተጠቃሚዎች የሚሰጧቸው አስተያየቶች ህጋዊ፣ እውነተኛ እና ሀገራዊ እድገትን የሚያስፋፉ መሆን አለባቸው።
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 font-bold text-sm text-blue-500">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>2. የስደብ እና የጠል ፅሁፎች መከልከል</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    የብሄር፣ የሃይማኖት ወይም የቡድን ግጭት የሚቀሰቅሱ እና የስደብ ቃላትን መጠቀም የተከለከለ ነው።
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center space-x-2 font-bold text-sm text-blue-500">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>3. የአንድ ጊዜ ድምፅ</span>
                  </div>
                  <p className={`text-xs pl-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    አንድ ተጠቃሚ በአንድ የህዝብ ጥያቄ ላይ መስጠት የሚችለው አንድ አስተያየት ብቻ ነው።
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`pt-4 border-t text-right ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              ተረድቻለሁ (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
