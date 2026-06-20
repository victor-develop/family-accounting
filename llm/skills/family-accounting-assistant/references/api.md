# Family Ledger API

Base path:

`/api/method/family_accounting.api`

All methods return Frappe-style JSON:

```json
{ "message": { "result": "..." } }
```

## create_entry

Endpoint:

`POST /api/method/family_accounting.api.create_entry`

Before calling this endpoint, show the parsed entry to the user and wait for confirmation.

Payload:

```json
{
  "posted_on": "2026-06-20",
  "household_member": "Victor",
  "account": "HSBC Visa",
  "direction": "Expense",
  "amount": 245.8,
  "currency": "HKD",
  "merchant": "Wellcome",
  "category": "Groceries",
  "tags": ["weekly-shop", "dinner"],
  "source_text": "Wellcome weekly supermarket groceries for dinner",
  "note": "Shared dinner ingredients",
  "created_by_agent": true
}
```

Required fields:

- `household_member`
- `account`
- `amount`

Allowed `direction` values:

- `Expense`
- `Income`
- `Transfer`

## create_minimal_expense

Endpoint:

`POST /api/method/family_accounting.api.create_minimal_expense`

Before calling this endpoint, show the amount and description to the user and wait for confirmation.

Payload:

```json
{
  "amount": 42.5,
  "description": "MTR commute top up"
}
```

Optional defaults:

- `household_member`: defaults to `Victor`
- `account`: defaults to `Quick Capture`
- `posted_on`: defaults to today's date
- `currency`: defaults to `HKD`

## suggest_tags

Endpoint:

`POST /api/method/family_accounting.api.suggest_tags`

Use this before `create_entry` when category or tags are missing.

Returns:

```json
{
  "category": "Groceries",
  "tags": ["supermarket", "victor"],
  "confidence": 0.74,
  "reason": "Matched household ledger keywords for Groceries.",
  "llm_context": {
    "task": "classify_household_transaction",
    "allowed_categories": ["Groceries", "Dining"],
    "required_output_schema": {
      "category": "string",
      "tags": ["string"],
      "confidence": "number between 0 and 1",
      "reason": "short string"
    }
  }
}
```

The `llm_context` field is intentionally provider-neutral. Any LLM can use it to produce the same output shape.

## list_entries

Endpoint:

`POST /api/method/family_accounting.api.list_entries`

Payload:

```json
{
  "filters": {
    "q": "Wellcome",
    "household_member": "Victor",
    "category": "Groceries",
    "direction": "Expense"
  },
  "limit": 50
}
```

All filter fields are optional.

## get_summary

Endpoint:

`POST /api/method/family_accounting.api.get_summary`

Payload:

```json
{
  "filters": {
    "household_member": "Victor"
  }
}
```

Returns totals, category spend, member spend, month trend, and budget alerts.

## export_entries

Endpoint:

`POST /api/method/family_accounting.api.export_entries`

Payload:

```json
{
  "filters": {
    "q": "Wellcome"
  },
  "format": "csv"
}
```

Allowed formats are `json` and `csv`. The response includes `filename`, `content_type`, `entry_count`, and either `entries` or text `content`.

## clear_entries

Endpoint:

`POST /api/method/family_accounting.api.clear_entries`

Ask the user for explicit confirmation before calling this endpoint. Only pass the confirmation token after the user confirms deletion.

Payload:

```json
{
  "confirm": "CLEAR_FAMILY_LEDGER"
}
```

## agent_execute

Endpoint:

`POST /api/method/family_accounting.api.agent_execute`

Payload:

```json
{
  "operation": "create_entry",
  "payload": {
    "household_member": "Partner",
    "account": "Agent Inbox",
    "direction": "Expense",
    "amount": 88,
    "merchant": "Coffee shop",
    "source_text": "Coffee shop family breakfast",
    "created_by_agent": true
  }
}
```

Allowed operations:

- `create_entry`
- `create_minimal_expense`
- `list_entries`
- `get_summary`
- `suggest_tags`
- `export_entries`
- `clear_entries`
