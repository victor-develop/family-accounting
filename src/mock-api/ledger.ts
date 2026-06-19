import type { Direction, EntryFilters, LedgerEntry, LedgerSummary, TagSuggestion } from '../types'

export const categories = [
  'Groceries',
  'Dining',
  'Housing',
  'Utilities',
  'Transport',
  'Education',
  'Healthcare',
  'Travel',
  'Gifts',
  'Subscriptions',
  'Income',
  'Savings',
  'Uncategorized',
]

const keywordMap: Record<string, string[]> = {
  Groceries: ['supermarket', 'grocery', 'market', 'costco', 'whole foods', 'park n shop', 'wellcome'],
  Dining: ['restaurant', 'cafe', 'coffee', 'dinner', 'lunch', 'breakfast', 'takeout'],
  Housing: ['rent', 'mortgage', 'property', 'management fee'],
  Utilities: ['electric', 'water', 'gas', 'internet', 'mobile', 'phone', 'utility'],
  Transport: ['uber', 'taxi', 'mtr', 'metro', 'bus', 'fuel', 'parking'],
  Education: ['school', 'tuition', 'course', 'book', 'class'],
  Healthcare: ['doctor', 'clinic', 'hospital', 'pharmacy', 'medicine'],
  Travel: ['hotel', 'flight', 'airline', 'booking', 'train'],
  Gifts: ['gift', 'birthday', 'holiday', 'red packet'],
  Subscriptions: ['netflix', 'spotify', 'icloud', 'subscription', 'saas'],
  Income: ['salary', 'payroll', 'bonus', 'interest', 'dividend'],
  Savings: ['saving', 'investment', 'brokerage', 'deposit'],
}

const seedEntries: LedgerEntry[] = [
  {
    name: 'FAC-ENTRY-2026-0001',
    posted_on: '2026-06-02',
    household_member: 'Victor',
    account: 'HSBC Visa',
    direction: 'Expense',
    amount: 386.4,
    currency: 'HKD',
    merchant: 'Wellcome',
    category: 'Groceries',
    tags: ['wellcome', 'weekly-shop'],
    source_text: 'Wellcome weekly groceries',
    note: 'Family dinner supplies',
    confidence: 0.91,
    created_by_agent: false,
  },
  {
    name: 'FAC-ENTRY-2026-0002',
    posted_on: '2026-06-05',
    household_member: 'Partner',
    account: 'Cash',
    direction: 'Expense',
    amount: 128,
    currency: 'HKD',
    merchant: 'MTR',
    category: 'Transport',
    tags: ['mtr', 'commute'],
    source_text: 'MTR top up',
    note: '',
    confidence: 0.89,
    created_by_agent: false,
  },
  {
    name: 'FAC-ENTRY-2026-0003',
    posted_on: '2026-06-08',
    household_member: 'Victor',
    account: 'Payroll',
    direction: 'Income',
    amount: 52000,
    currency: 'HKD',
    merchant: 'Employer',
    category: 'Income',
    tags: ['salary'],
    source_text: 'June salary',
    note: '',
    confidence: 0.94,
    created_by_agent: false,
  },
]

export class LedgerStore {
  private entries: LedgerEntry[] = []
  private sequence = 100

  constructor(seed = true) {
    this.entries = seed ? structuredClone(seedEntries) : []
  }

  reset() {
    this.entries = structuredClone(seedEntries)
    this.sequence = 100
  }

