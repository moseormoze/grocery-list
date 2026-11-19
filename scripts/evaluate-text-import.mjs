import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { model, promptVersion, systemPrompt, parseGroceries } from '../lib/text-import/parser.ts'

const folder = new URL('../specs/features/09-text-list-import/', import.meta.url)
const cases = JSON.parse(await readFile(new URL('evaluation-cases.json', folder), 'utf8'))
const rows = []
const fieldMatches = { name: 0, qty: 0, negated: 0 }
let comparedSlots = 0
for (const { text, expected } of cases) {
  const start = performance.now()
  try {
    const { items, usage } = await parseGroceries(text, { key: process.env.ANTHROPIC_API_KEY ?? '' })
    const slots = Math.max(expected.length, items.length)
    comparedSlots += slots
    let pass = items.length === expected.length
    for (let i = 0; i < slots; i++) {
      for (const field of Object.keys(fieldMatches)) {
        const accepted = [expected[i]?.[field]].flat()
        if (items[i] && expected[i] && accepted.includes(items[i][field])) fieldMatches[field]++
        else pass = false
      }
    }
    rows.push({ text, items, pass, usage, ms: Math.round(performance.now() - start) })
  } catch (error) {
    rows.push({ text, error: error.message, reason: error.cause?.code, ms: Math.round(performance.now() - start) })
    break
  }
}
const scored = rows.filter(row => typeof row.pass === 'boolean').length
const passed = rows.filter(row => row.pass).length
const report = {
  date: new Date().toISOString(), model, promptVersion,
  promptHash: createHash('sha256').update(systemPrompt).digest('hex'),
  cases: cases.length, scored, passed, fieldMatches, comparedSlots, rows,
}
const output = new URL('evaluation-' + report.date.replace(/[:.]/g, '-') + '.json', folder)
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log({ cases: cases.length, scored, passed, error: rows.at(-1)?.error, output: output.pathname })
if (passed !== cases.length) process.exitCode = 1
