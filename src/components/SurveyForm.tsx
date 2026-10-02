import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Send,
  CheckCircle2,
  AlertTriangle,
  PenTool,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Lock,
  QrCode,
  UserCheck,
  RefreshCw,
  WifiOff,
  BookmarkCheck,
  Save,
  Sparkles,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCodeLib from 'qrcode';
import {
  Survey,
  Demographics,
  Question,
  RESIDENCE_CATEGORIES,
  SECTOR_INSTITUTIONS,
  URBAN_WOREDAS,
  RURAL_WOREDAS,
} from '../types';
import { Language, translations } from '../lib/i18n';
import { DgcQrCard } from './DgcQrCard';
import { getAnonymousClientId } from '../lib/clientId';

export type SupportedSurveyLang = 'am' | 'om' | 'so';

export interface SurveyFormProps {
  survey: Survey;
  hasResponded: boolean;
  onBack: () => void;
  onSubmitSuccess: () => void;
  language?: Language;
  isDarkMode?: boolean;
}

const SURVEY_LANG_OPTIONS: { code: SupportedSurveyLang; label: string; name: string }[] = [
  { code: 'am', label: 'አማርኛ', name: 'አማርኛ — Amharic' },
  { code: 'om', label: 'Afaan Oromoo', name: 'Afaan Oromoo — Oromo' },
  { code: 'so', label: 'Soomaali', name: 'Soomaali — Somali' },
];

