import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { OpenRouter } from '@openrouter/sdk';
import { z } from 'zod';

const requestSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
});

// All models via OpenRouter
const MODELS = [
  { id: 'chatgpt-4o', name: 'ChatGPT-4o', modelId: 'openai/chatgpt-4o-latest' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', modelId: 'google/gemini-3-pro-preview' },
  { id: 'claude-opus', name: 'Claude Opus 4.5', modelId: 'anthropic/claude-opus-4.5' },
  { id: 'kimi-k2', name: 'Kimi K2', modelId: 'moonshotai/kimi-k2' },
];

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }, { status: 400 });
    }

    const { leadId } = validation.data;

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({
        error: 'Lead not found',
        details: leadError?.message || 'Lead not found'
      }, { status: 404 });
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
    if (lead.instagram) leadContext.instagram = lead.instagram;
    if (lead.facebook) leadContext.facebook = lead.facebook;
    if (lead.classes_per_week_estimate) leadContext.classes_per_week_estimate = lead.classes_per_week_estimate;
    if (lead.instructors_count_estimate) leadContext.instructors_count_estimate = lead.instructors_count_estimate;
    if (lead.additional_info) leadContext.additional_info = lead.additional_info;
    if (lead.notes) leadContext.notes = lead.notes;

    // Currency mapping by country code
    const CURRENCY_MAP: Record<string, { symbol: string; avgRevenuePerClass: number; nayyaProMonthly: number }> = {
      // Dollar countries
      US: { symbol: '$', avgRevenuePerClass: 35, nayyaProMonthly: 200 },
      AU: { symbol: 'A$', avgRevenuePerClass: 40, nayyaProMonthly: 300 },
      CA: { symbol: 'C$', avgRevenuePerClass: 35, nayyaProMonthly: 270 },
      NZ: { symbol: 'NZ$', avgRevenuePerClass: 35, nayyaProMonthly: 320 },
      SG: { symbol: 'S$', avgRevenuePerClass: 40, nayyaProMonthly: 270 },
      HK: { symbol: 'HK$', avgRevenuePerClass: 300, nayyaProMonthly: 1560 },
      // Pound
      GB: { symbol: '£', avgRevenuePerClass: 25, nayyaProMonthly: 160 },
      // Euro countries (default)
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
      // Other
      CH: { symbol: 'CHF', avgRevenuePerClass: 40, nayyaProMonthly: 220 },
      JP: { symbol: '¥', avgRevenuePerClass: 3500, nayyaProMonthly: 30000 },
      IN: { symbol: '₹', avgRevenuePerClass: 800, nayyaProMonthly: 5000 },
    };

    const countryCode = (leadContext.country_code as string) || '';
    const currencyConfig = CURRENCY_MAP[countryCode] || { symbol: '€', avgRevenuePerClass: 30, nayyaProMonthly: 200 };
    const currency = currencyConfig.symbol;
    const avgRevenuePerClass = currencyConfig.avgRevenuePerClass;
    const nayyaProMonthly = currencyConfig.nayyaProMonthly;

    // Get data or use reasonable defaults
    const classesPerWeek = (leadContext.classes_per_week_estimate as number) || 10;
    const instructors = (leadContext.instructors_count_estimate as number) || 0;

    // Calculate rough savings
    const weeklyRevenue = classesPerWeek * avgRevenuePerClass;
    const monthlyRevenue = Math.round(weeklyRevenue * 4.3);
    const yearlyRevenue = monthlyRevenue * 12;

    // Transaction fee savings: competitors 4-5%, Naayya 2.5% = ~2% savings
    const transactionFeeSavingsYearly = Math.round(yearlyRevenue * 0.02);

    // 12 months free Naayya Pro
    const nayyaProSavings = nayyaProMonthly * 12;

    // Total first year savings
    const totalYearlySavings = transactionFeeSavingsYearly + nayyaProSavings;

    // Round to nice number
    const roundedSavings = Math.round(totalYearlySavings / 500) * 500;
    const savingsDisplay = `${currency}${roundedSavings.toLocaleString()}+`;

    // Build what Sally researched based on available data
    const researchedItems: string[] = [];
    if (leadContext.website) researchedItems.push('their website');
    if (leadContext.instagram) researchedItems.push('their Instagram');
    if (leadContext.facebook) researchedItems.push('their Facebook');
    if (leadContext.current_platform) researchedItems.push(`noticed they use ${leadContext.current_platform} for bookings`);

    const researchSummary = researchedItems.length > 0
      ? `You checked out ${researchedItems.slice(0, -1).join(', ')}${researchedItems.length > 1 ? ' and ' : ''}${researchedItems[researchedItems.length - 1]}.`
      : 'You looked into their studio.';

    // Build prompt with lead context
    const prompt = `You are Sally Gruniesen, co-founder of Naayya. You've spent time researching this studio.

${researchSummary}

Here's what you know about them:

${JSON.stringify(leadContext, null, 2)}

Write a SHORT cold email (4-6 lines max, not including signature) that feels like you genuinely researched them.

IMPORTANT - Only reference what you actually have data for:
${leadContext.website ? `- You visited their website (${leadContext.website})` : ''}
${leadContext.instagram ? `- You scrolled their Instagram (${leadContext.instagram})` : ''}
${leadContext.facebook ? `- You checked their Facebook (${leadContext.facebook})` : ''}
${leadContext.current_platform ? `- You noticed they use ${leadContext.current_platform} for bookings` : ''}
${leadContext.classes_per_week_estimate ? `- You saw they run about ${classesPerWeek} classes/week` : ''}
${instructors ? `- They have around ${instructors} instructors` : ''}
${leadContext.additional_info ? `- Additional context: ${leadContext.additional_info}` : ''}

Do NOT make up information you don't have. Only mention what's listed above.

What to convey:
- You genuinely looked into them using the info above
- ${leadContext.current_platform ? `Switching from ${leadContext.current_platform} to Naayya could save them ~${savingsDisplay} in year one` : `Switching to Naayya could save them ~${savingsDisplay} in year one`}
- Frame numbers as your observation: "looks like you run about ${classesPerWeek} classes a week - switching could save you around ${savingsDisplay}"
- Naayya isn't just cheaper - it's better for community-focused studios (growth tools, member retention)
- Offer: 12 months of Naayya Pro free

Background on Sally (use only if it fits naturally):
- She's run her own studio for 7 years

CTA: Keep it casual and human, like writing to a friend. Examples:
- "If you're curious, I'd love to show you around - just reply to this email"
- "Happy to walk you through it if you're interested - just hit reply"
- "Would love to show you how it works - reply and we can chat"
Don't be salesy. Just a friendly offer to show them.

Guidelines:
- EVERY mention of "Naayya" must be hyperlinked: <a href="https://naayya.com">Naayya</a>
- Sound like you actually researched them
- BREVITY - every word must earn its place
- Don't always open the same way
- End with: "Sally\\nCo-founder, <a href="https://naayya.com">Naayya.com</a>"

Return JSON only: { "subject": "...", "body": "..." }
- Subject: Short, specific to them
- Body: Use \\n for line breaks. EVERY "Naayya" must be <a href="https://naayya.com">Naayya</a>. No markdown. Keep it simple.`;

    // Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({
        error: 'Configuration error',
        details: 'OPENROUTER_API_KEY is not configured'
      }, { status: 500 });
    }

    // Initialize OpenRouter client
    const openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Generate emails from all models in parallel
    const modelResults = await Promise.allSettled(
      MODELS.map(async (modelConfig) => {
        const startTime = Date.now();

        try {
          const completion = await openRouter.chat.send({
            model: modelConfig.modelId,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            stream: false,
          });

          const content = completion.choices?.[0]?.message?.content;
          let text: string;

          // Content can be string or array of content items
          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content
              .filter((item): item is { type: 'text'; text: string } =>
                typeof item === 'object' && item !== null && 'type' in item && item.type === 'text'
              )
              .map(item => item.text)
              .join('');
          } else {
            text = '';
          }

          const parsed = safeExtractJsonObject(text);
          const duration = Date.now() - startTime;

          if (!parsed || !parsed.subject || !parsed.body) {
            return {
              modelId: modelConfig.id,
              modelName: modelConfig.name,
              success: false,
              error: 'Failed to parse response',
              duration,
            };
          }

          return {
            modelId: modelConfig.id,
            modelName: modelConfig.name,
            success: true,
            subject: parsed.subject,
            body: parsed.body,
            duration,
          };
        } catch (err) {
          return {
            modelId: modelConfig.id,
            modelName: modelConfig.name,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            duration: Date.now() - startTime,
          };
        }
      })
    );

    // Process results
    const results = modelResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        modelId: MODELS[index].id,
        modelName: MODELS[index].name,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        duration: 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        context: leadContext,
      }
    });

  } catch (error: unknown) {
    console.error('Error in generate-cold-email API:', error);

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
