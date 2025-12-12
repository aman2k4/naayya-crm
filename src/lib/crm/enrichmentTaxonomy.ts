export const BUSINESS_TYPE_KEYWORDS = [
  'Yoga Studio',
  'Pilates Studio',
  'Yoga & Pilates Studio',
  'Barre Studio',
  'HIIT Studio',
  'Spin/Cycling Studio',
  'Strength & Conditioning Studio',
  'CrossFit Gym',
  'Boxing/Kickboxing Studio',
  'Martial Arts Studio',
  'Dance Studio',
  'Gym/Fitness Center',
  'Personal Training Studio',
  'Wellness Center',
  'Physiotherapy/Physical Therapy Clinic',
  'Chiropractic Clinic',
  'Massage/Spa',
  'Other',
] as const;

export type BusinessTypeKeyword = (typeof BUSINESS_TYPE_KEYWORDS)[number];

const includesAny = (haystack: string, needles: string[]): boolean => {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
};

/**
 * Normalizes arbitrary business-type text to one of BUSINESS_TYPE_KEYWORDS.
 * Returns empty string when unsure (so we can omit the field).
 */
export function normalizeBusinessType(input: string | null | undefined): BusinessTypeKeyword | '' {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  // If the model already returned an exact keyword, trust it.
  const exact = BUSINESS_TYPE_KEYWORDS.find((k) => k === raw);
  if (exact) return exact;

  const s = raw.toLowerCase();

  // Special combined category
  const yogaish = includesAny(s, ['yoga', 'hot yoga', 'vinyasa', 'ashtanga', 'iyengar', 'yin']);
  const pilatesish = includesAny(s, ['pilates', 'reformer', 'mat pilates', 'classical pilates']);
  if (yogaish && pilatesish) return 'Yoga & Pilates Studio';

  if (yogaish) return 'Yoga Studio';
  if (pilatesish) return 'Pilates Studio';

  if (includesAny(s, ['barre'])) return 'Barre Studio';
  if (includesAny(s, ['hiit', 'bootcamp', 'interval training', 'circuit training'])) return 'HIIT Studio';
  if (includesAny(s, ['spin', 'cycling', 'cycle studio'])) return 'Spin/Cycling Studio';
  if (includesAny(s, ['strength', 'conditioning', 'functional training', 'performance training'])) {
    return 'Strength & Conditioning Studio';
  }
  if (includesAny(s, ['crossfit'])) return 'CrossFit Gym';
  if (includesAny(s, ['kickboxing', 'boxing', 'muay thai'])) return 'Boxing/Kickboxing Studio';
  if (includesAny(s, ['martial arts', 'karate', 'taekwondo', 'jiu jitsu', 'bjj', 'mma', 'dojo'])) {
    return 'Martial Arts Studio';
  }
  if (includesAny(s, ['dance', 'ballet', 'contemporary', 'hip hop', 'ballroom'])) return 'Dance Studio';
  if (includesAny(s, ['gym', 'fitness center', 'fitness centre', 'health club'])) return 'Gym/Fitness Center';
  if (includesAny(s, ['personal training', 'pt studio', 'trainer studio'])) return 'Personal Training Studio';
  if (includesAny(s, ['wellness', 'holistic', 'wellbeing'])) return 'Wellness Center';
  if (includesAny(s, ['physiotherapy', 'physical therapy', 'physio'])) return 'Physiotherapy/Physical Therapy Clinic';
  if (includesAny(s, ['chiropractic', 'chiro'])) return 'Chiropractic Clinic';
  if (includesAny(s, ['massage', 'spa'])) return 'Massage/Spa';

  // If it's still in the domain, prefer "Other" rather than dropping.
  if (includesAny(s, ['studio', 'fitness', 'wellness'])) return 'Other';

  return '';
}

