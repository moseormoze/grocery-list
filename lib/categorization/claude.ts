import { CATEGORY_PROMPT } from './prompt'
import { isRecord, isCategory, SUPERMARKET_CATEGORIES, type SupermarketCategory } from './types'

export const AI_MODEL = 'claude-haiku-5-5'
export const AI_VERSION = `${AI_MODEL}:groceries-v1`

export function parseClaudeCategory(body: unknown): SupermarketCategory | null {
  if (!isRecord(body) || body.stop_reason !== 'end_turn' || !Array.isArray(body.content)) return null
  const blocks: unknown[] = body.content.filter((block: unknown) => isRecord(block) && block.type === 'text')
  if (blocks.length !== 1 || !isRecord(blocks[0]) || typeof blocks[0].text !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(blocks[0].text)
    return isRecord(parsed) && Object.keys(parsed).length === 1 && isCategory(parsed.section_id) ? parsed.section_id : null
  } catch { return null }
}

export async function classifyWithClaude(name: string, options: { key: string, transport?: typeof fetch }): Promise<SupermarketCategory | null> {
  if (!options.key) return null
  try {
    const response = await (options.transport ?? fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(4000),
      headers: { 'content-type': 'application/json', 'x-api-key': options.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 256, thinking: { type: 'disabled' }, system: CATEGORY_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ name }) }],
        output_config: { format: { type: 'json_schema', schema: {
          type: 'object', properties: { section_id: { type: 'string', enum: SUPERMARKET_CATEGORIES } },
          required: ['section_id'], additionalProperties: false,
        } } },
      }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return null
    }
    return parseClaudeCategory(await response.json())
  } catch { return null }
}
