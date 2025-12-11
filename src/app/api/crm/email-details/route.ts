import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailId = searchParams.get('emailId');

    if (!emailId) {
      return NextResponse.json({ error: 'Missing emailId parameter.' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key not configured.' }, { status: 500 });
    }

    // Fetch email details from Resend
    const emailDetails = await resend.emails.get(emailId);

    if (!emailDetails.data) {
      return NextResponse.json({ error: 'Email not found.' }, { status: 404 });
    }

    return NextResponse.json({ email: emailDetails.data });
  } catch (err: any) {
    console.error(`Error fetching email details: ${err.message}`);
    
    // Handle specific Resend API errors
    if (err.message?.includes('not found') || err.status === 404) {
      return NextResponse.json({ error: 'Email not found in Resend.' }, { status: 404 });
    }
    
    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid Resend API key.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch email details.' }, { status: 500 });
  }
}