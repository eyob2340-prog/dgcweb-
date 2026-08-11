import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, WifiOff, RefreshCw, CheckCircle2, Sun, Moon, ShieldCheck, Sparkles } from 'lucide-react';
import { AdminUser } from '../types';
import { DgcLogo } from './DgcLogo';
import { Language, translations } from '../lib/i18n';

interface HeaderProps {
  currentTab: 'public' | 'admin';
  setCurrentTab: (tab: 'public' | 'admin') => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  offlineCount: number;
  isOnline: boolean;
  onSyncOffline: () => void;
  isSyncing: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  adminUser,
  onLogout,
  onOpenLogin,
  language,
  onLanguageChange,
  offlineCount,
  isOnline,
  onSyncOffline,
  isSyncing,
  isDarkMode = true,
  onToggleTheme,
}) => {
  const t = translations[language];
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Dynamic Scroll Listener: Hide on scroll down, show on scroll up or top
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 30) {
        setIsVisible(true);
        setScrolled(false);
      } else {
        setScrolled(true);
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsVisible(false); // Scroll down -> hide (ወጣ)
        } else if (currentScrollY < lastScrollY) {
          setIsVisible(true);  // Scroll up -> reveal (ገባ)
        }
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      <motion.header
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: isVisible ? 0 : -100,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`sticky top-0 sm:top-2 z-50 transition-all duration-300 max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 no-print`}
      >
        <div
          className={`rounded-2xl sm:rounded-3xl border transition-all duration-300 px-3 sm:px-6 py-2.5 sm:py-3.5 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-2 sm:gap-4 ${
            isDarkMode
              ? scrolled
                ? 'bg-slate-900/90 border-blue-500/30 shadow-blue-950/40'
                : 'bg-slate-900/80 border-slate-800 shadow-slate-950/30'
              : scrolled
              ? 'bg-white/90 border-blue-200 shadow-blue-100/60'
              : 'bg-white/80 border-slate-200 shadow-slate-200/50'
          }`}
        >
          {/* DGC Logo with Secret Admin Trigger */}
          <div className="flex items-center space-x-3 shrink-0">
            <DgcLogo
              onLongPress={onOpenLogin}
              onClick={() => setCurrentTab('public')}
            />
          </div>

          {/* Center 100% Privacy Badge */}
          <div
            className={`hidden md:flex items-center space-x-2 px-4 py-1.5 rounded-full border shadow-inner transition-all ${
              isDarkMode
                ? 'bg-gradient-to-r from-blue-950/80 to-slate-900/80 border-amber-500/40 text-amber-300'
                : 'bg-gradient-to-r from-blue-50 to-amber-50/50 border-amber-300 text-amber-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs font-black tracking-wide">
              የእርስዎ አስተያየት 100% ደህንነቱ የተጠበቀ ነው!
            </span>
          </div>

          {/* Right Header Controls: Theme Toggle, Language Switcher, Offline Badge, Admin Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={isDarkMode ? 'ወደ ላይት ሞድ ቀይር (Light Mode)' : 'ወደ ዳርክ ሞድ ቀይር (Dark Mode)'}
                className={`p-2 sm:p-2.5 rounded-2xl transition-all duration-200 border flex items-center justify-center shadow-sm ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-amber-500/40'
                    : 'bg-slate-100 hover:bg-slate-200 text-amber-600 border-slate-200 hover:border-amber-400'
                }`}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {/* Offline Queue Badge & Sync Button */}
            {(!isOnline || offlineCount > 0) && (
              <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-2xl text-xs font-bold text-amber-400 animate-pulse">
                {!isOnline ? (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">
                  {!isOnline ? 'ኦፍላይን ሞድ' : `${offlineCount} በኦፍላይን የተቀመጠ`}
                </span>
                {offlineCount > 0 && isOnline && (
                  <button
                    onClick={onSyncOffline}
                    disabled={isSyncing}
                    className="ml-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2 py-0.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 shadow"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{t.syncNow}</span>
                  </button>
                )}
              </div>
            )}

            {/* Admin Logout / Status Indicator */}
            {adminUser ? (
              <button
                onClick={onLogout}
                title="ውጣ (Logout)"
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/30 rounded-2xl transition-all flex items-center space-x-1.5 text-xs font-bold shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ውጣ</span>
              </button>
            ) : (
              <div className="text-right hidden lg:block">
                <span className={`text-[11px] font-semibold block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.publicPortal}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.header>
    </AnimatePresence>
  );
};

