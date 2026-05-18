# Tech Stack

> Most choices are **draft** at project start. Lock them in the first Tech Lead cycle.

## Runtime
- **Framework**: Next.js (App Router, latest stable)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS (with RTL plugin / logical properties)
- **Components**: shadcn/ui (RTL-configured)
- **Package manager**: npm (matches v0 output)

## Internationalization
- **i18n**: TBD — `next-intl` or `next-i18next`. Hebrew is the only locale for MVP, but no hard-coded strings in JSX.
- **Direction**: `dir="rtl"` on `<html>`; verify all primitives render correctly.
- **Date/number formatting**: `Intl.*` APIs with `he-IL`.

## Data
- **Database**: TBD — Neon.tech (PostgreSQL) or Supabase. Supabase wins if its Realtime is the simplest fit for shared-list sync.
- **ORM**: Prisma if Neon; Supabase's client if Supabase
- **Realtime sync**: TBD — Supabase Realtime, Pusher, or Postgres LISTEN/NOTIFY behind a small WS layer

## Auth
- **Provider**: TBD — must support inviting a partner. Magic-link or OAuth (Google) likely.

## Hosting & Deploy
- **App hosting**: Vercel
- **Database hosting**: Neon or Supabase (chosen with DB)
- **Domain**: TBD
- **PWA**: manifest + service worker, installable on iOS / Android home screen

## Testing
- **Unit / component**: Vitest + React Testing Library
- **E2E**: Playwright (only if needed beyond MVP)
- **RTL coverage**: at least one snapshot/visual check per screen confirming RTL layout

## Repo Conventions
- Branches: `feature/NN-<feature>/T<n>-<slug>`
- Commits: `feat(NN-<feature>): T<n> — <short message>`
- PRs: one task per PR, body references `specs/features/NN-<feature>/tasks.md#T<n>`

## Constraints
- Infra cost target: under $5/month
- All services must have a free tier that covers two-user personal use
- No paid dependencies without explicit approval
