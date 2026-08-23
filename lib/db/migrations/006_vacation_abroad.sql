begin;

alter table public.lists drop constraint if exists lists_type_check;
alter table public.lists add constraint lists_type_check
  check (type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad'));

alter table public.categorizations_cache drop constraint if exists categorizations_cache_list_type_check;
alter table public.categorizations_cache add constraint categorizations_cache_list_type_check
  check (list_type in ('supermarket', 'pharmacy', 'house', 'vacation_abroad'));

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

commit;
