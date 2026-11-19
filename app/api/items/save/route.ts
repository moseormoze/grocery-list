import { createServerSupabase } from '@/lib/supabase/server'
import { classifyWithClaude } from '@/lib/categorization/claude'
import { parseSaveInput, SaveError, saveCategorizedItem } from '@/lib/categorization/service'
import { parseMemory, parseSaveResult } from '@/lib/categorization/types'

export const runtime = 'nodejs'

async function readPayload(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new SaveError(400)
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new SaveError(413)
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    if (error instanceof SaveError) throw error
    throw new SaveError(400)
  } finally { reader.releaseLock() }
}
function databaseFailure(code: string): SaveError {
  return new SaveError(code === '42501' ? 403 : code === '22023' ? 400 : 500)
}
export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) throw new SaveError(403)
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SaveError(415)
    const input = parseSaveInput(await readPayload(request))
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new SaveError(401)
    const result = await saveCategorizedItem(input, {
      async lookup(value) {
        const { data, error } = await supabase.rpc('get_supermarket_categorization', {
          p_list_id: value.listId, p_name: value.name, p_item_id: value.itemId ?? null,
        })
        if (error) throw databaseFailure(error.code)
        return parseMemory(data)
      },
      async save(value, candidate, version) {
        const { data, error } = await supabase.rpc('save_supermarket_item', {
          p_list_id: value.listId, p_name: value.name, p_qty: value.qty,
          p_mode: value.mode, p_section_id: value.sectionId ?? null, p_item_id: value.itemId ?? null,
          p_ai_section_id: candidate, p_ai_version: version,
        })
        if (error) throw databaseFailure(error.code)
        return parseSaveResult(data)
      },
    }, name => classifyWithClaude(name, { key: process.env.ANTHROPIC_API_KEY ?? '' }))
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: 'SAVE_FAILED' }, {
      status: error instanceof SaveError ? error.status : 500, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
