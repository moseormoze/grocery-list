---
status: pending-approval
date: 2026-05-18
brief: specs/features/01-mvp/brief.md
design: specs/features/01-mvp/design.md
---

# Tasks: MVP — Shared Grocery List

## Overview

This feature is broken into 16 tasks grouped into 5 workstreams:
1. **Data & Infrastructure** (T1–T3)
2. **Auth & Sharing** (T4–T6)
3. **Core List Features** (T7–T12)
4. **Offline & Sync** (T13–T14)
5. **Polish & PWA** (T15–T16)

All tasks assume:
- Database: Supabase (Postgres + Realtime) or equivalent
- Auth: Magic links via Supabase Auth or similar
- Frontend framework: Next.js with React, TypeScript, Tailwind
- Component library: shadcn/ui (RTL-configured)
- i18n: next-intl (Hebrew only in MVP)
- State management: React Context + hooks for local state, Supabase for server state

---

## Task List

### T1 — Database Schema & Auth Infrastructure
**Goal:** Set up Postgres schema for households, users, lists, items, and invite tokens. Configure Supabase Auth (magic-link sign-up/sign-in).

**Files likely touched:**
- `lib/db/schema.sql` (or Prisma schema if using ORM)
- `lib/supabase/client.ts`
- `app/auth/` (auth callback / redirect)
- `.env.local` (Supabase keys)

**Schema includes:**
- `households` (id, created_at)
- `users` (id, email, name, household_id, created_at)
- `lists` (id, name, type, household_id, created_at, updated_at)
- `items` (id, list_id, name, qty, section_id, ticked, order_index, created_at, updated_at, created_by_user_id)
- `list_snapshots` (id, list_id, items_snapshot (JSON), created_at) — for trip history
- `invite_tokens` (id, household_id, token_hash, consumed_by_user_id, expires_at, created_at)
- `categorizations_cache` (item_name, list_type, section_id, created_at) — for AI categorization caching

**Auth setup:**
- Magic-link flow via Supabase Auth or custom JWT
- Session stored in httpOnly cookie
- Middleware to protect authenticated routes

**Test strategy:** Schema validation, basic CRUD operations on each table, auth token lifecycle.

**Depends on:** None (external services: Supabase)

**Done when:**
- [ ] Postgres schema created and migrations applied
- [ ] Supabase Auth configured for magic-link sign-up/sign-in
- [ ] User can receive magic link via email and sign in
- [ ] Session cookie set and validated on protected routes
- [ ] Basic integration tests pass

---

### T2 — Realtime Sync Foundation
**Goal:** Set up Supabase Realtime subscriptions for items list. Implement silent sync: when a user refreshes or re-opens the app, they fetch the latest list state.

**Files likely touched:**
- `lib/supabase/realtime.ts` (subscription helpers)
- `app/lists/[listId]/page.tsx` (subscribe on mount)
- `hooks/useList.ts` (custom hook for list state + realtime)

**Behavior:**
- On list view mount, subscribe to changes on the items table (filtered by list_id).
- When a change arrives (insert, update, delete), update local state.
- No push notifications (MVP silent sync only).
- Optimistic updates: local state changes immediately; server write happens in background.

**Test strategy:** Unit tests for subscription logic, integration test for item insertion triggering a re-render.

**Depends on:** T1 (database schema)

**Done when:**
- [ ] useList hook returns items, loading, error state
- [ ] New item inserted by partner appears on first user's screen within 2s of next sync (manual refresh)
- [ ] Optimistic updates: local state changes immediately on user action
- [ ] Tests pass for subscription lifecycle

---

### T3 — Offline Mutation Queue
**Goal:** Implement local SQLite / IndexedDB queue for mutations when offline. Replay mutations when connectivity returns.

**Files likely touched:**
- `lib/offline/queue.ts` (enqueue, dequeue, replay logic)
- `hooks/useOfflineQueue.ts`
- `lib/supabase/sync.ts` (integration with T2)

**Behavior:**
- When a user edits (add, tick, delete, reorder) and network is unavailable, mutations are enqueued locally with a timestamp.
- When network returns, replay mutations in order. Server applies last-write-wins for field conflicts.
- Visual cue (optional): subtle "Syncing..." indicator while replaying.
- No UI prompt for conflicts — server decides based on timestamp.

**Test strategy:** Unit tests for queue operations, offline/online simulation, conflict resolution.

