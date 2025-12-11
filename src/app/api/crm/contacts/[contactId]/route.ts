import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Validation schema for updating a contact
const updateContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  unsubscribed: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabase = await createClient();
    const { contactId } = await params;

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

    // Try to fetch from local cache first
    const { data: cachedContact, error: cacheError } = await supabase
      .from('resend_contacts_cache')
      .select('*')
      .eq('resend_contact_id', contactId)
      .single();

    if (cachedContact) {
      return NextResponse.json({
        success: true,
        contact: cachedContact,
        source: 'cache'
      });
    }

    // Fallback to Resend API if not in cache
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'Contact not found in cache and Resend API key not configured'
      }, { status: 404 });
    }

    // Get audienceId from query params (required by Resend API)
    const audienceId = request.nextUrl.searchParams.get('audienceId');
    if (!audienceId) {
      return NextResponse.json({
        error: 'audienceId query parameter is required when fetching from Resend API'
      }, { status: 400 });
    }

    try {
      const result = await resend.contacts.get({
        audienceId,
        id: contactId
      });

      if (!result.data) {
        return NextResponse.json({
          error: 'Contact not found',
          details: result.error?.message
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        contact: result.data,
        source: 'resend'
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);
      return NextResponse.json({
        error: 'Failed to fetch contact from Resend',
        details: resendError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Unexpected error in GET /api/crm/contacts/[contactId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabase = await createClient();
    const { contactId } = await params;

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
    const validationResult = updateContactSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return NextResponse.json({
        error: 'Validation failed',
        details: errorMessage
      }, { status: 400 });
    }

    const updateData = validationResult.data;

    // Build Resend update payload
    const resendUpdateData: any = { id: contactId };

    if (updateData.firstName !== undefined) {
      resendUpdateData.firstName = updateData.firstName?.trim() || undefined;
    }
    if (updateData.lastName !== undefined) {
      resendUpdateData.lastName = updateData.lastName?.trim() || undefined;
    }
    if (updateData.unsubscribed !== undefined) {
      resendUpdateData.unsubscribed = updateData.unsubscribed;
    }

    // Update contact in Resend
    try {
      console.log('Updating contact in Resend:', resendUpdateData);
      const result = await resend.contacts.update(resendUpdateData);

      if (!result.data && result.error) {
        throw new Error(result.error.message || 'Failed to update contact in Resend');
      }

      console.log('Contact updated successfully in Resend');

      // Update local cache
      const cacheUpdateData: any = {};
      if (updateData.firstName !== undefined) {
        cacheUpdateData.first_name = updateData.firstName?.trim() || null;
      }
      if (updateData.lastName !== undefined) {
        cacheUpdateData.last_name = updateData.lastName?.trim() || null;
      }
      if (updateData.unsubscribed !== undefined) {
        cacheUpdateData.unsubscribed = updateData.unsubscribed;
      }

      if (Object.keys(cacheUpdateData).length > 0) {
        const { error: cacheError } = await supabase
          .from('resend_contacts_cache')
          .update({
            ...cacheUpdateData,
            synced_at: new Date().toISOString()
          })
          .eq('resend_contact_id', contactId);

        if (cacheError) {
          console.warn('Failed to update local cache (non-critical):', cacheError);
        }
      }

      return NextResponse.json({
        success: true,
        contact: result.data,
        message: 'Contact updated successfully'
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

      // Handle not found
      if (resendError.status === 404) {
        return NextResponse.json({
          error: 'Contact not found in Resend',
          details: resendError.message
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to update contact in Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Unexpected error in PATCH /api/crm/contacts/[contactId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabase = await createClient();
    const { contactId } = await params;

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

    // Get audienceId from query params (required by Resend API)
    const audienceId = request.nextUrl.searchParams.get('audienceId');
    if (!audienceId) {
      return NextResponse.json({
        error: 'audienceId query parameter is required'
      }, { status: 400 });
    }

    // Delete contact from Resend
    try {
      console.log('Deleting contact from Resend:', contactId);
      const result = await resend.contacts.remove({
        audienceId,
        id: contactId
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to delete contact from Resend');
      }

      console.log('Contact deleted successfully from Resend');

      // Soft delete in local cache (mark as inactive)
      const { error: cacheError } = await supabase
        .from('resend_contacts_cache')
        .update({
          is_active: false
        })
        .eq('resend_contact_id', contactId);

      if (cacheError) {
        console.warn('Failed to update local cache (non-critical):', cacheError);
      } else {
        console.log('Contact marked as deleted in local cache (soft delete)');
      }

      return NextResponse.json({
        success: true,
        message: 'Contact deleted successfully'
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

      // Handle not found (treat as success since goal is to remove)
      if (resendError.status === 404) {
        // Still mark as deleted in cache
        await supabase
          .from('resend_contacts_cache')
          .update({
            is_active: false
          })
          .eq('resend_contact_id', contactId);

        return NextResponse.json({
          success: true,
          message: 'Contact not found in Resend (already deleted)'
        });
      }

      return NextResponse.json({
        error: 'Failed to delete contact from Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Unexpected error in DELETE /api/crm/contacts/[contactId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
