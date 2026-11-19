import { supabase } from '@/lib/supabase/client'
import type { ListType } from '@/lib/list-types'
import { parseSaveResult, type CategoryMode, type SaveResult } from './types'

export type EditorSaveInput = {
  listId: string, itemId?: string, name: string, qty: string, mode: CategoryMode, sectionId: string,
}
export async function saveListItem(input: EditorSaveInput, listType: ListType, orderIndex: number): Promise<SaveResult> {
  if (listType === 'supermarket') {
    const response = await fetch('/api/items/save', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error('Save failed')
    return parseSaveResult(await response.json())
  }
  const fields = { name: input.name, qty: input.qty || null, section_id: input.sectionId }
  if (input.itemId) {
    const { data, error } = await supabase.from('items').update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', input.itemId).eq('list_id', input.listId).select().single()
    if (error || !data) throw new Error('Save failed')
    return parseSaveResult({ item: data, source: 'preserved' })
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Sign in required')
  const { data, error } = await supabase.from('items').insert({
    ...fields, list_id: input.listId, created_by_user_id: user.id, ticked: false, order_index: orderIndex,
  }).select().single()
  if (error || !data) throw new Error('Save failed')
  return parseSaveResult({ item: data, source: 'manual' })
}
