import { once } from 'node:events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFamilyAccountingServer } from '../../src/mock-api/server'

let running: Awaited<ReturnType<typeof createFamilyAccountingServer>> extends infer T
  ? T extends { listen: (...args: any[]) => infer R }
    ? R
    : never
  : never
let baseURL = ''

beforeAll(async () => {
  const server = await createFamilyAccountingServer({ includeFrontend: false })
  running = server.listen(0)
  await once(running.server, 'listening')
  baseURL = running.url
})

afterAll(async () => {
  await running.close()
})

async function rpc(method: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(`${baseURL}/api/method/family_accounting.api.${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  return data.message
}

describe('Family Accounting API', () => {
  it('returns health and OpenAPI metadata', async () => {
    const health = await fetch(`${baseURL}/api/health`).then((response) => response.json())
    const spec = await rpc('openapi_spec')

    expect(health).toMatchObject({ ok: true, app: 'family-accounting' })
    expect(spec.methods).toContain('agent_execute')
  })

  it('suggests tags without coupling to one LLM vendor', async () => {
    const suggestion = await rpc('suggest_tags', {
      merchant: 'MTR',
      source_text: 'MTR top up for commute',
      amount: 200,
      direction: 'Expense',
    })

    expect(suggestion.category).toBe('Transport')
    expect(suggestion.llm_context.task).toBe('classify_household_transaction')
  })

  it('creates, lists, filters, and summarizes entries', async () => {
    const created = await rpc('create_entry', {
      posted_on: '2026-06-20',
      household_member: 'Victor',
      account: 'HSBC Visa',
      direction: 'Expense',
      amount: 46.5,
      merchant: 'Coffee shop',
      source_text: 'Coffee shop breakfast',
      note: 'API test entry',
    })
    const entries = await rpc('list_entries', { filters: { q: 'API test' } })
    const summary = await rpc('get_summary', { filters: { q: 'API test' } })

    expect(created.name).toMatch(/^FAC-ENTRY-/)
    expect(entries).toHaveLength(1)
    expect(summary.expense).toBe(46.5)
  })

  it('executes agent operations through agent_execute', async () => {
    const result = await rpc('agent_execute', {
      operation: 'create_entry',
      payload: {
        household_member: 'Partner',
        account: 'Agent Inbox',
        direction: 'Expense',
        amount: 120,
        merchant: 'School book store',
        source_text: 'School book purchase',
        created_by_agent: true,
      },
    })

    expect(result.operation).toBe('create_entry')
    expect(result.result.category).toBe('Education')
    expect(result.result.created_by_agent).toBe(true)
  })
})
