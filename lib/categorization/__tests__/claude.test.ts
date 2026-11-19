import { describe, it, expect, vi } from 'vitest'
import { classifyWithClaude, parseClaudeCategory } from '../claude'
const reply = (section: string) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', signature: 'discard' }, { type: 'text', text: JSON.stringify({ section_id: section }) }] })
describe('Claude category validation', () => {
  it('reads only the validated category', () => expect(parseClaudeCategory(reply('milk'))).toBe('milk'))
  it.each([reply('admin'), { ...reply('milk'), stop_reason: 'max_tokens' }, { ...reply('milk'), stop_reason: 'refusal' }, { content: [] }, null, { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"section_id":"milk","extra":1}' }] }])('rejects malformed or incomplete reply', (body) => expect(parseClaudeCategory(body)).toBeNull())
  it('sends only name and prompt, with bounded latency and no retries', async () => {
    const transport = vi.fn<typeof fetch extends (...args: infer A) => unknown ? A : never, ReturnType<typeof fetch>>().mockResolvedValue(new Response(JSON.stringify(reply('milk'))))
    expect(await classifyWithClaude('סקיר', { key: 'test-key', transport })).toBe('milk')
    const options = transport.mock.calls[0][1]!
    expect(JSON.parse(String(options.body)).messages).toEqual([{ role: 'user', content: JSON.stringify({ name: 'סקיר' }) }])
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('falls back for missing key without a request', async () => {
    const transport = vi.fn()
    expect(await classifyWithClaude('סקיר', { key: '', transport })).toBeNull()
    expect(transport).not.toHaveBeenCalled()
  })
  it.each([429, 500, 401])('falls back on HTTP %s', async (status) => {
    const transport = vi.fn().mockResolvedValue(new Response('secret provider error', { status }))
    expect(await classifyWithClaude('סקיר', { key: 'test', transport })).toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('falls back on timeout', async () => {
    const transport = vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
    expect(await classifyWithClaude('סקיר', { key: 'test', transport })).toBeNull()
  })
})
