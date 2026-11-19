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

## Automatic supermarket categorization (007)

For an existing database, run **only** `migrations/007_auto_categorization.sql` in the Supabase SQL Editor before deploying the updated app. Do not rerun the full schema against an existing database. The migration is additive and can be reapplied. It does not change existing items or copy the old public cache.

`household_item_categorizations` keeps separate manual and AI categories per household and whitespace-normalized name. Authenticated users may read their own household's rows. Only the checked save RPC writes them. Manual preferences survive item/list deletion and completed trips. The last committed manual save wins for future automatic additions.

- `get_supermarket_categorization` authorizes the list/item and returns memory using the database's canonical normalization.
- `save_supermarket_item` saves the item and a manual preference in one transaction. A per-household/name transaction lock and a final preference lookup protect against late AI replies. No transaction stays open during an AI call.
- `preserve` edits retain the stored category without learning a preference. Explicit manual `other` is remembered. AI fallback is never learned.
- AI cache version: `claude-haiku-5-5:groceries-v1`. No global cache is used by the feature.

The Next.js server needs `ANTHROPIC_API_KEY`. `.env.local` is sufficient for local development. Configure the same variable in the hosting environment for a deployed app, without a `NEXT_PUBLIC_` prefix. Never commit the key. The API uses the caller's Supabase cookie session, not a service-role key. Missing/unavailable Claude falls back to `other`, while unavailable memory/storage is a save error.

### Isolated database checks

With Docker running, execute `npm run test:categorization:db`. This creates a temporary PostgreSQL 16 container with Supabase-compatible auth roles, loads the schema, reapplies migration 007, runs rollback/RLS/memory scenarios, and runs two concurrent sessions with observed lock contention. The container is removed afterward. It never reads `.env.local` or connects to the real database. The first run may download the standard `postgres:16-alpine` image.

This is a database integration test, not a substitute for a two-user check against the actual Supabase deployment. Regular Vitest schema checks only verify migration packaging.

### Release check

After migration and deployment, use two authenticated household members:

1. Add a new supermarket item in automatic mode.
2. Manually change its category, save, then delete the item.
3. From the partner's account, add the same name with surrounding spaces. Confirm it uses the correction, including an explicit choice of `other`.
4. Refresh both clients and verify the saved category remains. Try a different item name to confirm no partial matching.
5. Verify a failed save leaves the editor contents intact. Verify the cosmic feedback appears only for a successful automatic save and respects reduced motion.

To roll back the app, deploy the previous application version and retain the new table and functions. Do not drop the table, which would erase remembered corrections. Older clients do not learn new preferences, so update both clients when enabling the feature.
