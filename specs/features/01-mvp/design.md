---
status: draft
date: 2026-05-18
brief: specs/features/01-mvp/brief.md
---

# Design: MVP — Shared Grocery List

## Screens Affected

- **Onboarding / Auth**: Sign-up and invite consumption (new)
- **List View**: Main persistent screen — displays all items grouped by section, add/edit/delete/tick interactions, and trip completion (new)
- **Item Add/Edit**: Modal or bottom sheet for creating or modifying an item (new)
- **Section Picker**: Modal or bottom sheet for overriding an item's assigned section (new)
- **Invite Link Share**: Minimal screen to generate and display a shareable URL (new)
- **Empty State**: Displayed when no items exist on the list (new)
- **Loading / Error States**: Global error handling for sync failures (new)

## Components

### New Components

- **`ListScreen`** — Main persistent view, renders sections with items, orchestrates add/tick/delete/drag interactions, displays trip-complete button.
  - Props: `items: Item[]`, `sections: Section[]`, `onAddItem`, `onEditItem`, `onDeleteItem`, `onTickItem`, `onReorderItem`, `onCompleteTrip`, `onGenerateInvite`, `isLoading: boolean`, `error?: string`
  - Children: `SectionGroup` (repeated), `AddItemButton` (sticky bottom or FAB), `CompleteTrip Button` (conditional)

- **`SectionGroup`** — One collapsible or always-expanded group of items under a section header.
  - Props: `section: Section`, `items: Item[]`, `illustration: ImageAsset`, `onTickItem`, `onEditItem`, `onDeleteItem`, `onReorderItem`, `isDragging: boolean`
  - Children: `ItemRow` (repeated)

- **`ItemRow`** — A single item with checkbox, name (+ optional quantity), edit/delete actions, and drag handle.
  - Props: `item: Item`, `onTick`, `onEdit`, `onDelete`, `isDragging: boolean`, `canDrag: boolean`
  - States: unticked (normal), ticked (strike-through + gray), editing (highlight feedback)

- **`AddItemSheet`** (or Modal) — Form to add or edit an item.
  - Props: `isOpen: boolean`, `existingItem?: Item`, `defaultSection?: Section`, `onSave: (item) => void`, `onCancel: () => void`
  - Fields: Name input (required, Hebrew), Quantity input (optional, free-text), Section display (read-only, changed via section picker)

- **`SectionPickerSheet`** — Modal with a scrollable list of all starter sections for the user to select.
  - Props: `isOpen: boolean`, `currentSection: Section`, `allSections: Section[]`, `onSelect: (section) => void`, `onCancel: () => void`
  - Behavior: Tapping a section dismisses the picker and applies the change to the item being edited.

- **`AuthFlow`** — Two-step: (1) Email entry, (2) Magic link landing page inside the app.
  - Screens: `EmailEntryScreen`, `MagicLinkValidationScreen`, `PostSignupScreen` (show invite-generation or wait for partner)
  - Props: `onSignupComplete`, `isInviteConsumption: boolean`, `inviteToken?: string`

- **`InviteLinkShareSheet`** — Displays the generated invite URL and copy-to-clipboard button.
  - Props: `inviteUrl: string`, `onDismiss: () => void`

- **`CompleteTrip Button`** — Sticky header or floating action, visible only when at least one item is ticked.
  - Props: `onComplete: () => void`, `isLoading: boolean`
  - Text: "סיימתי קניות" (I finished shopping)
  - Tapping shows a confirmation or immediately processes the trip end.

- **`EmptyState`** — Full-screen view when list is empty.
  - Props: none
  - Content: Illustration + message: "רשימה ריקה. הוסף פריט כדי להתחיל" (Empty list. Add an item to start.)

- **`ErrorBanner`** — Transient error message for sync/network failures.
  - Props: `message: string`, `onDismiss: () => void`
  - Behavior: Auto-dismisses after 4 seconds or on user tap.

### Reused / Extended Components

- **Checkbox** — Standard RTL checkbox from shadcn/ui, configured for 44px touch target.
- **Text Input** — Standard RTL text input with `dir="auto"` for mixed-language entry.
- **Bottom Sheet / Modal** — From shadcn/ui, positioned for mobile and RTL.
- **Button** — Primary (accent color) and secondary (outline) buttons, 44px minimum height.
- **Icon Button** — For edit/delete/drag handles, 44px size, directional icons mirrored in RTL.

### Modified Existing Components

None yet. All components are new.

## User Flow

