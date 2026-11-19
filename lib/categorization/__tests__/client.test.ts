import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveListItem } from '../client'
const mocks = vi.hoisted(() => ({ from: vi.fn(), user: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.user } } }))
const item = { id: 'i', list_id: 'l', name: 'סקיר', qty: null, section_id: 'milk', ticked: false, order_index: 0, created_by_user_id: 'u', created_at: 'now', updated_at: 'now' }
const input = { listId: 'l', name: 'סקיר', qty: '', mode: 'auto' as const, sectionId: 'auto' }
beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })
describe('save transport', () => {
  it('routes supermarket saves to the server, never direct item writes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item, source: 'remembered' })))
    vi.stubGlobal('fetch', fetch)
    const result = await saveListItem(input, 'supermarket', 0)
    expect(fetch).toHaveBeenCalledWith('/api/items/save', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }))
    expect(result.item.qty).toBeUndefined()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not retry or fall back to a direct write when the server fails', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetch)
    await expect(saveListItem(input, 'supermarket', 0)).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('preserves the direct save path for other list types', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    mocks.user.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { ...item, section_id: 'hygiene' }, error: null }) }) })
    mocks.from.mockReturnValue({ insert })
    await saveListItem({ ...input, mode: 'manual', sectionId: 'hygiene' }, 'pharmacy', 3)
    expect(fetch).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ section_id: 'hygiene', order_index: 3 }))
  })
  it('reports returned update errors for other list types', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'failure' } })
    const chain = { eq: vi.fn(), select: () => ({ single }) }
    chain.eq.mockReturnValue(chain)
    mocks.from.mockReturnValue({ update: () => chain })
    await expect(saveListItem({ ...input, itemId: 'i', mode: 'preserve', sectionId: 'hygiene' }, 'pharmacy', 0)).rejects.toThrow()
    expect(chain.eq).toHaveBeenCalledWith('list_id', 'l')
  })
})
