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

    // Calculate potential value (for AI context, not to be stated directly)
    const weeklyRevenue = classesPerWeek * avgRevenuePerClass;
    const monthlyRevenue = Math.round(weeklyRevenue * 4.3);
    const yearlyRevenue = monthlyRevenue * 12;
    const transactionFeeSavingsYearly = Math.round(yearlyRevenue * 0.02);
    const nayyaProSavings = nayyaProMonthly * 12;
    const totalYearlySavings = transactionFeeSavingsYearly + nayyaProSavings;
    const roundedSavings = Math.round(totalYearlySavings / 500) * 500;

    // Build what Sally researched based on available data
    const researchedItems: string[] = [];
    if (leadContext.website) researchedItems.push('their website');
    if (leadContext.instagram) researchedItems.push('their Instagram');
    if (leadContext.facebook) researchedItems.push('their Facebook');
    if (leadContext.current_platform) researchedItems.push(`noticed they use ${leadContext.current_platform}`);

    const researchSummary = researchedItems.length > 0
      ? `You checked out ${researchedItems.slice(0, -1).join(', ')}${researchedItems.length > 1 ? ' and ' : ''}${researchedItems[researchedItems.length - 1]}.`
      : 'You looked into their studio.';

    // Build prompt with lead context - optimized for email deliverability
    const prompt = `You are Sally Grüneisen, co-founder of Naayya, writing a warm personal email to a studio owner.

${researchSummary}

LEAD DATA:
${JSON.stringify(leadContext, null, 2)}

---

WHO YOU'RE WRITING TO:
These are health & wellness studio owners - yoga, pilates, fitness, dance, etc. They're warm, community-oriented people who care deeply about their students and their craft. They're NOT tech people. Write like you're reaching out to a fellow studio owner you admire, not like a business email. Be genuinely friendly and human.

TONE:
- Warm and personable, like messaging a friend
- Genuinely enthusiastic when you notice something you like about their studio
- Conversational, not corporate or salesy
- Brief but not cold - every word counts, but don't sound robotic
- Think: friendly text message, not LinkedIn pitch

---

PERSONALIZATION - USE THESE TO SHOW YOU DID YOUR HOMEWORK:

${leadContext.website ? `WEBSITE: You visited ${leadContext.website} - mention something you genuinely liked (their class variety, the vibe, how they describe their community, etc.)` : ''}
${leadContext.instagram || leadContext.facebook ? `SOCIALS: You scrolled their ${[leadContext.instagram ? 'Instagram' : '', leadContext.facebook ? 'Facebook' : ''].filter(Boolean).join(' and ')} - maybe you loved their community posts, saw a cool class, noticed their energy. Say "checked out your Instagram" or "love what you're sharing" naturally.` : ''}
${leadContext.current_platform ? `CURRENT PLATFORM: They use ${leadContext.current_platform} - you can mention you noticed this and gently hint there might be something better suited for them.` : ''}
${leadContext.classes_per_week_estimate ? `CLASS VOLUME: ~${classesPerWeek} classes/week - USE THIS! Say something like "looks like you're running around ${classesPerWeek} classes a week" - shows you actually looked into their studio.` : ''}
${instructors ? `TEAM SIZE: ${instructors} instructors - great detail to weave in, shows you understand their scale.` : ''}
${leadContext.city ? `LOCATION: ${leadContext.city}${leadContext.state ? `, ${leadContext.state}` : ''}${leadContext.country_code ? ` (${leadContext.country_code})` : ''} - can mention their city warmly.` : ''}
${leadContext.business_type ? `BUSINESS TYPE: ${leadContext.business_type} - tailor your language to their specific world (yoga vs pilates vs fitness, etc.)` : ''}
${leadContext.additional_info ? `EXTRA NOTES: ${leadContext.additional_info}` : ''}

BACK-OF-ENVELOPE VALUE (know this, hint at it warmly):
- With ~${classesPerWeek} classes/week${instructors ? ` and ${instructors} instructors` : ''}, they could benefit meaningfully
- Potential first-year value: ~${currency}${roundedSavings.toLocaleString()} (lower fees + included features)
- ${leadContext.current_platform ? `${leadContext.current_platform} typically charges more than Naayya` : 'Most platforms charge 4-5% vs Naayya at 2.5%'}

HOW TO HINT AT VALUE (without sounding like spam):
- "with ${classesPerWeek} classes a week, those platform fees really add up"
- "for a studio your size, switching could make a real difference"
- "we've helped studios like yours keep more of what they earn"
- Let them be curious - specifics come in the reply

SALLY'S STORY (use naturally if it fits):
- Ran her own yoga studio for 7 years - she gets it
- Built Naayya because she was frustrated with the tools out there

---

DELIVERABILITY (critical for inbox, not promotions):

1. ONE LINK - signature only. No links in body.

2. AVOID these spam triggers:
   "save [amount]", "free", "offer", "discount", "guarantee", "limited time",
   "act now", "special", "exclusive", "no cost", "click here", "opportunity"

3. LENGTH: 3-4 warm sentences, then signature. Short but not cold.

4. GOAL: Start a conversation. Spark curiosity. Get a reply.

5. PLAIN TEXT: No formatting, bullets, or bold. Just natural writing.

---

STRUCTURE:

Sentence 1: Show you actually looked at their studio - be specific and warm
- Mention their name, something from their site/socials, class count, location
- Sound genuinely interested, not like you're checking boxes

Sentence 2: Why you're reaching out - connect to value without numbers
- Bridge from what you noticed to how Naayya might help
- Keep it conversational

Sentence 3: Friendly, low-pressure invitation to chat
- Make it easy to say yes

Signature:
Sally Grüneisen
Co-founder, <a href="https://naayya.com">Naayya</a>

---

GOOD EXAMPLES (warm, personal, brief):

"Hey! Was checking out ${leadContext.studio_name || '[studio]'} - love what you're doing${leadContext.classes_per_week_estimate ? `, and ${classesPerWeek} classes a week is no joke` : ''}. I ran a studio for years before building Naayya, and I think it could be a really good fit for you. Would you be up for a quick look?"

"Came across your ${leadContext.instagram ? 'Instagram' : 'studio'} and had to reach out - ${leadContext.city ? `love seeing studios like yours in ${leadContext.city}` : 'really like what you\'re building'}. We made Naayya specifically for studios like yours, and I'd love to show you around if you're curious!"

"Hi ${leadContext.first_name || 'there'}! Noticed you're ${leadContext.current_platform ? `on ${leadContext.current_platform}` : 'running a beautiful studio'}${leadContext.classes_per_week_estimate ? ` with around ${classesPerWeek} classes a week` : ''}. There might be a simpler (and more affordable) way - happy to share more if you're interested?"

BAD EXAMPLES (avoid):
- "Save ${currency}2,500+ this year!" (spam trigger)
- "I'm offering you 12 months free..." (promotional)
- "Dear Studio Owner..." (cold, generic)
- Dry, corporate tone without warmth
- Multiple links

---

Return JSON only: { "subject": "...", "body": "..." }

Subject: Short, warm, personal
- Good: "Love what you're doing at [studio]", "Fellow studio owner here", "Quick hello from ${leadContext.city || 'a yoga person'}"
- Bad: "Save money on booking fees", "Business opportunity"

Body: Plain text, \\n for line breaks, NO links except signature`;

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