### Sign-up & Invite (First User)
1. User opens the app, sees "Sign in" screen.
2. Enters email, receives magic link by email.
3. Taps magic link, lands inside the app, authenticated.
4. App detects user has no list and shows "Invite your partner" prompt.
5. User taps "Generate invite link", sees a modal with a shareable URL.
6. User copies and shares link via WhatsApp / messaging app.

### Invite Consumption (Second User)
1. Second user receives link via WhatsApp, opens it in browser.
2. Link contains an invite token and redirects to the sign-up flow.
3. Second user enters email, receives magic link, taps it.
4. On sign-in, the system consumes the invite token and auto-joins them to the list.
5. Both users now see the same shared list.

### Main List View & Shopping
1. User sees list grouped by sections, each section has a header + illustration + items below.
2. Sections are in a fixed order (per the starter dictionary).
3. Items within a section are in the order the user set (draggable).
4. To add an item: tap FAB or bottom-sticky add button, enter name + optional quantity, confirm.
  - System assigns section via dictionary or AI; user can override via "change section" action.
5. To edit an item: tap edit icon on the row, modify name/quantity, confirm.
6. To delete: tap delete icon (or swipe on mobile?).
7. To tick off while shopping: tap the checkbox, item gets strike-through and dims.
8. To untick: tap the checkbox again, strike-through removed.
9. To reorder within a section: long-press and drag the item to a new position within the same section.
  - Dragging out of section snaps back (no drop zone outside section).
10. Once at least one item is ticked, "סיימתי קניות" button appears (sticky top or bottom).
11. Tap "סיימתי קניות": confirm action, trip is archived, ticked items are removed, unticked items stay.
12. Partner opens app on next interaction, sees updated list without the ticked items.

### Offline Tolerance
1. All mutations (add, edit, delete, tick, reorder) apply optimistically to the local UI.
2. Network request fires in the background; if it fails, the mutation is queued.
3. When network returns, queued mutations are replayed.
4. Visual cue (optional): a subtle "syncing" indicator appears during offline writes; disappears when sync completes.
5. Conflict: if both partners edited the same field offline, last-write-wins (timestamp-based). No UI prompt.

## States

### Loading
- **First app load** (cold start): Show a loading skeleton with section placeholders and shimmer animations, or a simple spinner + "Loading your list…".
- **Item add/edit in flight**: Add button is disabled until response; submit button shows a spinner.
- **Sync in progress**: Subtle indicator (e.g., "Syncing…" text or a pulsing dot in the header).

### Empty
- Full-screen illustration + text: "רשימה ריקה. הוסף פריט כדי להתחיל" (Empty list. Add an item to start.)
- Add button remains accessible.

### Error
- **Network error on load**: "לא ניתן לטעון את הרשימה. בדוק חיבור ו נסה שוב" (Unable to load list. Check connection and try again.) with a retry button.
- **Item mutation fails**: Transient banner at the top, "שגיאה בעדכון. נסה שוב" (Error updating. Try again.). Auto-dismisses in 4s or on tap.
- **Auth error**: Redirect to sign-in with an error message.

### Success
- **Item added**: Item appears in its section immediately (optimistic). Slight fade-in animation.
- **Item ticked**: Strike-through appears with a smooth fade. Item remains visible.
- **Trip completed**: Confirmation modal, then ticked items fade out. A brief success message, e.g., "קניות שמורות בהיסטוריה" (Shopping archived to history.). List resets to unticked items.

## RTL / Hebrew Notes

### Final Hebrew Copy
- **Header**: "רשימת קניות שלנו" (Our Shopping List)
- **Add button**: "הוסף פריט" (Add Item) or just a "+" icon
- **Complete trip**: "סיימתי קניות" (I Finished Shopping)
- **Item quantity label**: "כמות" (Quantity)
- **Section name field**: "קטגוריה" (Category)
- **Empty state**: "רשימה ריקה. הוסף פריט כדי להתחיל" (Empty list. Add an item to start.)
- **Network error**: "לא ניתן לטעון את הרשימה. בדוק חיבור ו נסה שוב" (Unable to load list. Check connection and try again.)
- **Sign-in**: "כנס עם דוא״ל" (Sign in with email)
- **Invite**: "הזמן את השותף שלך" (Invite Your Partner)
- **Copy to clipboard**: "הועתק" (Copied) confirmation
- More strings finalized per component implementation.

