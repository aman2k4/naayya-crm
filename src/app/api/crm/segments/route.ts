import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory cache for segments
interface CachedSegments {
  data: any;
  timestamp: number;
}

let segmentCache: CachedSegments | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const createSegmentSchema = z.object({
  name: z.string().min(1, 'Segment name is required'),
});

export async function GET() {
  try {
    console.log('[Segments API] GET request received');

    if (!process.env.RESEND_API_KEY) {
      console.error('[Segments API] RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Resend API key not configured.' }, { status: 500 });
    }

    // Check if cache is valid
    const now = Date.now();
    if (segmentCache && (now - segmentCache.timestamp) < CACHE_DURATION) {
      console.log('[Segments API] Returning cached data');
      return NextResponse.json({
        segments: segmentCache.data,
        cached: true,
        cacheTimestamp: segmentCache.timestamp
      });
    }

    console.log('[Segments API] Fetching from Resend API');
    // Fetch fresh data from Resend - using audiences.list() since segments API may not be available yet
    const segmentsResponse = await resend.audiences.list();

    console.log('[Segments API] Resend response:', {
      hasData: !!segmentsResponse.data,
      dataLength: segmentsResponse.data?.data?.length
    });

    if (!segmentsResponse.data) {
      console.error('[Segments API] No data returned from Resend');
      return NextResponse.json({ error: 'Failed to fetch segments.' }, { status: 500 });
    }

    // Update cache
    segmentCache = {
      data: segmentsResponse.data,
      timestamp: now
    };

    console.log('[Segments API] Successfully fetched segments');
    return NextResponse.json({
      segments: segmentsResponse.data,
      cached: false,
      cacheTimestamp: now
    });

  } catch (err: any) {
    console.error(`[Segments API] Error fetching segments:`, err);
    console.error(`[Segments API] Error details:`, {
      message: err.message,
      status: err.status,
      stack: err.stack
    });

    // Handle specific Resend API errors
    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid Resend API key.' }, { status: 401 });
    }

    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    return NextResponse.json({
      error: 'Failed to fetch segments.',
      details: err.message
    }, { status: 500 });
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
    const validationResult = createSegmentSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return NextResponse.json({
        error: 'Validation failed',
        details: errorMessage
      }, { status: 400 });
    }

    const { name } = validationResult.data;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 });
    }

    try {
      // Create the segment in Resend - using audiences.create() since segments API may not be available yet
      const segment = await resend.audiences.create({ name });

      if (!segment || !segment.data?.id) {
        throw new Error('Failed to create segment - no ID returned');
      }

      // Clear the segment cache since we've added a new segment
      segmentCache = null;

      return NextResponse.json({
        success: true,
        segment: {
          id: segment.data.id,
          name: segment.data.name,
          object: segment.data.object
        },
        message: `Successfully created segment "${name}"`
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);
      return NextResponse.json({
        error: 'Failed to create segment in Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get('segmentId');

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured' }, { status: 500 });
    }

    try {
      // Delete the segment from Resend - using audiences.remove() since segments API may not be available yet
      await resend.audiences.remove(segmentId);

      // Clear the segment cache
      segmentCache = null;

      return NextResponse.json({
        success: true,
        message: 'Segment deleted successfully'
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);
      return NextResponse.json({
        error: 'Failed to delete segment in Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
