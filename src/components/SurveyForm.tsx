import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Star,
  Send,
  CheckCircle2,
  AlertTriangle,
  Check,
  Lock,
  QrCode,
  Share2,
  Globe,
  Clock,
  ListChecks,
  UserRound,
  MessageSquareText,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Survey,
  Demographics,
  Question,
  RESIDENCE_CATEGORIES,
  SECTOR_INSTITUTIONS,
  URBAN_WOREDAS,
  RURAL_WOREDAS,
} from '../types';
import { Language } from '../lib/i18n';
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

// Extra UI strings for the simplified form layout
const UI_TEXTS: Record<
  SupportedSurveyLang,
  {
    aboutYou: string;
    aboutYouSub: string;
    yourOpinion: string;
    yourOpinionSub: string;
    residence: string;
    choosePlace: string;
    questionOf: (n: number, total: number) => string;
    filled: string;
    ready: string;
    notAnswered: string;
    answered: string;
    chars: string;
    missing: (demo: number, q: number) => string;
    sendMine: string;
    share: string;
    copied: string;
    questionsCount: (n: number) => string;
    minutes: string;
    anonymous: string;
    thanksTitle: string;
    thanksBody: string;
    home: string;
    alreadyTitle: string;
    alreadyBody: string;
  }
> = {
  am: {
    aboutYou: 'ክፍል 1፦ ስለ እርስዎ',
    aboutYouSub: 'ስምዎ አይጠየቅም። ይህ መረጃ ለጥናቱ ትንታኔ ብቻ ይውላል።',
    yourOpinion: 'ክፍል 2፦ የእርስዎ አስተያየት',
    yourOpinionSub: 'ለእያንዳንዱ ጥያቄ ሐሳብዎን በራስዎ ቃል በነፃነት ይጻፉ።',
    residence: 'የሚኖሩበት / የሚሰሩበት ቦታ',
    choosePlace: '— ቦታ/ተቋም ይምረጡ —',
    questionOf: (n, t) => `ጥያቄ ${n} ከ ${t}`,
    filled: 'ተሞልቷል',
    ready: 'ለመላክ ዝግጁ ነው ✓',
    notAnswered: 'ይህ ጥያቄ አልተመለሰም',
    answered: '✓ ተመልሷል',
    chars: 'ፊደል',
    missing: (d, q) =>
      `እባክዎ ያልተሞሉትን ያሟሉ፦ ${[d ? `${d} የግል መረጃ` : '', q ? `${q} ጥያቄ` : ''].filter(Boolean).join(' እና ')} ይቀራል። በቀይ የተከበቡትን ይመልከቱ።`,
    sendMine: 'አስተያየቴን ላክ',
    share: 'ለሌሎች ያጋሩ',
    copied: 'ሊንኩ ተቀድቷል ✓',
    questionsCount: (n) => `${n} ጥያቄዎች`,
    minutes: '~5 ደቂቃ',
    anonymous: 'ስም አይጠየቅም · ሚስጥራዊ',
    thanksTitle: 'እናመሰግናለን! አስተያየትዎ ደርሶናል',
    thanksBody: 'የሰጡት አስተያየት ሚስጥራዊ ሆኖ ለፖሊሲና ለአሰራር ማሻሻያ ጥናት ይውላል። ሌሎችም እንዲሳተፉ ሊንኩን ያጋሩ።',
    home: 'ወደ ዋናው ገጽ',
    alreadyTitle: 'ይህንን መጠይቅ ቀደም ብለው ሞልተዋል',
    alreadyBody: 'አስተያየትዎ ተመዝግቧል — እናመሰግናለን! ከአንድ ስልክ/ኮምፒውተር አንድ ጊዜ ብቻ መሙላት ይቻላል። ሌሎችም እንዲሳተፉ ሊንኩን ያጋሩ።',
  },
  om: {
    aboutYou: 'Kutaa 1: Waa’ee keessan',
    aboutYouSub: 'Maqaan keessan hin gaafatamu. Odeeffannoon kun xiinxala qorannoo qofaaf oola.',
    yourOpinion: 'Kutaa 2: Yaada keessan',
    yourOpinionSub: 'Gaaffii hundaaf yaada keessan jecha mataa keessaniin bilisaan barreessaa.',
    residence: 'Bakka jireenyaa / hojii',
    choosePlace: '— Bakka/Dhaabbata filadhaa —',
    questionOf: (n, t) => `Gaaffii ${n} / ${t}`,
    filled: 'Guutameera',
    ready: 'Erguuf qophaa’eera ✓',
    notAnswered: 'Gaaffiin kun hin deebifamne',
    answered: '✓ Deebifameera',
    chars: 'qubee',
    missing: (d, q) =>
      `Mee kanneen hin guutamin guutaa: ${[d ? `odeeffannoo dhuunfaa ${d}` : '', q ? `gaaffii ${q}` : ''].filter(Boolean).join(' fi ')} hafeera. Kanneen diimaan marfaman ilaalaa.`,
    sendMine: 'Yaada koo ergi',
    share: 'Warra biroof qoodi',
    copied: 'Liinkiin waraabameera ✓',
    questionsCount: (n) => `Gaaffilee ${n}`,
    minutes: '~Daqiiqaa 5',
    anonymous: 'Maqaan hin gaafatamu · Icitii',
    thanksTitle: 'Galatoomaa! Yaadni keessan nu gaheera',
    thanksBody: 'Yaadni keessan icitiidhaan qorannoo fooyya’iinsa imaammataaf oola. Akka warri biroo hirmaatan liinkii qoodaa.',
    home: 'Gara fuula jalqabaa',
    alreadyTitle: 'Gaaffannoo kana duraan guuttaniirtu',
    alreadyBody: 'Yaadni keessan galmeeffameera — galatoomaa! Meeshaa tokkoon al tokko qofa guutuun ni danda’ama. Akka warri biroo hirmaatan liinkii qoodaa.',
  },
  so: {
    aboutYou: 'Qaybta 1: Adiga ku saabsan',
    aboutYouSub: 'Magacaaga lama weydiinayo. Xogtan waxaa loo isticmaalayaa falanqaynta sahanka oo keliya.',
    yourOpinion: 'Qaybta 2: Fikraddaada',
    yourOpinionSub: 'Su’aal kasta fikraddaada si xor ah ugu qor erayadaada.',
    residence: 'Goobta aad ku nooshahay / ka shaqeyso',
    choosePlace: '— Dooro goobta/hay’adda —',
    questionOf: (n, t) => `Su’aal ${n} / ${t}`,
    filled: 'La buuxiyay',
    ready: 'Diyaar u ah in la diro ✓',
    notAnswered: 'Su’aashan lama jawaabin',
    answered: '✓ Waa la jawaabay',
    chars: 'xaraf',
    missing: (d, q) =>
      `Fadlan buuxi waxa haray: ${[d ? `${d} xog shakhsi ah` : '', q ? `${q} su’aal` : ''].filter(Boolean).join(' iyo ')}. Eeg kuwa casaanka lagu wareejiyay.`,
    sendMine: 'Dir fikraddayda',
    share: 'La wadaag dadka kale',
    copied: 'Linkiga waa la koobiyeeyay ✓',
    questionsCount: (n) => `${n} su’aalood`,
    minutes: '~5 daqiiqo',
    anonymous: 'Magac lama weydiinayo · Qarsoodi',
    thanksTitle: 'Mahadsanid! Fikraddaada waa na soo gaartay',
    thanksBody: 'Fikraddaadu si qarsoodi ah ayaa loogu isticmaali doonaa daraasadda horumarinta siyaasadda. La wadaag linkiga si dadka kale uga qaybgalaan.',
    home: 'Bogga hore',
    alreadyTitle: 'Horay ayaad u buuxisay sahankan',
    alreadyBody: 'Fikraddaada waa la diiwaangeliyay — mahadsanid! Qalab kasta hal mar oo keliya ayaa la buuxin karaa. La wadaag linkiga si dadka kale uga qaybgalaan.',
  },
};

