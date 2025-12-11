import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schema for creating a contact
const createContactSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  audienceId: z.string().min(1, 'Audience ID is required'),
  unsubscribed: z.boolean().default(false)
});

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const audienceId = searchParams.get('audienceId');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'active'; // active | deleted | all
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    // Step 1: Build base query for filtering
    let baseQuery = supabase
      .from('resend_contacts_cache')
      .select('resend_contact_id, email, first_name, last_name, unsubscribed, contact_created_at, is_active, synced_at');

    // Filter by status
    if (status === 'active') {
      baseQuery = baseQuery.eq('is_active', true);
    } else if (status === 'deleted') {
      baseQuery = baseQuery.eq('is_active', false);
    }

    // Filter by audience if specified
    if (audienceId && audienceId !== 'all') {
      baseQuery = baseQuery.eq('audience_id', audienceId);
    }

    // Search by email or name
    if (search) {
      baseQuery = baseQuery.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
      );
    }

    // Fetch all matching rows (before pagination)
    const { data: allRows, error: fetchError } = await baseQuery;

    if (fetchError) {
      console.error('Error fetching contacts:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch contacts',
        details: fetchError.message
      }, { status: 500 });
    }

    // Step 2: Group by resend_contact_id to get unique contacts
    const contactsMap = new Map();

    for (const row of (allRows || [])) {
      const contactId = row.resend_contact_id;

      if (!contactsMap.has(contactId)) {
        contactsMap.set(contactId, {
          id: contactId, // Use resend_contact_id as primary id
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          unsubscribed: row.unsubscribed,
          resend_contact_id: row.resend_contact_id,
          contact_created_at: row.contact_created_at,
          is_active: row.is_active,
          synced_at: row.synced_at,
          audiences: []
        });
      }
    }

    // Step 3: Fetch audiences for each unique contact
    for (const [contactId, contact] of contactsMap) {
      const { data: audienceRows } = await supabase
        .from('resend_contacts_cache')
        .select('audience_id, audience_name')
        .eq('resend_contact_id', contactId)
        .eq('is_active', contact.is_active);

      contact.audiences = (audienceRows || [])
        .filter(row => row.audience_id) // Exclude NULL audiences
        .map(row => ({
          id: row.audience_id,
          name: row.audience_name
        }));
    }

    // Step 4: Convert to array and apply pagination
    const uniqueContacts = Array.from(contactsMap.values());
    const totalContacts = uniqueContacts.length;
    const totalPages = Math.ceil(totalContacts / limit);
    const offset = (page - 1) * limit;
    const paginatedContacts = uniqueContacts.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      contacts: paginatedContacts,
      pagination: {
        page,
        limit,
        total: totalContacts,
        totalPages
      }
    });

  } catch (error: any) {
    console.error('Unexpected error in GET /api/crm/contacts:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'Resend API key not configured'
      }, { status: 500 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createContactSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return NextResponse.json({
        error: 'Validation failed',
        details: errorMessage
      }, { status: 400 });
    }

    const { email, firstName, lastName, audienceId, unsubscribed } = validationResult.data;

    // Create contact in Resend
    try {
      const contactData: any = {
        email: email.toLowerCase().trim(),
        audienceId,
        unsubscribed
      };

      // Add optional fields if provided
      if (firstName?.trim()) {
        contactData.firstName = firstName.trim();
      }
      if (lastName?.trim()) {
        contactData.lastName = lastName.trim();
      }

      console.log('Creating contact in Resend:', contactData);
      const result = await resend.contacts.create(contactData);

      if (!result.data) {
        // Check if duplicate
        const isDuplicate = result.error && (
          result.error.message?.toLowerCase().includes('already exists') ||
          result.error.message?.toLowerCase().includes('duplicate')
        );

        if (isDuplicate) {
          return NextResponse.json({
            error: 'Contact already exists in this audience',
            details: result.error?.message
          }, { status: 409 });
        }

        throw new Error(result.error?.message || 'Failed to create contact in Resend');
      }

      console.log('Contact created successfully in Resend:', result.data.id);

      // Fetch audience name for cache entry
      const { data: audiences } = await supabase
        .from('resend_contacts_cache')
        .select('audience_name')
        .eq('audience_id', audienceId)
        .limit(1)
        .single();

      // Get audience name from Resend if not in cache
      let audienceName = audiences?.audience_name;
      if (!audienceName) {
        try {
          const audienceResult = await resend.audiences.list();
          const audience = audienceResult.data?.data?.find((a: any) => a.id === audienceId);
          audienceName = audience?.name || 'Unknown Audience';
        } catch (audienceError) {
          console.error('Error fetching audience name:', audienceError);
          audienceName = 'Unknown Audience';
        }
      }

      // Add to local cache
      const { error: cacheError } = await supabase
        .from('resend_contacts_cache')
        .insert({
          email: email.toLowerCase().trim(),
          first_name: firstName?.trim() || null,
          last_name: lastName?.trim() || null,
          unsubscribed,
          resend_contact_id: result.data.id,
          contact_created_at: new Date().toISOString(),
          audience_id: audienceId,
          audience_name: audienceName,
          synced_at: new Date().toISOString()
        });

      if (cacheError) {
        console.warn('Failed to update local cache (non-critical):', cacheError);
      }

      return NextResponse.json({
        success: true,
        contact: result.data,
        message: 'Contact created successfully'
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);

      // Handle rate limiting
      if (resendError.status === 429) {
        return NextResponse.json({
          error: 'Rate limit exceeded. Please try again later.',
          details: resendError.message
        }, { status: 429 });
      }

      return NextResponse.json({
        error: 'Failed to create contact in Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Unexpected error in POST /api/crm/contacts:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
