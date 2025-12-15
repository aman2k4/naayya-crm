-- Migration: Fix leads_with_email_count view to include all leads columns
-- Date: 2025-12-15
-- Description: Use l.* instead of explicit column list so new columns are automatically included

-- Drop the existing view first (required because column order is changing)
DROP VIEW IF EXISTS public.leads_with_email_count;

CREATE VIEW public.leads_with_email_count AS
 SELECT l.*,
    COALESCE(es.contacted, false) AS contacted,
    COALESCE(es.email_status, 'not_sent'::text) AS email_status,
    es.last_event_type,
    es.last_event_timestamp,
    es.event_count,
    COALESCE(esc.emails_sent_count, (0)::bigint) AS emails_sent_count,
    rc.unsubscribed,
    rc.audience_id,
    rc.audience_name,
    rc.resend_contact_id,
    rc.contact_created_at,
    rc.synced_at
   FROM (((public.leads l
     LEFT JOIN ( SELECT DISTINCT ON ((lower(TRIM(BOTH FROM email_events."to")))) lower(TRIM(BOTH FROM email_events."to")) AS normalized_email,
            email_events."to" AS original_email,
            true AS contacted,
            email_events.event_type AS last_event_type,
            email_events.event_timestamp AS last_event_timestamp,
            count(*) OVER (PARTITION BY (lower(TRIM(BOTH FROM email_events."to")))) AS event_count,
                CASE
                    WHEN ((email_events.event_type ~~* '%bounce%'::text) OR (email_events.event_type ~~* '%failed%'::text)) THEN 'bounced'::text
                    WHEN ((email_events.event_type ~~* '%complaint%'::text) OR (email_events.event_type ~~* '%spam%'::text)) THEN 'complained'::text
                    WHEN (email_events.event_type ~~* '%click%'::text) THEN 'clicked'::text
                    WHEN (email_events.event_type ~~* '%open%'::text) THEN 'opened'::text
                    WHEN (email_events.event_type ~~* '%deliver%'::text) THEN 'delivered'::text
                    ELSE 'sent'::text
                END AS email_status
           FROM public.email_events
          ORDER BY (lower(TRIM(BOTH FROM email_events."to"))), email_events.event_timestamp DESC) es ON ((lower(TRIM(BOTH FROM l.email)) = es.normalized_email)))
     LEFT JOIN ( SELECT lower(TRIM(BOTH FROM email_events."to")) AS normalized_email,
            count(DISTINCT email_events.email_id) AS emails_sent_count
           FROM public.email_events
          GROUP BY (lower(TRIM(BOTH FROM email_events."to")))) esc ON ((lower(TRIM(BOTH FROM l.email)) = esc.normalized_email)))
     LEFT JOIN ( SELECT DISTINCT ON (resend_contacts_cache.email) resend_contacts_cache.email,
            resend_contacts_cache.unsubscribed,
            resend_contacts_cache.audience_id,
            resend_contacts_cache.audience_name,
            resend_contacts_cache.resend_contact_id,
            resend_contacts_cache.contact_created_at,
            resend_contacts_cache.synced_at
           FROM public.resend_contacts_cache
          ORDER BY resend_contacts_cache.email, resend_contacts_cache.synced_at DESC) rc ON ((lower(TRIM(BOTH FROM l.email)) = lower(TRIM(BOTH FROM rc.email)))));

COMMENT ON VIEW public.leads_with_email_count IS 'View combining leads with email engagement statistics. Uses l.* to automatically include all leads columns. Access controlled by RLS policies on the underlying leads table.';
