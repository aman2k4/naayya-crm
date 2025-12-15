import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { Resend } from 'resend';
import { replaceVariables, getTemplateById } from '@/lib/crm/emailTemplates';
import { Lead } from '@/types/crm';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { fromEmail, replyTo, leadIds, subject, body: emailBody, templateId, html: emailHtml } = body;

    // Validate inputs
    if (!fromEmail || !leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: fromEmail, leadIds' }, { status: 400 });
    }

    // Get template if templateId is provided
    const template = templateId ? getTemplateById(templateId) : null;

    // Validate subject and body/html - body or html only required if not using template
    if (!subject || (!template && !emailBody && !emailHtml)) {
      return NextResponse.json({ error: 'Missing required fields: subject' + (!template ? ', body or html' : '') }, { status: 400 });
    }

    // Fetch lead details from database
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .in('id', leadIds);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch lead details' }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: 'No leads found with the provided IDs' }, { status: 404 });
    }

    // Filter leads with valid emails
    const validLeads = leads.filter((lead: Lead) => lead.email && lead.email.trim());

    if (validLeads.length === 0) {
      return NextResponse.json({ error: 'No leads with valid email addresses' }, { status: 400 });
    }

    // Enforce batch limit of 100 emails
    if (validLeads.length > 100) {
      return NextResponse.json({
        error: 'Batch limit exceeded. You can only send to a maximum of 100 recipients at once.'
      }, { status: 400 });
    }

    // Prepare batch emails - build array of email objects
    const batchEmails = validLeads.map((lead: Lead) => {
      const emailData: any = {
        from: fromEmail,
        to: [lead.email],
        replyTo: replyTo || 'aman@naayya.com',
      };

      // Use React Email template or plain text
      if (template) {
        // Pass React component directly to Resend
        const personalizedSubject = replaceVariables(subject, lead);
        emailData.subject = personalizedSubject;
        emailData.react = template.reactComponent({
          firstName: lead.first_name || undefined,
          studioName: lead.studio_name || undefined,
        });
      } else if (emailHtml) {
        // Use HTML for emails with links
        const personalizedSubject = replaceVariables(subject, lead);
        const personalizedHtml = replaceVariables(emailHtml, lead);
        emailData.subject = personalizedSubject;
        emailData.html = personalizedHtml;
      } else {
        // Use plain text for custom emails
        const personalizedSubject = replaceVariables(subject, lead);
        const personalizedBody = replaceVariables(emailBody, lead);
        emailData.subject = personalizedSubject;
        emailData.text = personalizedBody;
      }

      return emailData;
    });

    // Send batch email (max 100 emails enforced above)
    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    try {
      const response = await resend.batch.send(batchEmails);

      if (response.error) {
        // If entire batch fails, mark all as failed
        console.error('Batch send failed:', response.error);
        batchEmails.forEach((email) => {
          failed++;
          errors.push({
            email: email.to[0],
            error: response.error?.message || 'Batch send failed',
          });
        });
      } else if (response.data?.data) {
        // Process batch results - data.data is the array of results
        const results = response.data.data;
        results.forEach((result: any, index: number) => {
          const email = batchEmails[index].to[0];

          if (result.id) {
            // Success
            sent++;
          } else {
            // Individual email failed
            failed++;
            errors.push({
              email,
              error: 'Failed to send',
            });
          }
        });
      }
    } catch (err: any) {
      console.error('Exception during batch send:', err);
      // Mark all emails as failed
      batchEmails.forEach((email) => {
        failed++;
        errors.push({
          email: email.to[0],
          error: err.message || 'Exception occurred',
        });
      });
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: validLeads.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully sent ${sent} email(s). ${failed > 0 ? `${failed} failed.` : ''}`,
    });

  } catch (error: any) {
    console.error('Error in send-email API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
