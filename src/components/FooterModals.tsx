import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

interface PolicyModalProps {
  type: 'privacy' | 'terms' | null;
  onClose: () => void;
}

export const FooterModals: React.FC<PolicyModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden relative text-left">
        {/* Header */}
        <div className={`p-6 text-white relative ${type === 'privacy' ? 'bg-gradient-to-r from-blue-900 to-blue-950' : 'bg-gradient-to-r from-slate-900 to-blue-900'}`}>
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors"
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
              <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 flex items-start space-x-3">
                <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-950 leading-relaxed font-medium">
                  ይህ የህዝብ አስተያየትና ጥናት መድረክ የዜጎችን ማንነት ሙሉ በሙሉ በሚስጥር ለመጠበቅ የታቀደ የመንግስት ዲጂታል መድረክ ነው::
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>1. ሙሉ አኖኒመስነት (100% Anonymity)</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    የህዝብ አስተያየት በሚሰበሰብበት ወቅት የስም፣ የኢሜይል፣ የስልክ ቁጥር ወይም የማንነት መረጃ በፍፁም አይጠየቅም፤ አይመዘገብም።
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>2. የመረጃ ደህንነት (Data Security)</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    ሚሰጡ አስተያየቶች ሙሉ በሙሉ የተጠበቁ ናቸው። የመሳሪያዎ IP Address ዳታቤዝ ላይ የሚቀመጠው ሲስተሙን ከስፓም (Spam) ለመጠበቅ ሲባል Hashed (Encrypted) ሆኖ ብቻ ነው።
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>3. የመረጃ አጠቃቀም (Data Utilization)</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    የተሰበሰቡ አስተያየቶች ለመንግስት የፖሊሲ እና የስራ አፈፃፀም ማሻሻያ ግብአትነት ብቻ ውሎ ይውላሉ።
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-950 leading-relaxed font-medium">
                  የህዝብ አስተያየት መድረኩን ሲጠቀሙ የሚከተሉትን ህጎችና ደንቦች ማክበር ግዴታ ነው::
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>1. እውነተኛ እና ግንቢ አስተያየት</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    ተጠቃሚዎች የሚሰጧቸው አስተያየቶች ህጋዊ፣ እውነተኛ እና ሀገራዊ እድገትን የሚያስፋፉ መሆን አለባቸው።
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>2. የስደብ እና የጠል ፅሁፎች መከልከል</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    የብሄር፣ የሃይማኖት ወይም የቡድን ግጭት የሚቀሰቅሱ እና የስደብ ቃላትን መጠቀም የተከለከለ ነው።
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-1">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>3. የአንድ ጊዜ ድምፅ</span>
                  </div>
                  <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                    አንድ ተጠቃሚ በአንድ የህዝብ ጥያቄ ላይ መስጠት የሚችለው አንድ አስተያየት ብቻ ነው።
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-right">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              ተረድቻለሁ (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