const SURVEY_TEXTS = {
  am: {
    langLabel: 'የመጠይቁ ቋንቋ (Survey Language):',
    back: 'ተመለስ',
    qrAndShare: 'QR ኮድ እና ማጋሪያ',
    startedAt: 'የጀመረበት፡',
    questionProgress: 'ጥያቄ',
    completed: 'ተጠናቋል',
    demographicSection: '1. የተሳታፊው ስነ-ሕዝብ (Demographics) - ግዴታ',
    demographicSubtitle: 'እባክዎ መልስ ከመስጠትዎ በፊት እነዚህን መሰረታዊ መረጃዎች ይምረጡ፡',
    ageGroup: 'ዕድሜ (Age Group)',
    gender: 'ፆታ (Gender)',
    male: 'ወንድ',
    female: 'ሴት',
    education: 'የትምህርት ደረጃ (Education Level)',
    residenceCat: 'መኖሪያ / ተቋም Category:',
    specificRes: 'የተወሰነ ቦታ/ተቋም',
    questionsTitle: '2. የመጠይቅ ጥያቄዎች',
    expandAll: 'ሁሉንም ዘርጋ',
    collapseAll: 'ሁሉንም ሰብስብ',
    radioPrompt: 'እባክዎ አንዱን ይምረጡ...',
    ratingLow: '1 - በጣም ዝቅተኛ',
    ratingHigh: '5 - በጣም ከፍተኛ',
    textPrompt: 'እባክዎ የተሟላ አስተያየትዎን እዚህ ያስፍሩ፡',
    textPlaceholder: 'አስተያየትዎን እዚህ ይጻፉ...',
    antiBotTitle: '3. የቦት መከላከያ ማረጋገጫ (Anti-Bot Challenge)',
    antiBotSubtitle: 'ሀሰተኛ እና አውቶሜትድ ምላሾችን ለመከላከል የተደረገ፡',
    captchaAnswerPlaceholder: 'መልስ',
    cancel: 'ሰርዝ',
    submit: 'አስተያየት ይላኩ',
    submitting: 'በመላክ ላይ...',
    submittedSuccess: 'አስተያየትዎ በስኬት ተመዝግቧል!',
    submittedMessage: 'ስለተሳተፉ እጅግ እናመሰግናለን! የእርስዎ አስተያየት ሙሉ በሙሉ ሚስጥራዊና አኖኒመስ ሆኖ ለድሬደዋ አስተዳደር የፖሊሲ ማሻሻያዎች ይውላል::',
    refCode: 'አኖኒመስ ማረጋገጫ ቁጥር (Reference Code):',
    giveAnother: 'ሌላ ተጨማሪ አስተያየት ይስጡ',
    backToSurveys: 'ወደ ሌሎች ጥናቶች ተመለስ',
    errCaptcha: (a: number, b: number) => `የቦት መከላከያ ቁጥር መልስ አልተክከለም (${a} + ${b} = ?):: እባክዎ በትክክል ይሙሉ!`,
    errDemographics: 'እባክዎ መጀመሪያ የጀርባ ስነ-ሕዝብ (ዕድሜ፣ ፆታ፣ ትምህርት እና መኖሪያ ቦታ) መረጃዎችን ይሙሉ::',
    errQuestionChoice: (t: string) => `እባክዎ ለጥያቄ "${t.slice(0, 30)}..." መልስ ይምረጡ::`,
    errQuestionRating: (t: string) => `እባክዎ ለጥያቄ "${t.slice(0, 30)}..." የደረጃ ቁጥር ይስጡ::`,
    errNetwork: 'የኔትወርክ ስህተት አጋጥሟል! እባክዎ መስመርዎን ይፈትሹ እና እንደገና ይሞክሩ::',
    errOffline: 'የኢንተርኔት ግኑኝነት አልተገኘም:: እባክዎ ኢንተርኔት ሲያገኙ እንደገና ይሞክሩ::',
  },
  om: {
    langLabel: 'Afaan Gaaffannoo (Survey Language):',
    back: 'Deebi’i',
    qrAndShare: 'Koodii QR fi Qoodadhu',
    startedAt: 'Kan eegale:',
    questionProgress: 'Gaaffii',
    completed: 'Xumurameera',
    demographicSection: '1. Odeeffannoo Hawaasummaa (Demographics) - Dirqama',
    demographicSubtitle: 'Mee deebii kennuu keessan dura kanneen filadhaa:',
    ageGroup: 'Umurii (Age Group)',
    gender: 'Kornaa (Gender)',
    male: 'Dhiira',
    female: 'Dhalaa',
    education: 'Sadarkaa Barumsaa (Education Level)',
    residenceCat: 'Ramaddii Bakka Jireenyaa / Dhaabbataa:',
    specificRes: 'Bakka / Dhaabbata Murtaa’aa',
    questionsTitle: '2. Gaaffilee Qorannoo',
    expandAll: 'Hunda Dirirsi',
    collapseAll: 'Hunda Sassaabi',
    radioPrompt: 'Mee filannoo tokko filadhaa...',
    ratingLow: '1 - Baay’ee Gadaanaa',
    ratingHigh: '5 - Baay’ee Olaanaa',
    textPrompt: 'Mee yaada keessan guutuu asitti barreessaa:',
    textPlaceholder: 'Yaada keessan asitti barreessaa...',
    antiBotTitle: '3. Mirkaneessa Boottii (Anti-Bot Challenge)',
    antiBotSubtitle: 'Deebii sobaa fi ofiin socho’u ittisuuf kan qophaa’e:',
    captchaAnswerPlaceholder: 'Deebii',
    cancel: 'Dhiisi',
    submit: 'Yaada Ergi',
    submitting: 'Ergamaa jira...',
    submittedSuccess: 'Yaadni keessan milkaa’inaan galmeeffameera!',
    submittedMessage: 'Hirmaannaa keessaniif baay’ee galatoomaa! Yaadni keessan guutumaan guutuutti icitii fi eenyummaa malee imaammata Bulchiinsa Dirree Dawaa fooyyessuuf oola.',
    refCode: 'Koodhii Mirkaneessaa Icitii (Reference Code):',
    giveAnother: 'Yaada Biraa Kenni',
    backToSurveys: 'Gara Qorannootti Deebi’i',
    errCaptcha: (a: number, b: number) => `Deebiin mirkaneessa boottii dogoggora (${a} + ${b} = ?)! Mee sirriitti guutaa!`,
    errDemographics: 'Mee dura odeeffannoo hawaasummaa (umurii, kornaa, barumsaa fi bakka jireenyaa) guutaa.',
    errQuestionChoice: (t: string) => `Mee gaaffii "${t.slice(0, 30)}..." deebii filadhaa.`,
    errQuestionRating: (t: string) => `Mee gaaffii "${t.slice(0, 30)}..." sadarkaa kennaa.`,
    errNetwork: 'Dogoggorri neetworkii uumameera! Mee sarara keessan ilaalaatii irra deebiaa yaalaa.',
    errOffline: 'Walgrelationship interneetii hin jiru! Mee yeroo interneetiin argamu irra deebi’aa yaalaa.',
  },
  so: {
    langLabel: 'Luuqadda Sahanka (Survey Language):',
    back: 'Dib u noqo',
    qrAndShare: 'Koodhka QR iyo Wadaagidda',
    startedAt: 'Taariikhda bilaabashada:',
    questionProgress: 'Su’aal',
    completed: 'Waa la dhammaystiray',
    demographicSection: '1. Xogta Dadweynaha Ka Qaybgalayaasha (Demographics) - Qasab',
    demographicSubtitle: 'Fadlan dooro xogtaada aasaasiga ah ka hor inta aadan jawaabin:',
    ageGroup: 'Kooxda Da’da (Age Group)',
    gender: 'Jinsiga (Gender)',
    male: 'Lab',
    female: 'Dheddig',
    education: 'Heerka Waxbarashada (Education Level)',
    residenceCat: 'Qaybta Degganaanshaha / Hay’adda:',
    specificRes: 'Goobta / Hay’adda Gaarka ah',
    questionsTitle: '2. Su’aalaha Sahanka',
    expandAll: 'Ballaari Dhammaan',
    collapseAll: 'Isku laab Dhammaan',
    radioPrompt: 'Fadlan dooro mid ka mid ah...',
    ratingLow: '1 - Aad u Liita',
    ratingHigh: '5 - Aad u Sareeya',
    textPrompt: 'Fadlan fikraddaada oo buuxda halkan ku qor:',
    textPlaceholder: 'Ku qor fikraddaada ama jawaabtaada halkan...',
    antiBotTitle: '3. Xaqiijinta Ka Hortagga Bot-ka (Anti-Bot Challenge)',
    antiBotSubtitle: 'Si looga hortago jawaabaha beenta ah ee otomaatiga ah:',
    captchaAnswerPlaceholder: 'Jawaab',
    cancel: 'Jooji',
    submit: 'Dir Fikraddaada',
    submitting: 'Waa la dirayaa...',
    submittedSuccess: 'Fikraddaada si guul leh ayaa loo diiwaangeliyay!',
    submittedMessage: 'Waad ku mahadsan tihiin ka qaybgalkaaga! Fikraddaadu waa mid gabi ahaanba qarsoodi ah oo loo adeegsan doono horumarinta maamulka Diridhaba.',
    refCode: 'Koodhka Tixraaca Qarsoodiga ah (Reference Code):',
    giveAnother: 'Dhiibo Fikrad Kale',
    backToSurveys: 'Ku Noqo Sahannada Kale',
    errCaptcha: (a: number, b: number) => `Jawaabta ka-hortagga bot-ku ma saxna (${a} + ${b} = ?)! Fadlan si sax ah u buuxi!`,
    errDemographics: 'Fadlan marka hore buuxi xogta aasaasiga ah (da’da, jinsiga, waxbarashada iyo goobta).',
    errQuestionChoice: (t: string) => `Fadlan su’aasha "${t.slice(0, 30)}..." u dooro jawaab.`,
    errQuestionRating: (t: string) => `Fadlan su’aasha "${t.slice(0, 30)}..." heerka darajada sii.`,
    errNetwork: 'Khalad khadka ah ayaa dhacay! Fadlan xiriirkaaga hubi oo dib u tijaabi.',
    errOffline: 'Ma jiro xiriir internet! Fadlan dib u tijaabi marka internet la helo.',
  },
};

