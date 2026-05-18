---
status: draft
date: 2026-05-18
discovery: specs/discovery/01-mvp-shape.md
---

# Feature: MVP — Shared Grocery List

## Problem

Two partners currently maintain groceries in fragmented places — paper, Notes, WhatsApp screenshots — and constantly duplicate items, forget what the other asked for, and re-type the same staples every week. There is no single source of truth that both can read and edit from anywhere, and nothing that survives between trips. If we don't build this, the couple keeps falling back to chat messages and paper, and "shared grocery list" stays an unsolved chore.

## User Story

As one of two partners sharing a household, I want a single Hebrew, mobile-friendly list that my partner and I can both add to from anywhere and tick off together in the supermarket, so that we stop duplicating items, never forget what the other asked for, and don't have to start a new list from scratch every week.

## Scope — What's In

### Accounts & sharing
- Magic-link email sign-up and sign-in. Each user enters their own name during sign-up.
- A signed-in user can generate a one-time invite link from inside the app and share it externally (WhatsApp, etc.).
- Opening an unused invite link in a browser starts magic-link sign-up; the invitee enters their name and is auto-joined to the inviter's household.
- Exactly two users per household. Invite link is single-use and expires when consumed.
- Both users see the same dashboard with all lists. Either user can pick any list and edit it.

### Multiple lists per household
- A household can have multiple lists. Each list has a **type**: supermarket, pharmacy, or house.
- Creating a new list requires picking its type; the type determines the default item sections.
- List names are user-defined (e.g. "סופר תל אביב", "אתא פארם", "רהיטים לשינה").
- Each list is fully shared: both users can add, edit, delete, tick items, and initiate a trip completion.

### List behavior (per-list)
- Add an item: name (required), quantity (optional, free-text Hebrew, e.g. "קילו", "שתי חבילות").
- Edit an item's name or quantity.
- Delete an item.
- Tick an item — it strike-throughs and stays visible.
- Untick an item.
- Items are auto-grouped into sections on screen.
- A user can override an item's section from a section picker.
- A user can drag to reorder items **within a section**. Section order itself is fixed by the canonical Hebrew section list.

### Sectioning (per list type)
On add, the item is assigned to a section using: (1) a curated Hebrew starter dictionary first, (2) an AI categorizer fallback for unknown items, (3) results cached globally so each unique item costs at most one categorization call ever.

**Supermarket list sections:**
- מוצרי חלב (dairy)
- ירקות ופירות (produce)
- בשר ודגים (meat & fish)
- יבש (dry goods / pantry)
- אפייה ומאפייה (bakery & baking)
- ניקיון (cleaning supplies)
- חטיפים (snacks)
- משקאות (beverages)
- קפואים (frozen)
- אחר (other)

**Pharmacy list sections:**
- ניקיון הבית (house cleaning)
- מוצרי היגינה (hygiene products)
- תרופות (medicine)
- אחר (other)

**House list sections:**
- למטבח (kitchen)
- איחסון (storage)
- רהיט (furniture)
- חשמל (electrical)
- אחר (other)

Items the system cannot confidently categorize land in the "אחר" section for that list type. Each section displays an illustration above its items.

### Trip flow & progress
- A status badge shows progress for the current trip (e.g. "4 of 12 items checked"). This gives both users a sense of whether the shopping is done.
- A "סיימתי קניות" action archives the current state as a trip snapshot, removes ticked items from the live list, and leaves unticked items on the live list for next time.
- Trip snapshot is persisted (date + items + ticked status). MVP does not require a UI to browse history beyond the most recent snapshot — see Out of Scope.

### Sync
- Silent sync: when a user opens the app (or pulls to refresh), they see the latest state including any of their partner's changes.
- No push notifications.

