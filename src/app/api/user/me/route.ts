import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isUserGlobalAdmin } from '@/utils/permissions';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is global admin
    const isGlobalAdmin = await isUserGlobalAdmin(supabase, user.id);

    // Get basic profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      profile: profile || { id: user.id, email: user.email },
      isGlobalAdmin,
    });
  } catch (error) {
    console.error('Error in /api/user/me:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
