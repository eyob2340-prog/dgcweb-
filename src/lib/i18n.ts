export type Language = 'am' | 'en' | 'om' | 'ti';

export interface Translations {
  bureauTitle: string;
  bureauSubtitle: string;
  publicPortal: string;
  adminPortal: string;
  allSurveys: string;
  searchSurveys: string;
  giveFeedback: string;
  back: string;
  qrAndShare: string;
  demographicSection: string;
  demographicSubtitle: string;
  ageGroup: string;
  gender: string;
  male: string;
  female: string;
  education: string;
  residence: string;
  questions: string;
  expandAll: string;
  collapseAll: string;
  submitFeedback: string;
  submitting: string;
  captchaTitle: string;
  submittedSuccess: string;
  submittedMessage: string;
  refCode: string;
  giveAnother: string;
  backToSurveys: string;
  copyLink: string;
  linkCopied: string;
  downloadQr: string;
  offlineQueued: string;
  offlineSyncNotice: string;
  syncNow: string;
  offlineSuccess: string;
  saveProgress: string;
  progressRestored: string;
  progressSavedToast: string;
  questionProgress: string;
  printA4Letter: string;
  categories: {
    all: string;
    politics: string;
    infrastructure: string;
    social: string;
  };
}

export const translations: Record<Language, Translations> = {
  am: {
    bureauTitle: 'የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ',
    bureauSubtitle: 'Dire Dawa Administration Government Communication Affairs Bureau',
    publicPortal: 'የህዝብ አስተያየት መስጫ',
    adminPortal: 'አድሚን ፖርታል',
    allSurveys: 'ሁሉም የህዝብ ዳሰሳ ጥናቶች',
    searchSurveys: 'ጥናት ፈልግ...',
    giveFeedback: 'አስተያየት ይስጡ',
    back: 'ተመለስ',
    qrAndShare: 'QR ኮድ እና ማጋሪያ',
    demographicSection: '1. የተሳታፊው ስነ-ሕዝብ (Demographics) - ግዴታ',
    demographicSubtitle: 'እባክዎ መልስ ከመስጠትዎ በፊት እነዚህን መሰረታዊ መረጃዎች ይምረጡ፡',
    ageGroup: 'ዕድሜ (Age Group)',
    gender: 'ፆታ (Gender)',
    male: 'ወንድ',
    female: 'ሴት',
    education: 'የትምህርት ደረጃ (Education Level)',
    residence: 'መኖሪያ ቦታ / ክፍለ ከተማ (Residence)',
    questions: '2. የመጠይቅ ጥያቄዎች',
    expandAll: 'ሁሉንም ዘርጋ',
    collapseAll: 'ሁሉንም ሰብስብ',
    submitFeedback: 'አስተያየት ይላኩ',
    submitting: 'በመላክ ላይ...',
    captchaTitle: '3. የቦት መከላከያ ማረጋገጫ (Anti-Bot Challenge)',
    submittedSuccess: 'አስተያየትዎ በስኬት ተመዝግቧል!',
    submittedMessage: 'ስለተሳተፉ እጅግ እናመሰግናለን! የእርስዎ አስተያየት ሙሉ በሙሉ ሚስጥራዊና አኖኒመስ ሆኖ ለድሬዳዋ አስተዳደር የፖሊሲ ማሻሻያዎች ይውላል::',
    refCode: 'አኖኒመስ ማረጋገጫ ቁጥር (Reference Code):',
    giveAnother: 'ሌላ ተጨማሪ አስተያየት ይስጡ',
    backToSurveys: 'ወደ ሌሎች ጥናቶች ተመለስ',
    copyLink: 'ሊንኩን ኮፒ አድርግ (Copy Link)',
    linkCopied: 'ሊንኩ ኮፒ ተደርጓል! ✓',
    downloadQr: 'QR ኮዱን ዳውንሎድ አድርግ (.png)',
    offlineQueued: 'በኦፍላይን የተቀመጠ ምላሽ አለ',
    offlineSyncNotice: 'ኢንተርኔት ሲመጣ ምላሽዎ በራስ-ሰር ይላካል::',
    syncNow: 'አሁን ላክ (Sync Now)',
    offlineSuccess: 'በኦፍላይን የተቀመጡ ምላሾች በስኬት ተልከዋል!',
    saveProgress: 'ምላሼን አስቀምጥ (Save My Progress)',
    progressRestored: 'የቀደመ መልስዎ በራስ-ሰር ተመልሷል!',
    progressSavedToast: 'ምላሽዎ ተቀምጧል! በኋላ ተመልሰው መቀጠል ይችላሉ::',
    questionProgress: 'ጥያቄ',
    printA4Letter: 'ወደ A4 ኦፊሴላዊ ደብዳቤ ፕሪንት / PDF አውርድ',
    categories: {
      all: 'ሁሉም',
      politics: 'ፖለቲካ እና ኢኮኖሚ',
      infrastructure: 'መሠረተ ልማት',
      social: 'ማህበራዊ ጉዳዮች',
    },
  },
  en: {
    bureauTitle: 'Dire Dawa Administration Government Communication Affairs Bureau',
    bureauSubtitle: 'Official Public Opinion & Civic Survey Portal',
    publicPortal: 'Public Opinion Portal',
    adminPortal: 'Admin Portal',
    allSurveys: 'All Civic Opinion Surveys',
    searchSurveys: 'Search survey...',
    giveFeedback: 'Provide Feedback',
    back: 'Back',
    qrAndShare: 'QR Code & Share',
    demographicSection: '1. Participant Demographic Profile (Mandatory)',
    demographicSubtitle: 'Please select your demographic profile before answering:',
    ageGroup: 'Age Group',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    education: 'Education Level',
    residence: 'Residence / Sub-city',
    questions: '2. Survey Questions',
    expandAll: 'Expand All',
    collapseAll: 'Collapse All',
    submitFeedback: 'Submit Response',
    submitting: 'Submitting...',
    captchaTitle: '3. Anti-Bot Verification',
    submittedSuccess: 'Your feedback has been submitted successfully!',
    submittedMessage: 'Thank you for participating! Your feedback is completely confidential and anonymous, used for Dire Dawa Administration policy improvements.',
    refCode: 'Anonymous Reference Code:',
    giveAnother: 'Submit Another Response',
    backToSurveys: 'Back to Surveys',
    copyLink: 'Copy Link',
    linkCopied: 'Link Copied! ✓',
    downloadQr: 'Download QR Code (.png)',
    offlineQueued: 'Response saved offline',
    offlineSyncNotice: 'Your response will automatically sync once internet connection is restored.',
    syncNow: 'Sync Now',
    offlineSuccess: 'Offline responses synced successfully!',
    saveProgress: 'Save My Progress',
    progressRestored: 'Your previously saved progress has been restored!',
    progressSavedToast: 'Your progress is saved! You can resume anytime later.',
    questionProgress: 'Question',
    printA4Letter: 'Print / Download Official A4 Formal Letter',
    categories: {
      all: 'All',
      politics: 'Politics & Economy',
      infrastructure: 'Infrastructure',
      social: 'Social Affairs',
    },
  },
  om: {
    bureauTitle: 'Waajjira Dhimmoota Komuniikeeshinii Mootummaa Bulchiinsa Dirree Dawaa',
    bureauSubtitle: 'Tajaajila Yaada Uummataa fi Qorannoo Dirree Dawaa',
    publicPortal: 'Poortaalii Yaada Uummataa',
    adminPortal: 'Poortaalii Admiinii',
    allSurveys: 'Qorannoo Yaada Uummataa Huunda',
    searchSurveys: 'Barbaadi...',
    giveFeedback: 'Yaada Kennai',
    back: 'Deebi’i',
    qrAndShare: 'Koodii QR fi Qoodadhu',
    demographicSection: '1. Odeeffannoo Hawaasummaa (Dirqama)',
    demographicSubtitle: 'Mee deebii kennuu keessan dura kanneen filadhaa:',
    ageGroup: 'Umurii',
    gender: 'Kornaa',
    male: 'Dhiira',
    female: 'Dhalaa',
    education: 'Sadarkaa Barumsaa',
    residence: 'Bakka Jireenyaa / Kutaa Magaalaa',
    questions: '2. Gaaffilee Qorannoo',
    expandAll: 'Hunda Dirirsi',
    collapseAll: 'Hunda Sassaabi',
    submitFeedback: 'Yaada Ergi',
    submitting: 'Ergamaa jira...',
    captchaTitle: '3. Mirkaneessa Boottii (Anti-Bot)',
    submittedSuccess: 'Yaadni keessan milkaa’inaan galmeeffameera!',
    submittedMessage: 'Hirmaannaa keessaniif galatoomaa! Yaadni keessan guutumaan guutuutti icitii fi eenyummaa malee imaammata Bulchiinsa Dirree Dawaa fooyyessuuf oola.',
    refCode: 'Lakkoofsa Mirkaneessaa:',
    giveAnother: 'Yaada Biraa Kenni',
    backToSurveys: 'Gara Qorannootti Deebi’i',
    copyLink: 'Liinkii Waraabi',
    linkCopied: 'Waraabameera! ✓',
    downloadQr: 'QR Maxxansi (.png)',
    offlineQueued: 'Deebiin sararaan ala kuufameera',
    offlineSyncNotice: 'Yeroo interneetiin argamutti deebiin keessan ofumaan ergama.',
    syncNow: 'Amma Ergi',
    offlineSuccess: 'Deebiin kuufame milkaa’inaan ergameera!',
    saveProgress: 'Adeemsa Koof Qabadhu',
    progressRestored: 'Deebiin keessan kanaan duraa deebi’era!',
    progressSavedToast: 'Deebiin keessan ol-ka’ameera! Booda itti fufuu dandeessu.',
    questionProgress: 'Gaaffii',
    printA4Letter: 'Xalayaa Waraqaa A4 Maxxansi',
    categories: {
      all: 'Hunda',
      politics: 'Poliitikaa fi Dinagdee',
      infrastructure: 'Misooma Bu’uuraa',
      social: 'Dhimma Hawaasummaa',
    },
  },
  ti: {
    bureauTitle: 'ቢሮ ጉዳያት ኮሙኒኬሽን መንግስቲ ምምሕዳር ድሬዳዋ',
    bureauSubtitle: 'ወግዓዊ ፖርታል ርእይቶ ህዝብን ዳህሳስን ድሬዳዋ',
    publicPortal: 'ፖርታል ርእይቶ ህዝቢ',
    adminPortal: 'ፖርታል ኣድሚን',
    allSurveys: 'ኩሎም ዳህሳሳት ርእይቶ ህዝቢ',
    searchSurveys: 'ደህሳስ ደሊ...',
    giveFeedback: 'ርእይቶ ሃቡ',
    back: 'ተመለስ',
    qrAndShare: 'QR ኮድን ምክፋልን',
    demographicSection: '1. መረዳእታ ስነ-ሕዝቢ (ግዴታ)',
    demographicSubtitle: 'በጃኹም መልሲ ቅድሚ ምሃብኩም እዞም መሰረታዊ መረዳእታታት ምረጹ፡',
    ageGroup: 'ዕድመ',
    gender: 'ፆታ',
    male: 'ተባዕታይ',
    female: 'ኣንስታይ',
    education: 'ብርኪ ትምህርቲ',
    residence: 'ቦታ መቐመጢ / ክፍለ ከተማ',
    questions: '2. ሕቶታት ዳህሳስ',
    expandAll: 'ኩሉ ዘርግሕ',
    collapseAll: 'ኩሉ ኣእክብ',
    submitFeedback: 'ርእይቶ ስደዱ',
    submitting: 'ይስደድ ኣሎ...',
    captchaTitle: '3. ምርጋጋፅ ቦት (Anti-Bot Verification)',
    submittedSuccess: 'ርእይቶኹም ብዓወት ተመዝጊቡ ኣሎ!',
    submittedMessage: 'ብምስታፍኩም ነመስግን! ርእይቶኹም ምሉእ ብምሉእ ምስጢራዊ ኮይኑ ንምምሕዳር ድሬዳዋ የገልግሎት::',
    refCode: 'ቁፅሪ መረጋገፂ:',
    giveAnother: 'ተወሳኺ ርእይቶ ሃቡ',
    backToSurveys: 'ናብ ካልኦት ዳህሳሳት ተመለስ',
    copyLink: 'ሊንክ ኮፒ ጀምር',
    linkCopied: 'ኮፒ ተገይሩ! ✓',
    downloadQr: 'QR ኮድ ዳውንሎድ ግበር (.png)',
    offlineQueued: 'ብኦፍላይን ዝተቐመጠ መልሲ ኣሎ',
    offlineSyncNotice: 'ኢንተርኔት እንተመፂኡ መልስኹም ብባዕሉ ይስደድ::',
    syncNow: 'ሕዚ ስደድ',
    offlineSuccess: 'ብኦፍላይን ዝተቐመጡ መልስታት ብዓወት ተላኢኾም!',
    saveProgress: 'መልሰይ ዓቅብ',
    progressRestored: 'ናይ ቀደም መልስኹም ተመሊሱ ኣሎ!',
    progressSavedToast: 'መልስኹም ተዓቂቡ ኣሎ! ደሓር ክትቅፅሉ ትኽእሉ::',
    questionProgress: 'ሕቶ',
    printA4Letter: 'ወግዓዊ ደብዳቤ A4 ፕሪንት ግበር',
    categories: {
      all: 'ኩሎም',
      politics: 'ፖለቲካን ኢኮኖሚን',
      infrastructure: 'መሠረተ ልማት',
      social: 'ማሕበራዊ ጉዳያት',
    },
  },
};