### Offline tolerance
- The app uses **optimistic local writes**: tapping add / edit / delete / tick / reorder updates the UI instantly from local state.
- If the network is unavailable when a write fires, the mutation is queued locally and replayed when connectivity returns.
- Conflict policy: **last-write-wins per item field** (e.g. if both partners edited the same item's quantity while offline, the later timestamp wins). No conflict UI.
- Scope is offline-*tolerant*, not offline-first. The app may render an empty state on a cold open with no network (we do not guarantee that the full list is browsable offline without a prior load).

### Locale & platform
- 100% Hebrew UI, RTL throughout. No English copy in MVP.
- Mobile-first responsive web app.
- Installable as a PWA on iOS and Android home screens (manifest + service worker).

## Out of Scope

- Push notifications of any kind.
- Three or more users per household, custom list types, or household/group concepts.
- Browsable trip history UI (snapshots are persisted but no list-of-past-trips screen).
- Suggested items, autocomplete, recurring staples, smart re-add.
- Per-item illustrations.
- Recipes, meal planning, store sections by aisle, price tracking, coupons.
- Voice input, OCR, barcode scan.
- Native iOS/Android apps.
- English UI / second locale.
- Password auth, OAuth providers.
- Conflict-resolution UI for simultaneous duplicate adds (Design picks a deterministic dedupe rule; no user-facing conflict screen).
- Custom user-created sections or reordering sections.
- Reordering whole sections, or moving items across sections by drag (change section via the section picker instead).
- Editing or deleting an already-archived trip snapshot.
- Full offline browsing of a list never previously loaded on the device.

## Acceptance Criteria

### Auth & invite
- [ ] A new user can sign up by entering an email, receiving a magic link, tapping it, entering their name, and landing signed-in inside the app.
- [ ] A signed-in user with no partner sees an action to generate an invite link; tapping it produces a shareable URL.
- [ ] An invite URL opened in a fresh browser triggers magic-link sign-up for the recipient; the recipient enters their name, and on completion both users see the same dashboard with all lists.
- [ ] An invite URL cannot be used twice.
- [ ] A user who is already a member of a household cannot consume a different invite link (clear error state — copy finalized in Design).

### Multiple lists
- [ ] A user can create a new list by picking a name and a type (supermarket, pharmacy, house).
- [ ] Both users see the same dashboard showing all lists and their progress.
- [ ] Either user can pick any list and add/edit/delete items, tick, or initiate trip completion.

### List behavior
- [ ] Adding an item with a Hebrew name (e.g. "חלב") makes it appear within 1s on the same device.
- [ ] Adding an item with a quantity stores and displays the free-text quantity alongside the name.
- [ ] Editing an item's name or quantity updates the displayed item.
- [ ] Deleting an item removes it from the list.
- [ ] Tapping an unticked item's checkbox renders the item with a visible strike-through; it stays in its section.
- [ ] Tapping a ticked item's checkbox returns it to the unticked visual.
- [ ] Items added on one device appear on the partner's device the next time the partner opens or refreshes the app, within 2s of that open/refresh.
- [ ] No real-time push to the partner is sent (verifiable by absence of push registration code paths).
- [ ] A user can drag an item to reorder it within its section; the new order persists locally and to the partner's device on next sync.
- [ ] Dragging an item out of its section is disallowed (visual snap-back or no-op).

### Offline tolerance
- [ ] With the network disabled, adding / editing / deleting / ticking / reordering an item updates the on-screen list immediately.
- [ ] Mutations performed while offline are persisted to the partner's view within 5s of network restoration on the originating device, without any user action beyond regaining connectivity.
- [ ] If both partners edited the same field of the same item while offline, the later timestamp wins after both reconnect.

### Sectioning (per list type)
- [ ] Every item on a list is rendered under exactly one section header from that list's type-specific sections.
- [ ] An item whose Hebrew name exists in the starter dictionary is assigned its dictionary section without an AI call (verifiable in logs / network).
- [ ] An item not in the dictionary triggers at most one categorization call across the lifetime of the app for that exact string (verifiable: adding the same novel item twice triggers one call total).
- [ ] A user can change an item's section via a section picker (only among sections for that list's type); the new section persists for that item.
- [ ] Items the categorizer returns nothing confident for land in "אחר" for that list type.
- [ ] Each non-empty section renders its illustration above its items.

### Progress & trip completion
- [ ] A status badge shows "X of Y items checked" for the current trip.
- [ ] The "סיימתי קניות" button is visible when at least one item is ticked.
- [ ] Tapping "סיימתי קניות" archives the current trip (ticked + unticked snapshot with timestamp), removes ticked items from the live list, and leaves unticked items on the live list.
- [ ] After "סיימתי קניות", the partner sees the same updated live list on their next open/refresh.

### Hebrew / RTL
- [ ] The document direction is RTL (`dir="rtl"` on `<html>` or equivalent).
- [ ] No hard-coded English strings are present in any user-visible component (verifiable by lint / grep on JSX text nodes).
- [ ] Directional icons (chevrons, arrows, send-style affordances) render mirrored under RTL.
- [ ] On a 375px mobile viewport, every primary screen renders without horizontal overflow.

### PWA
- [ ] The app exposes a valid manifest and is installable as a PWA on iOS Safari and Android Chrome (verifiable by browser install prompt / "Add to Home Screen").
- [ ] After installation, launching from the home screen opens the app full-screen without browser chrome.

### Cost
- [ ] Total monthly infrastructure cost for two-user usage stays under USD 5 (verifiable by provider billing dashboards after first full month).

## Dependencies

- **Depends on**: closed discovery `specs/discovery/01-mvp-shape.md`. No prior features.
- **Blocks**: all post-MVP work (history browse, staples, push notifications, multi-user, offline, etc.).

## Open Questions

*None.* All product decisions needed to design are made. Items listed in the discovery doc's "Deferred to later phases" belong to Design or Tech Lead, not PM.
