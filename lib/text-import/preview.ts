import type { DraftItem } from './parser'
import type { SupermarketCategory } from '../categorization/types'

export const normalizedName = (name: string) => name.trim().replace(/\s+/gu, ' ')

export type PendingItem = { name: string, qty: string | null }
export function reviewRows(
  items: DraftItem[],
  pending: PendingItem[],
  categories: ReadonlyMap<string, SupermarketCategory>,
) {
  const existingByName = new Map(pending.map(item => [normalizedName(item.name), item]))
  const seen = new Set<string>()
  return items.map(item => {
    const name = normalizedName(item.name)
    const repeated = seen.has(name)
    seen.add(name)
    const existing = existingByName.get(name) ?? null
    return { ...item, existing, repeated, sectionId: categories.get(name) ?? 'other',
      selected: !item.negated && !existing && !repeated }
  })
}
