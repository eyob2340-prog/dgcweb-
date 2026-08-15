// Ethiopian Calendar Helper Utility (የሐበሻ ቀን አቆጣጠር)

const AMHARIC_MONTHS = [
  'መስከረም',
  'ጥቅምት',
  'ህዳር',
  'ታህሳስ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜ',
];

const OROMOO_MONTHS = [
  'Fuulbaana',
  'Onkololeessa',
  'Sadaasa',
  'Muddee',
  'Amajjii',
  'Gurraandhala',
  'Bitootessa',
  'Elba',
  'Caamsaa',
  'Waxabajjii',
  'Adooleessa',
  'Hagayya',
  'Qaammee',
];

const TIGRINYA_MONTHS = [
  'መስከረም',
  'ጥቅምቲ',
  'ሕዳር',
  'ታሕሳስ',
  'ጥሪ',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰነ',
  'ሓምለ',
  'ነሐሰ',
  'ጳጉሜን',
];

export function toEthiopianDate(gregorianDate: Date | string = new Date()): {
  year: number;
  month: number;
  day: number;
  monthNameAmharic: string;
  formattedAmharic: string;
} {
  const date = typeof gregorianDate === 'string' ? new Date(gregorianDate) : gregorianDate;
  if (isNaN(date.getTime())) {
    return {
      year: 2018,
      month: 12,
      day: 5,
      monthNameAmharic: 'ነሐሴ',
      formattedAmharic: 'ነሐሴ 5 ቀን 2018 ዓ.ም.',
    };
  }

  const gy = date.getFullYear();
  const gm = date.getMonth(); // 0-indexed
  const gd = date.getDate();

  // Approximate Ethiopian Year
  let ey = gy - 8;
  if (gm > 8 || (gm === 8 && gd >= 11)) {
    ey = gy - 7;
  }

  // Calculate new year start (Sept 11 or Sept 12)
  const isGregorianLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const newYearDay = isGregorianLeap ? 12 : 11;

  // Days count from Sept 11
  const startOfEthYear = new Date(gy - (gm < 8 || (gm === 8 && gd < newYearDay) ? 1 : 0), 8, newYearDay);
  const diffTime = Math.abs(date.getTime() - startOfEthYear.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let em = Math.floor(diffDays / 30) + 1;
  let ed = (diffDays % 30) + 1;

  if (em > 13) {
    em = 13;
  }

  const monthNameAmharic = AMHARIC_MONTHS[em - 1] || 'ነሐሴ';
  const formattedAmharic = `${monthNameAmharic} ${ed} ቀን ${ey} ዓ.ም.`;

  return {
    year: ey,
    month: em,
    day: ed,
    monthNameAmharic,
    formattedAmharic,
  };
}

export function formatEthiopianDate(gregorianDate?: Date | string | null): string {
  if (!gregorianDate) return 'ነሐሴ 5 ቀን 2018 ዓ.ም.';
  return toEthiopianDate(gregorianDate).formattedAmharic;
}

export function formatEthiopianDateTime(gregorianDate?: Date | string | null): string {
  if (!gregorianDate) return 'ነሐሴ 5 ቀን 2018 ዓ.ም.';
  const d = typeof gregorianDate === 'string' ? new Date(gregorianDate) : gregorianDate;
  const eth = toEthiopianDate(d);
  const timeStr = !isNaN(d.getTime())
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return timeStr ? `${eth.formattedAmharic} (${timeStr})` : eth.formattedAmharic;
}
