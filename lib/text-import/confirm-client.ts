import { readConfirmation, readImportResult, type ConfirmedRow, type ImportResult } from './confirmation'

/** Keep this confirmation across retries. Create a new one when the user changes the selection. */
export function createImportConfirmation(listId: string, rows: ConfirmedRow[], transport = fetch) {
  const input = readConfirmation({ listId, rows, operationId: crypto.randomUUID() })
  const body = JSON.stringify(input)
  return {
    async submit(): Promise<ImportResult> {
      const response = await transport('/api/items/import', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      })
      if (response.status !== 200 && response.status !== 409) throw new Error('Import confirmation failed')
      const result = readImportResult(await response.json(), input)
      if ((response.status === 409) !== (result.status === 'conflict')) throw new Error('Unexpected import response')
      return result
    },
  }
}