const EDUCATIONS_BY_LANG: Record<SupportedSurveyLang, { value: string; label: string }[]> = {
  am: [
    { value: 'ያልተማረ / መሠረታዊ', label: 'ያልተማረ / መሠረታዊ' },
    { value: 'የመጀመሪያ ደረጃ (1-8)', label: 'የመጀመሪያ ደረጃ (1-8)' },
    { value: 'ሁለተኛ ደረጃ (9-12)', label: 'ሁለተኛ ደረጃ (9-12)' },
    { value: 'ዲፕሎማ / ሰርተፊኬት', label: 'ዲፕሎማ / ሰርተፊኬት' },
    { value: 'የመጀመሪያ ዲግሪ', label: 'የመጀመሪያ ዲግሪ' },
    { value: 'ሁለተኛ ዲግሪና ከዚያ በላይ', label: 'ሁለተኛ ዲግሪና ከዚያ በላይ' },
  ],
  om: [
    { value: 'ያልተማረ / መሠረታዊ', label: 'Kan hin baratin / Bu’uura' },
    { value: 'የመጀመሪያ ደረጃ (1-8)', label: 'Sadarkaa Tokkoffaa (1-8)' },
    { value: 'ሁለተኛ ደረጃ (9-12)', label: 'Sadarkaa Lammaffaa (9-12)' },
    { value: 'ዲፕሎማ / ሰርተፊኬት', label: 'Diilpoomaa / Sartafikeettii' },
    { value: 'የመጀመሪያ ዲግሪ', label: 'Digrii Jalqabaa (Degree)' },
    { value: 'ሁለተኛ ዲግሪና ከዚያ በላይ', label: 'Digrii Lammaffaa fi Isaa Ol (Masters/PhD)' },
  ],
  so: [
    { value: 'ያልተማረ / መሠረታዊ', label: 'Aan wax baran / Aasaasi' },
    { value: 'የመጀመሪያ ደረጃ (1-8)', label: 'Dugsiga Hoose/Dhexe (1-8)' },
    { value: 'ሁለተኛ ደረጃ (9-12)', label: 'Dugsiga Sare (9-12)' },
    { value: 'ዲፕሎማ / ሰርተፊኬት', label: 'Diploma / Shahaado' },
    { value: 'የመጀመሪያ ዲግሪ', label: 'Shahaadada Koowaad (Degree)' },
    { value: 'ሁለተኛ ዲግሪና ከዚያ በላይ', label: 'Shahaadada Labaad iyo Wixii Ka Sareeya (Masters/PhD)' },
  ],
};

