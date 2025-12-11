import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks if a user is a global admin.
 *
 * @param supabase Initialized Supabase client instance.
 * @param userId The ID of the user to check.
 * @returns {Promise<boolean>} True if the user is a global admin, false otherwise.
 */
export async function isUserGlobalAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data: globalAdmin, error } = await supabase
      .from('global_admins')
      .select('profile_id')
      .eq('profile_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`Error checking global admin status for user ${userId}:`, error);
      return false;
    }
    return !!globalAdmin;
  } catch (error) {
    console.error('Unexpected error during global admin check:', error);
    return false;
  }
}
