import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('categorization migration packaging (not database integration)', () => {
  it('keeps new installations and the incremental migration in sync', () => {
    const migration = readFileSync('lib/db/migrations/007_auto_categorization.sql', 'utf8').trim()
    const schema = readFileSync('lib/db/schema.sql', 'utf8')
    expect(schema).toContain(migration)
  })
})
