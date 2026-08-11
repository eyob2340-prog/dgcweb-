import React from 'react';
import { Target, Eye, ShieldCheck, HeartHandshake, Award, Database, Share2, Scale, ShieldAlert, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

export const OfficeInfoSection: React.FC = () => {
  const coreValues = [
    { title: 'ወንድማማችነት', desc: 'አንድነትና ህብረተሰባዊ ትስስርን ማጠናከር', icon: HeartHandshake, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { title: 'በእውቀት እና በክህሎት ውስጥ ያሉ ብቃቶች', desc: 'ከፍተኛ የሙያ ብቃትና ተወዳዳሪነት', icon: Award, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { title: 'የመረጃ ኃይል', desc: 'በመረጃ ላይ የተመሰረተ ውሳኔና አመራር', icon: Database, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { title: 'የመረጃ ተደራሽነትን ማስፋት', desc: 'ለህዝቡ መረጃን በግልጽ ማድረስ', icon: Share2, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    { title: 'ዴሞክራሲያዊ አስተሳሰብ መመስረት', desc: 'የህዝብ ተሳትፎና የሃሳብ ነፃነት', icon: Scale, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { title: 'ሙስናን እና ብልሹ አሰራርን መዋጋት', desc: 'ግልፅነትና ተጠያቂነት ያለው አሰራር', icon: ShieldAlert, color: 'text-red-600 bg-red-50 border-red-200' },
    { title: 'ለእድገት እና ብልጽግና መስራት', desc: 'የአካባቢና የሀገር ሁለንተናዊ እድገት', icon: TrendingUp, color: 'text-amber-700 bg-amber-100/60 border-amber-300' },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-xl shadow-blue-900/5 space-y-8 my-6">
      {/* Header Badge */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            የቢሮው መረጃና ብራንዲንግ
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
            የድሬዳዋ አስተዳደር የመንግስት ኮሙዩኒኬሽን ጉዳዮች ቢሮ
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Dire Dawa Administration Government Communication Affairs Office
          </p>
        </div>
      </div>

      {/* Mission & Vision Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mission Card */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 sm:p-7 rounded-2xl relative overflow-hidden shadow-lg border border-blue-800"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-amber-400">
              <Target className="w-5 h-5 animate-spin-slow" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-amber-400">
              ተልዕኮ (Mission)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-light">
            "ከፍተኛ ስነ ምግባር ያለው እና በመንግስት የመረጃ ልውውጥ ዘርፍ ጥሩ አገልግሎት የሚሰጥ፣ በህዝብ መረጃ ላይ የተመሰረተ ተሳትፎ በማድረግ ስልታዊ አመራር የሚሰጥ ከፍተኛ ስነ ምግባር ያለው ባለሙያ መገንባት ነው።"
          </p>
        </motion.div>

        {/* Vision Card */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-gradient-to-br from-amber-900/90 via-slate-900 to-blue-950 text-white p-6 sm:p-7 rounded-2xl relative overflow-hidden shadow-lg border border-amber-800/60"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-amber-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-amber-400">
              ራዕይ (Vision)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-light">
            "በጠንካራ መሰረት ላይ የተገነባ የበለፀገ እና አስተማማኝ የመንግስት ኮሙዩኒኬሽን ስርዓት ተፈጥሮን ማየት።"
          </p>
        </motion.div>
      </div>

      {/* Core Values */}
      <div className="space-y-4 pt-2">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          ዋና ዋና እሴቶች (Core Values)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {coreValues.map((val, idx) => {
            const IconComp = val.icon;
            return (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-2xl border ${val.color} flex flex-col justify-between transition-all hover:shadow-md`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <IconComp className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-black leading-tight">
                    {idx + 1}. {val.title}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 font-normal">
                  {val.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
