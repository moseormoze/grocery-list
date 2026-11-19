// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildRequest, parseReply, readCases, runCases, summarize } from '../categorization-evaluation'

const item = { id: 'one', group: 'standard', name: 'חלב', expected: 'milk' }
const reply = (section = 'milk') => ({
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: 'private', signature: 'secret-signature' },
    { type: 'text', text: JSON.stringify({ section_id: section }) },
  ],
  usage: { input_tokens: 20, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
})

describe('evaluation input and requests', () => {
  it('validates the fixture and rejects conflicting IDs or unsupported categories', () => {
    expect(readCases({ cases: [item] })).toEqual([item])
    expect(() => readCases({ cases: [item, item] })).toThrow()
    expect(() => readCases({ cases: [{ ...item, expected: 'admin' }] })).toThrow()
    expect(() => readCases({ cases: Array.from({ length: 61 }, (_, i) => ({ ...item, id: String(i) })) })).toThrow()
  })
  it('sends only the item name, with a closed schema and no expected label', () => {
    const request = buildRequest(item.name, 'system instructions')
    expect(request.messages).toEqual([{ role: 'user', content: JSON.stringify({ name: 'חלב' }) }])
    expect(request.output_config.format.schema.additionalProperties).toBe(false)
    expect(request.output_config.format.schema.properties.section_id.enum).toContain('other')
    expect(JSON.stringify(request)).not.toContain('expected')
  })
})

describe('reply validation', () => {
  it('keeps only a validated category and numeric usage, discarding thinking and signatures', () => {
    const result = parseReply(reply())
    expect(result.category).toBe('milk')
    expect(result.status).toBe('ok')
    expect(result.usage?.output_tokens).toBe(5)
    expect(JSON.stringify(result)).not.toMatch(/private|secret-signature|thinking/)
  })
  it.each(['admin', 'ממרחים'])('rejects an unsupported category: %s', category => {
    expect(parseReply(reply(category)).status).toBe('invalid_response')
  })
  it('rejects extra fields, malformed JSON and absent text', () => {
    for (const text of ['not json', '{"section_id":"milk","extra":true}']) {
      expect(parseReply({ ...reply(), content: [{ type: 'text', text }] }).status).toBe('invalid_response')
    }
    expect(parseReply({ ...reply(), content: [{ type: 'thinking', signature: 'hidden' }] }).status).toBe('invalid_response')
  })
  it('does not score truncated or refused responses as valid classifications', () => {
    expect(parseReply({ ...reply(), stop_reason: 'max_tokens' }).status).toBe('truncated')
    expect(parseReply({ ...reply(), stop_reason: 'refusal' }).status).toBe('refused')
  })
})

describe('evaluation execution', () => {
  it('runs once per item and reports mistakes and usage without logging credentials', async () => {
    const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockResolvedValue(new Response(JSON.stringify(reply()), { status: 200 }))
    const result = await runCases(readCases({ cases: [item] }), { key: 'private-key', system: 'instructions', transport })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(result[0]).toMatchObject({ id: 'one', category: 'milk', status: 'ok', httpStatus: 200 })
    expect(JSON.stringify(result)).not.toMatch(/private-key|secret-signature/)
  })
  it('stops on authorization failure and never stores the raw provider error', async () => {
    const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-key' } }), { status: 401 }))
    const result = await runCases(readCases({ cases: [item, { ...item, id: 'two' }] }), { key: 'private-key', system: 'instructions', transport })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('http_error')
    expect(JSON.stringify(result)).not.toContain('private-key')
  })
  it('records timeouts without retries, and stops on a network failure', async () => {
    const timeout = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockRejectedValue(new DOMException('private-key', 'TimeoutError'))
    const result = await runCases(readCases({ cases: [item] }), { key: 'private-key', system: 'instructions', transport: timeout })
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(result[0].status).toBe('timeout')
    const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockRejectedValue(new TypeError('private-key'))
    const network = await runCases(readCases({ cases: [item, { ...item, id: 'two' }] }), { key: 'private-key', system: 'instructions', transport })
    expect(network).toHaveLength(1)
    expect(network[0].status).toBe('network_error')
    expect(JSON.stringify(network)).not.toContain('private-key')
  })
  it('checkpoints each completed result before continuing', async () => {
    const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockImplementation(async () => new Response(JSON.stringify(reply())))
    const checkpoint = vi.fn()
    await runCases(readCases({ cases: [item, { ...item, id: 'two' }] }), { key: 'key', system: 'instructions', transport }, checkpoint)
    expect(checkpoint.mock.calls.map(call => call[0].length)).toEqual([1, 2])
  })
  it('counts failures in accuracy, reports unattempted items, and uses nearest-rank percentiles', async () => {
    const transport = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(reply())))
      .mockRejectedValueOnce(new DOMException('', 'TimeoutError'))
    const cases = readCases({ cases: [item, { ...item, id: 'two' }] })
    const rows = await runCases(cases, { key: 'key', system: 'instructions', transport })
    rows[0].elapsedMs = 100
    rows[1].elapsedMs = 10000
    expect(summarize(rows, 60)).toMatchObject({ attempted: 2, correct: 1, failures: 1, accuracy: 0.5, unattempted: 58, p50Ms: 100, p95Ms: 10000, inputTokens: 20, outputTokens: 5 })
  })
})
