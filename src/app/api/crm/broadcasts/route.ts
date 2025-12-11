import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory cache for broadcasts
interface CachedBroadcasts {
  data: any;
  timestamp: number;
}

let broadcastCache: CachedBroadcasts | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function GET(req: NextRequest) {
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

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured.' }, { status: 500 });
    }

    const url = new URL(req.url);
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    const after = url.searchParams.get('after') || undefined;
    const before = url.searchParams.get('before') || undefined;

    // Create cache key based on query parameters
    const cacheKey = `${limit || 'all'}-${after || ''}-${before || ''}`;

    // Check if cache is valid for this specific query
    const now = Date.now();
    if (broadcastCache &&
        broadcastCache.data[cacheKey] &&
        (now - broadcastCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: broadcastCache.data[cacheKey],
        cached: true,
        cacheTimestamp: broadcastCache.timestamp
      });
    }

    // Fetch fresh data from Resend
    const broadcastsResponse = await resend.broadcasts.list();

    if (!broadcastsResponse.data) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch broadcasts.'
      }, { status: 500 });
    }

    // Extract the broadcasts array from the response
    const broadcastsData = broadcastsResponse.data as any;
    const broadcastsArray = Array.isArray(broadcastsData.data) ? broadcastsData.data : [];

    // Sort broadcasts by created_at in descending order (newest first)
    const sortedBroadcasts = broadcastsArray.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const responseData = {
      broadcasts: sortedBroadcasts,
      has_more: broadcastsData.has_more || false
    };

    // Update cache
    if (!broadcastCache) {
      broadcastCache = { data: {}, timestamp: now };
    }
    broadcastCache.data[cacheKey] = responseData;
    broadcastCache.timestamp = now;

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      cacheTimestamp: now
    });

  } catch (err: any) {
    console.error(`Error fetching broadcasts: ${err.message}`);

    // Handle specific Resend API errors
    if (err.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Resend API key.'
      }, { status: 401 });
    }

    if (err.status === 429) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch broadcasts.'
    }, { status: 500 });
  }
}