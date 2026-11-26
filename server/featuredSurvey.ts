// Featured survey built from the questionnaire document
// "SG 2019 house of mekir bet 17 የታረመ.doc" (ሕዳር 17/3/2019 ዓ.ም parliament session).
// The server makes sure this survey exists on startup (matched by title), so it
// appears at the top of the public homepage without any manual admin step.

export const FEATURED_SURVEY_TITLE =
  'የጠ/ሚ ዐቢይ አሕመድ (ዶ/ር) የሕዳር 17/2019 ዓ.ም የፓርላማ ምላሽና ማብራሪያ — የሕዝብ አስተያየት';

export const FEATURED_SURVEY = {
  title: FEATURED_SURVEY_TITLE,
  description:
    'ጠቅላይ ሚኒስትር ዐቢይ አሕመድ (ዶ/ር) በሕዝብ ተወካዮች ምክር ቤት የ1ኛ ዓመት የሥራ ዘመን 4ኛ መደበኛ ጉባኤ (ሕዳር 17/3/2019 ዓ.ም) ' +
    'ከምክር ቤት አባላት ለተነሱ ጥያቄዎች የሰጡትን ምላሽና ማብራሪያ መሠረት በማድረግ የሕዝብ አስተያየት ለመሰብሰብና ለመተንተን የተዘጋጀ መጠይቅ ነው። ' +
    'እባክዎ ለእያንዳንዱ ጥያቄ ያለዎትን ሐሳብና አስተያየት በተሰጠው ቦታ ላይ ይጻፉ።',
  category: 'ፖለቲካ እና ኢኮኖሚ',
  theme: 'government',
  questions: [
    {
      question_text:
        'ጠቅላይ ሚኒስትር ዐቢይ አሕመድ (ዶ/ር) የንግድ ሥርዓት መዛባት፣ የኢራንና የአሜሪካ ጦርነት እንዲሁም በቂ ምግብ አለመመረት ከፍተኛ የዋጋ ጭማሪና የእድገት መገራገጭ ማስከተሉን፣ ሆኖም መንግሥታቸው ሕብረተሰቡ በዋጋ ግሽበትና በኑሮ ውድነት እንዳይጎዳ ነዳጅን ጨምሮ የተለያዩ እርምጃዎችን እየወሰደ እንደሚገኝ ለምክር ቤቱ አብራርተዋል። በዚህ ጉዳይ ላይ ያለዎትን ሐሳብ ይስጡን።',
      question_type: 'text' as const,
      options: [] as string[],
    },
    {
      question_text:
        'ጠ/ሚ ዐቢይ አሕመድ (ዶ/ር) ኢትዮጵያ በኢኮኖሚ ክለሳው (ሪፎርሙ) የተነሳ ዓመታዊ ጥቅል ምርቷ 210 ቢሊዮን ዶላር በመድረስ ከሰብ-ሰሃራ አገራት 3ኛዋ ትልቅ ኢኮኖሚ መሆን መቻሏን ገልጸዋል። ይህን ስኬት በተመለከተ ያለዎትን ሐሳብ ቢያካፍሉን?',
      question_type: 'text' as const,
      options: [] as string[],
    },
    {
      question_text:
        'ጠቅላይ ሚኒስትሩ በአገር ውስጥ ታማኝ ግብር ከፋዮች ጥቂት መሆናቸውን፣ ግብር ከፋዩ በቂ ግብር መክፈል እንዳለበት እንዲሁም ሕገ-ወጥ የዋጋ ጭማሪ የሚያደርጉ ነጋዴዎችን መቆጣጠር አስፈላጊ መሆኑን ለምክር ቤቱ ገልጸዋል። በግብር አከፋፈልና በገበያ ቁጥጥር ዙሪያ ያለዎትን ሐሳብ ይግለጹልን።',
      question_type: 'text' as const,
      options: [] as string[],
    },
    {
      question_text:
        'የሥራ እድልን በተመለከተ ጠቅላይ ሚኒስትር ዐቢይ አሕመድ (ዶ/ር) በኢትዮጵያ በበርካታ አካባቢዎች ሠራተኛ ተፈልጎ የማይገኝባቸው አጋጣሚዎች መኖራቸውንና በአገራችን የሥራ እጦት ሳይሆን ሥራ መራጮች መኖራቸውን ለምክር ቤቱ ጠቁመዋል። የሥራ ዕድልና የሥራ ባህልን በተመለከተ ጠ/ሚ በሰጡት ማብራሪያ ላይ ሐሳብና አስተያየትዎን ያጋሩን።',
      question_type: 'text' as const,
      options: [] as string[],
    },
    {
      question_text:
        'ጠቅላይ ሚኒስትር ዐቢይ አሕመድ (ዶ/ር) ከግራ ከቀኝ ተከፋፍሎ ለሌሎች መሣሪያ ከመሆን ይልቅ በሰላም አገርን ማልማት እንደሚገባና መንግሥት ለማንኛውም ጥቃት ድርብ ዝግጁነትና አቅም እንዳለው ጥሪ አስተላልፈዋል። በሰላም፣ በደኅንነትና በብሔራዊ መግባባት ዙሪያ ጠ/ሚ ለምክር ቤቱ ከሰጡት ሰፊ ማብራሪያ ጋር ተያይዞ አስተያየትዎን በዝርዝር ይስጡን።',
      question_type: 'text' as const,
      options: [] as string[],
    },
    {
      question_text:
        'የባሕር በርን በተመለከተ ጠ/ሚ የአገራችንን የባሕር በር ጥያቄና መብት ማንም ኃይል እንደማያስቆመውና ይህ ጥረትም እንደሚሳካ በንግግራቸው አረጋግጠዋል። ይህን ጉዳይ አስመልክቶ ያለዎትን ተጨማሪ ሐሳብና አስተያየት ቢሰጡን።',
      question_type: 'text' as const,
      options: [] as string[],
    },
  ],
};
