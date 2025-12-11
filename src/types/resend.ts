// Types for Resend API responses and cached data

export interface ResendAudience {
  id: string;
  name: string;
  created_at: string;
}

export interface ResendContact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  unsubscribed: boolean;
}

export interface ResendAudienceResponse {
  object: 'list';
  data: ResendAudience[];
}

export interface ResendContactsResponse {
  object: 'list';
  data: ResendContact[];
}

// Cached contact data in our database
export interface CachedContact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  resend_contact_id: string;
  contact_created_at: string | null;
  audience_id: string;
  audience_name: string;
  synced_at: string;
}

// API response types
export interface SyncStatsResponse {
  success: boolean;
  audiencesProcessed: number;
  contactsProcessed: number;
  contactsUpserted: number;
  duplicatesSkipped: number;
  syncedAt: string;
  error?: string;
}

export interface ContactListsResponse {
  email: string;
  found: boolean;
  audiences: Array<{
    id: string;
    name: string;
  }>;
}