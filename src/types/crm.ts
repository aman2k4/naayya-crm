export type ResponseStatus = 'interested' | 'not_interested' | 'interested_later' | 'follow_up_needed' | 'qualified' | 'converted';

export interface Lead {
  id: string;

  // Lead source
  lead_source: string;

  // Person details
  first_name: string;
  last_name: string;
  email: string; // unique constraint
  phone_number?: string;

  // Studio details
  studio_name: string;
  current_platform: string;
  classes_per_week_estimate?: number | null;
  instructors_count_estimate?: number | null;
  website?: string;
  instagram?: string;
  facebook?: string;
  business_type?: string;

  // Location details
  city: string;
  state?: string; // state, province, or region
  country_code: string; // ISO 3166-1 alpha-2 country code (e.g., 'US', 'CA', 'GB')

  // Response tracking
  response_status: ResponseStatus;
  notes: string;
  additional_info?: string;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Email engagement metadata (available on CRM view)
  email_status?: string | null;
  last_event_type?: string | null;
  last_event_timestamp?: string | null;
  event_count?: number | null;
  emails_sent_count?: number | null;
  unsubscribed?: boolean | null;
}


export interface CreateLeadInput {
  // Lead source
  lead_source: string;

  // Person details
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;

  // Studio details
  studio_name: string;
  current_platform: string;
  classes_per_week_estimate?: number | null;
  instructors_count_estimate?: number | null;
  website?: string;
  instagram?: string;
  facebook?: string;
  business_type?: string;

  // Location details
  city: string;
  state?: string;
  country_code: string; // ISO 3166-1 alpha-2 country code

  // Response tracking
  response_status?: ResponseStatus;
  notes?: string;
  additional_info?: string;
}


// Lead enrichment types
export interface LeadEnrichmentConflict {
  field: string;
  current: string;
  found: string;
}

export type LeadEnrichmentProvider = 'gemini' | 'perplexity';

export interface WebsiteStatus {
  valid: boolean;
  status?: number;
  error?: string;
  finalUrl?: string;
}

export interface SocialStatus {
  valid: boolean;
  error?: string;
}


export interface LeadEnrichmentProviderResult {
  provider: LeadEnrichmentProvider;
  found: Record<string, string>;
  newFields: Record<string, string>;
  conflicts: LeadEnrichmentConflict[];
  sources: string[];
  rawResponse: string;
  websiteStatus?: WebsiteStatus;
  instagramStatus?: SocialStatus;
  facebookStatus?: SocialStatus;
  error?: string;
}

export interface LeadEnrichmentResult {
  leadId: string;
  providers: {
    gemini: LeadEnrichmentProviderResult;
    perplexity: LeadEnrichmentProviderResult;
  };
}

export interface BulkEnrichmentResult {
  leadId: string;
  success: boolean;
  updatedLead?: Lead;
  fieldsUpdated?: string[];
  error?: string;
}

// Bulk enrichment review types (preview mode - no auto-apply)
export interface BulkEnrichmentPreviewItem {
  leadId: string;
  lead: Lead;
  success: boolean;
  providers: {
    gemini: LeadEnrichmentProviderResult;
    perplexity: LeadEnrichmentProviderResult;
  };
  error?: string;
}


export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface Broadcast {
  id: string;
  name: string;
  audience_id: string;
  from: string;
  subject: string;
  reply_to: string | null;
  preview_text: string;
  status: BroadcastStatus;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
} 
