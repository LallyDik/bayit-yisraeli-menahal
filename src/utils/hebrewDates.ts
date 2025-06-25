
// Hebrew months in order
export const HEBREW_MONTHS = [
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר',
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'
];

// Hebrew numerals for years
const hebrewNumerals = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
};

// Convert number to Hebrew numerals (simplified)
const toHebrewNumerals = (num: number): string => {
  if (num === 5785) return 'תשפ"ה';
  if (num === 5786) return 'תשפ"ו';
  if (num === 5787) return 'תשפ"ז';
  // Add more years as needed
  return num.toString();
};

// Get current Hebrew month and year
export const getCurrentHebrewDate = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Hebrew year calculation (add ~3761 years, adjusted for Tishrei start)
  const hebrewYear = currentMonth >= 8 ? currentYear + 3761 : currentYear + 3760;
  
  // Map Gregorian months to Hebrew months (approximate)
  const monthMapping = [
    4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3 // Jan=Tevet(7), etc.
  ];
  
  const hebrewMonthIndex = monthMapping[currentMonth];
  
  return {
    month: HEBREW_MONTHS[hebrewMonthIndex],
    year: toHebrewNumerals(hebrewYear),
    monthIndex: hebrewMonthIndex
  };
};

export const getPaymentTypeLabel = (type: string): string => {
  const labels = {
    rent: 'שכירות',
    electricity: 'חשמל',
    water: 'מים',
    committee: 'ועד בית',
    gas: 'גז'
  };
  return labels[type as keyof typeof labels] || type;
};
