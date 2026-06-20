import type {
  ClearLedgerResult,
  EntryFilters,
  LedgerEntry,
  LedgerExport,
  LedgerSummary,
  MinimalExpensePayload,
  TagSuggestion,
} from './types'

async function callMethod<T>(method: string, payload: object = {}): Promise<T> {
  const response = await fetch(`/api/method/family_accounting.api.${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `API call failed: ${method}`)
  }
  return data.message as T
}

export function suggestTags(payload: Partial<LedgerEntry>) {
  return callMethod<TagSuggestion>('suggest_tags', payload)
}

export function createEntry(payload: Partial<LedgerEntry>) {
  return callMethod<LedgerEntry>('create_entry', payload)
}

export function createMinimalExpense(payload: MinimalExpensePayload) {
  return callMethod<LedgerEntry>('create_minimal_expense', payload)
}

export function listEntries(filters: EntryFilters = {}) {
  return callMethod<LedgerEntry[]>('list_entries', { filters })
}

export function getSummary(filters: EntryFilters = {}) {
  return callMethod<LedgerSummary>('get_summary', { filters })
}

export function exportEntries(filters: EntryFilters = {}, format: 'json' | 'csv' = 'json') {
  return callMethod<LedgerExport>('export_entries', { filters, format })
}

export function clearEntries(confirm = 'CLEAR_FAMILY_LEDGER') {
  return callMethod<ClearLedgerResult>('clear_entries', { confirm })
}

export function agentExecute<T>(operation: string, payload: Record<string, unknown>) {
  return callMethod<{ operation: string; result: T }>('agent_execute', { operation, payload })
}
