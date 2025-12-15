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
  { id: 'grok-4', name: 'Grok 4', modelId: 'x-ai/grok-4-fast' },
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

    // Determine currency based on country
    const isUS = leadContext.country_code === 'US';
    const currency = isUS ? '$' : '€';
    const avgRevenuePerClass = isUS ? 35 : 30; // Avg revenue per class (attendance × price)
    const nayyaProMonthly = isUS ? 200 : 200;

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

    // Build prompt with lead context
    const prompt = `You are Sally Gruniesen, co-founder of Naayya.

Here's the studio you're writing to:

${JSON.stringify(leadContext, null, 2)}

First, think: Who are the experts at writing cold emails to ${leadContext.business_type || 'fitness studio'}s${leadContext.current_platform ? ` that use ${leadContext.current_platform}` : ''}${leadContext.country_code ? ` in ${leadContext.country_code}` : ''}? What would they say? How would they open the email to get this specific person's attention?

Write like that expert would write - not a generic template.

Keep it SHORT. 4-6 lines max. People skim cold emails - if it's too long, they won't read it.

Background on Sally (use naturally, only when it adds value):
- She's run her own studio for 7 years
- She built Naayya because she understands studio owners' pain points

The offer:
- 12 months of Naayya Pro free
- You chose them specifically

What is Naayya (work this in naturally):
- Studio management software built specifically for studios like theirs
- Community-driven growth tools that help studios grow organically and retain members
- It's not just about price - Naayya is genuinely better than ${leadContext.current_platform || 'their current platform'} for community-focused studios
- Yes, also lower fees (2.5% vs 4-5%) but lead with the value, not just savings

Savings (based on their data):
- ~${classesPerWeek} classes/week${instructors ? `, ${instructors} instructors` : ''}
- Switching from ${leadContext.current_platform || 'their platform'} + free Naayya Pro = ~${savingsDisplay} first year
- Mention casually: "with your ${classesPerWeek} classes a week, that's around ${savingsDisplay} saved in year one"

Structure (4-6 lines total, not including signature):
1. Quick opener - specific to them, 1 line
2. The pitch - Naayya + offer + switching + savings (${savingsDisplay}) - 2-3 lines
3. CTA - check Naayya.com or reply - 1 line

Guidelines:
- BREVITY is key - every word must earn its place
- VARY your opening - don't always lead with "As a studio owner..." or "I came across..."
- Get to the point fast
- End with: "Sally\\nCo-founder, <a href="https://naayya.com">Naayya.com</a>"

Return JSON only: { "subject": "...", "body": "..." }
- Subject: Short, specific to them
- Body formatting:
  - Use \\n for line breaks
  - Use <a href="https://naayya.com">Naayya.com</a> for links
  - Use <b>text</b> for bold (sparingly, only if really needed)
  - Do NOT use markdown like **text** or *text* - it won't render in email
  - Keep it simple - plain text is usually best`;

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