**Depends on:** T2 (realtime sync)

**Done when:**
- [ ] Mutations queued and persisted locally while offline
- [ ] Mutations replayed in order when connectivity returns
- [ ] Last-write-wins applied correctly for conflicting edits
- [ ] Tests pass for offline + reconnect scenarios

---

### T4 — Magic Link Sign-Up & Email Verification
**Goal:** Implement sign-up flow: email entry → magic link sent → user taps link → name entry → signed in.

**Files likely touched:**
- `app/auth/signup/page.tsx` (email entry form)
- `app/auth/callback/route.ts` (magic link validation, redirect)
- `app/auth/name/page.tsx` (post-link name entry)
- `lib/supabase/auth.ts` (sign-up logic)

**Screens:**
1. **Email entry**: Text input for email, validate format, submit to Supabase Auth (triggers email send).
2. **Magic link check**: Placeholder screen while user checks email. ("בדוק את הדוא״ל שלך")
3. **Magic link click**: Browser redirects to `/auth/callback?code=...` — validates code, creates session.
4. **Name entry**: If user is new, show name input. If existing user (returning via invite link), skip this or show "welcome back".
5. **Redirect**: On completion, redirect to dashboard (`/lists`).

**Hebrew copy:**
- "כנס עם דוא״ל" — Sign in with email
- "כתובת דוא״ל" — Email address
- "שלח קישור התחברות" — Send sign-in link
- "בדוק את הדוא״ל שלך" — Check your email
- "מה שמך?" — What's your name?
- "המשך" — Continue

**RTL Notes:**
- Form labels and button text rendered in RTL.
- Email input has `dir="auto"` for mixed-direction entry.
- Email display pill is LTR-in-RTL (ensure layout respects this).

**Test strategy:** Unit tests for form validation, integration tests for email sending and magic link redirect, E2E for full flow.

**Depends on:** T1 (auth infrastructure)

**Done when:**
- [ ] Email validation works (basic format check + Supabase validation)
- [ ] Magic link sent via Supabase Auth
- [ ] User redirected to name entry on successful link click
- [ ] User created in database with name and email
- [ ] Session established and user redirected to dashboard
- [ ] Hebrew copy correct and RTL layout verified
- [ ] Tests pass

---

### T5 — Invite Link Generation & Sharing
**Goal:** Signed-in user with no partner can generate a one-time invite link. Share via copy-to-clipboard or external link.

**Files likely touched:**
- `app/lists/invite/page.tsx` (invite screen — shown if user has no partner)
- `lib/supabase/invites.ts` (generate token, create row in invite_tokens table)
- `components/InviteLinkShare.tsx` (display URL, copy button)

**Behavior:**
- User taps "Invite Partner" or sees a prompt on empty dashboard.
- App generates a unique token and creates an `invite_tokens` row (expires in 7 days or one-time).
- URL format: `https://app.example.com/invite?token=<token>`
- User sees a modal with the URL, copy button, and optional "Share via WhatsApp" (deep link).
- After copy, show "Copied" toast (Hebrew: "הועתק").

**Hebrew copy:**
- "הזמן את השותף שלך" — Invite Your Partner
- "קישור הזמנה" — Invite link
- "העתק" — Copy
- "שתף ב־WhatsApp" — Share via WhatsApp

**Test strategy:** Unit tests for token generation, integration test for invite row creation, E2E for copy and share flow.

**Depends on:** T1 (database schema for invite_tokens), T4 (auth)

**Done when:**
- [ ] Signed-in user can generate invite link
- [ ] Token stored in invite_tokens table with expiry
- [ ] User can copy link to clipboard
- [ ] "Copied" toast appears and auto-dismisses
- [ ] Link format is correct (includes token param)
- [ ] Hebrew copy correct and RTL verified
- [ ] Tests pass

---

### T6 — Invite Link Consumption
**Goal:** When a second user opens an invite link, they sign up via magic link and are auto-joined to the inviter's household.

**Files likely touched:**
- `app/invite/[token]/page.tsx` (invite landing page)
- `lib/supabase/invites.ts` (consume token, link user to household)
- `app/auth/callback/route.ts` (extend to handle invite flow)

