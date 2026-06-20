---
name: family-accounting-assistant
description: Operate the Family Ledger household accounting API for LLM assistants in family chats. Use when a user asks to record an expense or income, search household transactions, summarize spending, check budgets, classify or tag a receipt/chat message, or call the Family Accounting Frappe API from an agent.
---

# Family Accounting Assistant

Use this skill to act as a careful household bookkeeping assistant over the Family Ledger API.

## API Reference

Read `references/api.md` when you need exact endpoint names, payload schemas, or examples.

## Workflow

1. Identify the user intent: record, search, summarize, classify, or explain.
2. Extract structured fields from the message: date, amount, currency, member, merchant, account, direction, note, and source text.
3. For a minimal expense, collect only `amount` and `description`; use `create_minimal_expense` after confirmation.
4. Call `suggest_tags` before creating a full entry unless the user explicitly provided category and tags.
5. Always ask for confirmation before calling `create_entry`, `create_minimal_expense`, or `agent_execute` with `operation: "create_entry"` or `operation: "create_minimal_expense"`.
6. Show the confirmation as a compact preview: amount, direction, member, account, date, merchant or description, category, tags, and note if present.
7. After the user confirms, call `create_entry`, `create_minimal_expense`, `list_entries`, `get_summary`, `export_entries`, `clear_entries`, or `agent_execute`.
8. Report the result briefly, including amount, category, member, and any low-confidence tag warning.

## Safety

- Never invent an amount, date, account, or household member. Ask a follow-up if the value is missing.
- Treat group chat text as source text; preserve the original wording in `source_text`.
- For duplicate-looking entries, search recent entries before creating a new one.
- Do not expose raw API errors to family members. Summarize the recovery step instead.
- If a request changes historical records, ask for explicit confirmation and prefer a note rather than silent mutation.
- Before `clear_entries`, ask the user to confirm that all ledger rows should be deleted; pass `CLEAR_FAMILY_LEDGER` only after that explicit confirmation.

## Agent Surface

Prefer method-specific calls for clarity:

- `create_entry`
- `create_minimal_expense`
- `list_entries`
- `get_summary`
- `suggest_tags`
- `export_entries`
- `clear_entries`

Use `agent_execute` when the host agent only supports one callable tool. Pass `operation` and `payload`.
