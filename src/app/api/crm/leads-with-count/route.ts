import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { toDate } from 'date-fns-tz';
import { z } from 'zod';

const createLeadSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  studio_name: z.string().optional(),
  lead_source: z.string().optional(),
  current_platform: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country_code: z.string().optional(),
  response_status: z.enum(['interested', 'not_interested', 'interested_later', 'follow_up_needed', 'qualified', 'converted']).optional(),
  notes: z.string().optional(),
  phone_number: z.string().optional(),
  additional_info: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  business_type: z.string().optional(),
});

const CET_TIMEZONE = 'Europe/Berlin';

const parseCETDateBoundary = (value: string | null, boundary: 'start' | 'end') => {
  if (!value) return { iso: null, raw: null };

  const trimmedValue = value.trim();
  if (!trimmedValue) return { iso: null, raw: null };

  const normalized =
    trimmedValue.includes('T') || trimmedValue.includes(' ')
      ? trimmedValue
      : `${trimmedValue}${boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999'}`;

  const fallbackISO = () => {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  try {
    return { iso: toDate(normalized, { timeZone: CET_TIMEZONE }).toISOString(), raw: normalized };
  } catch (err) {
    console.error('Invalid date provided for CET conversion', { value, boundary, err });
    return { iso: fallbackISO(), raw: normalized };
  }
};

const parseNumberFilter = (value: string | null) => {
  if (value === null) return { number: null, raw: null };
  const trimmed = value.trim();
  if (!trimmed) return { number: null, raw: null };
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return { number: NaN, raw: trimmed };
  return { number: parsed, raw: trimmed };
};

type LeadFilters = {
  search?: string;
  emailStatuses: string[];
  countryCode?: string;
  platform?: string;
  source?: string;
  lastEmailFromUTC?: string | null;
  lastEmailToUTC?: string | null;
  minEmailsSent?: number | null;
  maxEmailsSent?: number | null;
};

const applyLeadFilters = (
  query: any,
  {
    search,
    emailStatuses,
    countryCode,
    platform,
    source,
    lastEmailFromUTC,
    lastEmailToUTC,
    minEmailsSent,
    maxEmailsSent,
  }: LeadFilters
) => {
  let filteredQuery = query;

  if (search?.trim()) {
    filteredQuery = filteredQuery.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,studio_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  if (emailStatuses.length > 0) {
    const hasUnsubscribed = emailStatuses.includes('unsubscribed');
    const otherStatuses = emailStatuses.filter((status) => status !== 'unsubscribed');

    if (hasUnsubscribed && otherStatuses.length > 0) {
      filteredQuery = filteredQuery.or(`unsubscribed.eq.true,email_status.in.(${otherStatuses.join(',')})`);
    } else if (hasUnsubscribed) {
      filteredQuery = filteredQuery.eq('unsubscribed', true);
    } else {
      filteredQuery = filteredQuery.in('email_status', otherStatuses);
    }
  }

  if (lastEmailFromUTC) {
    filteredQuery = filteredQuery.gte('last_event_timestamp', lastEmailFromUTC);
  }

  if (lastEmailToUTC) {
    filteredQuery = filteredQuery.lte('last_event_timestamp', lastEmailToUTC);
  }

  if (lastEmailFromUTC || lastEmailToUTC) {
    filteredQuery = filteredQuery.not('last_event_timestamp', 'is', null);
  }

  if (countryCode?.trim()) {
    filteredQuery = filteredQuery.eq('country_code', countryCode.trim());
  }

  if (platform?.trim()) {
    filteredQuery = filteredQuery.eq('current_platform', platform.trim());
  }

  if (source?.trim()) {
    filteredQuery = filteredQuery.eq('lead_source', source.trim());
  }

  if (typeof minEmailsSent === 'number') {
    filteredQuery = filteredQuery.gte('emails_sent_count', minEmailsSent);
  }

  if (typeof maxEmailsSent === 'number') {
    filteredQuery = filteredQuery.lte('emails_sent_count', maxEmailsSent);
  }

  return filteredQuery;
};

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';
    const ids = idsParam ? idsParam.split(',').map(id => id.trim()).filter(id => id) : [];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sort = (searchParams.get('sort') || 'last_email').toLowerCase();
    const dir = (searchParams.get('dir') || 'desc').toLowerCase();
    const search = searchParams.get('search') || '';
    const countryCode = searchParams.get('country_code') || ''; // Use only country_code
    const emailStatuses = searchParams.getAll('emailStatus') || [];
    const platform = searchParams.get('platform') || '';
    const source = searchParams.get('source') || '';
    const lastEmailFrom = searchParams.get('lastEmailFrom');
    const lastEmailTo = searchParams.get('lastEmailTo');
    const { number: minEmailsSent, raw: minEmailsSentRaw } = parseNumberFilter(
      searchParams.get('minEmailsSent')
    );
    const { number: maxEmailsSent, raw: maxEmailsSentRaw } = parseNumberFilter(
      searchParams.get('maxEmailsSent')
    );

    const { iso: lastEmailFromUTC } = parseCETDateBoundary(lastEmailFrom, 'start');
    const { iso: lastEmailToUTC } = parseCETDateBoundary(lastEmailTo, 'end');

    if (lastEmailFrom && !lastEmailFromUTC) {
      return NextResponse.json({ error: 'Invalid lastEmailFrom date' }, { status: 400 });
    }

    if (lastEmailTo && !lastEmailToUTC) {
      return NextResponse.json({ error: 'Invalid lastEmailTo date' }, { status: 400 });
    }

    if (minEmailsSentRaw && Number.isNaN(minEmailsSent)) {
      return NextResponse.json({ error: 'Invalid minEmailsSent' }, { status: 400 });
    }

    if (maxEmailsSentRaw && Number.isNaN(maxEmailsSent)) {
      return NextResponse.json({ error: 'Invalid maxEmailsSent' }, { status: 400 });
    }

    if (!['last_email', 'updated_at'].includes(sort)) {
      return NextResponse.json({ error: 'Invalid sort' }, { status: 400 });
    }

    if (!['asc', 'desc'].includes(dir)) {
      return NextResponse.json({ error: 'Invalid dir' }, { status: 400 });
    }

    console.log('Request params:', {
      ids,
      page,
      limit,
      sort,
      dir,
      search,
      countryCode,
      emailStatuses,
      platform,
      source,
      lastEmailFromUTC,
      lastEmailToUTC,
      minEmailsSent,
      maxEmailsSent,
    });

    const filters: LeadFilters = {
      search,
      emailStatuses,
      countryCode,
      platform,
      source,
      lastEmailFromUTC,
      lastEmailToUTC,
      minEmailsSent,
      maxEmailsSent,
    };

    // Special case: If specific IDs are requested, skip pagination and filters
    let query;
    if (ids.length > 0) {
      console.log('Fetching specific leads by IDs:', ids);
      query = supabase
        .from('leads_with_email_count')
        .select('*', { count: 'exact' })
        .in('id', ids);
    } else {
      // Build main query with filters and pagination
      query = applyLeadFilters(
        supabase.from('leads_with_email_count').select('*', { count: 'exact' }),
        filters
      );

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    // Apply sort consistently (server-side) so pagination matches the UI ordering
    if (sort === 'updated_at') {
      query = query
        .order('updated_at', { ascending: dir === 'asc', nullsFirst: false })
        .order('created_at', { ascending: false });
    } else {
      query = query
        .order('last_event_timestamp', { ascending: dir === 'asc', nullsFirst: false })
        .order('created_at', { ascending: false });
    }

    const { data: leads, error: queryError, count: totalCount } = await query;

    if (queryError) {
      console.error('Error fetching leads:', queryError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    const total = totalCount || 0;
    const totalPages = Math.ceil(total / limit);

    console.log(`Found ${total} total leads, showing ${leads?.length || 0} on page ${page}`);
    console.log('Final query results:', leads?.length, 'leads returned');

    // Transform the data to match the expected API response format
    const emailStatusData: Record<string, any> = {};
    const contactListData: Record<string, any> = {};

    leads?.forEach((lead: any) => {
      // Email status data
      emailStatusData[lead.email] = {
        contacted: lead.contacted,
        status: lead.email_status,
        lastEventType: lead.last_event_type,
        lastEventTimestamp: lead.last_event_timestamp,
        eventCount: lead.event_count || 0,
        unsubscribed: lead.unsubscribed || false,
        unsubscribeChecked: true,
        // NEW: Include emails sent count
        emailsSentCount: lead.emails_sent_count || 0
      };
    });

    // Fetch ALL audiences for each unique email (not just the most recent one)
    const uniqueEmails: string[] = Array.from(new Set(leads?.map((lead: any) => lead.email?.toLowerCase().trim()).filter(Boolean) || []));

    if (uniqueEmails.length > 0) {
      const { data: allContactAudiences } = await supabase
        .from('resend_contacts_cache')
        .select('email, audience_id, audience_name')
        .in('email', uniqueEmails)
        .not('audience_id', 'is', null);

      // Group audiences by email
      const audiencesByEmail: Record<string, Array<{ id: string; name: string }>> = {};

      allContactAudiences?.forEach((contact: any) => {
        const emailKey = contact.email.toLowerCase().trim();
        if (!audiencesByEmail[emailKey]) {
          audiencesByEmail[emailKey] = [];
        }
        audiencesByEmail[emailKey].push({
          id: contact.audience_id,
          name: contact.audience_name
        });
      });

      // Set contact list data with all audiences
      uniqueEmails.forEach((email: string) => {
        const audiences = audiencesByEmail[email] || [];
        contactListData[email] = {
          email: email,
          found: audiences.length > 0,
          audiences: audiences
        };
      });
    }

    // Note: Filter counts are now handled by the /api/crm/filters endpoint for better performance and accuracy

    // Pagination info
    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    return NextResponse.json({
      success: true,
      data: {
        leads: leads || [],
        emailStatus: emailStatusData,
        contactList: contactListData,
        pagination,
        // Filter counts are handled by /api/crm/filters endpoint
        summary: {
          totalLeads: total,
          totalEmailsSent: leads?.reduce((sum: number, lead: any) => sum + (lead.emails_sent_count || 0), 0) || 0,
          averageEmailsPerLead: leads?.length ? Math.round((leads?.reduce((sum: number, lead: any) => sum + (lead.emails_sent_count || 0), 0) || 0) / leads.length * 100) / 100 : 0
        }
      }
    });

  } catch (error: any) {
    console.error('Error in leads-with-count API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
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
    
    // Validate the request body
    const validationResult = createLeadSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.issues 
      }, { status: 400 });
    }

    const leadData = validationResult.data;

    // Insert the lead
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: data
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST leads-with-count:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Update the lead
    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating lead:', updateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    // Fetch the updated lead from the view to get all computed fields
    const { data, error: fetchError } = await supabase
      .from('leads_with_email_count')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated lead:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch updated lead' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error: any) {
    console.error('Error in PATCH leads-with-count:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Lead IDs array is required' }, { status: 400 });
    }

    // Delete the leads
    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', leadIds);

    if (error) {
      console.error('Error deleting leads:', error);
      return NextResponse.json({ error: 'Failed to delete leads' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${leadIds.length} leads` 
    });

  } catch (error: any) {
    console.error('Error in DELETE leads-with-count:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
