export const categories = ['produce', 'milk', 'meat', 'dry', 'sauces', 'baking', 'snacks', 'drinks', 'frozen', 'cleaning', 'other'] as const
export const model = 'claude-haiku-5-5'
type Category = typeof categories[number]
export type EvaluationCase = { id: string, group: string, name: string, expected: Category }
type Status = 'ok' | 'invalid_response' | 'truncated' | 'refused' | 'http_error' | 'timeout' | 'network_error'
type Usage = { input_tokens: number, output_tokens: number, cache_read_input_tokens: number, cache_creation_input_tokens: number }
type Reply = { category: Category | null, status: Status, usage: Usage | null }
export type Result = EvaluationCase & Reply & { elapsedMs: number, httpStatus: number | null }
type Options = { key: string, system: string, workspace?: string, transport?: typeof fetch }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function category(value: unknown): value is Category {
  return typeof value === 'string' && categories.some(key => key === value)
}
function tokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function readCases(value: unknown): EvaluationCase[] {
  if (!record(value) || !Array.isArray(value.cases) || !value.cases.length || value.cases.length > 60) throw new Error('Invalid evaluation data')
  const ids = new Set<string>()
  return value.cases.map((row: unknown) => {
    if (!record(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
      typeof row.name !== 'string' || !row.name.trim() || typeof row.group !== 'string' || !row.group || !category(row.expected)) {
      throw new Error('Invalid evaluation case')
    }
    ids.add(row.id)
    return { id: row.id, group: row.group, name: row.name, expected: row.expected }
  })
}

export function buildRequest(name: string, system: string) {
  return {
    model, max_tokens: 256, thinking: { type: 'disabled' }, system,
    messages: [{ role: 'user', content: JSON.stringify({ name }) }],
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object', properties: { section_id: { type: 'string', enum: categories } },
      required: ['section_id'], additionalProperties: false,
    } } },
  }
}

export function parseReply(body: unknown): Reply {
  const invalid: Reply = { category: null, status: 'invalid_response', usage: null }
  if (!record(body)) return invalid
  if (record(body.usage) && typeof body.usage.input_tokens === 'number' && typeof body.usage.output_tokens === 'number') {
    invalid.usage = {
      input_tokens: tokenCount(body.usage.input_tokens), output_tokens: tokenCount(body.usage.output_tokens),
      cache_read_input_tokens: tokenCount(body.usage.cache_read_input_tokens),
      cache_creation_input_tokens: tokenCount(body.usage.cache_creation_input_tokens),
    }
  }
  if (body.stop_reason === 'refusal') return { ...invalid, status: 'refused' }
  if (body.stop_reason === 'max_tokens') return { ...invalid, status: 'truncated' }
  if (body.stop_reason !== 'end_turn' || !Array.isArray(body.content)) return invalid
  const text = body.content.filter((block: unknown) => record(block) && block.type === 'text')
  if (text.length !== 1 || !record(text[0]) || typeof text[0].text !== 'string') return invalid
  try {
    const parsed: unknown = JSON.parse(text[0].text)
    if (!record(parsed) || Object.keys(parsed).length !== 1 || !category(parsed.section_id)) return invalid
    return { ...invalid, status: 'ok', category: parsed.section_id }
  } catch { return invalid }
}

export async function runCases(cases: EvaluationCase[], options: Options, checkpoint: (rows: Result[]) => void | Promise<void> = () => {}) {
  if (!options.key.trim() || !options.system.trim()) throw new Error('Missing evaluation configuration')
  readCases({ cases })
  const rows: Result[] = []
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'x-api-key': options.key, 'anthropic-version': '2023-06-01',
  }
  if (options.workspace) headers['anthropic-workspace-id'] = options.workspace
  for (const item of cases) {
    const start = Date.now()
    let result: Reply = { category: null, status: 'network_error', usage: null }
    let httpStatus: number | null = null
    try {
      const response = await (options.transport ?? fetch)('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, signal: AbortSignal.timeout(10000), body: JSON.stringify(buildRequest(item.name, options.system)),
      })
      httpStatus = response.status
      if (!response.ok) {
        result = { ...result, status: 'http_error' }
        await response.body?.cancel()
      } else {
        result = { ...result, status: 'invalid_response' }
        result = parseReply(await response.json())
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) result.status = 'timeout'
    }
    rows.push({ ...item, ...result, httpStatus, elapsedMs: Date.now() - start })
    await checkpoint([...rows])
    if (result.status === 'network_error' || (httpStatus !== null && [400, 401, 402, 403, 404, 429].includes(httpStatus))) break
  }
  return rows
}

export function summarize(rows: Result[], planned: number) {
  const times = rows.map(row => row.elapsedMs).sort((a, b) => a - b)
  const correct = rows.filter(row => row.status === 'ok' && row.category === row.expected).length
  const count = (key: keyof Usage) => rows.reduce((total, row) => total + (row.usage?.[key] ?? 0), 0)
  const groups = [...new Set(rows.map(row => row.group))]
  return {
    planned, attempted: rows.length, unattempted: planned - rows.length, correct,
    accuracy: rows.length ? correct / rows.length : null,
    failures: rows.filter(row => row.status !== 'ok').length,
    p50Ms: times[Math.ceil(times.length * 0.5) - 1] ?? null,
    p95Ms: times[Math.ceil(times.length * 0.95) - 1] ?? null, maxMs: times.at(-1) ?? null,
    inputTokens: count('input_tokens'), outputTokens: count('output_tokens'),
    cacheReadTokens: count('cache_read_input_tokens'), cacheWriteTokens: count('cache_creation_input_tokens'),
    usageMissing: rows.filter(row => row.usage === null).length,
    unexpectedOther: rows.filter(row => row.status === 'ok' && row.category === 'other' && row.expected !== 'other').length,
    missedOther: rows.filter(row => row.status === 'ok' && row.category !== 'other' && row.expected === 'other').length,
    groups: Object.fromEntries(groups.map(group => {
      const subset = rows.filter(row => row.group === group)
      return [group, { attempted: subset.length, correct: subset.filter(row => row.status === 'ok' && row.category === row.expected).length }]
    })),
  }
}
