import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import nextEnv from '@next/env'
import { buildRequest, model, readCases, runCases, summarize } from './categorization-evaluation.ts'
import type { Result } from './categorization-evaluation.ts'

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const feature = join(root, 'specs/features/07-auto-categorization')
  const fixture = await readFile(join(feature, 'ai-evaluation-cases.json'), 'utf8')
  const cases = readCases(JSON.parse(fixture))
  const protocol = await readFile(join(feature, 'ai-evaluation.md'), 'utf8')
  const system = protocol.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1]
  if (!system) throw new Error('Missing evaluation prompt')
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--dry-run')) throw new Error('Unknown argument')
  if (args.includes('--dry-run')) {
    console.log(`בדיקת הכנה הצליחה: ${cases.length} פריטים, מודל ${model}. לא נשלחה בקשת API.`)
    return
  }
  nextEnv.loadEnvConfig(root, false, { info: () => {}, error: () => {} })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key?.trim()) {
    console.error('חסר ANTHROPIC_API_KEY בקובץ .env.local')
    process.exitCode = 1
    return
  }
  const startedAt = new Date().toISOString()
  const output = join(feature, 'evaluation-results', `${startedAt.replace(/[:.]/g, '-')}.json`)
  await mkdir(dirname(output), { recursive: true })
  const sha = (value: string) => createHash('sha256').update(value).digest('hex')
  const metadata = {
    startedAt, model, apiVersion: '2023-06-01', timeoutMs: 10000, prompt: system,
    promptHash: sha(system), fixtureHash: sha(fixture), settings: buildRequest('', '').output_config,
    maxOutputTokens: 256, thinking: 'disabled', retries: 0,
    costUsd: null, costNote: 'עלות תחושב לאחר ההרצה לפי usage ותעריף הספק. טוקנים של בקשות ללא תשובה אינם ידועים.',
  }
  async function save(rows: Result[], state: string) {
    const report = { ...metadata, updatedAt: new Date().toISOString(), state, summary: summarize(rows, cases.length), results: rows }
    await writeFile(`${output}.tmp`, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
    await rename(`${output}.tmp`, output)
  }
  await save([], 'running')
  console.log(`מריץ ${cases.length} בדיקות מול Claude. התוצאות יישמרו אחרי כל פריט.`)
  const rows = await runCases(cases, { key, system, workspace: process.env.ANTHROPIC_WORKSPACE_ID }, async results => {
    await save(results, 'running')
    const row = results[results.length - 1]
    const outcome = row.status === 'ok' ? row.category : `${row.status}${row.httpStatus ? ` (${row.httpStatus})` : ''}`
    console.log(`${results.length}/${cases.length} | ${row.name} | ${outcome} | ${row.elapsedMs}ms`)
  })
  await save(rows, rows.length === cases.length ? 'completed' : 'stopped')
  const summary = summarize(rows, cases.length)
  console.log(`תוצאות: ${summary.correct}/${summary.attempted} תואמות לציפיות. כשלים: ${summary.failures}. לא הורצו: ${summary.unattempted}.`)
  console.log(`זמן חציוני: ${summary.p50Ms}ms. אחוזון 95: ${summary.p95Ms}ms.`)
  console.log(`טוקנים מדווחים: ${summary.inputTokens} קלט, ${summary.outputTokens} פלט. בקשות ללא usage: ${summary.usageMissing}.`)
  console.log(`הדוח נשמר: ${output}`)
  if (summary.unattempted || summary.failures) process.exitCode = 1
}

main().catch(() => {
  console.error('לא ניתן להשלים את הניסוי. בדוק שהקבצים קיימים ושיש הרשאת כתיבה לתיקיית הדוחות. דוח ביניים, אם נוצר, נשמר.')
  process.exitCode = 1
})
