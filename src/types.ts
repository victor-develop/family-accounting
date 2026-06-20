export type Direction = 'Expense' | 'Income' | 'Transfer'

export interface LedgerEntry {
  name: string
  posted_on: string
  household_member: string
  account: string
  direction: Direction
  amount: number
  currency: string
  merchant: string
  category: string
  tags: string[]
  source_text: string
  note: string
  confidence: number
  created_by_agent: boolean
}

export interface TagSuggestion {
  category: string
  tags: string[]
  confidence: number
  reason: string
  llm_context: {
    task: string
    allowed_categories: string[]
    required_output_schema: Record<string, unknown>
  }
}

export interface LedgerSummary {
  entry_count: number
  income: number
  expense: number
  transfer: number
  net: number
  by_category: Record<string, number>
  by_member: Record<string, number>
  by_month: Record<string, number>
  budget_alerts: Array<{
    category: string
    limit: number
    spent: number
    ratio: number
    status: 'ok' | 'over'
  }>
}

export interface EntryFilters {
  q?: string
  household_member?: string
  category?: string
  direction?: Direction | ''
}

export interface MinimalExpensePayload {
  amount: number
  description: string
  household_member?: string
  account?: string
  posted_on?: string
  currency?: string
  created_by_agent?: boolean
}

export interface LedgerExport {
  format: 'json' | 'csv'
  filename: string
  content_type: string
  entry_count: number
  entries?: LedgerEntry[]
  content?: string
}

export interface ClearLedgerResult {
  ok: boolean
  deleted: number
}
