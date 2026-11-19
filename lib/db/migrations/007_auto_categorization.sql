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
