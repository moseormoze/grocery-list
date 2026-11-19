import { describe, it, expect, vi } from 'vitest'
import { saveCategorizedItem, parseSaveInput, type CategoryStore } from '../service'
import { AI_VERSION } from '../claude'

const input = { listId: '00000000-0000-0000-0000-000000000001', name: ' סקיר ', qty: '', mode: 'auto' as const }
const item = { id: 'i', list_id: input.listId, name: input.name, section_id: 'milk', ticked: false, order_index: 0, created_by_user_id: 'u', created_at: 'now', updated_at: 'now' }
function setup(memory = { normalized_name: 'סקיר', manual_section_id: null as string | null, ai_section_id: null as string | null, ai_version: null as string | null }) {
  const store: CategoryStore = {
    lookup: vi.fn().mockResolvedValue(memory),
    save: vi.fn().mockResolvedValue({ item, source: 'remembered' }),
  }
  const classify = vi.fn().mockResolvedValue('milk')
  return { store, classify }
}

describe('categorization save', () => {
  it.each(['milk', 'other'])('uses household manual preference %s without AI', async (category) => {
    const { store, classify } = setup({ normalized_name: 'סקיר', manual_section_id: category, ai_section_id: 'dry', ai_version: AI_VERSION })
    await saveCategorizedItem(input, store, classify)
    expect(classify).not.toHaveBeenCalled()
    expect(store.save).toHaveBeenCalledWith(input, null, AI_VERSION)
  })
  it('uses a current household cache without calling AI', async () => {
    const { store, classify } = setup({ normalized_name: 'סקיר', manual_section_id: null, ai_section_id: 'milk', ai_version: AI_VERSION })
    await saveCategorizedItem(input, store, classify)
    expect(classify).not.toHaveBeenCalled()
  })
  it('ignores a stale cache and classifies the normalized name', async () => {
    const { store, classify } = setup({ normalized_name: 'סקיר', manual_section_id: null, ai_section_id: 'dry', ai_version: 'old' })
    await saveCategorizedItem(input, store, classify)
    expect(classify).toHaveBeenCalledWith('סקיר')
    expect(store.save).toHaveBeenCalledWith(input, 'milk', AI_VERSION)
  })
  it.each(['manual', 'preserve'] as const)('%s never calls AI', async (mode) => {
    const { store, classify } = setup()
    await saveCategorizedItem({ ...input, mode, sectionId: 'other', itemId: input.listId }, store, classify)
    expect(classify).not.toHaveBeenCalled()
  })
  it('uses the authoritative saved result after a correction during the AI call', async () => {
    const { store, classify } = setup()
    const corrected = { item: { ...item, section_id: 'sauces' }, source: 'remembered' as const }
    vi.mocked(store.save).mockResolvedValue(corrected)
    expect(await saveCategorizedItem(input, store, classify)).toEqual(corrected)
  })
  it.each([null, 'other'])('does not cache fallback %s', async (category) => {
    const { store, classify } = setup()
    classify.mockResolvedValue(category)
    await saveCategorizedItem(input, store, classify)
    expect(store.save).toHaveBeenCalledWith(input, null, AI_VERSION)
  })
  it('fails closed on memory lookup failure and never calls AI or saves', async () => {
    const { store, classify } = setup()
    vi.mocked(store.lookup).mockRejectedValue(new Error('database unavailable'))
    await expect(saveCategorizedItem(input, store, classify)).rejects.toThrow()
    expect(store.save).not.toHaveBeenCalled()
    expect(classify).not.toHaveBeenCalled()
  })
  it('does not turn a save failure into a fallback or retry', async () => {
    const { store, classify } = setup()
    vi.mocked(store.save).mockRejectedValue(new Error('save failed'))
    await expect(saveCategorizedItem(input, store, classify)).rejects.toThrow('save failed')
    expect(store.save).toHaveBeenCalledTimes(1)
  })
  it('still saves when the classifier throws unexpectedly', async () => {
    const { store, classify } = setup()
    classify.mockRejectedValue(new Error('provider failed'))
    await saveCategorizedItem(input, store, classify)
    expect(store.save).toHaveBeenCalledWith(input, null, AI_VERSION)
  })
})
describe('request validation', () => {
  it('preserves the displayed name', () => expect(parseSaveInput(input).name).toBe(input.name))
  it.each([
    { name: '  ' }, { name: 'x'.repeat(501) }, { name: '\u0000' }, { listId: 'bad' },
    { mode: 'oops' }, { mode: 'manual', sectionId: 'admin' }, { mode: 'preserve' },
    { qty: 'x'.repeat(201) }, { itemId: 42 },
  ])('rejects invalid payload %j', (change) => expect(() => parseSaveInput({ ...input, ...change })).toThrow())
})
