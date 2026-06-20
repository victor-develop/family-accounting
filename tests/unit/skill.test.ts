import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const skillRoot = path.resolve(process.cwd(), 'llm/skills/family-accounting-assistant')

describe('family accounting assistant skill', () => {
  it('requires confirmation before every entry creation surface', () => {
    const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf-8')

    expect(skill).toContain('Always ask for confirmation before calling `create_entry`')
    expect(skill).toContain('`agent_execute` with `operation: "create_entry"`')
    expect(skill).toContain('`create_minimal_expense`')
  })

  it('documents export and clear operations for agents', () => {
    const reference = fs.readFileSync(path.join(skillRoot, 'references/api.md'), 'utf-8')

    expect(reference).toContain('export_entries')
    expect(reference).toContain('clear_entries')
    expect(reference).toContain('CLEAR_FAMILY_LEDGER')
  })
})