**Behavior:**
1. Invite link `https://app.example.com/invite?token=<token>` is opened in browser.
2. Page validates token (not expired, not consumed).
3. If valid, redirect to sign-up with token embedded in session state (or URL param).
4. User completes magic-link sign-up (email → magic link → name entry).
5. On successful sign-up, consume the invite token and add user to the inviter's household.
6. Both users now see the same dashboard.

**Errors (user-facing copy in Hebrew):**
- "קישור ההזמנה פג תוקף" — Invite link expired
- "קישור זה כבר שימש" — This link was already used
- "אתה כבר חבר במשק זה" — You're already a member of this household

**RTL Notes:**
- Error messages in Hebrew, RTL rendering.

**Test strategy:** Unit tests for token validation and consumption, integration test for user creation + household linking, E2E for full invite flow.

**Depends on:** T1 (invite_tokens schema), T4 (sign-up flow), T5 (token generation)

**Done when:**
- [ ] Invalid / expired invite token shows error
- [ ] Valid token redirects to sign-up
- [ ] User completes sign-up and is added to household
- [ ] Both users see same lists on dashboard
- [ ] Token marked as consumed and cannot be reused
- [ ] Error messages in Hebrew and RTL correct
- [ ] Tests pass

---

### T7 — Dashboard / Home Screen
**Goal:** Display all lists for the household, show member avatars, progress badges, list type chips. Allow creating new lists.

**Files likely touched:**
- `app/lists/page.tsx` (dashboard)
- `components/ListCard.tsx` (individual list card)
- `components/CreateListSheet.tsx` (bottom sheet for new list)

**Screens:**
- **Header**: Show both household members' names and avatars (sample data: אילון, דנה).
- **List grid**: Card per list, showing:
  - List name (e.g., "סופר תל אביב")
  - Type emoji + label (e.g., 🛒 סופר)
  - Progress badge (e.g., "4 of 12" or "ריקה" if empty)
  - Last edited info (e.g., "ערכה אתמול · דנה")
  - Progress bar (filled % = ticked items / total)
- **Create list button**: FAB or card at bottom of list.
- **Empty state**: If no lists, show illustration + "צור רשימה ראשונה" (Create your first list).

**Hebrew copy:**
- "הרשימות שלנו" — Our lists
- "צור רשימה חדשה" — Create new list
- "רשימה ריקה" — Empty
- "X מתוך Y פריטים" — X out of Y items

**RTL Notes:**
- Avatars stacked right-to-left.
- Progress badge and last-edited text in RTL.
- Card layout mirrors in RTL.

**Test strategy:** Unit tests for list card rendering, integration tests for fetching lists, E2E for create/navigate flow.

**Depends on:** T2 (realtime list subscription), T4 (auth)

**Done when:**
- [ ] Dashboard fetches and displays all lists for household
- [ ] List cards show name, type, progress, last edited
- [ ] Progress bar renders correctly
- [ ] Empty state shown if no lists
- [ ] Create new list button navigates to creation flow
- [ ] Member avatars display correctly
- [ ] Hebrew copy and RTL verified
- [ ] Tests pass

---

### T8 — Create List Flow
**Goal:** User picks a name and type (supermarket, pharmacy, house) and creates a new list. New list appears on dashboard.

**Files likely touched:**
- `components/CreateListSheet.tsx` (already referenced in T7)
- `lib/supabase/lists.ts` (create list mutation)

**Behavior:**
- Bottom sheet with:
  - Text input for list name (placeholder: "סופר תל אביב")
  - Three buttons for type: 🛒 סופר, 💊 בית מרקחת, 🏠 בית
  - Disabled submit button until name is entered
- On submit, create row in `lists` table with name, type, household_id.
- Sheet closes, new list appears on dashboard.
- User can tap list to view details.

**Hebrew copy:**
- "רשימה חדשה" — New list
- "שם הרשימה" — List name
- "סוג הרשימה" — List type
- "צור" — Create

**Test strategy:** Unit tests for form validation, integration test for list creation.

**Depends on:** T7 (dashboard), T2 (realtime)

**Done when:**
- [ ] Form validates name (required, max length ~50 chars)
- [ ] Type selection works
- [ ] List created in database
- [ ] New list appears on dashboard in real-time
- [ ] Hebrew copy and RTL verified
- [ ] Tests pass

---

### T9 — List View - Browse Mode (Shopping)
**Goal:** Display all items grouped by sections. Render sections with headers + illustrations. Show progress badge. Add and Complete Trip buttons visible.

