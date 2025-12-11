import type { CookieOptions } from '@supabase/ssr'

const DEFAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export const resolveCookieOptions = (overrides: CookieOptions = {}): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production'
  const sameSite = overrides.sameSite ?? (isProduction ? 'none' : 'lax')
  const baseDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  const shouldSetDomain =
    !!baseDomain && !baseDomain.includes('localhost') && !baseDomain.includes('127.0.0.1')

  return {
    ...overrides,
    path: overrides.path ?? '/',
    sameSite,
    secure: overrides.secure ?? (sameSite === 'none' ? true : isProduction),
    maxAge: overrides.maxAge ?? DEFAULT_COOKIE_MAX_AGE,
    httpOnly: overrides.httpOnly ?? false,
    ...(shouldSetDomain ? { domain: baseDomain } : {}),
  }
}

export const COOKIE_MAX_AGE_SECONDS = DEFAULT_COOKIE_MAX_AGE
