# Database Schema & Setup

## Overview
This directory contains the PostgreSQL schema for the Grocery List app. All tables, indexes, and RLS (Row Level Security) policies are defined in `schema.sql`.

## Tables

### households
- `id` (uuid, PK): Unique identifier for household
- `created_at` (timestamp): Creation timestamp

Top-level grouping for shared lists between partners.

### users
- `id` (uuid, PK): Supabase Auth user ID
- `email` (text, NOT NULL): User's email (unique per household)
- `name` (text): Display name
- `household_id` (uuid, FK → households): Which household they belong to
- `created_at`, `updated_at` (timestamp): Timestamps

Constraint: `UNIQUE(email, household_id)` — same email can't be invited twice.

### lists
- `id` (uuid, PK): Unique list identifier
- `name` (text, NOT NULL): List name (e.g., "סופר תל אביב")
- `type` (text, NOT NULL): One of 'supermarket', 'pharmacy', 'house', 'vacation_abroad'
- `household_id` (uuid, FK → households): Which household owns this list
- `created_at`, `updated_at` (timestamp): Timestamps

### items
- `id` (uuid, PK): Item identifier
- `list_id` (uuid, FK → lists): Parent list
- `name` (text, NOT NULL): Item name (e.g., "חלב")
- `qty` (text): Quantity (e.g., "2 ליטר", "קילו")
- `section_id` (text): Auto-assigned section (e.g., "dairy")
- `ticked` (boolean, default false): Whether item is checked off
- `order_index` (integer, default 0): Position within section (for reordering)
- `created_by_user_id` (uuid, FK → users): Who created this item
- `created_at`, `updated_at` (timestamp): Timestamps

### list_snapshots
- `id` (uuid, PK): Snapshot identifier
- `list_id` (uuid, FK → lists): Parent list
- `items_snapshot` (jsonb): JSON array of items as they were when trip completed
- `created_at` (timestamp): When trip was completed

Stores archived trips for history.

### invite_tokens
- `id` (uuid, PK): Token identifier
- `household_id` (uuid, FK → households): Which household generated this invite
- `token_hash` (text, UNIQUE): Hashed token (never store plaintext)
- `consumed_by_user_id` (uuid, FK → users, nullable): User who claimed the token
- `expires_at` (timestamp): Token expiry (default 7 days)
- `created_at` (timestamp): Creation timestamp

One-time invites for partners to join.

### categorizations_cache
- `id` (uuid, PK): Cache entry ID
- `item_name` (text): Item being categorized (e.g., "חלב")
- `list_type` (text): Type of list (supermarket, pharmacy, house, vacation_abroad)
- `section_id` (text): Assigned section (e.g., "dairy")
- `created_at` (timestamp): When cached

Constraint: `UNIQUE(item_name, list_type)` — one assignment per item type.

AI categorization results cached to avoid redundant API calls.

## List Creation RPC

`create_list_with_items` creates a list and its optional initial items in one transaction. It runs with the authenticated caller's RLS permissions, so a failure rolls back both the list and its items. `vacation_abroad` supplies its 46-item template; existing list types supply an empty array.

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- **households**: Users can view their own
- **users**: Users can view household members, insert themselves
- **lists**: Users can view/create/update their household's lists
- **items**: Users can view/modify items in their lists
- **list_snapshots**: Users can view/create snapshots for their lists
- **invite_tokens**: Users can view/create invites for their household
- **categorizations_cache**: Public read (anyone can check cache)

## Realtime Subscriptions

The following tables are enabled for Supabase Realtime:
- `items` — real-time item updates
- `lists` — real-time list metadata changes
- `list_snapshots` — real-time trip completion

This allows partners to see changes within 2s without manual refresh.

## Setup Instructions

1. Create a Supabase project at https://supabase.com
2. For a new project, run `schema.sql`. For an existing project, apply new files from `migrations/` in numeric order.
3. Set up Supabase Auth with magic links:
   - Go to Authentication → Providers → Email
   - Enable "Email/Password" and "Magic Link"
   - Set redirect URL: `http://localhost:3000/auth/callback` (dev), `https://your-domain/auth/callback` (prod)
4. Copy your project credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
5. Run tests: `npm test`

## Indexes

Indexes are created on common query patterns:
- `idx_users_household` — fetch household members
- `idx_lists_household` — fetch lists in household
- `idx_items_list` — fetch items in list
- `idx_items_ticked` — count ticked items (for progress)
- `idx_invite_tokens_household` — fetch household invites
- `idx_categorizations_type` — cache lookup by item + list type

## Notes

- All timestamps use UTC (`with time zone`)
- UUIDs are generated server-side by Postgres (`gen_random_uuid()`)
- Soft deletes are not used; deletions are cascading or explicit
- Last-write-wins conflict resolution: server timestamp determines winner on concurrent edits
