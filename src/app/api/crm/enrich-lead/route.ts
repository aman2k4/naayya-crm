import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { BUSINESS_TYPE_KEYWORDS } from '@/lib/crm/enrichmentTaxonomy';
import {
  normalizeForComparison,
  standardizeFieldForStorage,
} from '@/lib/crm/enrichmentNormalization';
import {
  validateWebsite,
  validateSocialUrl,
  type WebsiteValidationResult,
  type SocialValidationResult,
} from '@/lib/crm/urlValidation';

const searchFieldsSchema = z.array(z.enum(['studio_name', 'person_name', 'email', 'location', 'current_platform', 'additional_info'])).optional();

const singleRequestSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  leadIds: z.undefined(),
  searchFields: searchFieldsSchema,
});

const bulkRequestSchema = z.object({
  leadIds: z.array(z.string().uuid('Invalid lead ID')).min(1).max(10),
  leadId: z.undefined(),
  searchFields: searchFieldsSchema, // Which fields to use for search (shared across all leads)
});

const requestSchema = z.union([singleRequestSchema, bulkRequestSchema]);

const VALID_LEAD_COLUMNS = new Set([
  'email',
  'first_name',
  'last_name',
  'phone_number',
  'website',
  'current_platform',
  'classes_per_week_estimate',
  'instructors_count_estimate',
  'city',
  'state',
  'country_code',
  'instagram',
  'facebook',
  'business_type',
  'additional_info',
]);

function postProcessFoundData(found: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(found)) {
    const standardized = standardizeFieldForStorage(field, value);
    if (standardized) out[field] = standardized;
  }
  return out;
}

interface LeadRecord {
  id: string;
  email?: string | null;
  studio_name?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  country_code?: string;
  current_platform?: string;
  additional_info?: string;
  [key: string]: unknown;
}

type SearchFieldType = 'studio_name' | 'person_name' | 'email' | 'location' | 'current_platform' | 'additional_info';

function buildEnrichmentPrompt(searchIdentifiers: string[]): string {
  return `Search the web for business information about this fitness/wellness studio or person:

${searchIdentifiers.join('\n')}

Find and return ONLY information you can verify from the web. Return a JSON object with these fields (only include fields you find with confidence):

{
  "email": "IMPORTANT: business contact email. Search the website contact page, footer, about page, Google Maps, Facebook, Yelp. Look for mailto: links or info@/hello@/contact@ patterns",
  "first_name": "owner/contact person first name",
  "last_name": "owner/contact person last name",
  "phone_number": "business phone number in E.164 format (e.g., +14155552671) if possible",
  "website": "official website URL (prefer https://, no tracking query params)",
  "current_platform": "MUST be a single word (no spaces). Known platforms: MindBody, Eversports, Momence, Setmore, Arketa, iSport, Momoyoga, Reservio, Bsport, Glofox, TeamUp, Acuity, MarianaTek, Fittogram, WellnessLiving. NEVER use a different name unless absolutely certain it's not in this list.",
  "classes_per_week_estimate": "INTEGER only. Estimate group classes per week from the public schedule. If uncertain, OMIT.",
  "instructors_count_estimate": "INTEGER only. Estimate instructors/teachers/coaches count from team page and/or schedule. If uncertain, OMIT.",
  "city": "city name",
  "state": "state/province/region (use 2-letter abbreviation for US if known)",
  "country_code": "ISO 3166-1 alpha-2 code (e.g., US, DE, GB)",
  "instagram": "Instagram profile URL",
  "facebook": "Facebook page URL",
  "business_type": "MUST be exactly ONE of: ${BUSINESS_TYPE_KEYWORDS.map((k) => `"${k}"`).join(', ')}",
  "description": "brief description of the business"
}

IMPORTANT:
- EMAIL IS TOP PRIORITY: You MUST actively search for an email address. Check: 1) Website contact/about pages 2) Website footer 3) Google Maps listing 4) Facebook/Instagram bios 5) Yelp/business directories 6) Domain-based guesses like info@domain.com if commonly used
- Only include fields you actually find evidence for
- Return ONLY the JSON object, no other text
- If you cannot find reliable information, return an empty object {}`;
}

function safeExtractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Fast path: already a JSON object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }

  // Common case: wrapped in extra text / code fences
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapAndFilterFoundData(parsed: Record<string, unknown>): Record<string, string> {
  const found: Record<string, string> = {};
  const numericFields = new Set(['classes_per_week_estimate', 'instructors_count_estimate']);

  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) continue;
    const mappedKey = key === 'description' ? 'additional_info' : key;
    if (VALID_LEAD_COLUMNS.has(mappedKey)) {
      if (typeof value === 'string') {
        found[mappedKey] = value;
      } else if (typeof value === 'number' && numericFields.has(mappedKey)) {
        found[mappedKey] = String(Math.trunc(value));
      }
    }
  }

  return postProcessFoundData(found);
}