  suggestTags(payload: Partial<LedgerEntry>): TagSuggestion {
    const haystack = [
      payload.source_text,
      payload.merchant,
      payload.note,
      payload.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const matches = Object.entries(keywordMap)
      .flatMap(([category, keywords]) =>
        keywords.filter((keyword) => haystack.includes(keyword)).map((keyword) => ({ category, keyword })),
      )

    const category = payload.direction === 'Income' && matches.length === 0
      ? 'Income'
      : matches[0]?.category || 'Uncategorized'
    const tags = new Set<string>(
      matches.slice(0, 4).map((match) => match.keyword.replace(/\s+/g, '-')),
    )
    if (!matches.length) tags.add('needs-review')
    if (payload.household_member) tags.add(String(payload.household_member).toLowerCase())
    if (Number(payload.amount || 0) >= 1000) tags.add('large-expense')

    return {
      category,
      tags: [...tags].filter(Boolean),
      confidence: matches.length ? Math.min(0.96, 0.58 + matches.length * 0.08) : 0.3,
      reason: `Matched household ledger keywords for ${category}.`,
      llm_context: {
        task: 'classify_household_transaction',
        allowed_categories: categories,
        required_output_schema: {
          category: 'string',
          tags: ['string'],
          confidence: 'number between 0 and 1',
          reason: 'short string',
        },
      },
    }
  }

  createEntry(payload: Partial<LedgerEntry>): LedgerEntry {
    if (!payload.household_member || !payload.account || !payload.amount) {
      throw new Error('household_member, account, and amount are required')
    }
    const amount = Number(payload.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be greater than zero')
    }
    const suggestion = this.suggestTags(payload)
    const entry: LedgerEntry = {
      name: payload.name || `FAC-ENTRY-2026-${String(++this.sequence).padStart(4, '0')}`,
      posted_on: payload.posted_on || new Date().toISOString().slice(0, 10),
      household_member: String(payload.household_member),
      account: String(payload.account),
      direction: normalizeDirection(payload.direction),
      amount: roundMoney(amount),
      currency: (payload.currency || 'HKD').toUpperCase(),
      merchant: payload.merchant || '',
      category: categories.includes(payload.category || '') ? String(payload.category) : suggestion.category,
      tags: normalizeTags(payload.tags?.length ? payload.tags : suggestion.tags),
      source_text: payload.source_text || '',
      note: payload.note || '',
      confidence: Number(payload.confidence || suggestion.confidence),
      created_by_agent: Boolean(payload.created_by_agent),
    }
    this.entries.unshift(entry)
    return structuredClone(entry)
  }

  listEntries(filters: EntryFilters = {}, limit = 50): LedgerEntry[] {
    const q = (filters.q || '').toLowerCase().trim()
    return this.entries
      .filter((entry) => {
        const matchesSearch =
          !q ||
          [entry.merchant, entry.note, entry.source_text, entry.category, entry.household_member, ...entry.tags]
            .join(' ')
            .toLowerCase()
            .includes(q)
        const matchesMember = !filters.household_member || entry.household_member === filters.household_member
        const matchesCategory = !filters.category || entry.category === filters.category
        const matchesDirection = !filters.direction || entry.direction === filters.direction
        return matchesSearch && matchesMember && matchesCategory && matchesDirection
      })
      .slice(0, limit)
      .map((entry) => structuredClone(entry))
  }

  getSummary(filters: EntryFilters = {}): LedgerSummary {
    const entries = this.listEntries(filters, 500)
    const summary: LedgerSummary = {
      entry_count: entries.length,
      income: 0,
      expense: 0,
      transfer: 0,
      net: 0,
      by_category: {},
      by_member: {},
      by_month: {},
      budget_alerts: [
        { category: 'Groceries', limit: 4800, spent: 0, ratio: 0, status: 'ok' },
        { category: 'Transport', limit: 1600, spent: 0, ratio: 0, status: 'ok' },
      ],
    }
    for (const entry of entries) {
      const directionKey = entry.direction.toLowerCase() as 'income' | 'expense' | 'transfer'
      summary[directionKey] += entry.amount
      if (entry.direction === 'Expense') {
        summary.by_category[entry.category] = roundMoney((summary.by_category[entry.category] || 0) + entry.amount)
        summary.by_member[entry.household_member] = roundMoney((summary.by_member[entry.household_member] || 0) + entry.amount)
        const month = entry.posted_on.slice(0, 7)
        summary.by_month[month] = roundMoney((summary.by_month[month] || 0) + entry.amount)
      }
    }
    summary.net = roundMoney(summary.income - summary.expense)
    summary.income = roundMoney(summary.income)
    summary.expense = roundMoney(summary.expense)
    summary.transfer = roundMoney(summary.transfer)
    summary.budget_alerts = summary.budget_alerts.map((budget) => {
      const spent = summary.by_category[budget.category] || 0
      const ratio = budget.limit > 0 ? spent / budget.limit : 0
      return {
        ...budget,
        spent,
        ratio: Number(ratio.toFixed(2)),
        status: spent > budget.limit ? 'over' : 'ok',
      }
    })
    return summary
  }

  agentExecute(operation: string, payload: Record<string, unknown>) {
    if (operation === 'create_entry') return this.createEntry(payload)
    if (operation === 'list_entries') return this.listEntries(payload.filters as EntryFilters, Number(payload.limit || 50))
    if (operation === 'get_summary') return this.getSummary(payload.filters as EntryFilters)
    if (operation === 'suggest_tags') return this.suggestTags(payload)
    throw new Error(`Unsupported operation: ${operation}`)
  }
}

function normalizeDirection(direction: unknown): Direction {
  if (direction === 'Income' || direction === 'Transfer') return direction
  return 'Expense'
}

function normalizeTags(tags: unknown): string[] {
  const values = Array.isArray(tags) ? tags : String(tags || '').split(',')
  return [...new Set(values.map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))]
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
