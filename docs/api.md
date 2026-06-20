# API Contract

Base path: `/api/method/family_accounting.api`

All endpoints return Frappe-style JSON:

```json
{ "message": {} }
```

## Methods

| Method | Purpose |
| --- | --- |
| `create_entry` | Validate and create a household ledger entry. |
| `create_minimal_expense` | Create an expense from only amount and description. |
| `list_entries` | Return entries with optional filters. |
| `get_summary` | Return totals, category spend, member split, month trend, and budget alerts. |
| `suggest_tags` | Return deterministic tags plus provider-neutral LLM classification schema. |
| `export_entries` | Export filtered ledger rows as JSON or CSV. |
| `clear_entries` | Clear ledger rows after an explicit confirmation token. |
| `agent_execute` | Single-call operation wrapper for constrained LLM tool hosts. |
| `openapi_spec` | Compact machine-readable API metadata. |

## Minimal Entry Payload

```json
{
  "household_member": "Victor",
  "account": "HSBC Visa",
  "amount": 245.8,
  "merchant": "Wellcome",
  "source_text": "Wellcome weekly supermarket groceries"
}
```

## Minimal Expense Payload

```json
{
  "amount": 42.5,
  "description": "MTR commute top up"
}
```

Defaults: `direction=Expense`, `household_member=Victor`, `account=Quick Capture`, `currency=HKD`, and `posted_on=today`.

## Export Payload

```json
{
  "filters": { "q": "Wellcome" },
  "format": "csv"
}
```

`format` can be `json` or `csv`.

## Clear Payload

```json
{
  "confirm": "CLEAR_FAMILY_LEDGER"
}
```

Clear operations intentionally reject requests without the exact confirmation token.

## Agent Execute Payload

```json
{
  "operation": "create_minimal_expense",
  "payload": {
    "amount": 88,
    "description": "Coffee shop family breakfast",
    "created_by_agent": true
  }
}
```
