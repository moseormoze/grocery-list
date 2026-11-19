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

create or replace function public.normalize_grocery_name(p_name text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(translate(p_name, U&'\00a0\2007\202f\feff', '    '), '[[:space:]]+', ' ', 'g'));
$$;

create table if not exists public.household_item_categorizations (
  household_id uuid not null references public.households(id) on delete cascade,
  normalized_name text not null check (length(normalized_name) between 1 and 500 and normalized_name = public.normalize_grocery_name(normalized_name)),
  manual_section_id text check (manual_section_id in ('produce','milk','meat','dry','sauces','baking','snacks','drinks','frozen','cleaning','other')),
  ai_section_id text check (ai_section_id in ('produce','milk','meat','dry','sauces','baking','snacks','drinks','frozen','cleaning')),
  ai_version text,
  updated_at timestamptz not null default now(),
  primary key (household_id, normalized_name),
  check (manual_section_id is not null or ai_section_id is not null),
  check ((ai_section_id is null) = (ai_version is null))
);
alter table public.household_item_categorizations enable row level security;
revoke all on public.household_item_categorizations from public, anon, authenticated;
grant select on public.household_item_categorizations to authenticated;
drop policy if exists "household reads category memory" on public.household_item_categorizations;
create policy "household reads category memory" on public.household_item_categorizations
  for select to authenticated using (
    household_id in (select household_id from public.users where id = auth.uid())
  );

create or replace function public.get_supermarket_categorization(
  p_list_id uuid, p_name text, p_item_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_name text := public.normalize_grocery_name(p_name);
  v_memory public.household_item_categorizations%rowtype;
begin
  select l.household_id into v_household from public.lists l
    join public.users u on u.household_id = l.household_id and u.id = auth.uid()
    where l.id = p_list_id and l.type = 'supermarket';
  if v_household is null then raise exception 'List unavailable' using errcode = '42501'; end if;
  if p_name is null or length(p_name) > 500 or v_name = '' then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  if p_item_id is not null and not exists (select from public.items where id = p_item_id and list_id = p_list_id) then
    raise exception 'Item unavailable' using errcode = '42501';
  end if;
  select * into v_memory from public.household_item_categorizations
    where household_id = v_household and normalized_name = v_name;
  return jsonb_build_object('normalized_name',v_name,'manual_section_id',v_memory.manual_section_id,
    'ai_section_id',v_memory.ai_section_id,'ai_version',v_memory.ai_version);
end;
$$;

create or replace function public.save_supermarket_item(
  p_list_id uuid,
  p_name text,
  p_qty text,
  p_mode text,
  p_section_id text default null,
  p_item_id uuid default null,
  p_ai_section_id text default null,
  p_ai_version text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_name text := public.normalize_grocery_name(p_name);
  v_memory public.household_item_categorizations%rowtype;
  v_item public.items%rowtype;
  v_section text;
  v_source text;
  v_categories constant text[] := array['produce','milk','meat','dry','sauces','baking','snacks','drinks','frozen','cleaning','other'];
begin
  select l.household_id into v_household from public.lists l
    join public.users u on u.household_id = l.household_id and u.id = auth.uid()
    where l.id = p_list_id and l.type = 'supermarket' for share of l, u;
  if v_household is null then raise exception 'List unavailable' using errcode = '42501'; end if;
  if p_name is null or length(p_name) > 500 or v_name = '' or length(p_qty) > 200
    or p_mode is null or p_mode not in ('auto','manual','preserve')
    or (p_mode = 'preserve' and p_item_id is null)
    or (p_mode = 'manual' and (p_section_id is null or not (p_section_id = any(v_categories))))
    or (p_ai_section_id is not null and (p_ai_section_id = 'other' or not (p_ai_section_id = any(v_categories)) or p_ai_version is null))
    or length(p_ai_version) > 200 then
    raise exception 'Invalid save input' using errcode = '22023';
  end if;

  -- Serialize even the first preference for a name. No lock is held during AI calls.
  perform pg_advisory_xact_lock(hashtextextended(v_household::text || ':' || v_name, 0));
  if p_item_id is not null then
    select * into v_item from public.items where id = p_item_id and list_id = p_list_id for update;
    if not found then raise exception 'Item unavailable' using errcode = '42501'; end if;
  end if;
  select * into v_memory from public.household_item_categorizations
    where household_id = v_household and normalized_name = v_name;

  if p_mode = 'manual' then
    v_section := p_section_id;
    v_source := 'manual';
    insert into public.household_item_categorizations(household_id,normalized_name,manual_section_id)
      values(v_household,v_name,v_section)
      on conflict(household_id,normalized_name) do update
        set manual_section_id = excluded.manual_section_id, updated_at = clock_timestamp();
  elsif p_mode = 'preserve' then
    v_section := coalesce(v_item.section_id, 'other');
    v_source := 'preserved';
  elsif v_memory.manual_section_id is not null then
    v_section := v_memory.manual_section_id;
    v_source := 'remembered';
  elsif v_memory.ai_section_id is not null and v_memory.ai_version = p_ai_version then
    v_section := v_memory.ai_section_id;
    v_source := 'cache';
  elsif p_ai_section_id is not null then
    v_section := p_ai_section_id;
    v_source := 'ai';
    insert into public.household_item_categorizations(household_id,normalized_name,ai_section_id,ai_version)
      values(v_household,v_name,v_section,p_ai_version)
      on conflict(household_id,normalized_name) do update
        set ai_section_id = excluded.ai_section_id, ai_version = excluded.ai_version, updated_at = clock_timestamp();
  else
    v_section := 'other';
    v_source := 'fallback';
  end if;

  if p_item_id is null then
    insert into public.items(list_id,name,qty,section_id,created_by_user_id,order_index)
      values(p_list_id,p_name,nullif(p_qty,''),v_section,auth.uid(),
        (select coalesce(max(order_index),-1)+1 from public.items where list_id=p_list_id))
      returning * into v_item;
  else
    update public.items set name=p_name, qty=nullif(p_qty,''), section_id=v_section, updated_at=clock_timestamp()
      where id=p_item_id and list_id=p_list_id returning * into v_item;
  end if;
  return jsonb_build_object('item', to_jsonb(v_item), 'source', v_source);
end;
$$;

revoke all on function public.normalize_grocery_name(text) from public, anon;
grant execute on function public.normalize_grocery_name(text) to authenticated;
revoke all on function public.get_supermarket_categorization(uuid,text,uuid) from public, anon;
grant execute on function public.get_supermarket_categorization(uuid,text,uuid) to authenticated;
revoke all on function public.save_supermarket_item(uuid,text,text,text,text,uuid,text,text) from public, anon;
grant execute on function public.save_supermarket_item(uuid,text,text,text,text,uuid,text,text) to authenticated;
