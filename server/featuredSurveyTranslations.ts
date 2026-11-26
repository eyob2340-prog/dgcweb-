// Afaan Oromoo and Soomaali versions of the featured questionnaire.
// Questions are listed in the same order as FEATURED_SURVEY.questions; the server maps them
// to the real question IDs when it stores them in surveys.translations.

export const FEATURED_SURVEY_TRANSLATIONS: Record<
  'om' | 'so',
  { title: string; description: string; category: string; questions: string[] }
> = {
  om: {
    title:
      "Yaada Uummataa — Deebii fi Ibsa Ministira Muummee Dr. Abiy Ahmed Mana Maree Bakka Bu'oota Uummataatti (Sadaasa 17, 2019 A.L.I.)",
    description:
      "Gaaffannoon kun deebii fi ibsa Ministirri Muummee Dr. Abiy Ahmed walgahii idilee 4ffaa bara hojii 1ffaa Mana Maree Bakka Bu'oota Uummataa (Sadaasa 17, 2019 A.L.I.) irratti gaaffilee miseensota mana marichaa irraa ka'aniif kennan bu'uureffachuun yaada uummataa walitti qabuu fi xiinxaluuf qophaa'e. Mee gaaffii tokkoon tokkoon isaatiif yaada keessan bakka kenname irratti barreessaa.",
    category: 'Poliitikaa fi Dinagdee',
    questions: [
      "Ministirri Muummee Dr. Abiy Ahmed jeequmsi sirna daldalaa, waraanni Iraan fi Ameerikaa, akkasumas omishni nyaataa gahaa ta'uu dhabuun dabalaa gatii olaanaa fi gufuu guddina dinagdee fiduu isaa mana mareef ibsaniiru. Haa ta'u malee, mootummaan isaanii uummanni dhiibbaa gatii dabaluu fi qaala'iinsa jireenyaatiin akka hin miidhamneef boba'aa dabalatee tarkaanfiiwwan adda addaa fudhachaa jiraachuu ibsaniiru. Dhimma kana irratti yaada qabdan nuuf kennaa.",
      "Ministirri Muummee Dr. Abiy Ahmed, sababa fooyya'iinsa (riifoormii) dinagdeetiin omishni waliigalaa waggaa Itoophiyaa doolaara biiliyoona 210 gahuun, biyyoota Gammoojjii Sahaaraa Gadii keessaa dinagdee guddaa 3ffaa ta'uu danda'uu ishee ibsaniiru. Milkaa'ina kana ilaalchisee yaada qabdan nuuf qooddu?",
      "Ministirri Muummee biyya keessatti kaffaltoonni gibiraa amanamoo ta'an muraasa ta'uu isaanii, kaffalaan gibiraa gibira gahaa kaffaluu akka qabu, akkasumas daldaltoota gatii seeraan ala dabalan to'achuun barbaachisaa ta'uu isaa mana mareef ibsaniiru. Kaffaltii gibiraa fi to'annoo gabaa irratti yaada qabdan nuuf ibsaa.",
      "Carraa hojii ilaalchisee, Ministirri Muummee Dr. Abiy Ahmed naannolee hedduu Itoophiyaa keessatti yeroon hojjetaan barbaadamee hin argamne akka jiru, akkasumas biyya keenya keessatti rakkoon hojii dhabuu osoo hin taane hojii filachuun akka jiru mana mareef akeekaniiru. Carraa hojii fi aadaa hojii ilaalchisee ibsa Ministirri Muummee kennan irratti yaada keessan nuuf qoodaa.",
      "Ministirri Muummee Dr. Abiy Ahmed garee lamatti qoodamanii warra biroof meeshaa ta'uu mannaa nagaan biyya misoomsuun akka barbaachisu, akkasumas mootummaan haleellaa kamiifuu qophii fi dandeettii dachaa akka qabu waamicha dabarsaniiru. Ibsa bal'aa Ministirri Muummee nagaa, nageenyaa fi waliigaltee biyyoolessaa irratti mana mareef kennan wajjin walqabatee yaada keessan bal'inaan nuuf kennaa.",
      "Karra galaanaa ilaalchisee, Ministirri Muummee gaaffii fi mirga karra galaanaa biyya keenyaa humni kamiyyuu akka hin dhaabne, carraaqqiin kunis akka milkaa'u haasaa isaanii keessatti mirkaneessaniiru. Dhimma kana ilaalchisee yaada fi ilaalcha dabalataa qabdan nuuf kennaa.",
    ],
  },
  so: {
    title:
      "Ra'yiga Dadweynaha — Jawaabaha iyo Sharraxaadda Ra'iisul Wasaare Dr. Abiy Ahmed ee Golaha Wakiilada Shacabka (17 Hidar 2019, Taariikhda Itoobiya)",
    description:
      "Sahankan waxaa loo diyaariyay in lagu ururiyo laguna falanqeeyo ra'yiga dadweynaha, iyadoo lagu salaynayo jawaabaha iyo sharraxaadda uu Ra'iisul Wasaare Dr. Abiy Ahmed ka bixiyay su'aalaha xubnaha Golaha Wakiilada Shacabka, kalfadhiga caadiga ah ee 4aad ee sannadka 1aad ee shaqada (17 Hidar 2019, Taariikhda Itoobiya). Fadlan su'aal kasta fikraddaada ku qor meesha loo qoondeeyay.",
    category: 'Siyaasadda iyo Dhaqaalaha',
    questions: [
      "Ra'iisul Wasaare Dr. Abiy Ahmed wuxuu Golaha u sharraxay in khalkhalka nidaamka ganacsiga, dagaalka Iiraan iyo Maraykanka, iyo wax-soo-saarka cuntada oo aan ku filnayn ay keeneen sicir-kac weyn iyo hoos u dhac ku yimid koboca dhaqaalaha. Si kastaba ha ahaatee, wuxuu sheegay in dowladdiisu ay qaadayso tallaabooyin kala duwan, oo ay ku jiraan shidaalka, si bulshadu aysan u waxyeelloobin sicir-bararka iyo qaalinimada nolosha. Fadlan noo sheeg fikraddaada arrintan.",
      "Ra'iisul Wasaare Dr. Abiy Ahmed wuxuu sheegay in, natiijada dib-u-habaynta dhaqaalaha, wax-soo-saarka guud ee sannadlaha ah ee Itoobiya uu gaaray 210 bilyan oo doolar, ayna noqotay dhaqaalaha 3aad ee ugu weyn waddamada Saxaraha ka hooseeya. Ma nala wadaagi kartaa fikraddaada ku saabsan guushan?",
      "Ra'iisul Wasaaruhu wuxuu Golaha u sheegay in canshuur-bixiyeyaasha daacadda ah ee dalka gudihiisa ay yar yihiin, in canshuur-bixiyuhu uu bixiyo canshuur ku filan, iyo in loo baahan yahay in la xakameeyo ganacsatada sharci-darrada ku kordhiya qiimaha. Fadlan noo sheeg fikraddaada ku saabsan bixinta canshuurta iyo xakamaynta suuqa.",
      "Ku saabsan fursadaha shaqo, Ra'iisul Wasaare Dr. Abiy Ahmed wuxuu Golaha u tilmaamay in meelo badan oo Itoobiya ah ay jiraan xaalado shaqaale la raadiyo oo aan la helin, iyo in dalkeena dhibaatadu aysan ahayn shaqo la'aan balse ay jiraan dad shaqo kala dooranaya. Fadlan nala wadaag fikraddaada ku saabsan sharraxaadda Ra'iisul Wasaaraha ee fursadaha shaqo iyo dhaqanka shaqada.",
      "Ra'iisul Wasaare Dr. Abiy Ahmed wuxuu ugu baaqay in halkii loo kala qaybsami lahaa oo loo noqon lahaa qalab ay kuwo kale adeegsadaan, dalka lagu horumariyo nabad, isagoo sheegay in dowladdu ay leedahay diyaar-garow iyo awood laban jibaaran oo ay kaga hortagto weerar kasta. Iyadoo la tixraacayo sharraxaadda ballaaran ee Ra'iisul Wasaaruhu Golaha ka siiyay nabadda, amniga iyo is-afgaradka qaranka, fadlan si faahfaahsan noogu sheeg fikraddaada.",
      "Ku saabsan marin-badeedka, Ra'iisul Wasaaruhu wuxuu khudbadiisa ku xaqiijiyay in codsiga iyo xuquuqda dalkeena ee marin-badeed aysan jirin awood joojin karta, iyo in dadaalkani uu guulaysan doono. Fadlan noo sheeg fikrad kasta oo dheeraad ah oo aad ka qabto arrintan.",
    ],
  },
};

/** Build the surveys.translations JSON using the real question IDs (same order as FEATURED_SURVEY.questions). */
export function buildFeaturedTranslations(questionIds: number[]) {
  const out: Record<string, any> = {};
  for (const lang of ['om', 'so'] as const) {
    const t = FEATURED_SURVEY_TRANSLATIONS[lang];
    out[lang] = {
      title: t.title,
      description: t.description,
      category: t.category,
      questions: t.questions.map((text, i) => ({ id: questionIds[i], question_text: text, options: [] })),
    };
  }
  return out;
}
