import { isRecord, isCategory } from '../categorization/types'
import type { reviewRows } from './preview'
export type ReviewItem = ReturnType<typeof reviewRows>[number] & { mode: 'auto' | 'manual' }

export async function getReview(
  listId: string,
  content: { text: string } | { name: string },
  signal: AbortSignal,
) {
  const response = await fetch('/api/items/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ listId, ...content }),
    signal,
  })
  if (!response.ok) throw new Error(String(response.status))
  const data: unknown = await response.json()
  if (!isRecord(data) || !Array.isArray(data.items) || data.items.length > 60)
    throw new Error('Invalid preview')
  return data.items.map((r: unknown): ReviewItem => {
    if (
      !isRecord(r) ||
      typeof r.name !== 'string' ||
      !(r.qty === null || typeof r.qty === 'string') ||
      !isCategory(r.sectionId) ||
      typeof r.selected !== 'boolean' ||
      typeof r.negated !== 'boolean' ||
      typeof r.repeated !== 'boolean'
    ) {
      throw new Error('Invalid preview item')
    }
    const existing = r.existing
    if (!(
      existing === null ||
      (isRecord(existing) &&
        typeof existing.name === 'string' &&
        (existing.qty === null || typeof existing.qty === 'string'))
    ))
      throw new Error('Invalid duplicate')
    return {
      name: r.name,
      qty: r.qty,
      sectionId: r.sectionId,
      selected: r.selected,
      negated: r.negated,
      repeated: r.repeated,
      existing:
        existing === null
          ? null
          : {
              name: String(existing.name),
              qty: typeof existing.qty === 'string' ? existing.qty : null,
            },
      mode: 'auto',
    }
  })
}
