import React from 'react';
import { Facebook, Youtube, Send, Twitter } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  isDarkMode?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy, onOpenTerms, isDarkMode = true }) => {
  const socialLinks = [
    { name: 'ፌስቡክ (Facebook)', url: 'https://facebook.com/DGCOMU', icon: Facebook, iconColor: 'text-blue-600 hover:text-blue-500' },
    { name: 'ዩትዩብ (YouTube)', url: 'https://www.youtube.com/@DireDawaComm', icon: Youtube, iconColor: 'text-amber-500 hover:text-amber-400' },
    { name: 'ቴሌግራም (Telegram)', url: 'https://t.me/DDGCAB', icon: Send, iconColor: 'text-blue-400 hover:text-blue-300' },
    { name: 'ትዊተር / X (Twitter)', url: 'https://twitter.com/DawaOffice', icon: Twitter, iconColor: 'text-amber-400 hover:text-amber-300' },
  ];

  return (
    <footer className={`border-t py-6 text-xs relative z-10 transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-950 text-slate-300 border-slate-800/80' : 'bg-white text-slate-700 border-slate-200'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col md:flex-row items-center justify-between gap-4 ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          
          {/* Left: Copyright & Dire Dawa Admin Text with Inline Social Icons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div>
              <p className={`font-bold text-xs sm:text-sm ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                © 2026 Dire Dawa Administration Government Communication Affairs Bureau.
              </p>
              <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ • Official Citizen Inquiry & Survey Platform
              </p>
            </div>

            {/* Icon-only Social Media Links placed directly beside text */}
            <div className={`flex items-center space-x-2.5 sm:ml-2 sm:border-l sm:pl-3 pt-1 sm:pt-0 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.name}
                    className={`p-1.5 rounded-lg border transition-transform hover:scale-110 ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'
                    } ${item.iconColor}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Right Side: Privacy/Terms & Official Government Portal Badge */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center space-x-3 text-[11px]">
              <button
                onClick={onOpenPrivacy}
                className="hover:text-amber-500 transition-colors font-medium cursor-pointer"
              >
                ሚስጥራዊነት ፖሊሲ
              </button>
              <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>•</span>
              <button
                onClick={onOpenTerms}
                className="hover:text-amber-500 transition-colors font-medium cursor-pointer"
              >
                የአጠቃቀም ህጎች
              </button>
            </div>

            {/* Developer Credit Link */}
            <a
              href="https://t.me/eyobreta"
              target="_blank"
              rel="noopener noreferrer"
              title="Developed by Devloper opa (@eyobreta)"
              className={`border px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all flex items-center space-x-1.5 shadow-sm hover:scale-105 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 hover:bg-slate-800 border-cyan-500/40 hover:border-cyan-400 text-cyan-400'
                  : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-900'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>Devloper opa</span>
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
};
