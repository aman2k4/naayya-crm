import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

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

    // Build prompt with lead context
    const prompt = `You are Sally Gruniesen, co-founder of Naayya - a FREE studio management software for fitness/wellness businesses that also saves on transaction fees.

Write a SHORT cold email (3-4 sentences max) to this studio. Here's everything we know about them:

${JSON.stringify(leadContext, null, 2)}

Guidelines:
- Tone: Friendly, direct, confident - like a personal Gmail, NOT marketing
- Use whatever info is relevant (name, studio, location, platform, social, etc.)
- If they have classes_per_week_estimate or instructors_count_estimate, you can mention potential savings (competitors charge ~3% transaction fees)
- Highlight: Naayya is FREE + saves on transaction fees
- CTA: Check Naayya.com or reply to schedule a quick call
- Sign off as Sally

Return JSON only: { "subject": "...", "body": "..." }
- Subject: Short, personal, no clickbait
- Body: Plain text, 3-4 sentences max, include signature`;

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    const parsed = safeExtractJsonObject(text);

    if (!parsed || !parsed.subject || !parsed.body) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json({
        error: 'Failed to generate email',
        details: 'Could not parse AI response'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: parsed.subject,
        body: parsed.body,
        context: leadContext, // Return what was sent to AI
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
