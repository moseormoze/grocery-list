// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { TooManyImportItems } from '@/lib/text-import/parser'
import { AI_VERSION } from '@/lib/categorization/claude'

const m = vi.hoisted(() => ({
  auth: vi.fn(), list: vi.fn(), pending: vi.fn(), rpc: vi.fn(), parse: vi.fn(), classify: vi.fn(),
}))
vi.mock('@/lib/text-import/parser', async original => ({
  ...await original<typeof import('@/lib/text-import/parser')>(), parseGroceries: m.parse,
}))
vi.mock('@/lib/categorization/claude', async original => ({
  ...await original<typeof import('@/lib/categorization/claude')>(), classifyWithClaude: m.classify,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: () => ({
    auth: { getUser: m.auth }, rpc: m.rpc,
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: table === 'lists' ? m.list : undefined,
        range: table === 'items' ? m.pending : undefined,
      }
      return query
    },
  }),
}))
const listId = '00000000-0000-0000-0000-000000000001'
const send = (text = 'רשימת קניות') => POST(new Request('https://example.test/api/items/preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listId, text }),
}))
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ data: { user: { id: 'user' } } })
  m.list.mockResolvedValue({ data: { id: listId, type: 'supermarket' } })
  m.pending.mockResolvedValue({ data: [{ name: ' חלב ', qty: 'קרטון' }] })
})
it('checks session and supermarket membership before sending text to AI', async () => {
  m.auth.mockResolvedValueOnce({ data: { user: null } })
  expect((await send()).status).toBe(401)
  for (const data of [null, { type: 'pharmacy' }]) {
    m.list.mockResolvedValueOnce({ data })
    expect((await send()).status).toBe(403)
  }
  expect(m.parse).not.toHaveBeenCalled()
})
it('rejects oversized text before parsing and distinguishes provider failure from empty results', async () => {
  expect((await send('א'.repeat(4001))).status).toBe(413)
  expect(m.parse).not.toHaveBeenCalled()
  m.parse.mockRejectedValueOnce(new TooManyImportItems())
  expect((await send()).status).toBe(413)
  m.parse.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ items: [] })
  expect((await send()).status).toBe(502)
  expect(await (await send()).json()).toEqual({ items: [] })
})
it('previews source order, saved choices, current cache, fallback, exclusions and repeats', async () => {
  const names = ['חלב', 'לחם', ' לחם ', 'מיץ', 'מלח']
  m.parse.mockResolvedValue({ items: names.map(name => ({ name, qty: null, negated: name === 'מיץ' })) })
  m.rpc.mockImplementation(async (fn, { p_name: name }) => {
    expect(fn).toBe('get_supermarket_categorization')
    return { data: { normalized_name: name, manual_section_id: name === 'חלב' ? 'other' : null,
      ai_section_id: name === 'לחם' ? 'baking' : null, ai_version: AI_VERSION } }
  })
  m.classify.mockRejectedValue(new Error('offline'))
  const response = await send()
  expect(response.status).toBe(200)
  const { items } = await response.json()
  expect(items).toMatchObject([
    { name: 'חלב', sectionId: 'other', selected: false, existing: { qty: 'קרטון' } },
    { name: 'לחם', sectionId: 'baking', selected: true },
    { name: ' לחם ', repeated: true, selected: false },
    { name: 'מיץ', negated: true, selected: false },
    { name: 'מלח', sectionId: 'other', selected: true },
  ])
  expect(m.rpc).toHaveBeenCalledTimes(4)
  expect(m.classify).toHaveBeenCalledTimes(2)
})
