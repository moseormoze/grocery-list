import { SaveError } from '@/lib/categorization/service'

export async function readPayload(request: Request, maxBytes: number): Promise<unknown> {
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
      if (size > maxBytes) {
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
