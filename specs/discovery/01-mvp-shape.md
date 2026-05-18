---
status: closed
date: 2026-05-18
participants: User, Claude (Discovery)
---

# 01 — MVP Shape

## Idea

A Hebrew-first, RTL, mobile-web (PWA) shared grocery list for two partners (the user and his girlfriend). One always-on rolling list both can edit from anywhere. In the supermarket either partner ticks items; ticked items strike through but stay visible until "סיימתי קניות" is tapped, which archives the trip as a snapshot and resets the live list (unticked items survive into the next trip). Items are auto-organized into sections by an AI categorizer with user override. Each section has its own illustration; individual items do not. Sync is silent — no push notifications in MVP. Sign-in is magic-link by email; partner #2 joins via a one-time invite link the first user shares (e.g. through WhatsApp).

## Open Questions Raised

- Rolling list vs new-list-per-trip vs hybrid?
- What happens to a ticked item visually — remove, strike-through, or move to "bought" bucket?
- Who decides which section an item belongs to — fixed dictionary, user, or AI?
- Does the partner get push notifications on add/tick, or is sync silent?
- What happens to unticked items when a trip is marked complete?
- How does partner #2 actually get into the list the first time?
- Email + password, magic link, or OAuth for sign-in?
- Do items need a structured quantity, free text, or no quantity at all?
- Does the app need a separate "shopping mode" UI, or does one screen serve both edit and shop?
- How are illustrations produced — AI per-item, AI per-section, curated set?
- What sections ship in v1 of the Hebrew dictionary?
- Does the MVP need offline support for flaky in-store signal?
- How is conflict handled when both partners add the same item near-simultaneously?

## Decisions

### Product shape
- **List model**: hybrid — one rolling "next trip" list that is always-on; tapping "סיימתי קניות" archives the trip as a snapshot in history and resets the list. **Unticked items survive into the next trip** (they do not get archived).
- **Tick behavior**: strike-through. Ticked items remain visible until trip end, so the partner can see what was bought.
- **Single screen, no mode switch**: the same list view serves both adding-at-home and ticking-in-the-store. The only trip ceremony is the "סיימתי קניות" button.
- **Sections**: items are auto-assigned to sections by AI on add, with a user override. A starter Hebrew dictionary caches common items to keep AI calls cheap.
- **Illustrations**: one illustration per section. No per-item illustrations in MVP.
- **Quantity**: optional free-text field on each item (e.g. "שתי חבילות", "קילו", "3"). No structured unit picker.
- **Notifications**: silent — partner sees updates on next open. No push in MVP.

### Auth & sharing
- **Sign-in**: magic link by email. No passwords.
- **Sharing model**: exactly two users per list (MVP scope — multi-user / multi-list deferred).
- **Partner invite**: the first user generates a one-time invite link from inside the app and shares it via any chat (WhatsApp, etc.). Partner #2 opens the link, signs up by magic link, and is automatically joined to the shared list.

### Locale & feel
- Hebrew-first, RTL. No English UI in MVP.
- Mobile-first PWA. Installable on iOS / Android home screens.

## Cost & risk notes (carried forward to PM / Tech Lead)
- **AI sectioning cost**: a naive per-add LLM call could exceed the $5/month infra target. Mitigations: (a) ship a curated Hebrew starter dictionary covering the common ~200 items so most adds skip the API; (b) cache every categorization globally so each unique item costs at most one call ever; (c) defer the AI call asynchronously — drop the item into a default section, re-shuffle when the answer arrives.

## Still Open (blockers for brief)

*None.* All decisions needed to write the brief are made.

## Deferred to later phases (not blockers)

- **PM phase**
  - Concrete list of starter sections (e.g. חלב, ירקות ופירות, בשר ודגים, יבש, אפייה, ניקיון, חטיפים, משקאות, קפואים, אחר…).
  - Conflict handling for near-simultaneous duplicate adds.
  - History UX — how / whether past trip snapshots are browsable.
- **Design phase**
  - Illustration style and source (AI-generated, hand-picked, icon set, etc.).
  - Active-list visual treatment for ticked vs unticked items.
  - Add-item interaction (sticky bottom input vs modal vs other).
- **Tech Lead phase**
  - Offline support strategy (offline-first PWA vs online-only).
  - Realtime sync provider (Supabase Realtime, Pusher, polling).
  - AI provider for sectioning and the caching layer that protects the cost target.

## Graduates to Feature Brief?

**Yes.** Proposed feature folder: `specs/features/01-mvp-shared-list/`.