**Files likely touched:**
- `app/lists/[listId]/page.tsx` (main list view)
- `components/ListView.tsx` (container)
- `components/SectionGroup.tsx` (section card with items)
- `components/ItemRow.tsx` (individual item)
- `hooks/useListItems.ts` (fetch and subscribe to items)

**Sections display:**
- Section header with emoji + colored background (e.g., 🥬 ירקות ופירות)
- Items below, grouped and ordered by user's drag order
- Empty sections hidden (per brief)

**Item rows (browse mode):**
- Large checkbox (44px touch target) on left
- Item name + quantity on right
- Unticked: normal text
- Ticked: strike-through + dimmed (opacity ~0.5)

**Top bar:**
- List name, type emoji, "משותפת" (shared) indicator
- Back button

**Progress strip:**
- "בואו נתחיל" / "בעיצומה של הקניה" / "הכל בעגלה" text
- Progress bar showing % ticked

**Bottom buttons:**
- "+ הוסף פריט" (persistent, always visible)
- "סיימתי קניות" (appears when ≥1 item ticked, with icon)

**Test strategy:** Integration tests for rendering items + sections, unit tests for tick logic.

**Depends on:** T2 (realtime), T8 (list creation)

**Done when:**
- [ ] Items displayed under correct sections
- [ ] Empty sections hidden
- [ ] Progress strip renders with correct text + bar
- [ ] Item rows show checkbox + name + qty
- [ ] Ticked items strike-through
- [ ] Buttons visible correctly (Add always, Complete when ticked)
- [ ] Hebrew copy and RTL verified
- [ ] Tests pass

---

### T10 — List View - Edit Mode
**Goal:** Toggle to edit mode (tap pencil icon). Show drag handle, edit, and delete icons. Hide checkbox. Add button pinned top, Save button pinned bottom.

**Files likely touched:**
- `app/lists/[listId]/page.tsx` (mode toggle)
- `components/ListView.tsx` (conditional rendering for edit mode)
- `components/ItemRow.tsx` (conditionally show grip/edit/delete)

**Edit mode changes:**
- Checkbox hidden
- Grip handle (⋮⋮) appears on left
- Pencil and trash icons appear on right (44px each)
- "+ הוסף פריט" button pinned to top
- "שמור" (Save) button pinned to bottom
- Section headers visible (items still grouped)

**Interactions (deferred to T11–T12):**
- Drag to reorder within section
- Edit button → opens modal (T11)
- Delete button → removes item (T12)

**Test strategy:** Unit tests for mode toggle, visual regression test for layout change.

**Depends on:** T9 (browse mode)

**Done when:**
- [ ] Mode toggle works (pencil button in top bar)
- [ ] Edit mode layout correct (grip/edit/delete visible, checkbox hidden)
- [ ] Add + Save buttons pinned and visible
- [ ] Hebrew copy correct
- [ ] Tests pass

---

### T11 — Add / Edit Item Modal
**Goal:** Open bottom sheet to add new item or edit existing. Fields: name (required), qty (optional), section (auto-assigned, overridable).

**Files likely touched:**
- `components/AddEditSheet.tsx`
- `lib/supabase/items.ts` (upsert logic)
- `lib/sectioning/categorize.ts` (AI categorization + cache lookup)

**Modal behavior:**
- **Add flow**: "הוסף פריט" title, empty fields, default section auto-assigned
- **Edit flow**: "ערוך פריט" title, fields pre-filled, "עדכן" button instead of "הוסף"
- **Section field**: Shows current section, tap to open picker (T12)
- **Auto-section note**: "נבחר אוטומטית" (auto-selected) for new items

**Sectioning logic:**
- On add with name, query `categorizations_cache` for exact match
- If cache miss, query AI categorizer (LLM call), cache result
- If no confidence, default to "אחר" (other)
- User can override via section picker

**Hebrew copy:**
- "הוסף פריט" — Add item
- "ערוך פריט" — Edit item
- "שם הפריט" — Item name
- "כמות (אופציונלי)" — Quantity (optional)
- "קטגוריה" — Category
- "בחר קטגוריה" — Choose category
- "נבחר אוטומטית" — Auto-selected
- "הוסיף" / "עדכן" — Add / Update

**Test strategy:** Unit tests for form validation, integration tests for item creation/update, unit test for sectioning logic (cache hit/miss/AI call).

