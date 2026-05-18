-- Households: top-level grouping for shared lists between partners
create table if not exists public.households (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now() not null
);

-- Users: members of households
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  name text,
  household_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint fk_household foreign key (household_id) references public.households(id) on delete cascade,
  constraint unique_email_household unique(email, household_id)
);

-- Lists: grocery lists (supermarket, pharmacy, house)
create table if not exists public.lists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check(type in ('supermarket', 'pharmacy', 'house')),
  household_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint fk_household foreign key (household_id) references public.households(id) on delete cascade
);

-- Items: individual items in a list
create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid not null,
  name text not null,
  qty text,
  section_id text,
  ticked boolean default false not null,
  order_index integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by_user_id uuid not null,
  constraint fk_list foreign key (list_id) references public.lists(id) on delete cascade,
  constraint fk_user foreign key (created_by_user_id) references public.users(id) on delete set null
);

-- List snapshots: archived trips (ticked items at end of shopping)
create table if not exists public.list_snapshots (
  id uuid default gen_random_uuid() primary key,
  list_id uuid not null,
  items_snapshot jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint fk_list foreign key (list_id) references public.lists(id) on delete cascade
);

-- Invite tokens: one-time invite links for partners
create table if not exists public.invite_tokens (
  id uuid default gen_random_uuid() primary key,
  household_id uuid not null,
  token_hash text not null,
  consumed_by_user_id uuid,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint fk_household foreign key (household_id) references public.households(id) on delete cascade,
  constraint fk_user foreign key (consumed_by_user_id) references public.users(id) on delete set null,
  constraint unique_token_hash unique(token_hash)
);

-- Categorizations cache: AI categorization results cached to avoid redundant API calls
create table if not exists public.categorizations_cache (
  id uuid default gen_random_uuid() primary key,
  item_name text not null,
  list_type text not null check(list_type in ('supermarket', 'pharmacy', 'house')),
  section_id text not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_categorization unique(item_name, list_type)
);

-- Indexes for common queries
create index if not exists idx_users_household on public.users(household_id);
create index if not exists idx_lists_household on public.lists(household_id);
create index if not exists idx_items_list on public.items(list_id);
create index if not exists idx_items_ticked on public.items(list_id, ticked);
create index if not exists idx_list_snapshots_list on public.list_snapshots(list_id);
create index if not exists idx_invite_tokens_household on public.invite_tokens(household_id);
create index if not exists idx_categorizations_type on public.categorizations_cache(list_type, item_name);

-- Row Level Security (RLS) — enable tables
alter table public.households enable row level security;
alter table public.users enable row level security;
alter table public.lists enable row level security;
alter table public.items enable row level security;
alter table public.list_snapshots enable row level security;
alter table public.invite_tokens enable row level security;
alter table public.categorizations_cache enable row level security;

-- RLS Policies: households
create policy "users can view their household"
  on public.households for select
  using (true);

-- RLS Policies: users (view own household members)
create policy "users can view household members"
  on public.users for select
  using (true);

create policy "users can insert themselves"
  on public.users for insert
  with check (true);

-- RLS Policies: lists (view own household lists)
create policy "users can view household lists"
  on public.lists for select
  using (
    household_id in (
      select household_id from public.users where id = auth.uid()
    )
  );

create policy "users can create lists in their household"
  on public.lists for insert
  with check (
    household_id in (
      select household_id from public.users where id = auth.uid()
    )
  );

create policy "users can update their household lists"
  on public.lists for update
  using (
    household_id in (
      select household_id from public.users where id = auth.uid()
    )
  );

-- RLS Policies: items
create policy "users can view items in their lists"
  on public.items for select
  using (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    )
  );

create policy "users can insert items in their lists"
  on public.items for insert
  with check (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    ) and created_by_user_id = auth.uid()
  );

create policy "users can update items in their lists"
  on public.items for update
  using (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    )
  );

create policy "users can delete items in their lists"
  on public.items for delete
  using (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    )
  );

-- RLS Policies: list_snapshots
create policy "users can view snapshots of their lists"
  on public.list_snapshots for select
  using (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    )
  );

create policy "users can create snapshots for their lists"
  on public.list_snapshots for insert
  with check (
    list_id in (
      select id from public.lists where household_id in (
        select household_id from public.users where id = auth.uid()
      )
    )
  );

-- RLS Policies: invite_tokens (allow reading own household invites)
create policy "users can view household invites"
  on public.invite_tokens for select
  using (
    household_id in (
      select household_id from public.users where id = auth.uid()
    )
  );

create policy "users can create invites for their household"
  on public.invite_tokens for insert
  with check (
    household_id in (
      select household_id from public.users where id = auth.uid()
    )
  );

-- RLS Policies: categorizations_cache (public read)
create policy "anyone can read cache"
  on public.categorizations_cache for select
  using (true);

-- Realtime subscriptions: enable for tables
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_snapshots;
