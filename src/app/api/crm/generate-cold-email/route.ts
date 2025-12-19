import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { z } from 'zod';
import { AI_MODELS } from '@/lib/crm/aiModelsConfig';
import { isSocialUrlValid } from '@/lib/crm/urlValidation';

const requestSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
});

function safeExtractJsonObject(text: string): { subject?: string; body?: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Fast path: already a JSON object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  // Common case: wrapped in extra text / code fences
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Global admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { leadId } = validation.data;

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({
        error: 'Lead not found',
        details: leadError?.message || 'Lead not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build context object with only the fields that have values
    const leadContext: Record<string, string | number> = {};

    if (lead.first_name) leadContext.first_name = lead.first_name;
    if (lead.last_name) leadContext.last_name = lead.last_name;
    if (lead.studio_name) leadContext.studio_name = lead.studio_name;
    if (lead.email) leadContext.email = lead.email;
    if (lead.city) leadContext.city = lead.city;
    if (lead.state) leadContext.state = lead.state;
    if (lead.country_code) leadContext.country_code = lead.country_code;
    if (lead.current_platform) leadContext.current_platform = lead.current_platform;
    if (lead.business_type) leadContext.business_type = lead.business_type;
    if (lead.website) leadContext.website = lead.website;
    if (lead.classes_per_week_estimate) leadContext.classes_per_week_estimate = lead.classes_per_week_estimate;
    if (lead.instructors_count_estimate) leadContext.instructors_count_estimate = lead.instructors_count_estimate;
    if (lead.additional_info) leadContext.additional_info = lead.additional_info;
    if (lead.notes) leadContext.notes = lead.notes;

    // Validate Instagram and Facebook URLs before including them
    // Run validations in parallel
    const [instagramValid, facebookValid] = await Promise.all([
      lead.instagram ? isSocialUrlValid(lead.instagram, 'instagram') : Promise.resolve(false),
      lead.facebook ? isSocialUrlValid(lead.facebook, 'facebook') : Promise.resolve(false),
    ]);

    if (lead.instagram && instagramValid) {
      leadContext.instagram = lead.instagram;
    }
    if (lead.facebook && facebookValid) {
      leadContext.facebook = lead.facebook;
    }

    // Currency mapping by country code for context
    const CURRENCY_MAP: Record<string, { symbol: string; avgRevenuePerClass: number; nayyaProMonthly: number }> = {
      US: { symbol: '$', avgRevenuePerClass: 35, nayyaProMonthly: 200 },
      AU: { symbol: 'A$', avgRevenuePerClass: 40, nayyaProMonthly: 300 },
      CA: { symbol: 'C$', avgRevenuePerClass: 35, nayyaProMonthly: 270 },
      NZ: { symbol: 'NZ$', avgRevenuePerClass: 35, nayyaProMonthly: 320 },
      SG: { symbol: 'S$', avgRevenuePerClass: 40, nayyaProMonthly: 270 },
      HK: { symbol: 'HK$', avgRevenuePerClass: 300, nayyaProMonthly: 1560 },
      GB: { symbol: '£', avgRevenuePerClass: 25, nayyaProMonthly: 160 },
      DE: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      FR: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      IT: { symbol: '€', avgRevenuePerClass: 25, nayyaProMonthly: 200 },
      ES: { symbol: '€', avgRevenuePerClass: 25, nayyaProMonthly: 200 },
      NL: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      BE: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      AT: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      IE: { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 },
      PT: { symbol: '€', avgRevenuePerClass: 20, nayyaProMonthly: 200 },
      LU: { symbol: '€', avgRevenuePerClass: 35, nayyaProMonthly: 200 },
      CH: { symbol: 'CHF', avgRevenuePerClass: 40, nayyaProMonthly: 220 },
      JP: { symbol: '¥', avgRevenuePerClass: 3500, nayyaProMonthly: 30000 },
      IN: { symbol: '₹', avgRevenuePerClass: 800, nayyaProMonthly: 5000 },
    };

    const countryCode = (leadContext.country_code as string) || '';
    const currencyConfig = CURRENCY_MAP[countryCode] || { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 };
    const currency = currencyConfig.symbol;
    const avgRevenuePerClass = currencyConfig.avgRevenuePerClass;
    const nayyaProMonthly = currencyConfig.nayyaProMonthly;

    const classesPerWeek = (leadContext.classes_per_week_estimate as number) || 10;
    const instructors = (leadContext.instructors_count_estimate as number) || 0;

    // Calculate potential value proposition
    // Assume ~10 participants per class on average for revenue calculation
    const avgParticipantsPerClass = 10;
    const revenuePerClass = avgRevenuePerClass * avgParticipantsPerClass;
    const weeklyRevenue = classesPerWeek * revenuePerClass;
    const monthlyRevenue = Math.round(weeklyRevenue * 4.3);

    // Transaction fee savings: MindBody/competitors charge ~4%, Naayya charges 2.5% = 1.5% savings
    const transactionFeeSavingsMonthly = Math.round(monthlyRevenue * 0.015);
    const netMonthlySavings = transactionFeeSavingsMonthly - nayyaProMonthly;
    const netYearlySavings = netMonthlySavings * 12;

    // Build prompt with lead context - optimized for email deliverability
    const prompt = `You are Sally Grüneisen, co-founder of Naayya. You ran a yoga studio for 7 years before building booking software. You write emails like you'd text a fellow studio owner - curious, direct, no bullshit.

LEAD:
${JSON.stringify(leadContext, null, 2)}

${instructors ? `(Instructor count ~${instructors} is an estimate - don't state as fact)` : ''}
${leadContext.classes_per_week_estimate ? `(Class count ~${classesPerWeek}/week is an estimate - don't state as fact)` : ''}

SCALE: ${(() => {
  const size = instructors || 0;
  const classes = classesPerWeek || 0;
  if (size >= 8 || classes >= 40) return `Larger operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''})`;
  if (size >= 4 || classes >= 20) return `Medium operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''})`;
  return `Smaller operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''})`;
})()}

NUMBERS YOU CAN USE:
- Transaction fee savings: ~${currency}${transactionFeeSavingsMonthly}/month (~${currency}${transactionFeeSavingsMonthly * 12}/year) compared to ${leadContext.current_platform || 'typical platforms'}
- They currently use ${leadContext.current_platform || 'a booking platform'}

OFFER:
- Naayya Pro free for a year (worth ${currency}${nayyaProMonthly * 12})
- Mention the value when offering the free year
- Do NOT mention monthly pricing - only the free year offer and its value

STRUCTURE:
1. Greeting (Hi ${leadContext.first_name || '[name]'},)
2. Brief context - why you're reaching out (fellow studio owner, noticed they use X, came across their studio)
3. The value or point
4. Soft close
5. Signature

TONE:
- One specific detail max, or none if nothing stands out
- No gushing (avoid: amazing, incredible, love what you're doing)
- Direct, not wishy-washy (avoid: not sure if, might be relevant)
- Soft, human close - not salesy (avoid: Worth a look?, Worth a chat?, Open to seeing if it's a fit?)
- 3-5 sentences max

DELIVERABILITY:
- No links in body, only in signature
- No emdashes (-), use hyphens
- Plain text only

SIGNATURE (exactly this):
Sally Grüneisen
Co-founder, Naayya
<a href="https://naayya.com">naayya.com</a>

Return JSON only: { "subject": "...", "body": "..." }
Subject: 3-6 words, hint at value or spark curiosity
Body: Plain text, use \\n for line breaks`;

    // Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Configuration error',
        details: 'OPENROUTER_API_KEY is not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize OpenRouter provider for Vercel AI SDK
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Create a readable stream that sends results as each model completes
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial context
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'context', data: leadContext })}\n\n`));

        // Run all models in parallel, streaming each result as it completes
        const modelPromises = AI_MODELS.map(async (modelConfig) => {
          const startTime = Date.now();

          try {
            const response = streamText({
              model: openrouter(modelConfig.modelId),
              prompt,
            });

            // Consume the full response
            const text = await response.text;
            const duration = Date.now() - startTime;

            const parsed = safeExtractJsonObject(text);

            if (!parsed || !parsed.subject || !parsed.body) {
              const result = {
                type: 'result',
                data: {
                  modelId: modelConfig.id,
                  modelName: modelConfig.name,
                  success: false,
                  error: 'Failed to parse response',
                  duration,
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
              return;
            }

            const result = {
              type: 'result',
              data: {
                modelId: modelConfig.id,
                modelName: modelConfig.name,
                success: true,
                subject: parsed.subject,
                body: parsed.body,
                duration,
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
          } catch (err) {
            const result = {
              type: 'result',
              data: {
                modelId: modelConfig.id,
                modelName: modelConfig.name,
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                duration: Date.now() - startTime,
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
          }
        });

        // Wait for all models to complete
        await Promise.all(modelPromises);

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('Error in generate-cold-email API:', error);

    if (error instanceof Error && error.message.includes('429')) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        details: 'Please wait a moment before trying again'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
