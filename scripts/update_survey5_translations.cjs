const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const translations = {
  om: {
    title: "Gaaffannoo Yaada Ummataa Ijaarsa Mootummaa Haaraa Bulchiinsa Dirree Dawaa (Fulbaana 2019)",
    category: "Siyaasaafi Bulchiinsa",
    description: "1. Seensa: Dhiheenya kana Dirree Dawaattis ta'ee sadarkaa biyyaatti filannoon dimokiraatawaa, iftoomina qabuufi hirmaachisaa ta'e gaggeeffamuun isaa ni beekama. Bu'aa filannichaa hordofeetis ijaarsi mootummaa haaraa adeemsifamaa jira. Haaluma kanaan Caffee Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa gaggeessuun geggeessitoota ol'aanoo adda addaa muudee jira. Kanaafuu, Caffeen haaraafi hoggansi muudame gara fuulduraatti badhaadhina hundagaleessa Dirree Dawaa mirkaneessuuf sochii taasisuufi dhimmoota xiyyeeffannoo argachuu qaban irratti yaadaafi ilaalcha ummataa walitti qabuun barbaachiseera. Kanaafis guddinaafi misooma Dirree Dawaa caalaatti mirkaneessuuf hundi qooda isaa akka gumaachu kan eegamu yoo ta'u, isinis yaadaafi ilaalcha keessan kennuun milkaa'ina imala badhaadhinaatiif gumaacha keessan akka gumaachitan kabajaan isin gaafanna.\n\n2. Kaayyoo Guddaa Gaaffannoo Kanaa: Caffee Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa gaggeessuun muudama geggeessitoota ol'aanoo adda addaa raawwatee jira. Kanaafuu, gaaffannoon kun sochii hundagaleessa Caffeen haaraafi hoggansi fuulduratti badhaadhina Dirree Dawaa mirkaneessuuf taasisaniifi dhimmoota ummata irraa eegaman ilaalchisee kan qophaa'edha.",
    questions: [
      {
        id: 36,
        question_text: "Dhiheenya kana Itoophiyaan filannoo waliigalaa hirmaachisaa, iftoomina qabu, dimokiraatawaafi fudhatamummaa ummataa qabu gaggeessitee jirti. Bu'aa filannichaa hordofeetis ijaarsa mootummaa haaraatiif qophiirra jirti. Kanaafuu, mootummaa sadarkaa federaalaatti ijaaramu irraa abdiiwwan qabdaniifi hojiiwwan gurguddoo eegdan ilaalchisee yaada keessan nuuf qooduu dandeessuu?",
        options: []
      },
      {
        id: 37,
        question_text: "Ijaarsa mootummaa kanaan walqabatee qoodiifi hirmaannaan ummataa maal ta'uu qaba jettanii yaaddu?",
        options: []
      },
      {
        id: 38,
        question_text: "Caffeen Bulchiinsa Dirree Dawaa yaa'ii hundeeffamaa gaggeessuun Af-yaa'ii Caffee dabalatee Kantiibaa bulchiinsichaafi hogganoota dhaabbilee adda addaa muudee jira. Kanaafuu, hogganoota amma gara aangootti dhufan ilaalchisee yaadaafi ilaalcha qabdan nuuf ibsuu dandeessuu?",
        options: []
      },
      {
        id: 39,
        question_text: "Hoggansi haaraan sochiiwwan nagaa, misoomaafi dimokiraasii Dirree Dawaatti eegalamaa jiran sadarkaa ol'aanaatti itti fufsiisuuf maal gochuu qaba jettanii yaaddu? Gama kanaan yaadaafi ilaalcha qabdan nuuf qoodaa?",
        options: []
      },
      {
        id: 40,
        question_text: "Caffeen haaraafi hoggansi fuulduratti badhaadhina hundagaleessa Dirree Dawaa mirkaneessuuf sochii hundagaleessa taasisan irratti eenyu irraa maal eegama dhimmoota jedhan irratti yaadaafi ilaalcha keessan nuuf qoodaa?",
        options: []
      },
      {
        id: 41,
        question_text: "Waggoota dhufan keessatti Dirree Dawaatti kallattiiwwan hundaan hojjetamuu qabu jettanii dhimmoota yaadDaniifi gahee hirmaannaa qooda-fudhattoota adda addaa ilaalchisee yaadaafi ilaalcha dabalataa yoo qabaattan nuuf ibsaa?",
        options: []
      }
    ]
  },
  so: {
    title: "Xog-ururinta Fikirka Dadweynaha ee Ku Saabsan Dhismaha Dawladda Cusub ee Maamulka Diridhaba (Sebtembar 2019)",
    category: "Siyaasadda iyo Maamulka",
    description: "1. Horudhac: Waxaa la wada ogsoon yahay in dhowaan magaalada Diridhaba iyo guud ahaan dalka ay ka qabsoontay doorasho guud oo daahfurnaan, dimuqraadiyad iyo ka-qaybgal buuxa leh. Ka dib natiijadii doorashada, waxaa hadda socda dhismaha dawladda cusub. Xaaladdan oo jirta awgeed, Golaha Maamulka Diridhaba waxa uu qabtay fadhigiisii aasaaska isaga oo magacaabay madax sare oo kala duwan. Sidaa darteed, waxaa lagama maarmaan noqotay in la ururiyo fikradaha iyo aragtiyaha bulshada ee ku saabsan dadaallada ballaaran ee golaha cusub iyo hoggaanka cusub u baahan yihiin si loo xaqiijiyo barwaaqo dhammaystiran iyo arrimaha mudnaanta la siinayo. Si loo xaqiijiyo horumarka iyo barwaaqada Diridhaba, qof kasta waxaa laga filayaa inuu doorkiisa ka qaato; sidaa darteed waxaan si sharaf leh idinkaga codsaneynaa inaad fikradihiinna iyo talooyinkiinna ku biirisaan si guul looga gaaro geeddi-socodka barwaaqada.\n\n2. Ujeeddada Guud ee Xog-ururintan: Golaha Maamulka Diridhaba wuxuu qabtay kulankiisii aasaaska isaga oo meelmariyey magacaabista mas'uuliyiin sare. Sidaa darteed, xog-ururintan waxaa loo diyaariyey in lagu sahamiyo dhaqdhaqaaqyada ballaaran ee hoggaanka cusubi ku horumarinayo Diridhaba iyo waxyaabaha laga filayo bulshada rayidka ah.",
    questions: [
      {
        id: 36,
        question_text: "Dhowaan Itoobiya waxay qabatay doorasho guud oo daahfuran, dimuqraadi ah, dadweynuhuna si buuxda u aqbaleen. Natiijada doorashada kaddib, waxaa socda u diyaar-garowga dhismaha dawlad cusub. Sidaa darteed, maxay yihiin rajooyinka iyo hawlaha ugu waaweyn ee aad ka filaysaan dawladda cusub ee heer federaal lagu dhisayo? Fadlan nala wadaaga fikraddiinna?",
        options: []
      },
      {
        id: 37,
        question_text: "Haddaba dhismaha dawladdan cusub la xiriirta, maxay kula tahay inuu noqdo doorka iyo mas'uuliyadda shacabka?",
        options: []
      },
      {
        id: 38,
        question_text: "Golaha Maamulka Diridhaba wuxuu qabtay fadhigiisii aasaaska isaga oo doortay Afhayeenka Golaha, Duqa Maamulka iyo mas'uuliyiinta hay'adaha kala duwan hoggaamin doona. Sidaa darteed, maxay tahay aragtidaada iyo fikraddaada ku aaddan madaxda cusub ee loo magacaabay xilalka?",
        options: []
      },
      {
        id: 39,
        question_text: "Maxay kula tahay in hoggaanka cusub uu qabto si loo sii xoojiyo dadaallada nabadda, horumarka iyo dimuqraadiyadda ee ka bilowday Diridhaba? Fadlan aragtidaada arrintan ku aaddan nala wadaag?",
        "options": []
      },
      {
        id: 40,
        question_text: "Golaha cusub iyo hoggaankooda si ay u xaqiijiyaan barwaaqada guud ee Diridhaba, maxay yihiin waxyaabaha qof kasta iyo qaybaha bulshada laga filayo? Fadlan aragtidaada ku aaddan nala wadaaga?",
        options: []
      },
      {
        id: 41,
        question_text: "Sanadaha soo socda gudaha Diridhaba, haddii aad hayso talooyin iyo aragtiyo dheeraad ah oo ku saabsan hawlaha ay tahay in dhammaan qaybaha laga qabto iyo doorka daneeyayaasha kala duwan, fadlan noo caddee?",
        options: []
      }
    ]
  },
  en: {
    title: "Public Opinion Survey on the Formation of the New Dire Dawa Government (September 2026 / Meskerem 2019 E.C.)",
    category: "Politics & Governance",
    description: "1. Introduction: It is well known that participatory, transparent, and democratic elections were recently conducted in Dire Dawa and nationwide. Following election results, the formation of the new administration is actively underway. The Dire Dawa Administration Council held its founding assembly and appointed top executive leadership. This survey gathers public feedback and priorities to guide the new council in ensuring comprehensive prosperity for Dire Dawa.\n\n2. Main Objective: To gather citizen input on leadership priorities, civic collaboration, and developmental expectations for the newly formed administration.",
    questions: [
      {
        id: 36,
        question_text: "Following the recent national general elections, what are your major expectations and priorities from the newly forming federal government?",
        options: []
      },
      {
        id: 37,
        question_text: "In connection with this government formation, what should the role and civic contribution of the public be?",
        options: []
      },
      {
        id: 38,
        question_text: "The Dire Dawa Council has appointed the Mayor, Council Speaker, and agency leadership. What are your views and expectations regarding the new leadership team?",
        options: []
      },
      {
        id: 39,
        question_text: "What strategic steps should the new administration take to elevate peace, development, and democratic participation in Dire Dawa?",
        options: []
      },
      {
        id: 40,
        question_text: "To achieve all-inclusive prosperity in Dire Dawa, what specific responsibilities do you expect from different sectors of society and stakeholders?",
        options: []
      },
      {
        id: 41,
        question_text: "What additional insights or recommendations do you have regarding the city's future initiatives and multi-stakeholder collaboration over the coming years?",
        options: []
      }
    ]
  }
};

async function run() {
  try {
    const res = await pool.query(
      'UPDATE surveys SET translations = $1 WHERE id = 5 RETURNING id, title',
      [JSON.stringify(translations)]
    );
    console.log('✅ Survey 5 translations updated successfully:', res.rows[0]);
  } catch (err) {
    console.error('❌ Error updating Survey 5 translations:', err);
  } finally {
    await pool.end();
  }
}

run();