**Depends on:** T3 (offline mutations), T2 (realtime)

**Done when:**
- [ ] Form validates name (required, max ~100 chars)
- [ ] Qty field accepts any Hebrew text
- [ ] Section auto-assigned from cache or AI
- [ ] User can override section (opens picker)
- [ ] Item created/updated on submit
- [ ] Modal closes and list updates
- [ ] Hebrew copy and RTL verified
- [ ] Cache working (adding same item twice triggers one AI call)
- [ ] Tests pass

---

### T12 — Edit / Delete / Reorder Items
**Goal:** Edit button opens modal (T11), delete removes item with undo toast, drag within section reorders.

**Files likely touched:**
- `components/ItemRow.tsx` (edit/delete button handlers)
- `lib/supabase/items.ts` (delete, update order_index)
- `components/DragContext.tsx` (drag-reorder logic)

**Edit:** Tap pencil → opens modal with pre-filled fields (T11).

**Delete:** Tap trash → item removed immediately (optimistic), undo toast appears (Hebrew: "ביטול" button, 4s auto-dismiss). On undo, item restored.

**Reorder (within section only):**
- Long-press item → enter drag mode (visual: lift/shadow effect)
- Drag within section → other items shift
- Drag out of section → snap back (no cross-section moves)
- Drop → update `order_index` for affected items
- Reordering persists to partner on next sync

**Hebrew copy:**
- "הפריט נמחק" — Item deleted
- "ביטול" — Undo
- Drag affordance (optional label): "החזק וגרור כדי לסדר מחדש" (optional UX text)

**RTL Notes:**
- Drag handle mirrors in RTL
- Undo toast in RTL

**Test strategy:** Unit tests for delete logic, integration test for order_index updates, E2E for drag-reorder flow.

**Depends on:** T10 (edit mode), T11 (modal)

**Done when:**
- [ ] Edit button opens modal with pre-filled data
- [ ] Delete removes item and shows undo toast
- [ ] Undo restores item
- [ ] Drag reorders items within section only
- [ ] Drag out of section snaps back
- [ ] Reorder persists to database
- [ ] Hebrew copy and RTL verified
- [ ] Tests pass

---

### T13 — Tick / Untick Items
**Goal:** Tap checkbox to toggle ticked state. Ticked items show strike-through. Progress badge updates.

**Files likely touched:**
- `components/ItemRow.tsx` (checkbox handler)
- `lib/supabase/items.ts` (update ticked field)

**Behavior:**
- Tap checkbox → `ticked` field flips true/false
- Ticked: strike-through text + dimmed (opacity ~0.5)
- Unticked: normal text
- Progress badge updates in real-time ("X of Y", "בעיצומה של הקניה", etc.)
- "סיימתי קניות" button appears when ticked ≥1

**Animation:**
- Strike-through appears with smooth fade (~250ms)
- Opacity change on text

**Test strategy:** Unit tests for ticked state, integration test for progress update, E2E for visual feedback.

**Depends on:** T9 (browse mode), T2 (realtime)

**Done when:**
- [ ] Checkbox toggles ticked state
- [ ] Strike-through renders on ticked items
- [ ] Opacity dims ticked items
- [ ] Progress badge updates correctly
- [ ] Complete Trip button appears/disappears based on ticked count
- [ ] Animations smooth
- [ ] Tests pass

---

### T14 — Trip Completion (Archive Ticked Items)
**Goal:** Tap "סיימתי קניות" → show confirmation modal → archive trip snapshot (ticked items + timestamp) → remove ticked items from live list → show success toast.

**Files likely touched:**
- `components/CompleteTrip Modal.tsx`
- `lib/supabase/trips.ts` (create snapshot, update list)

**Modal confirmation:**
- Title: "סיימתי את הקניות?" (Did you finish shopping?)
- Body: "N פריטים שסומנו יוסרו. המשך?" (N items marked will be removed. Continue?)
- Buttons: "אישור, סיימתי" (Confirm), "ביטול" (Cancel)

**On confirm:**
1. Create row in `list_snapshots` (list_id, items JSON, timestamp)
2. Delete all ticked items from `items` table (or set deleted_at for soft delete)
3. Unticked items remain
4. Show success toast: "קניות שמורות בהיסטוריה" (Shopping archived to history) + 2.6s auto-dismiss