const RESIDENCE_CATEGORIES_BY_LANG: Record<SupportedSurveyLang, { value: string; label: string }[]> = {
  am: [
    { value: 'የሴክተር ተቋማት', label: 'የሴክተር ተቋማት' },
    { value: 'ወረዳ', label: 'ወረዳ' },
    { value: 'የገጠር ወረዳዎች', label: 'የገጠር ወረዳዎች' },
  ],
  om: [
    { value: 'የሴክተር ተቋማት', label: 'Dhaabbilee Sekteeraa' },
    { value: 'ወረዳ', label: 'Aanaa (Magaalaa)' },
    { value: 'የገጠር ወረዳዎች', label: 'Aanaalee Baadiyyaa' },
  ],
  so: [
    { value: 'የሴክተር ተቋማት', label: 'Hay\'adaha Qaybaha' },
    { value: 'ወረዳ', label: 'Degmo (Magaalo)' },
    { value: 'የገጠር ወረዳዎች', label: 'Degmooyinka Miyiga' },
  ],
};

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-65', '65+'];
const GENDERS = ['ወንድ', 'ሴት'];

export const SurveyForm: React.FC<SurveyFormProps> = ({
  survey,
  onBack,
  onSubmitSuccess,
  language = 'am',
  isDarkMode = true,
}) => {
  // Survey language state: remembers per survey via localStorage, defaults to passed language or 'am'
  const [surveyLang, setSurveyLang] = useState<SupportedSurveyLang>(() => {
    try {
      const saved = localStorage.getItem(`dgc_survey_lang_${survey.id}`);
      if (saved === 'am' || saved === 'om' || saved === 'so') {
        return saved as SupportedSurveyLang;
      }
    } catch {}
    if (language === 'om' || language === 'so' || language === 'am') {
      return language as SupportedSurveyLang;
    }
    return 'am';
  });

  const handleLanguageChange = (newLang: SupportedSurveyLang) => {
    setSurveyLang(newLang);
    setErrorMessage(null);
    try {
      localStorage.setItem(`dgc_survey_lang_${survey.id}`, newLang);
      localStorage.setItem('dgc_lang', newLang);
    } catch {}
  };

  // Translations resolution
  const activeTranslation = surveyLang !== 'am' ? survey.translations?.[surveyLang] : undefined;
  const currentTitle = activeTranslation?.title || survey.title;
  const currentDescription = activeTranslation?.description || survey.description;
  const currentCategory = activeTranslation?.category || survey.category;
  const currentTexts = SURVEY_TEXTS[surveyLang] || SURVEY_TEXTS.am;
  const t = translations[language] || translations.am;

  // Demographic state
  const [demographics, setDemographics] = useState<Demographics>({
    age_group: '26-35',
    gender: 'ወንድ',
    education: 'የመጀመሪያ ዲግሪ',
    residence: 'አዲስ ከተማ',
    residence_category: 'ወረዳ',
  });

  const [answers, setAnswers] = useState<Record<number, { text?: string; rating?: number }>>({});
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [isOfflineSaved, setIsOfflineSaved] = useState<boolean>(false);
  const [showProgressSavedToast, setShowProgressSavedToast] = useState(false);
  const [restoredProgressNotice, setRestoredProgressNotice] = useState(false);

  // In-memory state only (Strictly avoids persisting unencrypted citizen opinions/demographics into shared localStorage)
  useEffect(() => {
    try {
      localStorage.removeItem(`dgc_survey_progress_${survey.id}`);
    } catch {}
  }, [survey.id]);

  // Progress Calculation
  const questionsList = survey.questions || [];
  const totalQuestions = questionsList.length;
  const answeredCount = questionsList.filter((q) => {
    const a = answers[q.id];
    return Boolean(a?.text && a.text.trim()) || Boolean(a?.rating);
  }).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // QR Code & Share modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (showQrModal) {
      const shareUrl = `${window.location.origin}/#survey-${survey.id}`;
      QRCodeLib.toDataURL(shareUrl, { width: 280, margin: 2 })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [showQrModal, survey.id]);

  const toggleQuestionCollapse = (qId: number) => {
    setCollapsedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleRadioSelect = (questionId: number, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text: option },
    }));
  };

  const handleRatingSelect = (questionId: number, rating: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating },
    }));
  };

  const handleTextChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text },
    }));
  };

  // Helper to resolve question text & options in active language
  const getQuestionDisplay = (q: Question, index: number) => {
    if (surveyLang === 'am' || !activeTranslation?.questions) {
      return {
        text: q.question_text,
        options: q.options || [],
      };
    }
    const match = activeTranslation.questions.find((tq: any) => tq.id === q.id) || activeTranslation.questions[index];
    return {
      text: match?.question_text || q.question_text,
      options: match?.options && match.options.length > 0 ? match.options : (q.options || []),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate Demographic selections
    if (!demographics.age_group || !demographics.gender || !demographics.education || !demographics.residence) {
      setErrorMessage(currentTexts.errDemographics);
      return;
    }

    // Validate questions
    const questions = survey.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const displayQ = getQuestionDisplay(q, i);
      if (q.question_type === 'radio' && !answers[q.id]?.text) {
        setCollapsedQuestions((prev) => ({ ...prev, [q.id]: false }));
        setErrorMessage(currentTexts.errQuestionChoice(displayQ.text));
        return;
      }
      if (q.question_type === 'rating' && !answers[q.id]?.rating) {
        setCollapsedQuestions((prev) => ({ ...prev, [q.id]: false }));
        setErrorMessage(currentTexts.errQuestionRating(displayQ.text));
        return;
      }
    }

    setIsSubmitting(true);

    const payloadAnswers = questions
      .map((q) => {
        const val = answers[q.id];
        return {
          question_id: q.id,
          answer_text: val?.text || undefined,
          rating_value: val?.rating || undefined,
        };
      })
      .filter((a) => a.answer_text !== undefined || a.rating_value !== undefined);

    // Check offline
    if (!navigator.onLine) {
      setErrorMessage(currentTexts.errOffline);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': getAnonymousClientId(),
        },
        body: JSON.stringify({
          answers: payloadAnswers,
          demographics,
          language: surveyLang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || currentTexts.errNetwork);
      } else {
        const ticketCode = data.refCode || 'DGC-OP-' + Math.floor(100000 + Math.random() * 900000);
        setSubmittedTicket(ticketCode);
        onSubmitSuccess();
      }
    } catch (err: any) {
      setErrorMessage(currentTexts.errNetwork);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completion Success Screen
  if (submittedTicket) {
    return (
      <div className={`max-w-2xl mx-auto rounded-3xl p-8 border shadow-2xl text-center space-y-6 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/90 backdrop-blur-md border-emerald-500/30 text-white'
          : 'bg-white/95 backdrop-blur-md border-emerald-500/40 text-slate-900 shadow-slate-200/80'
      }`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner"
        >
          {isOfflineSaved ? <WifiOff className="w-10 h-10 text-amber-400" /> : <CheckCircle2 className="w-10 h-10 animate-bounce" />}
        </motion.div>
        <div className="space-y-2">
          <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
            {isOfflineSaved ? t.offlineQueued : currentTexts.submittedSuccess}
          </h2>
          <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {isOfflineSaved
              ? t.offlineSyncNotice
              : currentTexts.submittedMessage}
          </p>
        </div>

        <div className={`p-5 rounded-2xl border inline-block text-left text-xs space-y-1.5 shadow-inner ${
          isDarkMode ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className={`flex items-center space-x-2 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>{currentTexts.refCode}</span>
          </div>
          <p className="font-mono text-base text-emerald-500 font-black tracking-widest pl-6">
            {submittedTicket}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setSubmittedTicket(null);
              setIsOfflineSaved(false);
              setAnswers({});
            }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <span>{currentTexts.giveAnother}</span>
          </button>

          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>{currentTexts.backToSurveys}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top bar with Back and Share QR buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className={`px-4 py-2 text-xs font-bold rounded-2xl border transition-all flex items-center space-x-1.5 shadow-md cursor-pointer ${
            isDarkMode
              ? 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4 text-blue-500" />
          <span>{currentTexts.back}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 py-2 text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-2xl border border-amber-500/30 transition-all flex items-center space-x-2 shadow-md cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-amber-500" />
            <span>{currentTexts.qrAndShare}</span>
          </button>
        </div>
      </div>

      {/* Multilingual Survey Language Selector (Amharic / Afaan Oromoo / Soomaali) */}
      <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/90 border-slate-800 backdrop-blur-md'
          : 'bg-white/95 border-slate-200 shadow-slate-200/60 backdrop-blur-md'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <Globe className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              {currentTexts.langLabel}
            </span>
          </div>
        </div>

        {/* Compact Segmented Control / Pill-style Selector */}
        <div
          role="tablist"
          aria-label="Survey Language Selection"
          className={`inline-flex items-center p-1 rounded-xl border ${
            isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {SURVEY_LANG_OPTIONS.map((l) => {
            const isSelected = surveyLang === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => handleLanguageChange(l.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-400 font-black'
                    : isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={l.name}
              >
                <span>{l.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Survey Title Header (Dynamic Language & Theme) */}
      <div className={`p-6 sm:p-8 rounded-3xl shadow-xl space-y-3 relative overflow-hidden border transition-all duration-300 ${
        isDarkMode
          ? 'bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-blue-500/30 text-white'
          : 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 text-white shadow-blue-200/50'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-bold border border-white/30">
            {currentCategory}
          </span>
          {survey.start_date && (
            <span className="text-white/90 text-xs flex items-center gap-1 font-medium bg-black/20 px-2.5 py-1 rounded-full border border-white/20">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>{currentTexts.startedAt} {survey.start_date}</span>
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black leading-snug">{currentTitle}</h1>
        <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal whitespace-pre-line">{currentDescription}</p>
      </div>

      {/* Live Survey Progress System Indicator */}
      <div className={`rounded-2xl p-4 border shadow-xl space-y-2 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/90 backdrop-blur-md border-slate-800'
          : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
      }`}>
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center space-x-2 text-amber-500">
            <BookmarkCheck className="w-4 h-4 text-amber-500" />
            <span>
              {currentTexts.questionProgress} {answeredCount} / {totalQuestions}
            </span>
          </div>
          <span className="text-blue-500 font-mono text-xs font-black">{progressPercent}% {currentTexts.completed}</span>
        </div>

        {/* Visual Progress Bar */}
        <div className={`w-full rounded-full h-3.5 p-0.5 border overflow-hidden shadow-inner ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-500 shadow-sm"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Mandatory Demographics Section (Translated dynamically) */}
      <div className={`rounded-3xl p-6 border shadow-xl space-y-5 transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900/80 backdrop-blur-md border-slate-800'
          : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
      }`}>
        <div className={`flex items-center space-x-2.5 border-b pb-3 ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className={`p-2 rounded-xl border ${
            isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
          }`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{currentTexts.demographicSection}</h2>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentTexts.demographicSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Age Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold flex items-center space-x-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <span>{currentTexts.ageGroup}:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map((age) => (
                <button
                  type="button"
                  key={age}
                  onClick={() => setDemographics((p) => ({ ...p, age_group: age }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    demographics.age_group === age
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md scale-105'
                      : isDarkMode
                      ? 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold flex items-center space-x-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <span>{currentTexts.gender}:</span>
            </label>
            <div className="flex gap-2">
              {GENDERS.map((g) => {
                const isSelected = demographics.gender === g;
                const label = g === 'ወንድ' ? currentTexts.male : currentTexts.female;
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setDemographics((p) => ({ ...p, gender: g }))}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md scale-105'
                        : isDarkMode
                        ? 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Education Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{currentTexts.education}:</label>
            <select
              value={demographics.education || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, education: e.target.value }))}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {EDUCATIONS_BY_LANG[surveyLang].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Residence Category Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{currentTexts.residenceCat}</label>
            <select
              value={demographics.residence_category || RESIDENCE_CATEGORIES[0]}
              onChange={(e) => {
                const cat = e.target.value;
                let defaultLoc = SECTOR_INSTITUTIONS[0] as string;
                if (cat === 'ወረዳ') defaultLoc = URBAN_WOREDAS[0];
                else if (cat === 'የገጠር ወረዳዎች') defaultLoc = RURAL_WOREDAS[0];
                setDemographics((p) => ({
                  ...p,
                  residence_category: cat,
                  residence: defaultLoc,
                }));
              }}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {RESIDENCE_CATEGORIES_BY_LANG[surveyLang].map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Location Selection */}
          <div className="space-y-2">
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {currentTexts.specificRes} ({demographics.residence_category || RESIDENCE_CATEGORIES[0]}):
            </label>
            <select
              value={demographics.residence || ''}
              onChange={(e) => setDemographics((p) => ({ ...p, residence: e.target.value }))}
              className={`w-full p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {(demographics.residence_category === 'የሴክተር ተቋማት' || !demographics.residence_category) &&
                SECTOR_INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>
                    🏢 {inst}
                  </option>
                ))}

              {demographics.residence_category === 'ወረዳ' &&
                URBAN_WOREDAS.map((woreda) => (
                  <option key={woreda} value={woreda}>
                    📍 {woreda}
                  </option>
                ))}

              {demographics.residence_category === 'የገጠር ወረዳዎች' &&
                RURAL_WOREDAS.map((woreda) => (
                  <option key={woreda} value={woreda}>
                    🌾 {woreda}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-4 bg-amber-500/15 border border-amber-500 rounded-2xl text-xs sm:text-sm text-amber-500 font-bold flex items-center space-x-2 animate-shake">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {(survey.questions || []).map((q, index) => {
          const displayQ = getQuestionDisplay(q, index);
          const isAnswered = Boolean(answers[q.id]?.text || answers[q.id]?.rating);
          const isCollapsed = Boolean(collapsedQuestions[q.id]);

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden ${
                isDarkMode
                  ? 'bg-slate-900/80 backdrop-blur-md border-slate-800'
                  : 'bg-white/95 backdrop-blur-md border-slate-200 shadow-slate-200/60'
              }`}
            >
              {/* Question Header */}
              <div
                onClick={() => toggleQuestionCollapse(q.id)}
                className={`p-6 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5 border ${
                      isAnswered
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : isDarkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h3 className={`text-sm sm:text-base font-bold leading-snug ${
                      isDarkMode ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      {displayQ.text}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {isAnswered && (
                    <span className="p-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Collapsible Question Details */}
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`p-6 pt-0 border-t ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}
                  >
                    {/* Radio Choice Question */}
                    {q.question_type === 'radio' && (
                      <div className="space-y-2.5 pt-4">
                        {(displayQ.options || []).map((opt) => {
                          const isSelected = answers[q.id]?.text === opt;
                          return (
                            <label
                              key={opt}
                              onClick={() => handleRadioSelect(q.id, opt)}
                              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? isDarkMode
                                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 ring-2 ring-blue-500/30 shadow-md'
                                    : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/30 shadow-md'
                                  : isDarkMode
                                  ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-semibold">{opt}</span>
                              <div
                                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-600 text-white scale-110'
                                    : isDarkMode
                                    ? 'border-slate-700 bg-slate-900'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Rating Question */}
                    {q.question_type === 'rating' && (
                      <div className="pt-4 space-y-3">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const currentRating = answers[q.id]?.rating || 0;
                            const isFilled = star <= currentRating;
                            return (
                              <button
                                type="button"
                                key={star}
                                onClick={() => handleRatingSelect(q.id, star)}
                                className={`p-3 sm:p-4 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                  isFilled
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-500 shadow-md scale-110'
                                    : isDarkMode
                                    ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                <Star className={`w-6 h-6 ${isFilled ? 'fill-amber-400 text-amber-500' : ''}`} />
                                <span className="text-xs font-black mt-1">{star}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className={`flex justify-between text-xs px-1 max-w-xs font-medium ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <span>{currentTexts.ratingLow}</span>
                          <span>{currentTexts.ratingHigh}</span>
                        </div>
                      </div>
                    )}

                    {/* Open-ended Text Question */}
                    {q.question_type === 'text' && (
                      <div className="pt-4 relative">
                        <div className={`flex items-center space-x-1.5 text-xs mb-2 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <PenTool className="w-3.5 h-3.5 text-amber-500" />
                          <span>{currentTexts.textPrompt}</span>
                        </div>
                        <textarea
                          rows={4}
                          value={answers[q.id]?.text || ''}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          placeholder={currentTexts.textPlaceholder}
                          className={`w-full p-4 rounded-2xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all border ${
                            isDarkMode
                              ? 'bg-slate-950/70 border-slate-800 text-slate-100'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        ></textarea>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}



        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className={`px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {currentTexts.cancel}
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>{currentTexts.submitting}</span>
            ) : (
              <>
                <Send className="w-4 h-4 text-amber-400" />
                <span>{currentTexts.submit}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* QR Code & Share Modal */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full"
            >
              <DgcQrCard
                url={typeof window !== 'undefined' ? `${window.location.origin}/?survey=${survey.id}` : `https://dgc.gov.et/?survey=${survey.id}`}
                surveyTitle={currentTitle}
                onClose={() => setShowQrModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
