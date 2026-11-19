import { AI_VERSION } from './claude'
import { isRecord, isCategory, type SaveInput, type SaveResult, type CategoryMemory, type SupermarketCategory } from './types'
export type { SaveInput } from './types'

export class SaveError extends Error {
  constructor(readonly status: number) { super('Item save failed') }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseSaveInput(body: unknown): SaveInput {
  if (!isRecord(body) || typeof body.listId !== 'string' || !uuid.test(body.listId) ||
    typeof body.name !== 'string' || !body.name.trim() || body.name.length > 500 || body.name.includes('\0') ||
    (body.qty !== undefined && (typeof body.qty !== 'string' || body.qty.length > 200 || body.qty.includes('\0'))) ||
    (body.itemId !== undefined && (typeof body.itemId !== 'string' || !uuid.test(body.itemId))) ||
    (body.mode !== 'auto' && body.mode !== 'manual' && body.mode !== 'preserve') ||
    (body.mode === 'manual' && !isCategory(body.sectionId)) ||
    (body.mode === 'preserve' && !body.itemId)) throw new SaveError(400)
  return { listId: body.listId, name: body.name, qty: typeof body.qty === 'string' ? body.qty : '',
    itemId: typeof body.itemId === 'string' ? body.itemId : undefined,
    mode: body.mode as SaveInput['mode'], sectionId: isCategory(body.sectionId) ? body.sectionId : undefined }
}
export interface CategoryStore {
  lookup(input: SaveInput): Promise<CategoryMemory>
  save(input: SaveInput, candidate: SupermarketCategory | null, version: string): Promise<SaveResult>
}
export async function saveCategorizedItem(input: SaveInput, store: CategoryStore, classify: (name: string) => Promise<SupermarketCategory | null>): Promise<SaveResult> {
  const memory = await store.lookup(input)
  let candidate: SupermarketCategory | null = null
  if (input.mode === 'auto' && memory.manual_section_id === null &&
    !(memory.ai_section_id && memory.ai_version === AI_VERSION)) {
    try { candidate = await classify(memory.normalized_name) }
    catch { candidate = null }
    if (candidate === 'other') candidate = null
  }
  // The transaction rechecks memory, so an AI reply cannot overwrite a newer correction.
  return store.save(input, candidate, AI_VERSION)
}