type DemoField = 'gender' | 'age_group' | 'education' | 'residence';
const DEMO_FIELDS: DemoField[] = ['gender', 'age_group', 'education', 'residence'];
const CATEGORY_ICONS: Record<string, string> = { 'የሴክተር ተቋማት': '🏢', 'ወረዳ': '🏙️', 'የገጠር ወረዳዎች': '🌾' };

export const SurveyForm: React.FC<SurveyFormProps> = ({
  survey,
  hasResponded = false,
  onBack,
  onSubmitSuccess,
  language = 'am',
  isDarkMode = false,
}) => {
  const [surveyLang, setSurveyLang] = useState<SupportedSurveyLang>(() => {
    try {
      const saved = localStorage.getItem(`dgc_survey_lang_${survey.id}`);
      if (saved === 'am' || saved === 'om' || saved === 'so') return saved as SupportedSurveyLang;
    } catch {}
    if (language === 'om' || language === 'so' || language === 'am') return language as SupportedSurveyLang;
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

  const activeTranslation = surveyLang !== 'am' ? survey.translations?.[surveyLang] : undefined;
  const currentTitle = activeTranslation?.title || survey.title;
  const currentDescription = activeTranslation?.description || survey.description;
  const currentCategory = activeTranslation?.category || survey.category;
  const tx = SURVEY_TEXTS[surveyLang] || SURVEY_TEXTS.am;
  const ui = UI_TEXTS[surveyLang] || UI_TEXTS.am;

  // No defaults: every respondent picks their own values (defaults silently skew the data)
  const [demographics, setDemographics] = useState<Demographics>({
    age_group: '',
    gender: '',
    education: '',
    residence: '',
    residence_category: RESIDENCE_CATEGORIES[0],
  });
  const [answers, setAnswers] = useState<Record<number, { text?: string; rating?: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const shareUrl = `${window.location.origin}/?survey=${survey.id}`;

  // In-memory only: never persist citizen opinions in shared-device localStorage
  useEffect(() => {
    try {
      localStorage.removeItem(`dgc_survey_progress_${survey.id}`);
    } catch {}
  }, [survey.id]);

  const questionsList = survey.questions || [];
  const isAnswered = (qId: number) => {
    const a = answers[qId];
    return Boolean(a?.text && a.text.trim()) || Boolean(a?.rating);
  };
  const demoDone = DEMO_FIELDS.filter((f) => Boolean(demographics[f])).length;
  const answeredCount = questionsList.filter((q) => isAnswered(q.id)).length;
  const totalSteps = DEMO_FIELDS.length + questionsList.length;
  const doneSteps = demoDone + answeredCount;
  const progressPercent = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const clearMissing = (key: string) =>
    setMissing((m) => {
      if (!m.has(key)) return m;
      const next = new Set(m);
      next.delete(key);
      return next;
    });

  const setDemo = (field: DemoField, value: string) => {
    setDemographics((p) => ({ ...p, [field]: value }));
    clearMissing(field);
  };

  const setAnswer = (qId: number, patch: { text?: string; rating?: number }) => {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], ...patch } }));
    clearMissing(`q${qId}`);
  };

  const getQuestionDisplay = (q: Question, index: number) => {
    if (surveyLang === 'am' || !activeTranslation?.questions) {
      return { text: q.question_text, options: q.options || [] };
    }
    const match = activeTranslation.questions.find((tq: any) => tq.id === q.id) || activeTranslation.questions[index];
    return {
      text: match?.question_text || q.question_text,
      options: match?.options && match.options.length > 0 ? match.options : q.options || [],
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const missingNow = new Set<string>();
    DEMO_FIELDS.forEach((f) => {
      if (!demographics[f]) missingNow.add(f);
    });
    questionsList.forEach((q) => {
      if (!isAnswered(q.id)) missingNow.add(`q${q.id}`);
    });
    if (missingNow.size > 0) {
      setMissing(missingNow);
      const d = DEMO_FIELDS.filter((f) => missingNow.has(f)).length;
      const qn = questionsList.filter((q) => missingNow.has(`q${q.id}`)).length;
      setErrorMessage(ui.missing(d, qn));
      const firstKey = [...DEMO_FIELDS, ...questionsList.map((q) => `q${q.id}`)].find((k) => missingNow.has(k));
      if (firstKey) fieldRefs.current[firstKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!navigator.onLine) {
      setErrorMessage(tx.errOffline);
      return;
    }

    setIsSubmitting(true);
    const payloadAnswers = questionsList
      .map((q) => ({
        question_id: q.id,
        answer_text: answers[q.id]?.text?.trim() || undefined,
        rating_value: answers[q.id]?.rating || undefined,
      }))
      .filter((a) => a.answer_text !== undefined || a.rating_value !== undefined);

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': getAnonymousClientId() },
        body: JSON.stringify({
          answers: payloadAnswers,
          demographics: {
            age_group: demographics.age_group,
            gender: demographics.gender,
            education: demographics.education,
            residence: demographics.residence,
          },
          language: surveyLang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error || tx.errNetwork);
      } else {
        setSubmittedTicket(data.refCode || 'DGC-OP-' + Math.floor(100000 + Math.random() * 900000));
        onSubmitSuccess();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setErrorMessage(tx.errNetwork);
    } finally {
      setIsSubmitting(false);
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: currentTitle, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* cancelled */
    }
  };

  // ----- theme helpers -----
  const card = isDarkMode
    ? 'bg-white/75 backdrop-blur-md border-slate-200'
    : 'bg-white border-slate-200 shadow-slate-200/70';
  const textMain = isDarkMode ? 'text-slate-900' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-500' : 'text-slate-500';
  const subtleBox = isDarkMode ? 'bg-slate-50/40' : 'bg-slate-50';
  const chip = (active: boolean, invalid: boolean) =>
    `min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      active
        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
        : `${isDarkMode ? 'bg-slate-50/70 text-slate-800 hover:border-slate-500' : 'bg-white text-slate-800 hover:border-slate-400'} ${
            invalid ? 'border-red-500/70' : isDarkMode ? 'border-slate-300' : 'border-slate-300'
          }`
    }`;
  const fieldBox = (key: string) =>
    `space-y-3 rounded-2xl p-4 sm:p-5 transition-colors ${missing.has(key) ? 'bg-red-500/5 ring-2 ring-red-500/60' : subtleBox}`;

  const FieldLabel = ({ n, label, done }: { n: number; label: string; done: boolean }) => (
    <div className="flex items-center gap-2.5">
      <span
        className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center ${
          done ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-200 text-slate-200' : 'bg-slate-200 text-slate-700'
        }`}
      >
        {done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : n}
      </span>
      <span className={`text-sm sm:text-[15px] font-bold ${textMain}`}>{label}</span>
    </div>
  );

  const qrModal = createPortal(
    <AnimatePresence>
      {showQrModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 overflow-y-auto z-[100] bg-slate-900/40 backdrop-blur-md flex items-center-safe justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full"
          >
            <DgcQrCard url={shareUrl} surveyTitle={currentTitle} onClose={() => setShowQrModal(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  // ---------------- Thank-you / already-answered screen ----------------
  if (submittedTicket || hasResponded) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[2rem] p-8 sm:p-10 border shadow-2xl text-center space-y-6 ${card} ${isDarkMode ? 'border-emerald-500/30' : 'border-emerald-300'}`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto bg-emerald-500/15 text-emerald-500"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>
          <div className="space-y-3">
            <h2 className={`text-2xl sm:text-3xl font-black ${textMain}`}>{submittedTicket ? ui.thanksTitle : ui.alreadyTitle}</h2>
            <p className={`text-sm sm:text-base max-w-md mx-auto leading-relaxed ${isDarkMode ? 'text-slate-700' : 'text-slate-600'}`}>
              {submittedTicket ? ui.thanksBody : ui.alreadyBody}
            </p>
          </div>
          {submittedTicket && (
          <div
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs ${
              isDarkMode ? 'bg-slate-50/80 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>{tx.refCode}</span>
            <span className="font-mono font-black text-emerald-500 tracking-wider">{submittedTicket}</span>
          </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            <button
              onClick={share}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              {copied ? ui.copied : ui.share}
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className={`px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border cursor-pointer ${
                isDarkMode ? 'bg-slate-100 hover:bg-slate-200 text-blue-700 border-slate-300' : 'bg-white hover:bg-slate-50 text-blue-700 border-slate-300'
              }`}
            >
              <QrCode className="w-4 h-4" />
              QR
            </button>
            <button
              onClick={onBack}
              className={`px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border cursor-pointer ${
                isDarkMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              {ui.home}
            </button>
          </div>
        </motion.div>
        {qrModal}
      </div>
    );
  }

  // ---------------- Form ----------------
  const category = demographics.residence_category || RESIDENCE_CATEGORIES[0];
  const locations: readonly string[] =
    category === 'ወረዳ' ? URBAN_WOREDAS : category === 'የገጠር ወረዳዎች' ? RURAL_WOREDAS : SECTOR_INSTITUTIONS;
  const topBtn = `min-h-[44px] px-4 py-2 text-sm font-bold rounded-2xl border flex items-center gap-2 cursor-pointer ${
    isDarkMode ? 'bg-white/80 hover:bg-slate-100 text-slate-800 border-slate-200' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
  }`;

  const progressBox = (extra: string) => (
    <div className={`${extra} rounded-2xl border px-4 py-3 shadow-lg ${isDarkMode ? 'bg-white/95 border-slate-200' : 'bg-white/95 border-slate-200'}`}>
      <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
        <span className={isDarkMode ? 'text-slate-800' : 'text-slate-700'}>
          {ui.filled}: <span className={isDarkMode ? 'text-blue-600' : 'text-blue-600'}>{doneSteps}</span> / {totalSteps}
        </span>
        <span className={progressPercent === 100 ? 'text-emerald-600' : textSub}>
          {progressPercent === 100 ? ui.ready : `${progressPercent}%`}
        </span>
      </div>
      <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-100' : 'bg-slate-200'}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl pb-28 sm:pb-8">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button onClick={onBack} className={topBtn}>
          <ArrowLeft className="w-4 h-4" />
          {tx.back}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={share} className={topBtn} aria-label={ui.share}>
            <Share2 className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{copied ? ui.copied : ui.share}</span>
          </button>
          <button onClick={() => setShowQrModal(true)} className={topBtn}>
            <QrCode className="w-4 h-4 text-blue-600" />
            QR
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start xl:gap-8">
        {/* Left column: title, language, progress (stays in view on desktop) */}
        <aside className="space-y-4 lg:sticky lg:top-[104px]">
          <div
            className={`relative overflow-hidden rounded-[2rem] border p-6 sm:p-7 shadow-xl ${
              isDarkMode
                ? 'border-blue-500/30 bg-gradient-to-br from-[#0b1f4a] via-[#0a1733] to-[#06261f]'
                : 'border-blue-100 bg-gradient-to-br from-white via-sky-50 to-emerald-50 shadow-blue-900/5'
            }`}
          >
            <div className="absolute inset-x-0 top-0 flex h-1.5">
              <span className="flex-1 bg-emerald-500" />
              <span className="flex-1 bg-amber-400" />
              <span className="flex-1 bg-red-500" />
            </div>
            <span
              className={`inline-block rounded-full border px-3 py-1 text-[11px] font-bold ${
                isDarkMode ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-700' : 'border-blue-100 bg-white text-blue-700'
              }`}
            >
              {currentCategory}
            </span>
            <h1 className={`mt-3 text-xl sm:text-2xl font-black leading-snug ${isDarkMode ? 'text-slate-900' : 'text-slate-900'}`}>{currentTitle}</h1>
            <p className={`mt-3 text-sm leading-relaxed whitespace-pre-line ${isDarkMode ? 'text-slate-700' : 'text-slate-600'}`}>{currentDescription}</p>
            <div className={`mt-5 flex flex-wrap gap-2 text-xs font-semibold ${isDarkMode ? 'text-slate-700' : 'text-slate-600'}`}>
              {[
                { icon: <ListChecks className="w-4 h-4" />, text: ui.questionsCount(questionsList.length) },
                { icon: <Clock className="w-4 h-4" />, text: ui.minutes },
                { icon: <Lock className="w-4 h-4" />, text: ui.anonymous },
              ].map((chipItem) => (
                <span
                  key={chipItem.text}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 ${
                    isDarkMode ? 'bg-slate-50/50 border-white/10' : 'bg-white border-slate-200'
                  }`}
                >
                  <span className={isDarkMode ? 'text-emerald-700' : 'text-blue-600'}>{chipItem.icon}</span>
                  {chipItem.text}
                </span>
              ))}
            </div>
          </div>

          {/* Language selector */}
          <div className={`p-3 rounded-2xl border shadow-lg space-y-2.5 ${card}`}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-800' : 'text-slate-800'}`}>{tx.langLabel}</span>
            </div>
            <div
              role="tablist"
              aria-label="Survey Language Selection"
              className={`grid grid-cols-3 items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-100 border-slate-200'}`}
            >
              {SURVEY_LANG_OPTIONS.map((l) => {
                const sel = surveyLang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    onClick={() => handleLanguageChange(l.code)}
                    title={l.name}
                    className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      sel
                        ? 'bg-blue-600 text-white shadow-md'
                        : isDarkMode
                        ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {progressBox('hidden lg:block')}
        </aside>

        {/* Right column: the form */}
        <div className="min-w-0 space-y-6">
          {progressBox('sticky top-[88px] sm:top-[100px] z-20 lg:hidden')}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1 */}
        <section className={`rounded-[2rem] border p-5 sm:p-7 shadow-xl space-y-5 ${card}`}>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-black ${textMain}`}>{ui.aboutYou}</h2>
              <p className={`text-sm ${textSub}`}>{ui.aboutYouSub}</p>
            </div>
          </div>

          <div ref={(el) => { fieldRefs.current.gender = el; }} className={fieldBox('gender')}>
            <FieldLabel n={1} label={tx.gender} done={Boolean(demographics.gender)} />
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {GENDERS.map((g) => (
                <button type="button" key={g} onClick={() => setDemo('gender', g)} className={chip(demographics.gender === g, missing.has('gender'))}>
                  {g === 'ወንድ' ? tx.male : tx.female}
                </button>
              ))}
            </div>
          </div>

          <div ref={(el) => { fieldRefs.current.age_group = el; }} className={fieldBox('age_group')}>
            <FieldLabel n={2} label={tx.ageGroup} done={Boolean(demographics.age_group)} />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {AGE_GROUPS.map((age) => (
                <button type="button" key={age} onClick={() => setDemo('age_group', age)} className={chip(demographics.age_group === age, missing.has('age_group'))}>
                  {age}
                </button>
              ))}
            </div>
          </div>

          <div ref={(el) => { fieldRefs.current.education = el; }} className={fieldBox('education')}>
            <FieldLabel n={3} label={tx.education} done={Boolean(demographics.education)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EDUCATIONS_BY_LANG[surveyLang].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setDemo('education', opt.value)}
                  className={`${chip(demographics.education === opt.value, missing.has('education'))} text-left`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={(el) => { fieldRefs.current.residence = el; }} className={fieldBox('residence')}>
            <FieldLabel n={4} label={ui.residence} done={Boolean(demographics.residence)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RESIDENCE_CATEGORIES_BY_LANG[surveyLang].map((cat) => (
                <button
                  type="button"
                  key={cat.value}
                  onClick={() => {
                    if (cat.value !== category) setDemographics((p) => ({ ...p, residence_category: cat.value, residence: '' }));
                  }}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                    category === cat.value
                      ? 'bg-blue-600 text-white border-blue-400'
                      : isDarkMode
                      ? 'bg-slate-50/70 text-slate-700 border-slate-300 hover:border-slate-500'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {CATEGORY_ICONS[cat.value]} {cat.label}
                </button>
              ))}
            </div>
            <select
              value={demographics.residence || ''}
              onChange={(e) => setDemo('residence', e.target.value)}
              aria-label={ui.residence}
              className={`w-full min-h-[48px] px-4 border rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isDarkMode ? 'bg-slate-50 text-slate-900' : 'bg-white text-slate-900'
              } ${missing.has('residence') ? 'border-red-500/70' : isDarkMode ? 'border-slate-300' : 'border-slate-300'}`}
            >
              <option value="" disabled>
                {ui.choosePlace}
              </option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <div className="flex items-start gap-3 px-1">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-lg font-black ${textMain}`}>{ui.yourOpinion}</h2>
              <p className={`text-sm ${textSub}`}>{ui.yourOpinionSub}</p>
            </div>
          </div>

          {questionsList.map((q, idx) => {
            const displayQ = getQuestionDisplay(q, idx);
            const done = isAnswered(q.id);
            const invalid = missing.has(`q${q.id}`);
            const text = answers[q.id]?.text || '';
            return (
              <div
                key={q.id}
                ref={(el) => { fieldRefs.current[`q${q.id}`] = el; }}
                className={`rounded-[1.75rem] border p-5 sm:p-7 shadow-xl transition-colors ${card} ${
                  invalid ? '!border-red-500/70 ring-2 ring-red-500/40' : done ? '!border-emerald-500/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-9 h-9 shrink-0 rounded-xl text-sm font-black flex items-center justify-center ${
                      done ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-bold uppercase tracking-wide ${textSub}`}>{ui.questionOf(idx + 1, questionsList.length)}</div>
                    <h3 className={`mt-1 text-[15px] sm:text-base font-semibold leading-relaxed ${textMain}`}>{displayQ.text}</h3>
                  </div>
                </div>

                <div className="mt-4 sm:pl-12">
                  {q.question_type === 'text' && (
                    <>
                      <textarea
                        rows={5}
                        value={text}
                        maxLength={2000}
                        onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                        placeholder={tx.textPlaceholder}
                        aria-label={ui.questionOf(idx + 1, questionsList.length)}
                        className={`w-full resize-y rounded-2xl border p-4 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 ${
                          isDarkMode ? 'bg-slate-50/80 text-slate-900 placeholder-slate-500' : 'bg-slate-50 text-slate-900 placeholder-slate-400'
                        } ${invalid ? 'border-red-500/70' : isDarkMode ? 'border-slate-300' : 'border-slate-300'}`}
                      />
                      <div className={`mt-1.5 flex justify-between text-xs ${textSub}`}>
                        <span>
                          {invalid ? (
                            <span className="text-red-500 font-semibold">{ui.notAnswered}</span>
                          ) : done ? (
                            <span className="text-emerald-500 font-semibold">{ui.answered}</span>
                          ) : null}
                        </span>
                        <span>
                          {text.length} / 2000 {ui.chars}
                        </span>
                      </div>
                    </>
                  )}

                  {q.question_type === 'radio' && (
                    <div className="grid gap-2">
                      {(displayQ.options || []).map((opt: string) => {
                        const selected = answers[q.id]?.text === opt;
                        return (
                          <button
                            type="button"
                            key={opt}
                            onClick={() => setAnswer(q.id, { text: opt })}
                            className={`min-h-[48px] flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm sm:text-base font-semibold transition-all cursor-pointer ${
                              selected
                                ? 'border-blue-500 bg-blue-500/10 ' + (isDarkMode ? 'text-blue-700' : 'text-blue-800')
                                : `${isDarkMode ? 'bg-slate-50/70 text-slate-800 hover:border-slate-500' : 'bg-white text-slate-800 hover:border-slate-400'} ${
                                    invalid ? 'border-red-500/60' : isDarkMode ? 'border-slate-300' : 'border-slate-300'
                                  }`
                            }`}
                          >
                            <span>{opt}</span>
                            <span
                              className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                selected ? 'border-blue-600 bg-blue-600 text-white' : isDarkMode ? 'border-slate-300' : 'border-slate-300'
                              }`}
                            >
                              {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === 'rating' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const filled = star <= (answers[q.id]?.rating || 0);
                          return (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setAnswer(q.id, { rating: star })}
                              aria-label={`${star}`}
                              className={`flex-1 max-w-[64px] aspect-square rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                                filled
                                  ? 'border-amber-400 bg-amber-400/15 text-amber-700'
                                  : isDarkMode
                                  ? 'border-slate-300 bg-slate-50/70 text-slate-500'
                                  : 'border-slate-300 bg-white text-slate-500'
                              }`}
                            >
                              <Star className={`w-6 h-6 ${filled ? 'fill-amber-400' : ''}`} />
                              <span className="text-xs font-black">{star}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className={`flex justify-between max-w-[340px] text-xs ${textSub}`}>
                        <span>{tx.ratingLow}</span>
                        <span>{tx.ratingHigh}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {errorMessage && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <span className={isDarkMode ? 'text-red-700' : 'text-red-700'}>{errorMessage}</span>
          </div>
        )}

        {/* Submit — sticky at the bottom on phones */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t p-3 backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:p-0 ${
            isDarkMode ? 'border-slate-200 bg-slate-50/95' : 'border-slate-200 bg-white/95'
          }`}
        >
          <div className="max-w-3xl mx-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white text-base sm:text-lg font-black shadow-xl shadow-blue-600/25 transition-all hover:brightness-105 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> {tx.submitting}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> {ui.sendMine}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
        </div>
      </div>

      {qrModal}
    </div>
  );
};
