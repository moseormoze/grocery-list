import { isCategory, isRecord, type SupermarketCategory } from '../categorization/types'
import type { Item } from '../db/types'
import { normalizedName } from './preview'

export type ConfirmedRow = {
  name: string
  qty: string | null
  mode: 'manual' | 'auto'
  sectionId: SupermarketCategory
  duplicateFor: string | null
}
export type ImportConfirmation = { listId: string, operationId: string, rows: ConfirmedRow[] }
export type ImportResult =
  | { status: 'saved', items: Item[] }
  | { status: 'conflict', conflicts: { index: number, name: string }[] }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readRow(value: unknown): ConfirmedRow {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim() ||
    value.name.length > 500 || value.name.includes('\0') ||
    !(value.qty === null || (typeof value.qty === 'string' && value.qty.length <= 200 && !value.qty.includes('\0'))) ||
    (value.mode !== 'auto' && value.mode !== 'manual') || !isCategory(value.sectionId) ||
    !(value.duplicateFor === null || value.duplicateFor === normalizedName(value.name))) {
    throw new Error('Invalid confirmed row')
  }
  return { name: value.name, qty: value.qty, mode: value.mode, sectionId: value.sectionId,
    duplicateFor: value.duplicateFor }
}

export function readConfirmation(value: unknown): ImportConfirmation {
  if (!isRecord(value) || typeof value.listId !== 'string' || !uuid.test(value.listId) ||
    typeof value.operationId !== 'string' || !uuid.test(value.operationId) ||
    !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 60) throw new Error('Invalid confirmation')
  return { listId: value.listId.toLowerCase(), operationId: value.operationId.toLowerCase(), rows: value.rows.map(readRow) }
}

export function readImportResult(value: unknown, input: ImportConfirmation): ImportResult {
  if (!isRecord(value)) throw new Error('Invalid import result')
  if (value.status === 'conflict' && Array.isArray(value.conflicts) && value.conflicts.length) {
    const used = new Set<number>()
    const conflicts = value.conflicts.map((c: unknown) => {
      if (!isRecord(c) || typeof c.index !== 'number' || !Number.isInteger(c.index) || used.has(c.index) ||
        typeof c.name !== 'string' || input.rows[c.index]?.name !== c.name) throw new Error('Invalid conflict')
      used.add(c.index)
      return { index: c.index, name: c.name }
    })
    return { status: 'conflict', conflicts }
  }
  if (value.status !== 'saved' || !Array.isArray(value.items) || value.items.length !== input.rows.length) {
    throw new Error('Incomplete import receipt')
  }
  const ids = new Set<string>()
  const items = value.items.map((i: unknown, index): Item => {
    if (!isRecord(i) || typeof i.id !== 'string' || !i.id || ids.has(i.id) || i.list_id !== input.listId ||
      typeof i.name !== 'string' || i.name !== input.rows[index].name ||
      (i.qty ?? null) !== (input.rows[index].qty || null) || !(i.qty == null || typeof i.qty === 'string') ||
      !isCategory(i.section_id) || i.entry_source !== 'text' || i.ticked !== false ||
      typeof i.order_index !== 'number' || typeof i.created_by_user_id !== 'string' ||
      typeof i.created_at !== 'string' || typeof i.updated_at !== 'string') throw new Error('Invalid imported item')
    ids.add(i.id)
    return { id: i.id, list_id: input.listId, name: i.name, qty: i.qty ?? undefined, section_id: i.section_id,
      entry_source: 'text', ticked: false, order_index: i.order_index, created_by_user_id: i.created_by_user_id,
      created_at: i.created_at, updated_at: i.updated_at }
  })
  return { status: 'saved', items }
}
