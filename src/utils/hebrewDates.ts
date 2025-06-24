
// Hebrew months in order
export const HEBREW_MONTHS = [
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר',
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'
];

// Get current Hebrew month and year (simplified - in real app would use Hebrew calendar library)
export const getCurrentHebrewDate = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Simplified Hebrew year calculation (add ~3760 years)
  const hebrewYear = (currentYear + 3761).toString();
  
  // Map Gregorian months to Hebrew months (approximate)
  const monthMapping = [
    'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר',
    'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'
  ];
  
  return {
    month: monthMapping[currentMonth],
    year: hebrewYear
  };
};

export const getPaymentTypeLabel = (type: string): string => {
  const labels = {
    rent: 'שכירות',
    electricity: 'חשמל',
    water: 'מים',
    committee: 'ועד בית'
  };
  return labels[type as keyof typeof labels] || type;
};
