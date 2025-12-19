import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { toDate } from 'date-fns-tz';

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
  city?: string;
  cities?: string[];
  platform?: string;
  source?: string;
  lastEmailFromUTC?: string | null;
  lastEmailToUTC?: string | null;
  updatedFromUTC?: string | null;
  updatedToUTC?: string | null;
  minEmailsSent?: number | null;
  maxEmailsSent?: number | null;
};

const applyLeadFilters = (
  query: any,
  {
    search,
    emailStatuses,
    countryCode,
    city,
    cities,
    platform,
    source,
    lastEmailFromUTC,
    lastEmailToUTC,
    updatedFromUTC,
    updatedToUTC,
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

  if (updatedFromUTC) {
    filteredQuery = filteredQuery.gte('updated_at', updatedFromUTC);
  }

  if (updatedToUTC) {
    filteredQuery = filteredQuery.lte('updated_at', updatedToUTC);
  }

  if (countryCode?.trim()) {
    filteredQuery = filteredQuery.eq('country_code', countryCode.trim());
  }

  if (cities && cities.length > 0) {
    filteredQuery = filteredQuery.in('city', cities);
  } else if (city?.trim()) {
    filteredQuery = filteredQuery.eq('city', city.trim());
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

    // Get query parameters (same filters as main endpoint but no pagination)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const countryCode = searchParams.get('country_code') || '';
    const city = searchParams.get('city') || '';
    const cities = searchParams.getAll('cities') || [];
    const emailStatuses = searchParams.getAll('emailStatus') || [];
    const platform = searchParams.get('platform') || '';
    const source = searchParams.get('source') || '';
    const sort = (searchParams.get('sort') || 'last_email').toLowerCase();
    const dir = (searchParams.get('dir') || 'desc').toLowerCase();
    const lastEmailFrom = searchParams.get('lastEmailFrom');
    const lastEmailTo = searchParams.get('lastEmailTo');
    const updatedFrom = searchParams.get('updatedFrom');
    const updatedTo = searchParams.get('updatedTo');
    const { number: minEmailsSent, raw: minEmailsSentRaw } = parseNumberFilter(
      searchParams.get('minEmailsSent')
    );
    const { number: maxEmailsSent, raw: maxEmailsSentRaw } = parseNumberFilter(
      searchParams.get('maxEmailsSent')
    );

    const { iso: lastEmailFromUTC } = parseCETDateBoundary(lastEmailFrom, 'start');
    const { iso: lastEmailToUTC } = parseCETDateBoundary(lastEmailTo, 'end');
    const { iso: updatedFromUTC } = parseCETDateBoundary(updatedFrom, 'start');
    const { iso: updatedToUTC } = parseCETDateBoundary(updatedTo, 'end');

    if (lastEmailFrom && !lastEmailFromUTC) {
      return NextResponse.json({ error: 'Invalid lastEmailFrom date' }, { status: 400 });
    }

    if (lastEmailTo && !lastEmailToUTC) {
      return NextResponse.json({ error: 'Invalid lastEmailTo date' }, { status: 400 });
    }

    if (updatedFrom && !updatedFromUTC) {
      return NextResponse.json({ error: 'Invalid updatedFrom date' }, { status: 400 });
    }

    if (updatedTo && !updatedToUTC) {
      return NextResponse.json({ error: 'Invalid updatedTo date' }, { status: 400 });
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

    console.log('Fetching all filtered leads with params:', { search, countryCode, city, cities, emailStatuses, platform, source, lastEmailFromUTC, lastEmailToUTC, updatedFromUTC, updatedToUTC, minEmailsSent, maxEmailsSent });

    const filters: LeadFilters = {
      search,
      emailStatuses,
      countryCode,
      city,
      cities,
      platform,
      source,
      lastEmailFromUTC,
      lastEmailToUTC,
      updatedFromUTC,
      updatedToUTC,
      minEmailsSent,
      maxEmailsSent,
    };

    // Build base query for filtering (without pagination)
    let query = applyLeadFilters(
      supabase.from('leads_with_email_count').select('*'),
      filters
    );

    if (sort === 'updated_at') {
      query = query
        .order('updated_at', { ascending: dir === 'asc', nullsFirst: false })
        .order('created_at', { ascending: false });
    } else {
      query = query
        .order('last_event_timestamp', { ascending: dir === 'asc', nullsFirst: false })
        .order('created_at', { ascending: false });
    }

    const { data: leads, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching all filtered leads:', queryError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    console.log(`Fetched ${leads?.length || 0} filtered leads (all)`);

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

      // Contact list data (only for leads with email)
      if (lead.email) {
        contactListData[lead.email.toLowerCase().trim()] = {
          email: lead.email,
          found: !!lead.audience_id,
          audiences: lead.audience_id ? [{
            id: lead.audience_id,
            name: lead.audience_name
          }] : []
        };
      }
    });

    // Build filter summary for frontend
    const filterSummary = {
      search: search || null,
      country_code: countryCode || null,
      city: city || null,
      cities: cities.length > 0 ? cities : null,
      emailStatuses: emailStatuses.length > 0 ? emailStatuses : null,
      platform: platform || null,
      source: source || null,
      lastEmailFrom: lastEmailFromUTC,
      lastEmailTo: lastEmailToUTC,
      updatedFrom: updatedFromUTC,
      updatedTo: updatedToUTC,
      minEmailsSent: typeof minEmailsSent === 'number' ? minEmailsSent : null,
      maxEmailsSent: typeof maxEmailsSent === 'number' ? maxEmailsSent : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        leads: leads || [],
        emailStatus: emailStatusData,
        contactList: contactListData,
        filters: filterSummary,
        // NEW: Add summary statistics
        summary: {
          totalLeads: leads?.length || 0,
          totalEmailsSent: leads?.reduce((sum: number, lead: any) => sum + (lead.emails_sent_count || 0), 0) || 0,
          averageEmailsPerLead: leads?.length ? Math.round((leads?.reduce((sum: number, lead: any) => sum + (lead.emails_sent_count || 0), 0) || 0) / leads.length * 100) / 100 : 0
        }
      }
    });

  } catch (error: any) {
    console.error('Error in leads-with-count/all API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
