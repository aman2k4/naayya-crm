import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';

interface ConflictInfo {
  email: string;
  existing: any;
  incoming: any;
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
    const { leads } = body;
    
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Leads array is required' }, { status: 400 });
    }

    // Validate that all leads have email
    const invalidLeads = leads.filter((lead: any) => !lead.email || !lead.email.trim());
    if (invalidLeads.length > 0) {
      return NextResponse.json({ 
        error: 'All leads must have an email address' 
      }, { status: 400 });
    }

    // Normalize leads
    const normalizedLeads = leads.map((lead: any) => ({
      email: lead.email.trim(),
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      studio_name: lead.studio_name || '',
      lead_source: lead.lead_source || '',
      current_platform: lead.current_platform || '',
      city: lead.city || '',
      country: lead.country || '',
    }));

    // Check for existing leads with same emails in batches
    const emails = normalizedLeads.map(lead => lead.email);
    const BATCH_SIZE = 100; // Process 100 emails at a time
    const existingLeads: any[] = [];
    
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const emailBatch = emails.slice(i, i + BATCH_SIZE);
      
      const { data: batchResults, error } = await supabase
        .from('leads')
        .select('*')
        .in('email', emailBatch);
        
      if (error) {
        return NextResponse.json({ error: `Failed to check for conflicts: ${error.message}` }, { status: 500 });
      }
      
      if (batchResults) {
        existingLeads.push(...batchResults);
      }
    }
    
    const conflicts: ConflictInfo[] = [];
    const existingByEmail = new Map(existingLeads.map((lead: any) => [lead.email, lead]));
    
    normalizedLeads.forEach(incomingLead => {
      const existing = existingByEmail.get(incomingLead.email);
      if (existing) {
        conflicts.push({
          email: incomingLead.email,
          existing,
          incoming: incomingLead
        });
      }
    });

    return NextResponse.json({
      conflicts,
      totalLeads: normalizedLeads.length,
      conflictCount: conflicts.length,
      newLeadCount: normalizedLeads.length - conflicts.length
    });

  } catch (error) {
    console.error('Conflict detection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}