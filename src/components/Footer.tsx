import React from 'react';
import { Globe, Facebook, Youtube, Send, Twitter, Code2 } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy, onOpenTerms }) => {
  const socialLinks = [
    { name: 'ድረ ገጽ (Website)', url: 'https://www.diredawacommunication.org', icon: Globe, iconColor: 'text-blue-400 hover:text-blue-300' },
    { name: 'ፌስቡክ (Facebook)', url: 'https://facebook.com/DGCOMU', icon: Facebook, iconColor: 'text-blue-500 hover:text-blue-400' },
    { name: 'ዩትዩብ (YouTube)', url: 'https://www.youtube.com/@Direcommunication', icon: Youtube, iconColor: 'text-red-500 hover:text-red-400' },
    { name: 'ቴሌግራም (Telegram)', url: 'https://t.me/DDGCAB', icon: Send, iconColor: 'text-sky-400 hover:text-sky-300' },
    { name: 'ትዊተር / X (Twitter)', url: 'https://twitter.com/DawaOffice', icon: Twitter, iconColor: 'text-amber-400 hover:text-amber-300' },
  ];

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800/80 py-6 text-xs relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400">
          
          {/* Left: Copyright & Dire Dawa Admin Text with Inline Social Icons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div>
              <p className="font-semibold text-slate-300 text-xs sm:text-sm">
                © 2026 - EyobReta. All Rights Reserved.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ • Anonymous Survey Platform
              </p>
            </div>

            {/* Icon-only Social Media Links placed directly beside text */}
            <div className="flex items-center space-x-2.5 sm:ml-2 sm:border-l sm:border-slate-800 sm:pl-3 pt-1 sm:pt-0">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.name}
                    className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800/80 transition-transform hover:scale-110 ${item.iconColor}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Right Side: Privacy/Terms & Developer Credit */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center space-x-3 text-[11px]">
              <button
                onClick={onOpenPrivacy}
                className="hover:text-amber-400 transition-colors font-medium text-slate-400"
              >
                ሚስጥራዊነት ፖሊሲ
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={onOpenTerms}
                className="hover:text-amber-400 transition-colors font-medium text-slate-400"
              >
                የአጠቃቀም ህጎች
              </button>
            </div>

            <a
              href="https://t.me/eyobreta"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-900 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 text-amber-300 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Developer: <span className="underline decoration-amber-400 font-mono">opa</span></span>
              <Send className="w-3 h-3 text-sky-400 ml-0.5" />
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
};
