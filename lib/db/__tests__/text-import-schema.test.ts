import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('ships the batch RPC in both the clean schema and upgrade migration', () => {
  const sql = readFileSync('lib/db/migrations/009_text_import.sql', 'utf8').trim()
  expect(readFileSync('lib/db/schema.sql', 'utf8')).toContain(sql)
})
