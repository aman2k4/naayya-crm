# CLAUDE.md
This is an interanl tool for Naayya. It is used to manage the CRM, look for new leads, and manage the leads send emails etc.

## General Rules
- Use pnpm as package manager
- App runs on port 4000

## Backend database schema
- For the complete database schema, read the file `/Users/amanagarwal/Documents/personal/tools/yambooking/supabase/schema.sql`. It is for READ ONLY PURPOSES.

## TypeScript
- Only create an abstraction if it's actually needed
- Prefer clear function/variable names over inline comments
- Avoid helper functions when a simple inline expression would suffice
- Use `knip` to remove unused code if making large changes
- The `gh` CLI is installed, use it
- Don't use emojis
- Don't unnecessarily add `try`/`catch`
- Don't cast to `any`

## React
- Avoid massive JSX blocks and compose smaller components
- Colocate code that changes together
- Avoid `useEffect` unless absolutely needed
- Always prefer shadcn/ui components over custom components when available

## Tailwind
- Mostly use built-in values, occasionally allow dynamic values, rarely globals
- Always use v4 + global CSS file format + shadcn/ui

## Next.js
- Prefer fetching data in RSC (page can still be static)
- Use next/font + next/script when applicable
- next/image above the fold should have `sync` / `eager` / use `priority` sparingly
- Be mindful of serialized prop size for RSC -> child components
- Route params must be typed as `Promise<{ paramName: string }>` and awaited with `await params`
- API paths: `/api/studios/[studioId]/...` for studio-specific endpoints, `/api/admin/...` only for global admin endpoints