# CLAUDE.md

## General Rules
- Use pnpm as package manager
- App runs on port 4000

## Commands
```bash
pnpm dev      # http://localhost:4000
pnpm build    # Production build
pnpm start    # Production server on port 4000
pnpm lint     # ESLint
```

## Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth + Database)
- Resend (Email)
- Zod (Validation)

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── crm/          # CRM API routes
│   │   └── user/         # User API (auth)
│   ├── contexts/         # React contexts (UserContext)
│   ├── crm/              # CRM pages & components
│   └── providers.tsx     # QueryClient + UserProvider
├── components/ui/        # Shared UI components
├── hooks/                # Custom hooks (use-toast)
├── lib/
│   ├── crm/              # Email templates & helpers
│   └── utils.ts          # cn() utility
├── types/                # TypeScript types
└── utils/
    ├── permissions.ts    # isUserGlobalAdmin
    └── supabase/         # Supabase clients
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in your values from yambooking.

## Database
Uses the same Supabase backend as yambooking. Required tables:
- `leads`
- `leads_with_email_count` (view)
- `email_events`
- `resend_contacts_cache`
- `global_admins`
- `profiles`
