// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
const mock = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), classify: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: () => ({ auth: { getUser: mock.auth }, rpc: mock.rpc }) }))
vi.mock('@/lib/categorization/claude', async (original) => ({ ...await original<typeof import('@/lib/categorization/claude')>(), classifyWithClaude: mock.classify }))
const listId = '00000000-0000-0000-0000-000000000001'
const body = { listId, name: 'סקיר', mode: 'auto' }
const request = (payload: unknown = body) => new Request('http://localhost/api/items/save', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(payload) })
beforeEach(() => {
  vi.resetAllMocks()
  mock.auth.mockResolvedValue({ data: { user: { id: 'user' } }, error: null })
  mock.classify.mockResolvedValue('milk')
})
describe('save endpoint', () => {
  it('requires authentication before memory lookup or AI', async () => {
    mock.auth.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(request())).status).toBe(401)
    expect(mock.rpc).not.toHaveBeenCalled()
    expect(mock.classify).not.toHaveBeenCalled()
  })
  it('rejects foreign lists before calling AI', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private' } })
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('private')
    expect(mock.classify).not.toHaveBeenCalled()
  })
  it('does not call AI or write for invalid input', async () => {
    expect((await POST(request({ ...body, mode: 'manual', sectionId: 'admin' }))).status).toBe(400)
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('rejects cross-origin requests', async () => {
    const req = request()
    req.headers.set('origin','https://foreign.test')
    expect((await POST(req)).status).toBe(403)
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('returns the authoritative saved category and never exposes provider data', async () => {
    mock.rpc.mockResolvedValueOnce({ data: { normalized_name: 'סקיר', manual_section_id: null, ai_section_id: null, ai_version: null }, error: null })
      .mockResolvedValueOnce({ data: { item: { id: 'i', list_id: listId, name: 'סקיר', qty: null, section_id: 'sauces', ticked: false, order_index: 0, created_by_user_id: 'u', created_at: 'now', updated_at: 'now' }, source: 'remembered' }, error: null })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).item.section_id).toBe('sauces')
    expect(mock.rpc.mock.calls[1][1]).toMatchObject({ p_mode: 'auto', p_ai_section_id: 'milk' })
  })
  it('reports memory failure instead of falling back', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } })
    expect((await POST(request())).status).toBe(500)
    expect(mock.classify).not.toHaveBeenCalled()
  })
  it('bounds request bodies before authentication and returns safe errors', async () => {
    expect((await POST(request({ ...body, name: 'x'.repeat(9000) }))).status).toBe(413)
    expect(mock.auth).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON without a write', async () => {
    const req = new Request('http://localhost/api/items/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
    expect((await POST(req)).status).toBe(400)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

})
