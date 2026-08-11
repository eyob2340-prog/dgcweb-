import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PrivacyBanner } from './components/PrivacyBanner';
import { PublicSurveyList } from './components/PublicSurveyList';
import { SurveyForm } from './components/SurveyForm';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';
import { FooterModals } from './components/FooterModals';
import { Survey, AdminUser, AuthResponse } from './types';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from './lib/i18n';
import { getOfflineQueue, processOfflineQueue } from './lib/offlineSync';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'public' | 'admin'>('public');
  const [language, setLanguage] = useState<Language>('am');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState<boolean>(true);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [selectedSurveyDetails, setSelectedSurveyDetails] = useState<Survey | null>(null);
  const [hasResponded, setHasResponded] = useState<boolean>(false);

  const [policyModalType, setPolicyModalType] = useState<'privacy' | 'terms' | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem('admin_token')
  );
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Offline queue state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dgc_theme');
    return saved ? saved === 'dark' : true;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('dgc_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const t = translations[language];

  const updateOfflineCount = useCallback(() => {
    setOfflineCount(getOfflineQueue().length);
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await processOfflineQueue();
      updateOfflineCount();
    } catch (err) {
      console.error('Error processing offline queue:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [updateOfflineCount]);

  useEffect(() => {
    updateOfflineCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineQueue, updateOfflineCount]);

  // Handle Routing (?survey=123, ?surveyId=123, or #survey-123)
  useEffect(() => {
    const parseUrl = () => {
      // 1. Check Search Query Parameters (?survey=123 or ?surveyId=123)
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get('survey') || params.get('surveyId');
      if (queryId) {
        const id = parseInt(queryId, 10);
        if (!isNaN(id)) {
          setSelectedSurveyId(id);
          setCurrentTab('public');
          return;
        }
      }

      // 2. Check Hash Routing (#survey-123)
      const hash = window.location.hash;
      if (hash && hash.startsWith('#survey-')) {
        const idStr = hash.replace('#survey-', '');
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          setSelectedSurveyId(id);
          setCurrentTab('public');
        }
      }
    };

    parseUrl();
    window.addEventListener('hashchange', parseUrl);
    window.addEventListener('popstate', parseUrl);
    return () => {
      window.removeEventListener('hashchange', parseUrl);
      window.removeEventListener('popstate', parseUrl);
    };
  }, []);

  // Fetch Public Surveys List
  const fetchPublicSurveys = async () => {
    setLoadingSurveys(true);
    try {
      const res = await fetch('/api/surveys');
      const data = await res.json();
      if (res.ok) {
        setSurveys(data.surveys || []);
      }
    } catch (err) {
      console.error('Error fetching surveys:', err);
    } finally {
      setLoadingSurveys(false);
    }
  };

  useEffect(() => {
    fetchPublicSurveys();
  }, []);

  // Check Admin Authentication Token
  useEffect(() => {
    if (!adminToken) {
      setAdminUser(null);
      return;
    }

    const checkToken = async () => {
      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await res.json();
        if (res.ok) {
          setAdminUser(data.admin);
        } else {
          localStorage.removeItem('admin_token');
          setAdminToken(null);
          setAdminUser(null);
        }
      } catch (err) {
        setAdminToken(null);
      }
    };

    checkToken();
  }, [adminToken]);

  // Fetch single survey details when selected
  useEffect(() => {
    if (!selectedSurveyId) {
      setSelectedSurveyDetails(null);
      return;
    }

    const fetchSingleSurvey = async () => {
      try {
        const res = await fetch(`/api/surveys/${selectedSurveyId}`);
        const data = await res.json();
        if (res.ok) {
          setSelectedSurveyDetails(data.survey);
          setHasResponded(data.hasResponded || false);
        }
      } catch (err) {
        console.error('Error fetching single survey:', err);
      }
    };

    fetchSingleSurvey();
  }, [selectedSurveyId]);

  const handleSelectSurvey = (id: number) => {
    setSelectedSurveyId(id);
    window.location.hash = `survey-${id}`;
  };

  const handleBackToSurveys = () => {
    setSelectedSurveyId(null);
    setSelectedSurveyDetails(null);
    window.location.hash = '';
    fetchPublicSurveys();
  };

  const handleLoginSuccess = (authData: AuthResponse) => {
    setAdminToken(authData.token);
    setAdminUser(authData.admin);
    setCurrentTab('admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setCurrentTab('public');
  };

  return (
    <div
      className={`min-h-screen font-sans flex flex-col transition-colors duration-300 relative overflow-hidden ${
        isDarkMode
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white'
          : 'bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white'
      }`}
    >
      {/* Animated Floating Gradient Background Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 80, -50, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.25, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl ${
            isDarkMode ? 'bg-blue-600/15' : 'bg-blue-400/20'
          }`}
        />
        <motion.div
          animate={{
            x: [0, -70, 60, 0],
            y: [0, 80, -40, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl ${
            isDarkMode ? 'bg-amber-500/10' : 'bg-amber-300/25'
          }`}
        />
        <motion.div
          animate={{
            x: [0, 60, -60, 0],
            y: [0, -40, 60, 0],
            scale: [1, 1.2, 0.85, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute -bottom-32 left-1/4 w-[32rem] h-[32rem] rounded-full blur-3xl ${
            isDarkMode ? 'bg-indigo-600/15' : 'bg-indigo-300/20'
          }`}
        />
      </div>

      {/* Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
        }}
        adminUser={adminUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsAdminModalOpen(true)}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang)}
        offlineCount={offlineCount}
        isOnline={isOnline}
        onSyncOffline={syncOfflineQueue}
        isSyncing={isSyncing}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content */}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12 sm:pt-6 sm:pb-16 relative z-10">
        {currentTab === 'public' ? (
          selectedSurveyDetails ? (
            <SurveyForm
              survey={selectedSurveyDetails}
              hasResponded={hasResponded}
              onBack={handleBackToSurveys}
              onSubmitSuccess={() => {
                setHasResponded(true);
                updateOfflineCount();
                fetchPublicSurveys();
              }}
              language={language}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {t.allSurveys}
                    </h2>
                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ድሬዳዋ ኮሙዩኒኬሽን
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    አስተያየትዎን በሙሉ ደህንነትና በሚስጥር በመስጠት በአካባቢና በአገር አቀፍ የፖሊሲ ጥናቶች ይሳተፉ
                  </p>
                </div>
              </div>

              <PublicSurveyList
                surveys={surveys}
                onSelectSurvey={handleSelectSurvey}
                loading={loadingSurveys}
              />
            </div>
          )
        ) : adminUser && adminToken ? (
          <AdminDashboard adminToken={adminToken} />
        ) : (
          <div className="bg-slate-900/70 backdrop-blur-md p-12 rounded-3xl text-center border border-slate-800 space-y-4 max-w-lg mx-auto my-12 shadow-xl">
            <h3 className="text-lg font-bold text-slate-100">ይህንን ክፍል ለማየት መግባት ያስፈልጋል</h3>
            <p className="text-xs text-slate-400">
              የአድሚን ዳሽቦርድን፣ ቻርቶችን እና መጠይቆችን ለማስተዳደር እባክዎ በቢሮው LOGO ላይ ለ8 ሰከንድ ተጭነው በመያዝ ይግቡ::
            </p>
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="px-6 py-2.5 bg-red-900/80 hover:bg-red-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md border border-red-700/50"
            >
              ወደ አድሚን መግቢያ (Restricted Access)
            </button>
          </div>
        )}
      </main>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Privacy Policy & Terms Footer Modals */}
      <FooterModals
        type={policyModalType}
        onClose={() => setPolicyModalType(null)}
      />

      {/* Official Footer with Social Media & Developer Credit */}
      <Footer
        onOpenPrivacy={() => setPolicyModalType('privacy')}
        onOpenTerms={() => setPolicyModalType('terms')}
      />
    </div>
  );
}
