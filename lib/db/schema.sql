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

-- Lists: shared lists by built-in type
create table if not exists public.lists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check(type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad')),
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
  list_type text not null check(list_type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad')),
  section_id text not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_categorization unique(item_name, list_type)
);

-- Keep type constraints current when this schema is applied to an existing project.
alter table public.lists drop constraint if exists lists_type_check;
alter table public.lists add constraint lists_type_check
  check (type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad'));
alter table public.categorizations_cache drop constraint if exists categorizations_cache_list_type_check;
alter table public.categorizations_cache add constraint categorizations_cache_list_type_check
  check (list_type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad'));

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

create policy "users can delete their household lists"
  on public.lists for delete
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

-- Invite token RPCs
-- These run with security definer so an authenticated invitee can validate and
-- consume their own token before they've been linked to a household — at that
-- point they have no row in public.users, so the row-level select policy on
-- invite_tokens would otherwise lock them out. The functions look up by
-- token_hash, which the caller cannot guess without already possessing the
-- plaintext token, so bypassing RLS here is safe.
create or replace function public.validate_invite_token(p_token_hash text)
returns table (household_id uuid, is_valid boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.invite_tokens%rowtype;
begin
  select * into v_token from public.invite_tokens where token_hash = p_token_hash;

  if not found then
    return query select null::uuid, false, 'NOT_FOUND'::text;
    return;
  end if;

  if v_token.consumed_by_user_id is not null then
    return query select v_token.household_id, false, 'CONSUMED'::text;
    return;
  end if;

  if v_token.expires_at < now() then
    return query select v_token.household_id, false, 'EXPIRED'::text;
    return;
  end if;

  return query select v_token.household_id, true, 'OK'::text;
end;
$$;

create or replace function public.consume_invite_token(p_token_hash text, p_user_id uuid)
returns table (household_id uuid, is_valid boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.invite_tokens%rowtype;
begin
  -- for update locks the row so two invitees racing the same token can't both win
  select * into v_token from public.invite_tokens where token_hash = p_token_hash for update;

  if not found then
    return query select null::uuid, false, 'NOT_FOUND'::text;
    return;
  end if;

  if v_token.consumed_by_user_id is not null then
    return query select v_token.household_id, false, 'CONSUMED'::text;
    return;
  end if;

  if v_token.expires_at < now() then
    return query select v_token.household_id, false, 'EXPIRED'::text;
    return;
  end if;

  update public.invite_tokens
    set consumed_by_user_id = p_user_id
    where id = v_token.id;

  return query select v_token.household_id, true, 'OK'::text;
end;
$$;

revoke execute on function public.validate_invite_token(text) from anon, public;
revoke execute on function public.consume_invite_token(text, uuid) from anon, public;
grant execute on function public.validate_invite_token(text) to authenticated;
grant execute on function public.consume_invite_token(text, uuid) to authenticated;

-- Atomic list creation. The function uses the caller's permissions, so the
-- existing list/item RLS policies validate household membership and ownership.
create or replace function public.create_list_with_items(
  p_name text,
  p_type text,
  p_household_id uuid,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_list public.lists%rowtype;
  v_result jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  insert into public.lists (name, type, household_id)
  values (trim(p_name), p_type, p_household_id)
  returning * into v_list;

  insert into public.items (list_id, name, qty, section_id, order_index, created_by_user_id)
  select
    v_list.id,
    item ->> 'name',
    nullif(item ->> 'qty', ''),
    item ->> 'section_id',
    (item ->> 'order_index')::integer,
    auth.uid()
  from jsonb_array_elements(p_items) as item;

  select jsonb_build_object(
    'list', to_jsonb(v_list),
    'items', coalesce(jsonb_agg(to_jsonb(i) order by i.order_index), '[]'::jsonb)
  )
  into v_result
  from public.items i
  where i.list_id = v_list.id;

  return v_result;
end;
$$;

revoke execute on function public.create_list_with_items(text, text, uuid, jsonb) from anon, public;
grant execute on function public.create_list_with_items(text, text, uuid, jsonb) to authenticated;
