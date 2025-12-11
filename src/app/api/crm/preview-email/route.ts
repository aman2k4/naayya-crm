import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { getTemplateById, renderEmailTemplate } from '@/lib/crm/emailTemplates';
import { Lead } from '@/types/crm';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin
    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { templateId, leadId } = body;

    if (!templateId || !leadId) {
      return NextResponse.json({ error: 'Missing required fields: templateId, leadId' }, { status: 400 });
    }

    // Get template
    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Render template
    const rendered = await renderEmailTemplate(template, lead as Lead);

    return NextResponse.json({
      success: true,
      html: rendered.html,
      subject: rendered.subject,
    });

  } catch (error: any) {
    console.error('Error in preview-email API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