### Mirrored Elements
- **Add button icon**: If using a "+" alone, no mirror needed. If a directional icon (e.g., arrow), mirror in RTL.
- **Edit / delete / drag handle icons**: All mirror.
- **Checkbox**: Standard RTL rendering (no manual mirror).
- **Back button** (if any): Chevron or arrow that points left-to-right in LTR, mirrors to right-to-left in RTL. Behavior: navigates logically backward.
- **Input fields**: Baseline right-alignment for text entry; cursor behavior handled by `dir="auto"`.

### Mixed-Direction Edge Cases
- **Item names**: If a user types "חלב Kerem" (milk brand), the system renders LTR-inside-RTL. Verify with `dir="auto"` on inputs.
- **Numbers**: A quantity like "3" or a date in a trip snapshot should render as part of the RTL paragraph. Test line-breaking and alignment.
- **Invite link URL**: Plain ASCII, rendered LTR within an RTL context. Ensure it doesn't break layout.

### Font
- **Primary font**: TBD — must include a strong Hebrew character set. Candidates: Rubik, Heebo, Assistant, Noto Sans Hebrew. **Decision deferred to next iteration with design tool.**
- **Fallback**: System font stack with Hebrew coverage.

## Layout & Interaction Details

### Main List View Layout
- **Viewport**: 375px mobile-first reference width.
- **Sections**: Full-width, each section is a card or raw group (TBD via design tool).
- **Section header**: Illustration (square or landscape, TBD) above the section title. Illustration size TBD with design tool.
- **Items**: Left-aligned list of rows, each row has checkbox (44px tap target) + name + quantity (if present) + edit/delete icons (44px each).
- **Bottom spacing**: Generous padding below the last section to avoid overlap with the "סיימתי קניות" button.
- **Add button**: Sticky to the bottom-right corner (FAB) or sticky bar at the bottom. TBD via design tool.
- **Complete trip button**: Sticky to the top or bottom, visible only when items are ticked.

### Drag & Drop
- **Within-section reordering**: Long-press an item to enter drag mode. A visual cue (e.g., lift/shadow effect) shows the item is draggable.
- **Drop zone**: Same section only. If user attempts to drag out of the section, the item snaps back.
- **Feedback**: Dragged item shows a shadow or opacity change; other items shift to make space.

### Tap Targets
- All interactive elements (checkbox, buttons, edit/delete icons, drag handle) are at least 44px in height and width for one-handed use in a supermarket aisle.

## Design System Impact

### New Tokens Needed (deferred to design tool)
- **Colors**: Primary accent, secondary, success (for ticked items), error, background, surface.
- **Typography**: Heading scale for section titles, body for item names, caption for quantity.
- **Spacing scale**: Consistent padding/margin across all components (already outlined in `context/design-system.md`).

### New Patterns
- **Optimistic updates**: State changes apply instantly, network request in background. System must handle rollback on failure.
- **Sticky headers / buttons**: Two affordances at opposite ends of the list (top: complete trip, bottom: add item). Ensure no overlap on small screens.
- **Bottom sheet / modal library**: Needed for add/edit and section picker. Confirm shadcn/ui supports RTL bottom sheets cleanly.

## Open Questions

- **Illustration source**: Where do section illustrations come from? AI-generated, hand-drawn, icon set, or curated assets? **Deferred to next cycle or design tool decision.**
- **Confirm action for trip completion**: Do we show a modal confirmation ("Are you sure?") or directly complete? **Recommend: small confirmation modal with option to undo** — to be finalized.
- **Undo for mutations**: Can a user undo a delete or an accidental tick? **Out of scope for MVP** — no undo history.
- **Sync indicator visibility**: Should users see "Syncing…" when offline changes are replayed? **Recommend: subtle, auto-hiding** — final decision deferred to next iteration.
- **Add button placement**: FAB in bottom-right, sticky bar at bottom, or top sticky bar? **Deferred to design tool**, but must be accessible during shopping (not hidden behind keyboard).
- **Section illustrations**: Static image, placeholder, or hidden until design is ready? **Deferred to design tool** — recommend starting with colored backgrounds and section emoji as fallback.
- **Keyboard handling**: When add-item sheet is open, does the keyboard push the sheet up or overlay it? **Deferred to design tool** — recommend push-up behavior for mobile.

## Next Phase: Tech Lead

Tech Lead will:
1. Confirm component architecture and state management strategy.
2. Choose realtime sync provider (Supabase, Pusher, polling).
3. Design the data model and offline-first storage layer.
4. Break design into tasks with tests.
