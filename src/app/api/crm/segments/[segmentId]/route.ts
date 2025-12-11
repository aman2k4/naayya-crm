import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ segmentId: string }> }
) {
  try {
    const params = await context.params;
    const { segmentId } = params;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured.' }, { status: 500 });
    }

    if (!segmentId) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 });
    }

    try {
      // Fetch segment details from Resend - using audiences.get() since segments API may not be available yet
      const segmentResponse = await resend.audiences.get(segmentId);

      if (!segmentResponse.data) {
        return NextResponse.json({ error: 'Segment not found.' }, { status: 404 });
      }

      return NextResponse.json({
        segment: segmentResponse.data
      });

    } catch (resendError: any) {
      console.error('Resend API error:', resendError);

      if (resendError.status === 404) {
        return NextResponse.json({ error: 'Segment not found.' }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to fetch segment from Resend',
        details: resendError.message || 'Unknown Resend API error'
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error(`Error fetching segment: ${err.message}`);

    // Handle specific Resend API errors
    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid Resend API key.' }, { status: 401 });
    }

    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'Failed to fetch segment.' }, { status: 500 });
  }
}
