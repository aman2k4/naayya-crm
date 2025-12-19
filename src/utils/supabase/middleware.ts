import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { resolveCookieOptions } from './cookieOptions'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            const resolvedOptions = resolveCookieOptions(options)
            supabaseResponse.cookies.set(name, value, resolvedOptions)
          })
        },
      },
      cookieOptions: resolveCookieOptions(),
    }
  )

  // IMPORTANT: Do not use getSession() here - it doesn't revalidate the token.
  // getUser() sends a request to Supabase Auth server to verify/refresh the token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
