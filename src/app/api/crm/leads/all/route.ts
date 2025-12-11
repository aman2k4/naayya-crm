import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClientForServiceRole } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';

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

    // Get query parameters (same as main leads endpoint but without pagination)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const country = searchParams.get('country') || '';
    const city = searchParams.get('city') || '';
    const cities = searchParams.getAll('cities') || [];
    const emailStatuses = searchParams.getAll('emailStatus') || [];
    const platform = searchParams.get('platform') || '';

    console.log('All leads endpoint - Request params:', { search, country, city, cities, emailStatuses, platform });

    // Build base query to get all matching leads (no pagination)
    let baseQuery = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    // Add search filters if search term exists
    if (search.trim()) {
      baseQuery = baseQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,studio_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Add country filter
    if (country.trim()) {
      baseQuery = baseQuery.eq('country', country);
    }

    // Apply city filter - prioritize multiple cities over single city
    if (cities.length > 0) {
      // Multiple cities filter takes precedence
      console.log('Applying multiple cities filter to /all endpoint:', cities);
      baseQuery = baseQuery.in('city', cities);
    } else if (city.trim()) {
      // Single city filter for legacy support
      console.log('Applying single city filter to /all endpoint:', city);
      baseQuery = baseQuery.eq('city', city);
    }

    // Apply platform filter
    if (platform.trim()) {
      console.log('Applying platform filter to /all endpoint:', platform);
      baseQuery = baseQuery.eq('current_platform', platform);
    }

    const { data: allMatchingLeads, error: baseError } = await baseQuery;

    if (baseError) {
      console.error('Error fetching all leads:', baseError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    let filteredLeads = allMatchingLeads || [];

    // Apply email status filtering if needed (same logic as main endpoint)
    if (emailStatuses.length > 0 && filteredLeads.length > 0) {
      try {
        const serviceRoleSupabase = await createClientForServiceRole();
        const allEmails = filteredLeads.map(lead => lead.email).filter(Boolean);
        
        // Get email events for all matching leads
        const { data: emailEvents } = await serviceRoleSupabase
          .from('email_events')
          .select('to, event_type, event_timestamp')
          .in('to', allEmails)
          .order('event_timestamp', { ascending: false });

        // Get unsubscribe data
        const { data: cachedContacts } = await supabase
          .from('resend_contacts_cache')
          .select('email, unsubscribed')
          .in('email', allEmails.map(email => email.toLowerCase().trim()))
          .order('synced_at', { ascending: false });

        // Build email status map (same logic as main endpoint)
        const emailStatusMap: Record<string, any> = {};
        allEmails.forEach(email => {
          emailStatusMap[email] = {
            contacted: false,
            eventCount: 0,
            status: 'not_sent',
            allEvents: [],
            unsubscribeChecked: false
          };
        });

        // Process email events
        if (emailEvents && emailEvents.length > 0) {
          const eventsByEmail: Record<string, typeof emailEvents> = {};
          emailEvents.forEach(event => {
            const email = event.to;
            if (!eventsByEmail[email]) {
              eventsByEmail[email] = [];
            }
            eventsByEmail[email].push(event);
          });

          Object.entries(eventsByEmail).forEach(([email, events]) => {
            const sortedEvents = events.sort((a, b) => 
              new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
            );

            const latestEvent = sortedEvents[0];
            const allEventTypes = sortedEvents.map(e => e.event_type);

            let status = 'sent';
            if (allEventTypes.some(t => t.includes('bounce') || t.includes('failed'))) {
              status = 'bounced';
            } else if (allEventTypes.some(t => t.includes('complaint') || t.includes('spam'))) {
              status = 'complained';
            } else if (allEventTypes.some(t => t.includes('click'))) {
              status = 'clicked';
            } else if (allEventTypes.some(t => t.includes('open'))) {
              status = 'opened';
            } else if (allEventTypes.some(t => t.includes('deliver'))) {
              status = 'delivered';
            }

            emailStatusMap[email] = {
              contacted: true,
              lastEventType: latestEvent.event_type,
              lastEventTimestamp: latestEvent.event_timestamp,
              eventCount: events.length,
              status,
              allEvents: allEventTypes
            };
          });
        }

        // Process unsubscribe status
        if (cachedContacts) {
          const unsubscribeStatusByEmail: Record<string, boolean> = {};
          cachedContacts.forEach(contact => {
            if (!unsubscribeStatusByEmail.hasOwnProperty(contact.email) || contact.unsubscribed) {
              unsubscribeStatusByEmail[contact.email] = contact.unsubscribed;
            }
          });

          allEmails.forEach(email => {
            const normalizedEmail = email.toLowerCase().trim();
            emailStatusMap[email].unsubscribeChecked = true;
            if (unsubscribeStatusByEmail.hasOwnProperty(normalizedEmail)) {
              emailStatusMap[email].unsubscribed = unsubscribeStatusByEmail[normalizedEmail];
            }
          });
        }

        // Filter leads based on email status (same logic as main endpoint)
        filteredLeads = filteredLeads.filter(lead => {
          const status = emailStatusMap[lead.email];
          
          // Handle not_sent status
          if (emailStatuses.includes('not_sent') && (!status || !status.contacted)) {
            return true;
          }
          
          if (!status || !status.contacted) {
            return false;
          }
          
          // Check if unsubscribed (highest priority)
          if (emailStatuses.includes('unsubscribed') && status.unsubscribed) {
            return true;
          }
          
          // Check other statuses
          return emailStatuses.includes(status.status);
        });

      } catch (err) {
        console.error('Error processing email status filter:', err);
      }
    }

    // Return all filtered leads without pagination
    return NextResponse.json({
      data: filteredLeads,
      total: filteredLeads.length,
      filters: {
        search,
        country,
        city,
        cities,
        emailStatuses,
        platform
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}