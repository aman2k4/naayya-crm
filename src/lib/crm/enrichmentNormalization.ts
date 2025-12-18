import { normalizeBusinessType } from '@/lib/crm/enrichmentTaxonomy';

function standardizePhoneNumber(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  // Convert 00 prefix to +
  const withPlus = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;

  const hasPlus = withPlus.trim().startsWith('+');
  const digits = withPlus.replace(/[^\d]/g, '');
  if (!digits) return '';

  return (hasPlus ? '+' : '') + digits;
}

function standardizeWebsite(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  let s = raw;
  // If missing scheme, add https:// so URL parsing works.
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  try {
    const u = new URL(s);
    // drop query/hash for canonical website
    u.hash = '';
    u.search = '';
    // drop trailing slash
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    // normalize host casing + www
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');

    // If path is just '/', keep it but don't show trailing slash in storage
    const asString = u.toString();
    return asString.endsWith('/') ? asString.slice(0, -1) : asString;
  } catch {
    // fallback to trimmed raw
    return raw;
  }
}

function standardizeCountryCode(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  return raw.toUpperCase();
}

const US_STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

function standardizeState(input: string | null | undefined): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();

  const key = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return US_STATE_NAME_TO_ABBR[key] || raw;
}

export function standardizeFieldForStorage(field: string, value: string): string {
  const v = value.trim();
  if (!v) return '';

  if (field === 'classes_per_week_estimate' || field === 'instructors_count_estimate') {
    const digits = v.replace(/[^\d]/g, '');
    return digits ? String(parseInt(digits, 10)) : '';
  }

  if (field === 'phone_number') return standardizePhoneNumber(v);
  if (field === 'website') return standardizeWebsite(v);
  if (field === 'country_code') return standardizeCountryCode(v);
  if (field === 'state') return standardizeState(v);
  if (field === 'business_type') return normalizeBusinessType(v) || '';

  return v;
}

/**
 * Normalization used for comparisons/diffing (provider vs provider, provider vs current).
 */
export function normalizeForComparison(field: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (field === 'classes_per_week_estimate' || field === 'instructors_count_estimate') {
    // Compare as integer (digits only)
    return raw.replace(/[^\d]/g, '');
  }

  if (field === 'phone_number') {
    // Compare by digits only (ignore formatting / leading +)
    return raw.replace(/[^\d]/g, '');
  }

  if (field === 'website') {
    // Compare ignoring protocol, www, trailing slash, query, hash
    let s = raw.toLowerCase();
    s = s.replace(/^https?:\/\//, '');
    s = s.replace(/^www\./, '');
    s = s.split('#')[0].split('?')[0];
    s = s.replace(/\/+$/, '');
    return s;
  }

  if (field === 'country_code') return raw.toUpperCase();
  if (field === 'state') return raw.toUpperCase().replace(/\./g, '').trim();
  if (field === 'business_type') return (normalizeBusinessType(raw) || raw).toLowerCase();

  return raw.toLowerCase();
}

