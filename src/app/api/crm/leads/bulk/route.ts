import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { z } from 'zod';

// Helper function to sanitize email addresses
function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;

  let cleaned = email.trim().toLowerCase();

  // Remove common trailing characters that shouldn't be in emails
  cleaned = cleaned.replace(/[.\s,>]+$/, '');

  // Remove leading/trailing special characters
  cleaned = cleaned.replace(/^[<>\s]+|[<>\s]+$/g, '');

  // Replace invalid characters with nothing
  cleaned = cleaned.replace(/[^\w@.\-+]/g, '');

  // Basic validation - must have @ and a dot after it
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return null;
  }

  // Check if it's likely a phone number (all digits except @)
  const withoutAt = cleaned.replace('@', '');
  if (/^\d+$/.test(withoutAt)) {
    return null;
  }

  return cleaned;
}

const leadSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  studio_name: z.string().optional(),
  lead_source: z.string().optional(),
  current_platform: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country_code: z.string().optional(),
});

const bulkImportSchema = z.object({
  leads: z.array(z.any()).min(1, 'At least one lead is required'), // Changed to z.any() to handle pre-validation
  conflictResolution: z.enum(['skip', 'update', 'merge', 'replace']).optional(),
  conflictDecisions: z.record(z.string(), z.enum(['skip', 'update', 'merge', 'replace'])).optional(),
});

type ConflictResolution = 'skip' | 'update' | 'merge' | 'replace';

interface ConflictInfo {
  email: string;
  existing: any;
  incoming: any;
}

interface BulkImportRequest {
  leads: any[];
  conflictResolution?: ConflictResolution;
  conflictDecisions?: Record<string, ConflictResolution>;
}

// Helper function to check conflicts in batches
async function detectConflicts(supabase: any, leads: any[]): Promise<ConflictInfo[]> {
  const emails = leads.map(lead => lead.email.trim());
  const BATCH_SIZE = 100; // Process 100 emails at a time
  const existingLeads: any[] = [];
  
  // Process emails in batches
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const emailBatch = emails.slice(i, i + BATCH_SIZE);
    
    const { data: batchResults, error } = await supabase
      .from('leads')
      .select('*')
      .in('email', emailBatch);
      
    if (error) {
      throw new Error(`Failed to check for conflicts: ${error.message}`);
    }
    
    if (batchResults) {
      existingLeads.push(...batchResults);
    }
  }
  
  const conflicts: ConflictInfo[] = [];
  const existingByEmail = new Map(existingLeads.map((lead: any) => [lead.email, lead]));
  
  leads.forEach(incomingLead => {
    const email = incomingLead.email.trim();
    const existing = existingByEmail.get(email);
    if (existing) {
      conflicts.push({
        email,
        existing,
        incoming: incomingLead
      });
    }
  });
  
  return conflicts;
}