function computeNewFieldsAndConflicts(
  lead: LeadRecord,
  foundData: Record<string, string>
): {
  newFields: Record<string, string>;
  conflicts: Array<{ field: string; current: string; found: string }>;
} {
  const conflicts: Array<{ field: string; current: string; found: string }> = [];
  const newFields: Record<string, string> = {};

  for (const [field, foundValue] of Object.entries(foundData)) {
    if (!foundValue || typeof foundValue !== 'string') continue;

    const currentValue = lead[field];

    if (currentValue && String(currentValue).trim()) {
      const normalizedCurrent = normalizeForComparison(field, currentValue);
      const normalizedFound = normalizeForComparison(field, foundValue);
      if (normalizedCurrent !== normalizedFound) {
        conflicts.push({
          field,
          current: String(currentValue),
          found: foundValue,
        });
      }
    } else {
      newFields[field] = foundValue;
    }
  }

  return { newFields, conflicts };
}

function filterValidUrls(urls: unknown[]): string[] {
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u !== 'string') continue;
    try {
      const parsed = new URL(u);
      out.push(parsed.toString());
    } catch {
      // ignore
    }
  }
  return out;
}

async function callPerplexity(prompt: string): Promise<{ text: string; citations: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const model = process.env.PERPLEXITY_MODEL || 'sonar-pro';

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            'You are a web research assistant. Follow the user instructions exactly and return only the requested JSON object, with no extra text.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: unknown[];
  };

  const text = json?.choices?.[0]?.message?.content ?? '';
  const citations = filterValidUrls(Array.isArray(json?.citations) ? json.citations : []);
  return { text, citations };
}

interface ProviderResult {
  provider: 'gemini' | 'perplexity';
  found: Record<string, string>;
  newFields: Record<string, string>;
  conflicts: Array<{ field: string; current: string; found: string }>;
  sources: string[];
  rawResponse: string;
  websiteStatus?: WebsiteValidationResult;
  instagramStatus?: SocialValidationResult;
  facebookStatus?: SocialValidationResult;
  error?: string;
}

