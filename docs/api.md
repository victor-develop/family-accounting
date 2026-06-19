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
| `list_entries` | Return entries with optional filters. |
| `get_summary` | Return totals, category spend, member split, month trend, and budget alerts. |
| `suggest_tags` | Return deterministic tags plus provider-neutral LLM classification schema. |
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

## Agent Execute Payload

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
