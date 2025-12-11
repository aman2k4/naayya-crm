import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { ContactListsResponse } from '@/types/resend';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Missing email parameter.' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check global admin permissions
    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    // Query the cached contact data for this email
    const { data: cachedContacts, error } = await supabase
      .from('resend_contacts_cache')
      .select('audience_id, audience_name')
      .eq('email', email.toLowerCase().trim())
      .order('audience_name');

    if (error) {
      console.error('Error querying contact lists:', error);
      return NextResponse.json({ 
        email,
        found: false,
        audiences: [],
        error: 'Failed to query contact lists.'
      }, { status: 500 });
    }

    const audiences = cachedContacts?.map(contact => ({
      id: contact.audience_id,
      name: contact.audience_name
    })) || [];

    const response: ContactListsResponse = {
      email,
      found: audiences.length > 0,
      audiences
    };

    return NextResponse.json(response);

  } catch (err: any) {
    console.error(`Error checking contact lists for ${email}:`, err);
    
    return NextResponse.json({ 
      email,
      found: false,
      audiences: [],
      error: 'Failed to check contact lists.'
    }, { status: 500 });
  }
}

// POST endpoint for batch lookup (multiple emails at once)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check global admin permissions
    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid emails array.' }, { status: 400 });
    }

    // Normalize emails
    const normalizedEmails = emails.map(email => email.toLowerCase().trim());

    // Query all contact lists for these emails
    const { data: cachedContacts, error } = await supabase
      .from('resend_contacts_cache')
      .select('email, audience_id, audience_name')
      .in('email', normalizedEmails)
      .order('email, audience_name');

    if (error) {
      console.error('Error querying contact lists:', error);
      return NextResponse.json({ 
        error: 'Failed to query contact lists.'
      }, { status: 500 });
    }

    // Group results by email
    const results: Record<string, ContactListsResponse> = {};
    
    // Initialize all emails with empty results
    normalizedEmails.forEach(email => {
      results[email] = {
        email,
        found: false,
        audiences: []
      };
    });

    // Populate with found data
    cachedContacts?.forEach(contact => {
      if (!results[contact.email]) {
        results[contact.email] = {
          email: contact.email,
          found: false,
          audiences: []
        };
      }
      
      results[contact.email].audiences.push({
        id: contact.audience_id,
        name: contact.audience_name
      });
      results[contact.email].found = true;
    });

    return NextResponse.json({ contactLists: results });

  } catch (err: any) {
    console.error('Error in batch contact lists lookup:', err);
    
    return NextResponse.json({ 
      error: 'Failed to check contact lists.'
    }, { status: 500 });
  }
}