async function enrichSingleLeadWithProviders(
  supabase: SupabaseClient,
  leadId: string,
  searchFields?: SearchFieldType[]
): Promise<{
  leadId: string;
  success: boolean;
  providers: {
    gemini: ProviderResult;
    perplexity: ProviderResult;
  };
  error?: string;
}> {
  console.log(`🔍 [Enrich] Starting enrichment for lead ${leadId}`);

  // Fetch lead data once
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    console.log(`❌ [Enrich] Lead not found: ${leadId}`);
    return {
      leadId,
      success: false,
      providers: {
        gemini: {
          provider: 'gemini',
          found: {},
          newFields: {},
          conflicts: [],
          sources: [],
          rawResponse: '',
          error: leadError?.message || 'Lead not found',
        },
        perplexity: {
          provider: 'perplexity',
          found: {},
          newFields: {},
          conflicts: [],
          sources: [],
          rawResponse: '',
          error: leadError?.message || 'Lead not found',
        },
      },
      error: leadError?.message || 'Lead not found',
    };
  }

  const typedLead = lead as LeadRecord;
  console.log(`📋 [Enrich] Lead found: ${typedLead.studio_name || typedLead.email || leadId}`);

  // Build search context based on selected fields
  const emailDomain = typedLead.email?.split('@')[1];
  const personName = [typedLead.first_name, typedLead.last_name].filter(Boolean).join(' ');
  const locationHints = [typedLead.city, typedLead.state, typedLead.country_code].filter(Boolean).join(', ');

  const fieldsToUse = searchFields || (['studio_name', 'person_name', 'email', 'location'] as SearchFieldType[]);

  const searchIdentifiers: string[] = [];
  if (fieldsToUse.includes('studio_name') && typedLead.studio_name?.trim()) {
    searchIdentifiers.push(`Business Name: ${typedLead.studio_name}`);
  }
  if (fieldsToUse.includes('person_name') && personName) {
    searchIdentifiers.push(`Contact Person: ${personName}`);
  }
  if (fieldsToUse.includes('email') && typedLead.email?.trim()) {
    searchIdentifiers.push(`Email: ${typedLead.email}`);
    if (emailDomain) searchIdentifiers.push(`Email Domain: ${emailDomain}`);
  }
  if (fieldsToUse.includes('location') && locationHints) {
    searchIdentifiers.push(`Location: ${locationHints}`);
  }
  if (fieldsToUse.includes('current_platform') && typedLead.current_platform?.trim()) {
    searchIdentifiers.push(`Studio using ${typedLead.current_platform} platform`);
  }
  if (fieldsToUse.includes('additional_info') && typedLead.additional_info?.trim()) {
    searchIdentifiers.push(`Additional context about this business: ${typedLead.additional_info}`);
  }
  // Fallback: if no identifiers, use studio name
  if (searchIdentifiers.length === 0) {
    if (typedLead.studio_name?.trim()) {
      searchIdentifiers.push(`Business Name: ${typedLead.studio_name}`);
    }
  }

  console.log(`🔎 [Enrich] Search identifiers:`, searchIdentifiers);
  console.log(`🚀 [Enrich] Starting parallel requests to Gemini and Perplexity...`);

  const prompt = buildEnrichmentPrompt(searchIdentifiers);

  const geminiPromise = (async () => {
    console.log(`🤖 [Enrich/Gemini] Starting Gemini search...`);
    const startTime = Date.now();

    const { text, sources } = await generateText({
      model: google('gemini-2.5-flash'),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      prompt,
    });

    console.log(`🤖 [Enrich/Gemini] Response received in ${Date.now() - startTime}ms`);

    const parsed = safeExtractJsonObject(text);
    console.log(`🤖 [Enrich/Gemini] Raw parsed JSON:`, parsed);
    const found = parsed ? mapAndFilterFoundData(parsed) : {};
    const { newFields, conflicts } = computeNewFieldsAndConflicts(typedLead, found);
    const sourceUrls =
      sources
        ?.map((s) => {
          if ('url' in s && typeof s.url === 'string') return s.url;
          return null;
        })
        .filter((u): u is string => typeof u === 'string') || [];

    console.log(`🤖 [Enrich/Gemini] Found ${Object.keys(found).length} fields:`, Object.keys(found));

    // Validate website if found
    let websiteStatus: WebsiteValidationResult | undefined;
    if (found.website) {
      console.log(`🌐 [Enrich/Gemini] Validating website: ${found.website}`);
      websiteStatus = await validateWebsite(found.website);
      if (websiteStatus.valid) {
        console.log(`✅ [Enrich/Gemini] Website valid (${websiteStatus.status})${websiteStatus.finalUrl ? ` -> ${websiteStatus.finalUrl}` : ''}`);
      } else {
        console.log(`❌ [Enrich/Gemini] Website invalid: ${websiteStatus.error || `status ${websiteStatus.status}`}`);
      }
    }

    // Validate Instagram if found
    let instagramStatus: SocialValidationResult | undefined;
    if (found.instagram) {
      console.log(`📸 [Enrich/Gemini] Validating Instagram: ${found.instagram}`);
      instagramStatus = await validateSocialUrl(found.instagram, 'instagram');
      if (instagramStatus.valid) {
        console.log(`✅ [Enrich/Gemini] Instagram valid`);
      } else {
        console.log(`❌ [Enrich/Gemini] Instagram invalid: ${instagramStatus.error}`);
      }
    }

    // Validate Facebook if found
    let facebookStatus: SocialValidationResult | undefined;
    if (found.facebook) {
      console.log(`📘 [Enrich/Gemini] Validating Facebook: ${found.facebook}`);
      facebookStatus = await validateSocialUrl(found.facebook, 'facebook');
      if (facebookStatus.valid) {
        console.log(`✅ [Enrich/Gemini] Facebook valid`);
      } else {
        console.log(`❌ [Enrich/Gemini] Facebook invalid: ${facebookStatus.error}`);
      }
    }

    return {
      provider: 'gemini' as const,
      found,
      newFields,
      conflicts,
      sources: filterValidUrls(sourceUrls),
      rawResponse: text,
      websiteStatus,
      instagramStatus,
      facebookStatus,
    };
  })();

  const perplexityPromise = (async () => {
    console.log(`🔮 [Enrich/Perplexity] Starting Perplexity search...`);
    const startTime = Date.now();

    const { text, citations } = await callPerplexity(prompt);

    console.log(`🔮 [Enrich/Perplexity] Response received in ${Date.now() - startTime}ms`);

    const parsed = safeExtractJsonObject(text);
    console.log(`🔮 [Enrich/Perplexity] Raw parsed JSON:`, parsed);
    const found = parsed ? mapAndFilterFoundData(parsed) : {};
    const { newFields, conflicts } = computeNewFieldsAndConflicts(typedLead, found);

    console.log(`🔮 [Enrich/Perplexity] Found ${Object.keys(found).length} fields:`, Object.keys(found));

    // Validate website if found
    let websiteStatus: WebsiteValidationResult | undefined;
    if (found.website) {
      console.log(`🌐 [Enrich/Perplexity] Validating website: ${found.website}`);
      websiteStatus = await validateWebsite(found.website);
      if (websiteStatus.valid) {
        console.log(`✅ [Enrich/Perplexity] Website valid (${websiteStatus.status})${websiteStatus.finalUrl ? ` -> ${websiteStatus.finalUrl}` : ''}`);
      } else {
        console.log(`❌ [Enrich/Perplexity] Website invalid: ${websiteStatus.error || `status ${websiteStatus.status}`}`);
      }
    }

    // Validate Instagram if found
    let instagramStatus: SocialValidationResult | undefined;
    if (found.instagram) {
      console.log(`📸 [Enrich/Perplexity] Validating Instagram: ${found.instagram}`);
      instagramStatus = await validateSocialUrl(found.instagram, 'instagram');
      if (instagramStatus.valid) {
        console.log(`✅ [Enrich/Perplexity] Instagram valid`);
      } else {
        console.log(`❌ [Enrich/Perplexity] Instagram invalid: ${instagramStatus.error}`);
      }
    }

    // Validate Facebook if found
    let facebookStatus: SocialValidationResult | undefined;
    if (found.facebook) {
      console.log(`📘 [Enrich/Perplexity] Validating Facebook: ${found.facebook}`);
      facebookStatus = await validateSocialUrl(found.facebook, 'facebook');
      if (facebookStatus.valid) {
        console.log(`✅ [Enrich/Perplexity] Facebook valid`);
      } else {
        console.log(`❌ [Enrich/Perplexity] Facebook invalid: ${facebookStatus.error}`);
      }
    }

    return {
      provider: 'perplexity' as const,
      found,
      newFields,
      conflicts,
      sources: citations,
      rawResponse: text,
      websiteStatus,
      instagramStatus,
      facebookStatus,
    };
  })();

  const [geminiSettled, perplexitySettled] = await Promise.allSettled([geminiPromise, perplexityPromise]);

  const gemini: ProviderResult =
    geminiSettled.status === 'fulfilled'
      ? geminiSettled.value
      : {
          provider: 'gemini' as const,
          found: {},
          newFields: {},
          conflicts: [],
          sources: [],
          rawResponse: '',
          error: geminiSettled.reason instanceof Error ? geminiSettled.reason.message : 'Gemini enrichment failed',
        };

  const perplexity: ProviderResult =
    perplexitySettled.status === 'fulfilled'
      ? perplexitySettled.value
      : {
          provider: 'perplexity' as const,
          found: {},
          newFields: {},
          conflicts: [],
          sources: [],
          rawResponse: '',
          error:
            perplexitySettled.reason instanceof Error ? perplexitySettled.reason.message : 'Perplexity enrichment failed',
        };

  if (geminiSettled.status === 'rejected') {
    console.log(`❌ [Enrich/Gemini] Failed:`, geminiSettled.reason);
  }
  if (perplexitySettled.status === 'rejected') {
    console.log(`❌ [Enrich/Perplexity] Failed:`, perplexitySettled.reason);
  }

  console.log(`✅ [Enrich] Enrichment complete for ${leadId}`);

  return {
    leadId,
    success: true,
    providers: {
      gemini,
      perplexity,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({
        error: 'Configuration error',
        details: 'GOOGLE_GENERATIVE_AI_API_KEY is not configured'
      }, { status: 500 });
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }, { status: 400 });
    }

    const data = validation.data;

    // Handle bulk enrichment
    if ('leadIds' in data && data.leadIds) {
      const { leadIds } = data;

      // Fetch leads first so we can include them in the response
      const { data: leads, error: leadsError } = await supabase
        .from('leads_with_email_count')
        .select('*')
        .in('id', leadIds);

      if (leadsError) {
        return NextResponse.json({
          error: 'Failed to fetch leads',
          details: leadsError.message
        }, { status: 500 });
      }

      const leadsMap = new Map(leads?.map(l => [l.id, l]) || []);

      // Process all leads in parallel with both providers
      const results = await Promise.all(
        leadIds.map(leadId => enrichSingleLeadWithProviders(supabase, leadId, data.searchFields))
      );

      const items = results.map(r => ({
        leadId: r.leadId,
        lead: leadsMap.get(r.leadId),
        success: r.success,
        providers: r.providers,
        error: r.error,
      }));

      const successCount = items.filter(r => r.success).length;

      return NextResponse.json({
        success: true,
        bulk: true,
        items,
        summary: {
          total: leadIds.length,
          successful: successCount,
          failed: leadIds.length - successCount,
        }
      });
    }

    // Handle single lead enrichment (original behavior)
    if ('leadId' in data && data.leadId) {
      const result = await enrichSingleLeadWithProviders(supabase, data.leadId, data.searchFields);

      if (!result.success) {
        return NextResponse.json({
          error: 'Lead not found',
          details: result.error
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          leadId: result.leadId,
          providers: result.providers,
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid request',
      details: 'Either leadId or leadIds must be provided'
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('Error in enrich-lead API:', error);

    if (error instanceof Error && error.message.includes('429')) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        details: 'Please wait a moment before trying again'
      }, { status: 429 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
