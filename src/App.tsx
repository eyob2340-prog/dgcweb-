import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { PrivacyBanner } from './components/PrivacyBanner';
import { PublicSurveyList } from './components/PublicSurveyList';
import { SurveyForm } from './components/SurveyForm';
import { AdminLoginModal } from './components/AdminLoginModal';
import { Footer } from './components/Footer';
import { Survey, AdminUser, AuthResponse } from './types';
import { DgcLogo } from './components/DgcLogo';
import { FeaturedSurveyBanner } from './components/FeaturedSurveyBanner';
import { FEATURED_SURVEY } from '../server/featuredSurvey';
import { AnimatedBackground } from './components/AnimatedBackground';
import { FileText, MessageSquare, Clock, Sparkles, Building2, Wrench, ArrowRight, Lock, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from './lib/i18n';
import { getOfflineQueue, processOfflineQueue } from './lib/offlineSync';
import { getAnonymousClientId } from './lib/clientId';

// Lazy-load heavy components — they are NOT in the initial JS bundle
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const CitizenComplaintModal = lazy(() => import('./components/CitizenComplaintModal').then(m => ({ default: m.CitizenComplaintModal })));
const TicketTrackerModal = lazy(() => import('./components/TicketTrackerModal').then(m => ({ default: m.TicketTrackerModal })));
const FooterModals = lazy(() => import('./components/FooterModals').then(m => ({ default: m.FooterModals })));
const CitizenChatWidget = lazy(() => import('./components/CitizenChatWidget').then(m => ({ default: m.CitizenChatWidget })));

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

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  const handleOpenLogin = () => {
    setIsAdminModalOpen(true);
  };

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

  useEffect(() => {
    const handleStatusChanged = () => checkMaintenanceMode();
    window.addEventListener('maintenance-status-changed', handleStatusChanged);
    return () => {
      window.removeEventListener('maintenance-status-changed', handleStatusChanged);
    };
  }, []);

  // Offline queue state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Dark mode removed: the site is always bright
  const isDarkMode = false;
  useEffect(() => {
    try {
      localStorage.removeItem('dgc_theme');
    } catch {}
  }, []);

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
    // Poll every 30s instead of 3s — reduces main-thread work & network calls significantly
    const maintenanceInterval = setInterval(checkMaintenanceMode, 30000);
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
      clearInterval(maintenanceInterval);
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
      const res = await fetch('/api/surveys', {
        headers: { 'X-Client-Id': getAnonymousClientId() },
      });
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

  // Check Admin Authentication Session via HttpOnly cookie
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/me', {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data.admin) {
          setAdminUser(data.admin);
          setAdminToken('active_session');
        } else {
          sessionStorage.removeItem('admin_token');
          localStorage.removeItem('admin_token');
          setAdminToken(null);
          setAdminUser(null);
        }
      } catch (err) {
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_token');
        setAdminToken(null);
        setAdminUser(null);
      }
    };

    checkSession();
  }, []);

  // Fetch single survey details when selected or when language changes
  useEffect(() => {
    if (!selectedSurveyId) {
      setSelectedSurveyDetails(null);
      return;
    }

    const fetchSingleSurvey = async () => {
      try {
        const langQuery = language ? `?lang=${language}` : '';
        const res = await fetch(`/api/surveys/${selectedSurveyId}${langQuery}`, {
          headers: { 'X-Client-Id': getAnonymousClientId() },
        });
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
  }, [selectedSurveyId, language]);

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
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
    setAdminToken('active_session');
    setAdminUser(authData.admin);
    setCurrentTab('admin');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Failed to notify server logout:', err);
    }
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setCurrentTab('public');
  };

  if (isMaintenanceActive && currentTab !== 'admin') {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans`}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-xl bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 p-8 sm:p-12 rounded-3xl shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/40 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Wrench className="w-8 h-8 animate-bounce text-amber-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ለተወሰኑ ሰዓታት በጥገና ላይ ነን
            </h1>
            <p className="text-xs sm:text-sm text-amber-400 font-bold">
              (System Under Maintenance)
            </p>
            <p className="text-xs text-slate-400 font-medium">
               የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            የአስተዳደሩ የመረጃ፣ የአቤቱታ እና የሕዝብ አስተያየት ፖርታል በአሁኑ ወቅት የተሻለ የአሰራር ዝመና እና የቴክኒክ ጥገና እየተደረገበት ይገኛል:: እባክዎ ከጥቂት ደቂቃዎች በኋላ ተመልሰው ይሞክሩ::
          </p>

          {/* DGC Logo */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col items-center space-y-2">
            <DgcLogo
              onLongPress={handleOpenLogin}
              className="opacity-95 hover:opacity-100 transition-opacity cursor-pointer active:scale-95 transition-transform"
            />
          </div>
        </div>

        <AdminLoginModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onLoginSuccess={(authData) => {
            handleLoginSuccess(authData);
            setCurrentTab('admin');
            setIsAdminModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans flex flex-col transition-colors duration-300 relative overflow-x-clip ${
        isDarkMode
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white'
          : 'bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white'
      }`}
    >
      {/* Sticky Admin Warning Banner when Maintenance Mode is ON and Admin is inside Admin Dashboard */}
      <Suspense fallback={null}>
      {isMaintenanceActive && currentTab === 'admin' && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 font-bold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xl border-b border-amber-600 z-50">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 animate-bounce text-slate-950" />
            <span>🚨 <strong>ማስታወቂያ:</strong> Emergency Maintenance Mode በርቷል! ዜጎች "ሲስተሙ በጥገና ላይ ነው" የሚለውን ገፅ እያዩ ነው::</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/developer/maintenance', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${adminToken}`,
                    },
                    body: JSON.stringify({ maintenance: false }),
                  });
                  if (res.ok) {
                    setIsMaintenanceActive(false);
                    window.dispatchEvent(new CustomEvent('maintenance-status-changed'));
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-black transition-all shadow-sm cursor-pointer"
            >
              ጥገናውን አጥፋ (Turn OFF)
            </button>
          </div>
        </div>
      )}
      </Suspense>
      {/* Rich Multi-Layered Animated Floating Background with Civic & Tech Symbols */}
      <AnimatedBackground isDarkMode={isDarkMode} />

      {/* Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
        }}
        adminUser={adminUser}
        onLogout={handleLogout}
        onOpenLogin={handleOpenLogin}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang)}
        offlineCount={offlineCount}
        isOnline={isOnline}
        onSyncOffline={syncOfflineQueue}
        isSyncing={isSyncing}
        isDarkMode={isDarkMode}
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
              isDarkMode={isDarkMode}
            />
          ) : (
            <div className="space-y-8">
              {/* Featured questionnaire — always shown first */}
              {(() => {
                const featured = surveys.find((sv) => sv.title === FEATURED_SURVEY.title);
                return featured ? (
                  <FeaturedSurveyBanner
                    survey={featured}
                    questionCount={FEATURED_SURVEY.questions.length}
                    onOpen={handleSelectSurvey}
                    isDarkMode={isDarkMode}
                  />
                ) : null;
              })()}

              {/* Citizen services — compact modern tiles */}
              <section aria-label={t.heroTitle} className="space-y-4">
                <div className="flex flex-col gap-1 px-1">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-black text-blue-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t.heroBadge}
                  </span>
                  <h1 className={`mt-2 text-2xl font-black tracking-tight sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                    {t.heroTitle}
                  </h1>
                  <p className={`max-w-3xl text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.heroSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setIsComplaintModalOpen(true)}
                    className="group relative flex min-h-[96px] items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-emerald-500 p-5 text-left text-white shadow-lg shadow-blue-600/20 transition-transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                      <MessageSquare className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-black sm:text-lg">{t.submitComplaintBtn}</span>
                      <span className="block text-xs font-bold text-white/85">{t.submitComplaintSub}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>

                  <button
                    onClick={() => setIsTrackerModalOpen(true)}
                    className={`group flex min-h-[96px] items-center gap-4 rounded-3xl border p-5 text-left shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer ${
                      isDarkMode ? 'border-slate-800 bg-slate-900 text-white shadow-black/20' : 'border-slate-200 bg-white text-slate-900 shadow-slate-200/70'
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
                      <Clock className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-black sm:text-lg">{t.trackTicketBtn}</span>
                      <span className="block text-xs font-bold text-blue-600">{t.trackTicketSub}</span>
                    </span>
                    <ArrowRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>
                </div>

                <div className={`grid grid-cols-3 divide-x rounded-2xl border text-center ${isDarkMode ? 'divide-slate-800 border-slate-800 bg-slate-900/60' : 'divide-slate-200 border-slate-200 bg-white'}`}>
                  {[
                    { icon: <Lock className="h-4 w-4" />, label: 'ስም አይጠየቅም' },
                    { icon: <Globe className="h-4 w-4" />, label: 'አማ · Oromoo · Soomaali' },
                    { icon: <Zap className="h-4 w-4" />, label: '~5 ደቂቃ' },
                  ].map((item) => (
                    <div key={item.label} className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-bold sm:flex-row sm:gap-2 sm:text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className="text-emerald-500">{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </section>

              {/* Public Surveys Section */}
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-3 px-1">
                  <div>
                    <h2 className={`text-xl font-black tracking-tight sm:text-2xl ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                      {t.allSurveys}
                    </h2>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.surveySubtitle}</p>
                  </div>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold sm:inline-flex ${
                    isDarkMode ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
                  }`}>
                    <FileText className="h-3.5 w-3.5" /> {t.officialSurveys}
                  </span>
                </div>

                <PublicSurveyList
                  surveys={surveys}
                  onSelectSurvey={handleSelectSurvey}
                  loading={loadingSurveys}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          )
        ) : adminUser && adminToken ? (
          <AdminDashboard adminToken={adminToken} isDarkMode={isDarkMode} />
        ) : (
          <div className={`p-12 rounded-3xl text-center border space-y-4 max-w-lg mx-auto my-12 shadow-2xl transition-all ${
            isDarkMode
              ? 'bg-slate-900/80 backdrop-blur-md border-slate-800 text-white'
              : 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-lg font-bold">የተፈቀደላቸው የስራ ኃላፊዎች መግቢያ</h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              የአድሚን ዳሽቦርድን፣ የትንታኔ ቻርቶችን እና የፖሊሲ ሪፖርቶችን ለማስተዳደር እባክዎ የመግቢያ ፈቃድዎን ይጠቀሙ::
            </p>
            {/* Red button exclusively for Admin Entrance */}
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-red-950/30 border border-red-500 cursor-pointer"
            >
              ወደ አድሚን መግቢያ (Admin Portal)
            </button>
          </div>
        )}
      </main>

      {/* Lazy-loaded modals — only fetched when first opened */}
      <Suspense fallback={null}>
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

        {/* Privacy Policy & Terms Footer Modals */}
        <FooterModals
          type={policyModalType}
          onClose={() => setPolicyModalType(null)}
          isDarkMode={isDarkMode}
        />

        {/* Public Citizen Chat Widget (Floating at Bottom-Right) */}
        {currentTab === 'public' && !selectedSurveyDetails && <CitizenChatWidget isDarkMode={isDarkMode} />}
      </Suspense>

      {/* Admin Login Modal (eagerly loaded — needed for maintenance page too) */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Official Footer with Social Media & Developer Credit */}
      <Footer
        onOpenPrivacy={() => setPolicyModalType('privacy')}
        onOpenTerms={() => setPolicyModalType('terms')}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