**Partner sees:**
- On next sync/refresh, they see the updated list (ticked items gone, unticked remain)

**Test strategy:** Integration test for snapshot creation, unit test for modal logic, E2E for full flow.

**Depends on:** T13 (tick logic), T2 (realtime)

**Done when:**
- [ ] Complete Trip button visible when ticked ≥1
- [ ] Modal shows correct count of ticked items
- [ ] Confirm creates snapshot and removes ticked items
- [ ] Success toast appears and auto-dismisses
- [ ] Partner sees updated list on next sync
- [ ] Hebrew copy correct
- [ ] Tests pass

---

### T15 — Empty / Loading / Error States
**Goal:** Graceful handling of empty lists, loading, network errors, auth errors.

**Files likely touched:**
- `app/lists/[listId]/page.tsx` (conditional rendering)
- `components/EmptyState.tsx`
- `components/SkeletonLoader.tsx`
- `components/ErrorBanner.tsx`

**States:**

**Empty:**
- Full-screen illustration + message: "רשימה ריקה. הוסף פריט כדי להתחיל"
- Add button still accessible

**Loading (cold start):**
- Skeleton loaders for section placeholders + items (shimmer animation)
- Or simple spinner + "טוען את הרשימה שלך…" (Loading your list…)

**Error (network):**
- Red banner: "לא ניתן לטעון את הרשימה. בדוק חיבור ו נסה שוב" (Unable to load list. Check connection and try again.) + Retry button
- Or full-screen error screen with illustration

**Error (mutation fails):**
- Transient banner: "שגיאה בעדכון. נסה שוב" (Error updating. Try again.) + auto-dismiss 4s or tap

**Auth error (session expired):**
- Redirect to sign-in with message: "פג הזמן שלך. הכנס שוב" (Session expired. Sign in again.)

**Test strategy:** Unit tests for state rendering, integration tests for error scenarios.

**Depends on:** T9 (list view), T2 (realtime)

**Done when:**
- [ ] Empty list shows illustration + text + add button
- [ ] Loading shows skeleton or spinner
- [ ] Network error shows banner with retry
- [ ] Mutation error shows transient banner
- [ ] Auth error redirects to sign-in
- [ ] Hebrew copy correct and RTL verified
- [ ] Tests pass

---

### T16 — PWA Setup & Install
**Goal:** Add manifest.json and service worker for offline caching and home-screen installation on iOS/Android.

**Files likely touched:**
- `public/manifest.json` (web app manifest)
- `app/layout.tsx` (manifest link)
- `public/service-worker.js` (or Next.js service worker)
- `lib/pwa/register.ts` (optional: explicit registration)

**Manifest includes:**
- Name: "רשימת קניות" (Grocery List)
- Short name: "רשימה"
- Icon set (192x192, 512x512 PNG)
- Theme color: app's primary accent (TBD from design)
- Background color: app background
- Display: fullscreen / standalone
- Start URL: /lists
- Scope: /
- Orientation: portrait

**Service worker:**
- Cache app shell (HTML, JS, CSS)
- Cache API responses (list data) with network-first or cache-first strategy
- Handle offline fallback (already handled by offline queue in T3)

**PWA install prompt:**
- Browser will prompt "Add to Home Screen" on supported browsers
- Optional: custom install banner (deferred if time)

**Test strategy:** Manual test on iOS Safari and Android Chrome for install prompt and full-screen launch. Lighthouse PWA audit.

**Depends on:** All other tasks (T1–T15)

**Done when:**
- [ ] manifest.json valid and linked in HTML
- [ ] Service worker registered and caching static assets
- [ ] App installable on iOS Safari (Add to Home Screen)
- [ ] App installable on Android Chrome (Install prompt)
- [ ] Launched from home screen opens full-screen without browser chrome
- [ ] Offline cached files load on revisit
- [ ] Lighthouse PWA audit score ≥90
- [ ] Tests pass

---

### T17 — i18n Setup & Hebrew Copy (If not bundled into T1–T16)
**Goal:** Centralize all Hebrew strings in i18n files (next-intl or similar). Remove hard-coded strings from JSX.

**Files likely touched:**
- `messages/he.json` (Hebrew message catalog)
- `lib/i18n/config.ts` (i18n configuration)
- All JSX files (replace hard-coded strings with `useTranslations()`)

**Strings included:**
- All UI copy (buttons, labels, placeholders)
- Toast messages
- Error messages
- State messages (empty, loading, error)

