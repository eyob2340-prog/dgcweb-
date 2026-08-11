import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const PrivacyBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white border-y border-blue-800/50 py-3.5 px-4 sm:px-6 shadow-inner">
      <div className="max-w-7xl mx-auto flex items-center justify-center text-center">
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="p-2 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-400 shrink-0"
          >
            <ShieldCheck className="w-5 h-5" />
          </motion.div>
          <h2 className="text-base sm:text-lg font-black text-amber-400">
            የእርስዎ አስተያየት 100% ደህንነቱ የተጠበቀ ነው!
          </h2>
        </div>
      </div>
    </div>
  );
};
