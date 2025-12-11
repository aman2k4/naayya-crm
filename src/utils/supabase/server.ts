import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import type { User as SupabaseUser } from '@supabase/supabase-js'

import { resolveCookieOptions } from './cookieOptions'

// Dual authentication: Bearer tokens (iOS) + Cookies (web)
// Backward compatible: no parameter = cookies only, with parameter = dual auth
export async function createClient(request?: NextRequest) {
  // Check for Bearer token first (mobile/API clients)
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      return createBearerClient(authHeader)
    }
  }

  // Default behavior: use cookies (existing functionality)
  return createCookieClient()
}

// Bearer token client for mobile/API authentication
function createBearerClient(authHeader: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // No cookies for Bearer token - provide minimal implementation
      cookies: {
        get() {
          return undefined
        },
        set() {
          // No-op
        },
        remove() {
          // No-op
        },
      },
      // Set global headers for all requests
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  )
}

// Cookie-based client for web browsers (existing behavior)
async function createCookieClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const resolvedOptions = resolveCookieOptions(options)
            cookieStore.set({ name, value, ...resolvedOptions })
          })
        },
      },
      cookieOptions: resolveCookieOptions(),
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )
}

// Service role client for admin operations (like webhooks)
export async function createClientForServiceRole() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}

// Get user server-side for SSR - used to pass initial auth state to client
// This avoids the client-side auth bootstrap delay
// Returns: User object if authenticated, null if not authenticated, undefined if check failed/skipped
export async function getServerUser(): Promise<SupabaseUser | null | undefined> {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Only check auth if Supabase auth cookies exist
    // This avoids unnecessary Supabase calls on public pages for logged-out users
    const hasAuthCookie = allCookies.some(cookie =>
      cookie.name.includes('-auth-token') || cookie.name.includes('sb-')
    )

    if (!hasAuthCookie) {
      // No auth cookies = definitely not logged in, no need to call Supabase
      return null
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      // Auth check failed - return undefined so client falls back to its own check
      console.error('[getServerUser] Auth check failed:', error.message)
      return undefined
    }

    // Explicitly checked: user is either authenticated (User) or not (null)
    return user
  } catch (err) {
    // Network/server error - return undefined so client falls back
    console.error('[getServerUser] Server error:', err)
    return undefined
  }
}
