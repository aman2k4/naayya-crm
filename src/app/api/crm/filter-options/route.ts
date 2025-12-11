import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';

// In-memory cache for filter options
let filterOptionsCache: {
  countries: string[];
  platforms: string[];
  sources: string[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
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

    // Check if cache is valid
    const now = Date.now();
    if (filterOptionsCache && (now - filterOptionsCache.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: {
          countries: filterOptionsCache.countries,
          platforms: filterOptionsCache.platforms,
          sources: filterOptionsCache.sources
        },
        cached: true
      });
    }

    // Use raw SQL with DISTINCT for efficient unique value fetching
    const [countriesResult, platformsResult, sourcesResult] = await Promise.all([
      supabase.rpc('get_distinct_lead_countries'),
      supabase.rpc('get_distinct_lead_platforms'),
      supabase.rpc('get_distinct_lead_sources')
    ]);

    // Fallback to regular queries if RPC functions don't exist
    let countries: string[];
    let platforms: string[];
    let sources: string[];

    if (countriesResult.error) {
      // Fallback: use regular query with deduplication
      const { data: countryData } = await supabase
        .from('leads')
        .select('country_code')
        .not('country_code', 'is', null)
        .not('country_code', 'eq', '');
      countries = [...new Set(countryData?.map(d => d.country_code).filter(Boolean) || [])].sort();
    } else {
      countries = (countriesResult.data || []).map((r: { country_code: string }) => r.country_code).filter(Boolean).sort();
    }

    if (platformsResult.error) {
      const { data: platformData } = await supabase
        .from('leads')
        .select('current_platform')
        .not('current_platform', 'is', null)
        .not('current_platform', 'eq', '');
      platforms = [...new Set(platformData?.map(d => d.current_platform).filter(Boolean) || [])].sort();
    } else {
      platforms = (platformsResult.data || []).map((r: { current_platform: string }) => r.current_platform).filter(Boolean).sort();
    }

    if (sourcesResult.error) {
      const { data: sourceData } = await supabase
        .from('leads')
        .select('lead_source')
        .not('lead_source', 'is', null)
        .not('lead_source', 'eq', '');
      sources = [...new Set(sourceData?.map(d => d.lead_source).filter(Boolean) || [])].sort();
    } else {
      sources = (sourcesResult.data || []).map((r: { lead_source: string }) => r.lead_source).filter(Boolean).sort();
    }

    // Update cache
    filterOptionsCache = {
      countries,
      platforms,
      sources,
      timestamp: now
    };

    return NextResponse.json({
      success: true,
      data: {
        countries,
        platforms,
        sources
      },
      cached: false
    });

  } catch (error: unknown) {
    console.error('Error in filter-options API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