// Helper function to merge leads based on strategy
function mergeLeads(existing: any, incoming: any, strategy: ConflictResolution) {
  switch (strategy) {
    case 'skip':
      return null; // Don't update
    case 'replace':
      return {
        ...incoming,
        id: existing.id,
        email: existing.email, // Preserve email
        created_at: existing.created_at,
        updated_at: new Date().toISOString()
      };
    case 'update':
      return {
        ...existing,
        ...incoming,
        id: existing.id,
        email: existing.email, // Preserve email
        updated_at: new Date().toISOString()
      };
    case 'merge':
      // Only update fields that are empty in existing
      const merged = { ...existing };
      Object.keys(incoming).forEach(key => {
        if (key !== 'email' && (!existing[key] || existing[key].trim() === '')) {
          merged[key] = incoming[key];
        }
      });
      merged.updated_at = new Date().toISOString();
      return merged.updated_at !== existing.updated_at ? merged : null;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting bulk import request');
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);
    if (!isGlobalAdmin) {
      console.error('❌ User is not global admin:', user.id);
      return NextResponse.json({ error: 'Forbidden - Global admin access required' }, { status: 403 });
    }

    console.log('📥 Parsing request body...');
    const body = await request.json();
    console.log('📊 Request body keys:', Object.keys(body));
    console.log('📊 Leads count:', body.leads?.length || 0);

    // Basic validation of request structure
    console.log('🔍 Validating request structure with Zod...');
    const validationResult = bulkImportSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('❌ Request structure validation failed:', validationResult.error.issues);
      return NextResponse.json({
        error: 'Invalid request structure',
        details: validationResult.error.issues.map(e => e.message),
      }, { status: 400 });
    }

    console.log('✅ Request structure validated');

    const { leads: rawLeads, conflictResolution = 'skip', conflictDecisions } = validationResult.data;

    // Sanitize and validate individual leads
    console.log('🧹 Sanitizing and validating individual leads...');
    const validLeads: any[] = [];
    const skippedLeads: Array<{ index: number, email: string, reason: string }> = [];

    rawLeads.forEach((lead: any, index: number) => {
      const originalEmail = lead.email;
      const sanitizedEmail = sanitizeEmail(lead.email);

      if (!sanitizedEmail) {
        console.log(`⏭️ Skipping lead at index ${index}: invalid email "${originalEmail}"`);
        skippedLeads.push({
          index: index + 1, // 1-indexed for user display
          email: originalEmail || '(empty)',
          reason: 'Invalid or missing email address'
        });
        return;
      }

      // Validate the sanitized lead
      const leadToValidate = {
        ...lead,
        email: sanitizedEmail
      };

      const leadValidation = leadSchema.safeParse(leadToValidate);
      if (leadValidation.success) {
        validLeads.push(leadValidation.data);
        if (sanitizedEmail !== originalEmail) {
          console.log(`✨ Sanitized email at index ${index}: "${originalEmail}" → "${sanitizedEmail}"`);
        }
      } else {
        console.log(`⏭️ Skipping lead at index ${index}: validation failed for "${sanitizedEmail}"`);
        skippedLeads.push({
          index: index + 1,
          email: originalEmail,
          reason: leadValidation.error.issues[0]?.message || 'Validation failed'
        });
      }
    });

    console.log(`✅ Valid leads: ${validLeads.length}, Skipped: ${skippedLeads.length}`);

    if (validLeads.length === 0) {
      return NextResponse.json({
        error: 'No valid leads to import',
        details: skippedLeads.slice(0, 20).map(s => `Row ${s.index}: ${s.email} - ${s.reason}`),
        message: `All ${skippedLeads.length} leads were skipped due to validation errors`
      }, { status: 400 });
    }

    const leads = validLeads;
    console.log('📋 Conflict resolution strategy:', conflictResolution);
    console.log('📋 Individual conflict decisions count:', Object.keys(conflictDecisions || {}).length);

    // Prepare leads for processing
    console.log('🔄 Normalizing leads...');
    const normalizedLeads = leads.map(lead => ({
      email: lead.email.trim(),
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      studio_name: lead.studio_name || '',
      lead_source: lead.lead_source || '',
      current_platform: lead.current_platform || '',
      city: lead.city || '',
      state: lead.state || '',
      country_code: lead.country_code || '',
    }));
    console.log('✅ Normalized', normalizedLeads.length, 'leads');

    // Detect conflicts
    console.log('🔍 Detecting conflicts...');
    const conflicts = await detectConflicts(supabase, normalizedLeads);
    console.log('⚠️ Found', conflicts.length, 'conflicts');
    
    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    const errors: string[] = [];
    const conflictEmails = new Set(conflicts.map(c => c.email));

    // Process conflicting leads based on resolution strategy in batches
    console.log('🔄 Processing conflicts...');
    const BATCH_SIZE = 50; // Smaller batch size for updates
    const updatesToProcess: any[] = [];
    
    for (const conflict of conflicts) {
      try {
        const resolution = conflictDecisions?.[conflict.email] || conflictResolution;
        console.log(`📧 Processing conflict for ${conflict.email} with resolution: ${resolution}`);
        const mergedData = mergeLeads(conflict.existing, conflict.incoming, resolution);
        
        if (mergedData) {
          updatesToProcess.push(mergedData);
          console.log(`✅ Prepared update for ${conflict.email}`);
        } else {
          skipCount++;
          console.log(`⏭️ Skipping ${conflict.email}`);
        }
      } catch (err) {
        console.error(`❌ Error preparing update for ${conflict.email}:`, err);
        errors.push(`Unexpected error preparing update for ${conflict.email}: ${err}`);
        errorCount++;
      }
    }
    
    console.log(`🔄 Processing ${updatesToProcess.length} updates in batches of ${BATCH_SIZE}`);
    // Process updates in batches
    for (let i = 0; i < updatesToProcess.length; i += BATCH_SIZE) {
      const batch = updatesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing update batch ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} items)`);
      
      for (const updateData of batch) {
        try {
          const { error } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', updateData.id);
            
          if (error) {
            console.error(`❌ Failed to update ${updateData.email}:`, error.message);
            errors.push(`Failed to update ${updateData.email}: ${error.message}`);
            errorCount++;
          } else {
            updateCount++;
            successCount++;
            console.log(`✅ Updated ${updateData.email}`);
          }
        } catch (err) {
          console.error(`❌ Unexpected error updating ${updateData.email}:`, err);
          errors.push(`Unexpected error updating ${updateData.email}: ${err}`);
          errorCount++;
        }
      }
    }

    // Process non-conflicting leads (new insertions) in batches
    const newLeads = normalizedLeads.filter(lead => !conflictEmails.has(lead.email));
    console.log(`📥 Processing ${newLeads.length} new leads for insertion`);
    const leadsToInsert = newLeads.map(lead => ({
      ...lead,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Process inserts in batches
    const INSERT_BATCH_SIZE = 100; // Larger batch size for inserts
    console.log(`🔄 Processing ${leadsToInsert.length} inserts in batches of ${INSERT_BATCH_SIZE}`);
    for (let i = 0; i < leadsToInsert.length; i += INSERT_BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + INSERT_BATCH_SIZE);
      console.log(`🔄 Processing insert batch ${Math.floor(i/INSERT_BATCH_SIZE) + 1} (${batch.length} items)`);
      
      try {
        const { error } = await supabase
          .from('leads')
          .insert(batch);

        if (error) {
          console.error(`❌ Batch insert failed:`, error.message);
          console.log(`🔄 Falling back to individual inserts for this batch`);
          // If batch insert fails, try individual inserts for this batch
          for (const lead of batch) {
            try {
              const { error: individualError } = await supabase
                .from('leads')
                .insert([lead]);

              if (individualError) {
                console.error(`❌ Failed to insert ${lead.email}:`, individualError.message);
                errors.push(`Failed to insert ${lead.email}: ${individualError.message}`);
                errorCount++;
              } else {
                successCount++;
                console.log(`✅ Inserted ${lead.email}`);
              }
            } catch (err) {
              console.error(`❌ Unexpected error inserting ${lead.email}:`, err);
              errors.push(`Unexpected error inserting ${lead.email}: ${err}`);
              errorCount++;
            }
          }
        } else {
          successCount += batch.length;
          console.log(`✅ Batch inserted ${batch.length} leads`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error with batch insert:`, err);
        errors.push(`Unexpected error with batch insert: ${err}`);
        errorCount += batch.length;
      }
    }

    console.log('📊 Final results:', {
      success: successCount,
      errors: errorCount,
      updated: updateCount,
      skipped: skipCount,
      conflicts: conflicts.length
    });

    return NextResponse.json({
      success: successCount,
      errors: errorCount,
      updated: updateCount,
      skipped: skipCount + skippedLeads.length,
      conflicts: conflicts.length,
      details: [
        ...(errorCount > 0 ? errors.slice(0, 10) : []),
        ...(skippedLeads.length > 0 ? [`${skippedLeads.length} leads skipped due to invalid emails`] : [])
      ],
      skippedLeads: skippedLeads.slice(0, 10), // Show first 10 skipped leads
      message: `Successfully processed ${successCount} leads${updateCount > 0 ? ` (${updateCount} updated)` : ''}${skipCount + skippedLeads.length > 0 ? `, ${skipCount + skippedLeads.length} skipped` : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`
    });

  } catch (error) {
    console.error('❌ Bulk import error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}