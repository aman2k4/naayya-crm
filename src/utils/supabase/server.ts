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

