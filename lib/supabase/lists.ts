import { getInitialItemsForListType } from '@/lib/list-templates';
import type { Item, List } from '@/lib/db/types';
import type { ListType } from '@/lib/list-types';
import { supabase } from './client';

type CreateListInput = {
  name: string;
  type: ListType;
  householdId: string;
};

type CreateListResult =
  | { success: true; list: List; items: Item[] }
  | { success: false; error: string };

type RpcPayload = {
  list: List;
  items?: Item[];
};

export async function createListWithTemplate(input: CreateListInput): Promise<CreateListResult> {
  try {
    const { data, error } = await supabase.rpc('create_list_with_items', {
      p_name: input.name.trim(),
      p_type: input.type,
      p_household_id: input.householdId,
      p_items: getInitialItemsForListType(input.type),
    });

    if (error) return { success: false, error: error.message };

    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) return { success: false, error: 'List creation returned no data' };

    const payload = raw as RpcPayload | List;
    if ('list' in payload) {
      return { success: true, list: payload.list, items: payload.items ?? [] };
    }

    return { success: true, list: payload, items: [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
