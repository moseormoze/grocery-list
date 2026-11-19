import { createServerSupabase } from '@/lib/supabase/server'
import { readPayload } from '@/lib/http/read-payload'
import { SaveError } from '@/lib/categorization/service'
import { AI_VERSION, classifyWithClaude } from '@/lib/categorization/claude'
import { isRecord, parseMemory, type SupermarketCategory } from '@/lib/categorization/types'
import { parseGroceries, TooManyImportItems } from '@/lib/text-import/parser'
import { normalizedName, reviewRows, type PendingItem } from '@/lib/text-import/preview'

export const runtime = 'nodejs'
type Database = Awaited<ReturnType<typeof createServerSupabase>>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function pendingItems(db: Database, listId: string): Promise<PendingItem[]> {
  const items: PendingItem[] = []
  const pageSize = 200
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('items').select('name, qty').eq('list_id', listId)
      .eq('ticked', false).order('id').range(offset, offset + pageSize - 1)
    if (error || !data) throw new SaveError(500)
    items.push(...data)
    if (data.length < pageSize) return items
  }
}

async function category(db: Database, listId: string, name: string, key: string): Promise<SupermarketCategory> {
  const { data, error } = await db.rpc('get_supermarket_categorization', { p_list_id: listId, p_name: name })
  if (error) throw new SaveError(error.code === '42501' ? 403 : 500)
  const memory = parseMemory(data)
  if (memory.manual_section_id) return memory.manual_section_id
  if (memory.ai_section_id && memory.ai_version === AI_VERSION) return memory.ai_section_id
  try { return await classifyWithClaude(name, { key }) ?? 'other' }
  catch { return 'other' }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) throw new SaveError(403)
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SaveError(415)
    const input = await readPayload(request, 32_768)
    if (!isRecord(input) || typeof input.listId !== 'string' || !uuid.test(input.listId)) throw new SaveError(400)
    const { listId } = input
    const rename = 'name' in input
    const text = rename ? input.name : input.text
    if (typeof text !== 'string' || !text.trim() || text.includes('\0') || (rename && ('text' in input || text.length > 500))) throw new SaveError(400)
    if (text.length > 4000) throw new SaveError(413)
    const db = await createServerSupabase()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (!user || authError) throw new SaveError(401)
    // The session-bound client applies household RLS before any text reaches Anthropic.
    const { data: list, error } = await db.from('lists').select('id, type').eq('id', listId).maybeSingle()
    if (error) throw new SaveError(500)
    if (list?.type !== 'supermarket') throw new SaveError(403)
    const key = process.env.ANTHROPIC_API_KEY ?? ''
    const { items } = rename ? { items: [{ name: text, qty: null, negated: false }] } : await parseGroceries(text, { key }).catch(error => {
      throw new SaveError(error instanceof TooManyImportItems ? 413 : 502)
    })
    if (!items.length) return json({ items: [] })
    const names = [...new Set(items.map(item => normalizedName(item.name)))]
    const categories = new Map<string, SupermarketCategory>()
    const batchSize = 5
    for (let start = 0; start < names.length; start += batchSize) {
      await Promise.all(names.slice(start, start + batchSize).map(async name => {
        categories.set(name, await category(db, listId, name, key))
      }))
    }
    const pending = await pendingItems(db, listId)
    return json({ items: reviewRows(items, pending, categories) })
  } catch (error) {
    const status = error instanceof SaveError ? error.status : 500
    const code = status === 413 ? 'IMPORT_TOO_LARGE' : 'PREVIEW_FAILED'
    return json({ error: code }, status)
  }
}
