import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory cache for audiences
interface CachedAudiences {
  data: any;
  timestamp: number;
}

let audienceCache: CachedAudiences | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const leadSchema = z.object({
  id: z.string(),
  email: z.string().email('Invalid email address'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  studio_name: z.string().optional(),
  lead_source: z.string().optional(),
  current_platform: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

const createAudienceSchema = z.object({
  name: z.string().min(1, 'Audience name is required'),
  leads: z.array(leadSchema).min(1, 'At least one lead is required')
});

export async function GET(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured.' }, { status: 500 });
    }

    // Check if cache is valid
    const now = Date.now();
    if (audienceCache && (now - audienceCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({ 
        audiences: audienceCache.data,
        cached: true,
        cacheTimestamp: audienceCache.timestamp
      });
    }

    // Fetch fresh data from Resend
    const audiencesResponse = await resend.audiences.list();

    if (!audiencesResponse.data) {
      return NextResponse.json({ error: 'Failed to fetch audiences.' }, { status: 500 });
    }

    // Update cache
    audienceCache = {
      data: audiencesResponse.data,
      timestamp: now
    };

    return NextResponse.json({ 
      audiences: audiencesResponse.data,
      cached: false,
      cacheTimestamp: now
    });

  } catch (err: any) {
    console.error(`Error fetching audiences: ${err.message}`);
    
    // Handle specific Resend API errors
    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid Resend API key.' }, { status: 401 });
    }
    
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'Failed to fetch audiences.' }, { status: 500 });
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
    const validationResult = createAudienceSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: errorMessage 
      }, { status: 400 });
    }

    const { name, leads } = validationResult.data;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 });
    }

    try {
      // Create the audience in Resend
      const audience = await resend.audiences.create({ name });
      
      if (!audience || !audience.data?.id) {
        throw new Error('Failed to create audience - no ID returned');
      }

      const audienceId = audience.data.id;

      // Add contacts to the audience with full lead data
      const addedContacts = [];
      const failedContacts = [];
      
      // Add contacts one by one (Resend API creates one contact at a time)
      console.log(`🚀 Starting to create ${leads.length} contacts for audience "${name}"`);
      
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const progress = Math.round(((i + 1) / leads.length) * 100);
        console.log(`📝 Processing contact ${i + 1}/${leads.length} (${progress}%): ${lead.email}`);
        // Prepare contact data with available information (using correct camelCase for Resend API)
        const contactData: any = {
          audienceId,
          email: lead.email,
          unsubscribed: false
        };

        // Add firstName if available and not empty (camelCase for Resend API)
        if (lead.first_name?.trim()) {
          contactData.firstName = lead.first_name.trim();
        }

        // Add lastName if available and not empty (camelCase for Resend API)
        if (lead.last_name?.trim()) {
          contactData.lastName = lead.last_name.trim();
        }

        // Log the data being sent to Resend for debugging
        console.log(`Creating contact for ${lead.email}:`, JSON.stringify(contactData, null, 2));

        try {
          // Retry logic with exponential backoff for rate limiting
          let contactResult = null;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount <= maxRetries) {
            try {
              contactResult = await resend.contacts.create(contactData);
              break; // Success, exit retry loop
            } catch (retryError: any) {
              retryCount++;
              
              // Check if it's a rate limit error
              if ((retryError.status === 429 || retryError.code === 'TOO_MANY_REQUESTS') && retryCount <= maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
                console.log(`⏳ Rate limited for ${lead.email}, retrying in ${delay/1000}s (attempt ${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry
              } else {
                throw retryError; // Re-throw if not rate limit or max retries exceeded
              }
            }
          }
          
          if (!contactResult) {
            throw new Error(`Failed to create contact after ${maxRetries} retries`);
          }
          
          // Log the full response for debugging
          console.log(`Raw Resend response for ${lead.email}:`, JSON.stringify(contactResult, null, 2));
          
          if (contactResult.data) {
            console.log(`✅ Successfully created contact ${lead.email} with ID: ${contactResult.data.id}`);
            addedContacts.push({
              ...contactResult.data,
              leadId: lead.id,
              leadEmail: lead.email,
              hasFirstName: !!lead.first_name?.trim(),
              hasLastName: !!lead.last_name?.trim()
            });
          } else {
            // Check if this is a duplicate contact (common cause of no data)
            const isDuplicate = contactResult.error && (
              contactResult.error.message?.toLowerCase().includes('already exists') ||
              contactResult.error.message?.toLowerCase().includes('duplicate') ||
              (contactResult.error as any).code === 'CONTACT_ALREADY_EXISTS'
            );
            
            if (isDuplicate) {
              console.log(`ℹ️ Contact ${lead.email} already exists in Resend - skipping`);
              // Don't count duplicates as failures, just log them
              addedContacts.push({
                id: 'duplicate',
                email: lead.email,
                leadId: lead.id,
                leadEmail: lead.email,
                hasFirstName: !!lead.first_name?.trim(),
                hasLastName: !!lead.last_name?.trim(),
                isDuplicate: true
              });
            } else {
              console.warn(`⚠️ Contact creation returned no data for ${lead.email}`);
              console.warn(`Full response:`, JSON.stringify(contactResult, null, 2));
              
              // Check if there's an error in the response
              const errorMessage = contactResult.error?.message || 'No data returned from Resend API';
              
              failedContacts.push({
                leadId: lead.id,
                email: lead.email,
                error: errorMessage,
                fullResponse: contactResult
              });
            }
          }
        } catch (contactError: any) {
          console.error(`❌ Error adding contact ${lead.email}:`, contactError);
          console.error(`Contact data that failed:`, JSON.stringify(contactData, null, 2));
          console.error(`Error details:`, {
            message: contactError.message,
            status: contactError.status,
            code: contactError.code,
            stack: contactError.stack
          });
          
          failedContacts.push({
            leadId: lead.id,
            email: lead.email,
            error: contactError.message || 'Unknown error',
            status: contactError.status,
            code: contactError.code,
            contactData: contactData
          });
          // Continue with next contact even if this one fails
        }
        
        // Add a longer delay between requests to avoid rate limiting
        if (i < leads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay (0.5 seconds)
        }
      }

      // Clear the audience cache since we've added a new audience
      audienceCache = null;

      // Log summary for debugging
      const duplicateContacts = addedContacts.filter(c => c.isDuplicate).length;
      const newContacts = addedContacts.filter(c => !c.isDuplicate).length;
      const contactsWithNames = addedContacts.filter(c => c.hasFirstName || c.hasLastName).length;
      const contactsWithoutNames = addedContacts.filter(c => !c.hasFirstName && !c.hasLastName).length;
      
      console.log(`📊 Audience "${name}" creation summary:`);
      console.log(`   Total leads processed: ${leads.length}`);
      console.log(`   Successfully added (new): ${newContacts}`);
      console.log(`   Skipped (duplicates): ${duplicateContacts}`);
      console.log(`   Failed: ${failedContacts.length}`);
      console.log(`   Contacts with names: ${contactsWithNames}`);
      console.log(`   Contacts without names: ${contactsWithoutNames}`);

      return NextResponse.json({
        success: true,
        audience: {
          id: audienceId,
          name: audience.data.name,
          object: audience.data.object
        },
        contactsAdded: addedContacts.length,
        totalContacts: leads.length,
        failedContacts: failedContacts.length,
        addedContactsDetails: addedContacts,
        failedContactsDetails: failedContacts,
        message: failedContacts.length > 0 
          ? `Created audience "${name}" with ${addedContacts.length} out of ${leads.length} contacts. ${failedContacts.length} contacts failed to add.`
          : `Successfully created audience "${name}" with ${addedContacts.length} contacts with full contact information`
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);
      return NextResponse.json({ 
        error: 'Failed to create audience in Resend', 
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}