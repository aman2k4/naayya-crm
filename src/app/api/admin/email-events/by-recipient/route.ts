import { NextRequest, NextResponse } from 'next/server';
import { createClientForServiceRole } from '@/utils/supabase/server';
import type { EmailEvent } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClientForServiceRole();
    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to');

    if (!to) {
      return NextResponse.json({ error: 'Missing recipient email (to) parameter.' }, { status: 400 });
    }

    const normalizedTo = to.trim().toLowerCase();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const requestedLimit = parseInt(searchParams.get('limit') || '5000', 10);
    const limit = Number.isNaN(requestedLimit) ? 5000 : Math.min(Math.max(requestedLimit, 1), 10000);

    let query = supabase
      .from('email_events')
      .select<'*', EmailEvent>('*')
      .ilike('to', normalizedTo)
      .order('event_timestamp', { ascending: true });

    if (startDate) {
      query = query.gte('event_timestamp', startDate);
    }
    if (endDate) {
      // Add a day to endDate to make it inclusive of the selected end date, assuming time is T00:00:00.000Z
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
      query = query.lt('event_timestamp', inclusiveEndDate.toISOString());
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching email events by recipient:', error);
      return NextResponse.json({ error: 'Failed to fetch email events.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error(`Unexpected error in /api/admin/email-events/by-recipient: ${err.message}`);
    console.error(err.stack);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
