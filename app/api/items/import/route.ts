import { createServerSupabase } from '@/lib/supabase/server'
import { readPayload } from '@/lib/http/read-payload'
import { SaveError } from '@/lib/categorization/service'
import { readConfirmation, readImportResult } from '@/lib/text-import/confirmation'

export const runtime = 'nodejs'

function json(data: unknown, status: number) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) throw new SaveError(403)
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SaveError(415)
    const payload = await readPayload(request, 512 * 1024)
    let input
    try { input = readConfirmation(payload) }
    catch { throw new SaveError(400) }

    const db = await createServerSupabase()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (!user || authError) throw new SaveError(401)
    // The RPC checks household membership and list type while holding the transaction lock.
    const { data, error } = await db.rpc('import_grocery_items', {
      p_list_id: input.listId, p_operation_id: input.operationId, p_rows: input.rows,
    })
    if (error) {
      if (error.code === '42501') throw new SaveError(403)
      if (error.code === '22023') throw new SaveError(400)
      throw new SaveError(500)
    }
    const result = readImportResult(data, input)
    return json(result, result.status === 'conflict' ? 409 : 200)
  } catch (error) {
    return json({ error: 'IMPORT_FAILED' }, error instanceof SaveError ? error.status : 500)
  }
}
