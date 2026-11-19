import type { Item } from '@/lib/db/types'

export const SUPERMARKET_CATEGORIES = ['produce', 'milk', 'meat', 'dry', 'sauces', 'baking', 'snacks', 'drinks', 'frozen', 'cleaning', 'other'] as const
export type SupermarketCategory = typeof SUPERMARKET_CATEGORIES[number]
export type CategoryMode = 'auto' | 'manual' | 'preserve'
export type CategorySource = 'manual' | 'remembered' | 'cache' | 'ai' | 'fallback' | 'preserved'
export type SaveInput = { listId: string, itemId?: string, name: string, qty: string, mode: CategoryMode, sectionId?: SupermarketCategory }
export type SaveResult = { item: Item, source: CategorySource }
export type CategoryMemory = { normalized_name: string, manual_section_id: SupermarketCategory | null, ai_section_id: SupermarketCategory | null, ai_version: string | null }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function isCategory(value: unknown): value is SupermarketCategory {
  return typeof value === 'string' && SUPERMARKET_CATEGORIES.some(category => category === value)
}
export function isAutoSuccess(source: CategorySource): boolean {
  return source === 'remembered' || source === 'cache' || source === 'ai'
}
export function parseMemory(value: unknown): CategoryMemory {
  if (!isRecord(value) || typeof value.normalized_name !== 'string' || !value.normalized_name ||
    !(value.manual_section_id === null || isCategory(value.manual_section_id)) ||
    !(value.ai_section_id === null || (isCategory(value.ai_section_id) && value.ai_section_id !== 'other')) ||
    !(value.ai_version === null || typeof value.ai_version === 'string')) throw new Error('Invalid memory response')
  return { normalized_name: value.normalized_name, manual_section_id: value.manual_section_id, ai_section_id: value.ai_section_id, ai_version: value.ai_version }
}
export function parseSaveResult(value: unknown): SaveResult {
  if (!isRecord(value) || !isRecord(value.item) || typeof value.source !== 'string' ||
    !['manual', 'remembered', 'cache', 'ai', 'fallback', 'preserved'].includes(value.source)) throw new Error('Invalid save response')
  const i = value.item
  if (typeof i.id !== 'string' || typeof i.list_id !== 'string' || typeof i.name !== 'string' ||
    typeof i.section_id !== 'string' || !(i.qty === null || i.qty === undefined || typeof i.qty === 'string') ||
    typeof i.ticked !== 'boolean' || typeof i.order_index !== 'number' || typeof i.created_by_user_id !== 'string' ||
    typeof i.created_at !== 'string' || typeof i.updated_at !== 'string') throw new Error('Invalid saved item')
  return {
    item: { id: i.id, list_id: i.list_id, name: i.name, qty: i.qty ?? undefined, section_id: i.section_id,
      ticked: i.ticked, order_index: i.order_index, created_by_user_id: i.created_by_user_id, created_at: i.created_at, updated_at: i.updated_at },
    source: value.source as CategorySource,
  }
}
