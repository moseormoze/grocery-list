// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { parseGroceries } from '../parser'

const item = { name: 'גבינה לבנה 5%', qty: 'חבילה אחת', negated: false }
const envelope = (items: unknown) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ items }) }],
  usage: { input_tokens: 20, output_tokens: 30 },
})
const parse = (payload: unknown) => parseGroceries('רשימה', {
  key: 'test', transport: async () => Response.json(payload),
})

describe('parseGroceries', () => {
  it('preserves order, missing quantities, product attributes and negation', async () => {
    const items = [item, { name: 'חלב', qty: null, negated: true }]
    expect(await parse(envelope(items))).toMatchObject({ items, usage: { input_tokens: 20, output_tokens: 30 } })
  })

  it('distinguishes a valid empty list from failed extraction', async () => {
    expect((await parse(envelope([]))).items).toEqual([])
  })

  it.each([
    { ...envelope([item]), stop_reason: 'max_tokens' },
    { ...envelope([]), content: [{ type: 'text', text: '{broken' }] },
    envelope([item, { ...item, name: '  ' }]),
    envelope([{ ...item, negated: 'false' }]),
    envelope([{ ...item, qty: 6 }]),
    envelope(Array.from({ length: 61 }, () => item)),
  ])('rejects the entire incomplete or malformed response', async body => {
    await expect(parse(body)).rejects.toThrow()
  })

  it('propagates network failures without returning an empty list', async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(parseGroceries('חלב', { key: 'test', transport })).rejects.toThrow()
    expect(transport).toHaveBeenCalledTimes(1)
  })
})

it('formats spoken counts before units while preserving fractions and compound numbers', async () => {
  const quantities = ['שש יחידות', 'שתי קופסאות', 'שש עשרה יחידות', 'חצי קילו', 'חבילה אחת']
  const { items } = await parse(envelope(quantities.map(qty => ({ ...item, qty }))))
  expect(items.map(row => row.qty)).toEqual(['6 יחידות', '2 קופסאות', ...quantities.slice(2)])
})
