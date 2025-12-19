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

    // Build prompt with lead context - optimized for email deliverability
    const prompt = `You are Sally Grüneisen, co-founder of Naayya, emailing a studio owner.

CONTEXT (use selectively, not exhaustively):
${JSON.stringify(leadContext, null, 2)}

${instructors ? `Note: The instructor count (${instructors}) is an ESTIMATE. Never state it as fact. You may say "looks like a small team" but never "your 5 instructors."` : ''}
${leadContext.classes_per_week_estimate ? `Note: The class count (~${classesPerWeek}/week) is an ESTIMATE. Never state it as fact.` : ''}

---

CORE PRINCIPLE:
Write an email that makes them think "huh, that's interesting" — not "this is a sales pitch."

The best cold emails feel like the start of a conversation, not a pitch. They make the reader curious. They don't try to close anything.

---

FIVE RULES:

1. ONE SPECIFIC DETAIL, MAX
Pick one thing from their studio that actually interests you. Not three things. Not a list of everything you noticed. One detail, stated simply. If nothing stands out, skip the personalization entirely — a short honest email beats a long fake one.

2. NO GUSHING, NO NEGGING
Never say: "wow", "amazing", "incredible", "love what you're doing", "stopped me in my tracks", "had to reach out"
These phrases signal inauthenticity. If you like something, just say what it is: "The rooftop space is a nice touch" not "OMG that rooftop space is incredible!"

Also avoid backhanded compliments like "you pull it off without it feeling scattered" or "impressive that you manage to..." — these imply the opposite could be true and come across as condescending.

3. STATE CURIOSITY, NOT CLAIMS
Bad: "We help studios keep more of what they earn"
Good: "I'm curious if you've looked at alternatives to ${leadContext.current_platform || 'your current setup'}"
Bad: "Naayya could be a great fit"
Good: "Not sure if it'd be relevant for you, but..."

4. THE ASK SHOULD BE TINY
Not: "Would you be open to a quick call?"
Better: "Happy to share more if you're curious"
Best: No ask at all — just end with something interesting and let them reply if they want

5. KEEP IT SHORT
3-4 sentences max. No filler. Every sentence should do work.

---

TAILOR THE ANGLE TO THEIR SCALE:
${(() => {
  const size = instructors || 0;
  const classes = classesPerWeek || 0;

  if (size >= 8 || classes >= 40) {
    return `This looks like a LARGER operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''}).
Don't pitch "simpler" — they might hear "less capable."
Better angles:
- "Built by someone who's been in your shoes"
- "Curious if you've compared what's out there lately"
- "We work with studios running serious volume"
- Focus on: better economics, fewer headaches at scale, someone who gets it`;
  } else if (size >= 4 || classes >= 20) {
    return `This looks like a MEDIUM operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''}).
They're past the scrappy early stage but not huge.
Good angles:
- "Right-sized tools for where you are"
- "Keep more of what you're earning"
- Focus on: value, not having to pay for enterprise features they don't need`;
  } else {
    return `This looks like a SMALLER operation (${size ? `~${size} instructors` : ''}${size && classes ? ', ' : ''}${classes ? `~${classes} classes/week` : ''}).
"Simpler" and "more affordable" resonate here.
Good angles:
- "Built for studios like yours, not giant chains"
- "Simpler than what's out there"
- Focus on: ease, affordability, not being overwhelmed`;
  }
})()}

---

WHAT SALLY CAN MENTION (if relevant):
- She ran a yoga studio for 7 years before building Naayya
- She noticed they use ${leadContext.current_platform || 'a booking platform'} (without criticizing it)
- Naayya's positioning depends on studio size — see above

DELIVERABILITY:
- No links in body. Only in signature.
- Avoid: "save", "free", "offer", "discount", "guarantee", "limited time", "opportunity"
- Plain text only. No formatting.
- NEVER use emdashes (—). Use a regular hyphen (-) or rewrite the sentence instead.

SIGNATURE (always use exactly this):
Sally Grüneisen
Co-founder, Naayya
<a href="https://naayya.com">naayya.com</a>

---

Return JSON only: { "subject": "...", "body": "..." }

Subject line rules:
- Short (3-6 words)
- No gushing ("Love what you're doing!")
- No clickbait
- Good: "Quick note", "Hi from a fellow studio owner", "Saw your studio"
- Bad: "Amazing opportunity!", "Fellow studio owner here (and big fan!)"

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
