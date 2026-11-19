// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../route'
import { createImportConfirmation } from '@/lib/text-import/confirm-client'

const db = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: () => ({ auth: { getUser: db.getUser }, rpc: db.rpc }),
}))
const listId = '00000000-0000-0000-0000-000000000001'
const operationId = '00000000-0000-0000-0000-000000000002'
const row = { name: 'חלב', qty: null, mode: 'auto' as const, sectionId: 'milk' as const, duplicateFor: null }
const input = { listId, operationId, rows: [row] }
const item = { id: 'item', name: row.name, qty: null, section_id: 'milk', entry_source: 'text',
  list_id: listId, ticked: false, order_index: 1, created_by_user_id: 'user', created_at: 'now', updated_at: 'now' }
const url = 'https://example.test/api/items/import'
function send(body: unknown = input, headers = {}) {
  return POST(new Request(url, { method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers } }))
}
beforeEach(() => {
  vi.resetAllMocks()
  db.getUser.mockResolvedValue({ data: { user: { id: 'user' } } })
  db.rpc.mockResolvedValue({ data: { status: 'saved', items: [item] } })
})
it('passes only confirmed fields and returns text-source records', async () => {
  const response = await send()
  expect(response.status).toBe(200)
  expect((await response.json()).items[0]).toMatchObject({ id: 'item', entry_source: 'text' })
  expect(db.rpc).toHaveBeenCalledWith('import_grocery_items', {
    p_list_id: listId, p_operation_id: operationId, p_rows: [row],
  })
})
it('rejects stale duplicate approvals, malformed selections and cross-origin requests before writing', async () => {
  for (const invalid of [{ name: ' ' }, { name: 'אורז', duplicateFor: 'חלב' }, { sectionId: 'invalid' }, { mode: 'preserve' }]) {
    expect((await send({ ...input, rows: [{ ...row, ...invalid }] })).status).toBe(400)
  }
  expect((await send({ ...input, rows: [] })).status).toBe(400)
  expect((await send(input, { origin: 'https://other.test' })).status).toBe(403)
  db.getUser.mockResolvedValue({ data: { user: null } })
  expect((await send()).status).toBe(401)
  expect(db.rpc).not.toHaveBeenCalled()
})
it.each([['42501',403], ['22023',400], ['XX000',500]])('propagates DB denial %s', async (code,status) => {
  db.rpc.mockResolvedValue({ error: { code } })
  expect((await send()).status).toBe(status)
})
it('requires an intelligible conflict or full ordered receipt for this list', async () => {
  const conflicts = [{ index: 0, name: row.name }]
  db.rpc.mockResolvedValueOnce({ data: { status: 'conflict', conflicts } })
  const response = await send()
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ status: 'conflict', conflicts })
  for (const data of [{ status: 'saved', items: [] }, { status: 'saved', items: [{ ...item, list_id: 'other' }] },
    { status: 'conflict', conflicts: [{ index: 1, name: row.name }] }]) {
    db.rpc.mockResolvedValueOnce({ data })
    expect((await send()).status).toBe(500)
  }
})
it('retries the identical snapshot after a lost response and uses a new ID for a changed confirmation', async () => {
  const transport = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>().mockRejectedValueOnce(new Error('offline'))
    .mockImplementation(async (_url, init) => send(JSON.parse(String(init?.body))))
  const editable: Omit<typeof row, 'qty'> & { qty: string | null } = { ...row }
  const attempt = createImportConfirmation(listId, [editable], transport)
  await expect(attempt.submit()).rejects.toThrow()
  editable.qty = '2'
  expect((await attempt.submit()).status).toBe('saved')
  const next = createImportConfirmation(listId, [editable], transport)
  db.rpc.mockResolvedValueOnce({ data: { status: 'conflict', conflicts: [{ index: 0, name: row.name }] } })
  expect((await next.submit()).status).toBe('conflict')
  const requests = transport.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
  expect(requests[0]).toEqual(requests[1])
  expect(requests[2].operationId).not.toBe(requests[0].operationId)
})
