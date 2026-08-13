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
import { CitizenComplaintModal } from './components/CitizenComplaintModal';
import { TicketTrackerModal } from './components/TicketTrackerModal';
import { FileText, Search, Plus, MessageSquare, Clock, ShieldCheck, Sparkles, Building2, Wrench } from 'lucide-react';
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

  // Citizen Complaint and Ticket Tracker Modals State
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState<boolean>(false);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState<boolean>(false);
  const [trackerInitialCode, setTrackerInitialCode] = useState<string>('');

  const [policyModalType, setPolicyModalType] = useState<'privacy' | 'terms' | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isMaintenanceActive, setIsMaintenanceActive] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem('admin_token')
  );
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const checkMaintenanceMode = async () => {
    try {
      const res = await fetch('/api/maintenance-mode');
      if (res.ok) {
        const data = await res.json();
        setIsMaintenanceActive(Boolean(data.maintenance));
      }
    } catch (e) {
      console.warn('Maintenance check failed:', e);
    }
  };

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
    checkMaintenanceMode();
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

  if (isMaintenanceActive && !adminUser) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans`}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-amber-500/40 p-8 sm:p-12 rounded-3xl shadow-2xl space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Wrench className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
              🚨 Emergency Maintenance Mode
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ሲስተሙ በጥገና ላይ ነው (System Under Maintenance)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            የአስተዳደሩ የመረጃ፣ የአቤቱታ እና የሕዝብ አስተያየት ፖርታል በአሁኑ ወቅት የተሻለ የአሰራር ዝመና እና የቴክኒክ ጥገና እየተደረገበት ይገኛል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ተመልሰው ይሞክሩ::
          </p>

          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[11px] text-slate-400">
              Dire Dawa Administration Government Communication Affairs Bureau
            </span>
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-black border border-slate-700 transition-all shadow-md"
            >
              ለአድሚን/Developer መግቢያ (Admin Access)
            </button>
          </div>
        </div>

        <AdminLoginModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

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
            <div className="space-y-8">
              {/* Prominent Citizen Hero Action Portal Banner */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 sm:p-8 rounded-3xl border shadow-2xl relative overflow-hidden ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-slate-900 via-blue-950/80 to-slate-900 border-blue-500/30'
                    : 'bg-gradient-to-r from-blue-50 via-white to-amber-50 border-blue-200'
                }`}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ኦፊሴላዊ ፖርታል</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      የዜጎች አቤቱታ፣ ጥያቄ እና የሕዝብ አስተያየት መስኮት
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      በድሬዳዋ ከተማ የሚገኙ የመሰረተ ልማት፣ የአገልግሎትና የአስተዳደር አቤቱታዎችን በኦፊሴላዊ መዝገብ ያስገቡ፣ የጥያቄዎን ሁኔታ በኮድ ይከታተሉ፣ ወይም በሚስጥራዊ የሕዝብ ጥናቶች ላይ ይሳተፉ::
                    </p>
                  </div>

                  {/* 2 Primary Interactive Hero CTA Portal Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto shrink-0">
                    <button
                      onClick={() => setIsComplaintModalOpen(true)}
                      className="px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs sm:text-sm rounded-2xl transition-all shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 flex items-center justify-center gap-2 border border-amber-300"
                    >
                      <MessageSquare className="w-5 h-5 text-slate-950" />
                      <div className="text-left">
                        <span className="block font-black">አቤቱታ/ጥያቄ አስገባ</span>
                        <span className="text-[10px] opacity-80 font-semibold block">Grievance & Inquiry</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setIsTrackerModalOpen(true)}
                      className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs sm:text-sm rounded-2xl transition-all shadow-xl border border-amber-500/40 flex items-center justify-center gap-2 group"
                    >
                      <Clock className="w-5 h-5 text-amber-400 group-hover:rotate-180 transition-transform duration-500" />
                      <div className="text-left">
                        <span className="block font-black text-slate-100">የጥያቄዎ ሁኔታ መከታተያ</span>
                        <span className="text-[10px] text-amber-400 font-semibold block">Track Ticket Status</span>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Public Surveys Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {t.allSurveys}
                      </h2>
                      <span className="bg-blue-500/10 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-400" /> ኦፊሴላዊ ጥናቶች
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

      {/* Citizen Complaint Submission Modal */}
      <CitizenComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        onOpenTrackerWithCode={(code) => {
          setTrackerInitialCode(code);
          setIsTrackerModalOpen(true);
        }}
        isDarkMode={isDarkMode}
      />

      {/* Citizen Ticket Status Tracker Modal */}
      <TicketTrackerModal
        isOpen={isTrackerModalOpen}
        onClose={() => setIsTrackerModalOpen(false)}
        initialCode={trackerInitialCode}
        isDarkMode={isDarkMode}
      />

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
