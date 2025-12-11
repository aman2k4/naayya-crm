import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { BulkEnrichmentResult } from '@/types/crm';

const searchFieldsSchema = z.array(z.enum(['studio_name', 'person_name', 'email', 'location'])).optional();

const singleRequestSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  leadIds: z.undefined(),
  searchFields: searchFieldsSchema,
});

const bulkRequestSchema = z.object({
  leadIds: z.array(z.string().uuid('Invalid lead ID')).min(1).max(10),
  leadId: z.undefined(),
  autoApply: z.boolean().default(true),
});

const requestSchema = z.union([singleRequestSchema, bulkRequestSchema]);

const VALID_LEAD_COLUMNS = new Set([
  'first_name',
  'last_name',
  'phone_number',
  'website',
  'current_platform',
  'city',
  'state',
  'country_code',
  'instagram',
  'facebook',
  'business_type',
  'additional_info',
]);

interface LeadRecord {
  id: string;
  email: string;
  studio_name: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  country_code?: string;
  [key: string]: unknown;
}

type SearchFieldType = 'studio_name' | 'person_name' | 'email' | 'location';

async function enrichSingleLead(
  supabase: SupabaseClient,
  leadId: string,
  autoApply: boolean = false,
  searchFields?: SearchFieldType[]
): Promise<{
  leadId: string;
  success: boolean;
  found: Record<string, string>;
  newFields: Record<string, string>;
  conflicts: Array<{ field: string; current: string; found: string }>;
  sources: string[];
  rawResponse: string;
  updatedLead?: LeadRecord;
  fieldsUpdated?: string[];
  error?: string;
}> {
  // Fetch lead data
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return {
      leadId,
      success: false,
      found: {},
      newFields: {},
      conflicts: [],
      sources: [],
      rawResponse: '',
      error: leadError?.message || 'Lead not found',
    };
  }

  const typedLead = lead as LeadRecord;

  // Build search context based on selected fields (or use defaults for bulk mode)
  const emailDomain = typedLead.email.split('@')[1];
  const personName = [typedLead.first_name, typedLead.last_name].filter(Boolean).join(' ');
  const locationHints = [typedLead.city, typedLead.state, typedLead.country_code].filter(Boolean).join(', ');

  // Determine which fields to use
  const fieldsToUse = searchFields || ['studio_name', 'person_name', 'email', 'location'] as SearchFieldType[];

  // Build search identifiers based on selected fields
  const searchIdentifiers: string[] = [];
  if (fieldsToUse.includes('studio_name') && typedLead.studio_name?.trim()) {
    searchIdentifiers.push(`Business Name: ${typedLead.studio_name}`);
  }
  if (fieldsToUse.includes('person_name') && personName) {
    searchIdentifiers.push(`Contact Person: ${personName}`);
  }
  if (fieldsToUse.includes('email')) {
    searchIdentifiers.push(`Email: ${typedLead.email}`);
    searchIdentifiers.push(`Email Domain: ${emailDomain}`);
  }
  if (fieldsToUse.includes('location') && locationHints) {
    searchIdentifiers.push(`Location: ${locationHints}`);
  }

  // Fallback: if no identifiers (shouldn't happen), use email
  if (searchIdentifiers.length === 0) {
    searchIdentifiers.push(`Email: ${typedLead.email}`);
  }

  const prompt = `Search the web for business information about this fitness/wellness studio or person:

${searchIdentifiers.join('\n')}

Find and return ONLY information you can verify from the web. Return a JSON object with these fields (only include fields you find with confidence):

{
  "first_name": "owner/contact person first name",
  "last_name": "owner/contact person last name",
  "phone_number": "business phone number with country code",
  "website": "official website URL",
  "current_platform": "their current studio management software (e.g., Mindbody, Momence, Glofox, Walla, Mariana Tek, WellnessLiving, etc.)",
  "city": "city name",
  "state": "state/province/region",
  "country_code": "ISO 3166-1 alpha-2 code (e.g., US, DE, GB)",
  "instagram": "Instagram profile URL",
  "facebook": "Facebook page URL",
  "business_type": "type of business (yoga studio, pilates studio, gym, wellness center, etc.)",
  "description": "brief description of the business"
}

IMPORTANT:
- Only include fields you actually find evidence for
- Return ONLY the JSON object, no other text
- If you cannot find reliable information, return an empty object {}`;

  // Call Gemini with grounded search
  const { text, sources } = await generateText({
    model: google('gemini-2.5-flash'),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt,
  });

  // Parse the response
  let foundData: Record<string, string> = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== 'string') continue;
        const mappedKey = key === 'description' ? 'additional_info' : key;
        if (VALID_LEAD_COLUMNS.has(mappedKey)) {
          foundData[mappedKey] = value;
        }
      }
    }
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', parseError, 'Raw text:', text);
  }

  // Build conflicts array
  const conflicts: Array<{ field: string; current: string; found: string }> = [];
  const newFields: Record<string, string> = {};

  for (const [field, foundValue] of Object.entries(foundData)) {
    if (!foundValue || typeof foundValue !== 'string') continue;

    const currentValue = typedLead[field];

    if (currentValue && String(currentValue).trim()) {
      if (String(currentValue).toLowerCase().trim() !== foundValue.toLowerCase().trim()) {
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

  // Extract source URLs
  const sourceUrls = sources?.map(s => {
    if ('url' in s && typeof s.url === 'string') {
      return s.url;
    }
    return null;
  }).filter((url): url is string => url !== null) || [];

  // Auto-apply if requested (for bulk mode)
  let updatedLead: LeadRecord | undefined;
  let fieldsUpdated: string[] | undefined;

  if (autoApply && (Object.keys(newFields).length > 0 || conflicts.length > 0)) {
    const updateData: Record<string, string> = { ...newFields };
    // Also apply conflicts (overwrite existing values)
    for (const conflict of conflicts) {
      updateData[conflict.field] = conflict.found;
    }

    if (Object.keys(updateData).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Failed to auto-apply enrichment:', updateError);
      } else {
        updatedLead = updated as LeadRecord;
        fieldsUpdated = Object.keys(updateData);
      }
    }
  }

  return {
    leadId,
    success: true,
    found: foundData,
    newFields,
    conflicts,
    sources: sourceUrls,
    rawResponse: text,
    updatedLead,
    fieldsUpdated,
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
      const { leadIds, autoApply = true } = data;

      // Process all leads in parallel
      const results = await Promise.all(
        leadIds.map(leadId => enrichSingleLead(supabase, leadId, autoApply))
      );

      // Transform to BulkEnrichmentResult format
      const bulkResults: BulkEnrichmentResult[] = results.map(r => ({
        leadId: r.leadId,
        success: r.success,
        updatedLead: r.updatedLead as BulkEnrichmentResult['updatedLead'],
        fieldsUpdated: r.fieldsUpdated,
        error: r.error,
      }));

      const successCount = bulkResults.filter(r => r.success).length;
      const updatedCount = bulkResults.filter(r => r.fieldsUpdated && r.fieldsUpdated.length > 0).length;

      return NextResponse.json({
        success: true,
        bulk: true,
        results: bulkResults,
        summary: {
          total: leadIds.length,
          successful: successCount,
          updated: updatedCount,
          failed: leadIds.length - successCount,
        }
      });
    }

    // Handle single lead enrichment (original behavior)
    if ('leadId' in data && data.leadId) {
      const result = await enrichSingleLead(supabase, data.leadId, false, data.searchFields);

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
          found: result.found,
          newFields: result.newFields,
          conflicts: result.conflicts,
          sources: result.sources,
          rawResponse: result.rawResponse,
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
