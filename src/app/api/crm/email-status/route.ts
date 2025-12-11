import { NextRequest, NextResponse } from 'next/server';
import { createClientForServiceRole } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClientForServiceRole();
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid emails array.' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter(email => emailRegex.test(email));

    if (validEmails.length === 0) {
      return NextResponse.json({ error: 'No valid emails provided.' }, { status: 400 });
    }

    // Query email_events table to check which emails have been contacted
    const { data, error } = await supabase
      .from('email_events')
      .select('to, event_type, event_timestamp')
      .in('to', validEmails)
      .order('event_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching email events:', error);
      return NextResponse.json({ error: 'Failed to fetch email status.', details: error.message }, { status: 500 });
    }

    // Process results to get comprehensive status for each email
    const emailStatusMap: Record<string, {
      contacted: boolean;
      lastEventType?: string;
      lastEventTimestamp?: string;
      eventCount: number;
      status: 'not_sent' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
      allEvents: string[];
      unsubscribed?: boolean;
      unsubscribeChecked?: boolean;
    }> = {};

    // Initialize all emails as not contacted
    validEmails.forEach(email => {
      emailStatusMap[email] = {
        contacted: false,
        eventCount: 0,
        status: 'not_sent',
        allEvents: [],
        unsubscribeChecked: false
      };
    });

    // Process email events
    if (data && data.length > 0) {
      // Group events by email
      const eventsByEmail: Record<string, typeof data> = {};
      data.forEach(event => {
        const email = event.to;
        if (!eventsByEmail[email]) {
          eventsByEmail[email] = [];
        }
        eventsByEmail[email].push(event);
      });

      // Process each email's events
      Object.entries(eventsByEmail).forEach(([email, events]) => {
        const sortedEvents = events.sort((a, b) => 
          new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
        );

        const latestEvent = sortedEvents[0];
        const allEventTypes = sortedEvents.map(e => e.event_type);

        // Determine overall status based on event progression
        let status: typeof emailStatusMap[string]['status'] = 'sent';
        
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
        } else if (allEventTypes.some(t => t.includes('sent'))) {
          status = 'sent';
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

    // Check unsubscribe status using cached Supabase data
    try {
      const { data: cachedContacts, error: cacheError } = await supabase
        .from('resend_contacts_cache')
        .select('email, unsubscribed')
        .in('email', validEmails.map(email => email.toLowerCase().trim()))
        .order('synced_at', { ascending: false }); // Get most recent sync data

      if (!cacheError && cachedContacts) {
        // Group by email and get the most recent unsubscribe status
        const unsubscribeStatusByEmail: Record<string, boolean> = {};
        
        cachedContacts.forEach(contact => {
          // If we haven't seen this email yet, or this contact shows unsubscribed, update the status
          if (!unsubscribeStatusByEmail.hasOwnProperty(contact.email) || contact.unsubscribed) {
            unsubscribeStatusByEmail[contact.email] = contact.unsubscribed;
          }
        });

        // Update email status with unsubscribe information
        validEmails.forEach(email => {
          const normalizedEmail = email.toLowerCase().trim();
          emailStatusMap[email].unsubscribeChecked = true;
          if (unsubscribeStatusByEmail.hasOwnProperty(normalizedEmail)) {
            emailStatusMap[email].unsubscribed = unsubscribeStatusByEmail[normalizedEmail];
          }
        });
      } else {
        console.warn('Error checking unsubscribe status from cache:', cacheError);
        // Mark as checked but couldn't determine status
        validEmails.forEach(email => {
          emailStatusMap[email].unsubscribeChecked = false;
        });
      }
    } catch (err) {
      console.warn('Error during cached unsubscribe checking:', err);
      // Continue without unsubscribe data
      validEmails.forEach(email => {
        emailStatusMap[email].unsubscribeChecked = false;
      });
    }

    return NextResponse.json({ emailStatus: emailStatusMap });
  } catch (err: any) {
    console.error(`Unexpected error in /api/crm/email-status: ${err.message}`);
    console.error(err.stack);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}