**Test strategy:** Lint to catch hard-coded Hebrew strings, unit test for i18n hook.

**Depends on:** All tasks (strings collected from T4–T16)

**Done when:**
- [ ] All Hebrew strings in messages/he.json
- [ ] No hard-coded Hebrew in JSX (lint passes)
- [ ] useTranslations() used throughout
- [ ] Mixed-direction text (e.g., brand names) uses `dir="auto"`
- [ ] Tests pass

---

## Build Order

```
T1 (Database & Auth)
  ↓
T2 (Realtime Sync)
  ↓
T3 (Offline Queue)
  ↓
T4 (Sign-Up)
  ↓
T5 (Invite Gen)
  ↓
T6 (Invite Consumption) ← T4 + T5 prerequisite
  ↓
T7 (Dashboard)
  ↓
T8 (Create List) ← T7 prerequisite
  ↓
T9 (Browse Mode) ← T8 prerequisite
  ↓
T10 (Edit Mode) ← T9 prerequisite
  ↓
T11 (Add/Edit Modal) ← T10 prerequisite
  ↓
T12 (Edit/Delete/Reorder) ← T11 prerequisite
  ↓
T13 (Tick/Untick) ← T12 prerequisite
  ↓
T14 (Trip Completion) ← T13 prerequisite
  ↓
T15 (States & Errors) ← Can run in parallel with T13-T14, but finalized after
  ↓
T16 (PWA) ← T1-T15 complete
  ↓
T17 (i18n) ← T1-T16 complete (final polish pass)
```

**Critical path:** T1 → T2 → T3 → T4 → T6 → T7 → T9 → T13 → T14 → T16 (~ 17 PRs, ~3-4 weeks for one engineer at normal velocity)

---

## Risks & Notes

### Infrastructure & Cost
- **AI categorization cost**: Starter dictionary should cover ~80% of common items. Remaining 20% trigger LLM calls. Monitor cache hit ratio.
- **Realtime subscriptions**: Supabase Realtime can scale to thousands of subscriptions. Monitor for connection limits on $5/month free tier.
- **Database size**: MVP assumes <1000 lists, <10k items total. No archival strategy yet.

### RTL & Hebrew
- Mixed-direction text (Hebrew item + English brand name) must use `dir="auto"` on inputs and have test coverage.
- Icons (chevron, trash, pencil, grip) must mirror. Verify all icon libraries support RTL.
- Number formatting: quantities like "3" or "500ג" must render correctly in RTL context (test with visual regression).

### Offline & Sync
- Last-write-wins can lead to unexpected results if two partners edit the same item simultaneously offline. Example: Partner A sets qty to "קילו", Partner B sets it to "חבילה" while offline. After reconnect, the later timestamp wins. No conflict UI shown.
- Offline queue is in-memory (T3) plus localStorage fallback for resilience. If user force-closes the app, queued mutations may be lost (acceptable for MVP).

### Auth & Sharing
- Invite tokens expire in 7 days. No UI reminder to the first user if partner doesn't join quickly.
- Once both users are in the household, they are fully equal (both can create lists, delete items, complete trips). No role distinction.

### Performance
- List view renders all items + sections. If a list grows to 1000+ items, consider virtualization or pagination (out of scope for MVP, but note for future).
- Drag-reorder updates `order_index` for each affected item. If 500 items in a section, reordering to the top triggers 500 updates. Batch updates (UPSERT in Postgres) recommended.

### Testing Coverage
- Critical path (auth, list CRUD, trip completion) should have E2E tests.
- Offline scenarios (add while offline, reconnect, sync) should have integration tests.
- RTL layout should have visual regression tests (at least 1 snapshot per screen).
- Accessibility: Keyboard navigation, screen reader labels (shadcn/ui handles most).

---

## Acceptance Criteria (for Tech Lead approval)

- [ ] All 17 tasks have clear, testable "Done when" criteria
- [ ] Dependencies are explicit and buildable in order
- [ ] Each task is < 200 LOC diff (rough estimate, not strict)
- [ ] Hebrew copy is finalized or marked "TBD with user"
- [ ] RTL concerns are flagged for each task involving layout or icons
- [ ] Risks are identified and mitigation strategies noted
- [ ] Build order is optimized for parallel work (where safe)
- [ ] No open questions blocking T1 start
