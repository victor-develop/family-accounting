import { describe, expect, it } from 'vitest'
import { LedgerStore } from '../../src/mock-api/ledger'

describe('LedgerStore', () => {
  it('suggests category and tags from transaction text', () => {
    const store = new LedgerStore(false)
    const suggestion = store.suggestTags({
      household_member: 'Victor',
      merchant: 'Wellcome',
      source_text: 'Weekly supermarket groceries',
      amount: 612,
      direction: 'Expense',
    })

    expect(suggestion.category).toBe('Groceries')
    expect(suggestion.tags).toContain('supermarket')
    expect(suggestion.llm_context.allowed_categories).toContain('Groceries')
  })

  it('creates entries and includes them in summaries', () => {
    const store = new LedgerStore(false)
    const entry = store.createEntry({
      posted_on: '2026-06-20',
      household_member: 'Partner',
      account: 'Cash',
      amount: 88.2,
      merchant: 'Coffee shop',
      source_text: 'Family breakfast at cafe',
    })

    expect(entry.category).toBe('Dining')
    expect(store.listEntries({ q: 'breakfast' })).toHaveLength(1)
    expect(store.getSummary().expense).toBe(88.2)
    expect(store.getSummary().by_member.Partner).toBe(88.2)
  })

  it('creates minimal expense entries from amount and description only', () => {
    const store = new LedgerStore(false)
    const entry = store.createMinimalExpense({
      amount: 42,
      description: 'MTR commute top up',
    })

    expect(entry.household_member).toBe('Victor')
    expect(entry.account).toBe('Quick Capture')
    expect(entry.direction).toBe('Expense')
    expect(entry.category).toBe('Transport')
    expect(entry.source_text).toBe('MTR commute top up')
  })

  it('exports and clears ledger data with explicit confirmation', () => {
    const store = new LedgerStore(false)
    store.createMinimalExpense({ amount: 66, description: 'Coffee with family' })

    const exported = store.exportEntries({}, 'csv')
    expect(exported.entry_count).toBe(1)
    expect(exported.content).toContain('Coffee with family')
    expect(() => store.clearEntries('')).toThrow(/confirm/)
    expect(store.clearEntries('CLEAR_FAMILY_LEDGER')).toEqual({ ok: true, deleted: 1 })
    expect(store.listEntries()).toHaveLength(0)
  })

  it('supports a single LLM agent operation surface', () => {
    const store = new LedgerStore(false)
    const result = store.agentExecute('suggest_tags', {
      direction: 'Income',
      source_text: 'June salary',
      amount: 52000,
    })

    expect(result).toMatchObject({ category: 'Income' })
  })
})
