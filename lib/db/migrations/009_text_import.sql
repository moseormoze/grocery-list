alter table public.items add column if not exists entry_source text not null default 'manual'
  check (entry_source in ('manual','text'));

create table if not exists public.grocery_import_receipts (
  list_id uuid not null references public.lists(id) on delete cascade,
  actor uuid not null references public.users(id) on delete cascade,
  operation_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  primary key (list_id,actor,operation_id)
);
alter table public.grocery_import_receipts enable row level security;
revoke all on public.grocery_import_receipts from public, anon, authenticated;

-- Direct/offline edits that introduce a pending name must coordinate with an
-- import's exclusive list lock. Single-item RPC writes already take FOR SHARE.
create or replace function public.lock_pending_item_list() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.ticked then
    perform 1 from public.lists where id = new.list_id for key share;
  end if;
  return new;
end;
$$;
drop trigger if exists lock_pending_item_list on public.items;
create trigger lock_pending_item_list before insert or update of name,ticked,list_id on public.items
for each row execute function public.lock_pending_item_list();

create or replace function public.import_grocery_items(p_list_id uuid, p_operation_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_house uuid;
  receipt public.grocery_import_receipts%rowtype;
  r jsonb;
  k text;
  section text;
  saved public.items%rowtype;
  seen text[] := '{}';
  conflicts jsonb := '[]';
  items jsonb := '[]';
  result jsonb;
  idx integer;
  lock_id bigint;
  categories constant text[] := array['produce','milk','meat','dry','sauces','baking','snacks','drinks','frozen','cleaning','other'];
begin
  select l.household_id into v_house from public.lists l join public.users u on u.household_id=l.household_id
    where l.id=p_list_id and l.type='supermarket' and u.id=v_actor for update of l for share of u;
  if not found then raise exception 'List unavailable' using errcode='42501'; end if;
  if p_operation_id is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Invalid import' using errcode='22023';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 60 then raise exception 'Invalid batch size' using errcode='22023'; end if;

  select * into receipt from public.grocery_import_receipts
    where list_id=p_list_id and actor=v_actor and operation_id=p_operation_id;
  if found then
    if receipt.payload <> p_rows then raise exception 'Operation payload changed' using errcode='22023'; end if;
    return receipt.result;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    k := public.normalize_grocery_name(r->>'name');
    if jsonb_typeof(r) <> 'object' or jsonb_typeof(r->'name') is distinct from 'string'
      or k='' or length(r->>'name') > 500
      or coalesce(jsonb_typeof(r->'qty'),'null') not in ('string','null') or length(r->>'qty') > 200
      or coalesce(r->>'mode','') not in ('auto','manual') or not(coalesce(r->>'sectionId','')=any(categories))
      or (r ? 'duplicateFor' and jsonb_typeof(r->'duplicateFor') not in ('string','null')) then
      raise exception 'Invalid item' using errcode='22023';
    end if;
    if (k=any(seen) or exists(select from public.items i where i.list_id=p_list_id and not i.ticked
      and public.normalize_grocery_name(i.name)=k)) and r->>'duplicateFor' is distinct from k then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('index',cardinality(seen),'name',r->>'name'));
    end if;
    seen := array_append(seen,k);
  end loop;
  if jsonb_array_length(conflicts)>0 then
    return jsonb_build_object('status','conflict','conflicts',conflicts);
  end if;

  -- Match migration 007's per-household lock. Stable ordering prevents two
  -- imports on different lists from taking the same name locks in reverse.
  for lock_id in select distinct hashtextextended(v_house::text||':'||n,0) from unnest(seen) n order by 1 loop
    perform pg_advisory_xact_lock(lock_id);
  end loop;
  select coalesce(max(order_index),-1)+1 into idx from public.items where list_id=p_list_id;
  for r in select value from jsonb_array_elements(p_rows) loop
    k := public.normalize_grocery_name(r->>'name');
    section := r->>'sectionId';
    if r->>'mode'='manual' then
      insert into public.household_item_categorizations(household_id,normalized_name,manual_section_id)
        values(v_house,k,section) on conflict(household_id,normalized_name) do update
        set manual_section_id=excluded.manual_section_id,updated_at=clock_timestamp();
    else
      select coalesce((select manual_section_id from public.household_item_categorizations
        where household_id=v_house and normalized_name=k),section) into section;
    end if;
    insert into public.items(list_id,name,qty,section_id,entry_source,created_by_user_id,order_index)
      values(p_list_id,r->>'name',nullif(r->>'qty',''),section,'text',v_actor,idx) returning * into saved;
    items := items || jsonb_build_array(to_jsonb(saved));
    idx := idx+1;
  end loop;
  result := jsonb_build_object('status','saved','items',items);
  insert into public.grocery_import_receipts(list_id,actor,operation_id,payload,result)
    values(p_list_id,v_actor,p_operation_id,p_rows,result);
  return result;
end;
$$;
revoke all on function public.import_grocery_items(uuid,uuid,jsonb) from public, anon;
grant execute on function public.import_grocery_items(uuid,uuid,jsonb) to authenticated;
