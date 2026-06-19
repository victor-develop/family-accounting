from __future__ import annotations

import json
from typing import Any

import frappe

from family_accounting.ledger_core import LedgerValidationError, normalize_entry, suggest_tags as suggest, summarize


ENTRY_DOCTYPE = "Family Accounting Entry"
BUDGET_DOCTYPE = "Family Accounting Budget"


def _payload(data: Any = None, **kwargs: Any) -> dict[str, Any]:
    if isinstance(data, str):
        parsed = frappe.parse_json(data)
    elif isinstance(data, dict):
        parsed = data
    elif data is None:
        parsed = {}
    else:
        parsed = dict(data)
    parsed.update({key: value for key, value in kwargs.items() if value is not None})
    return parsed


def _entry_to_dict(doc: Any) -> dict[str, Any]:
    data = doc.as_dict() if hasattr(doc, "as_dict") else dict(doc)
    tags = data.get("tags") or ""
    if isinstance(tags, str):
        data["tags"] = [tag.strip() for tag in tags.split(",") if tag.strip()]
    return data


@frappe.whitelist()
def suggest_tags(data: Any = None, **kwargs: Any) -> dict[str, Any]:
    """Return deterministic tag suggestions and an agent-agnostic LLM schema."""

    return suggest(_payload(data, **kwargs))


@frappe.whitelist()
def create_entry(data: Any = None, **kwargs: Any) -> dict[str, Any]:
    """Create a household ledger entry."""

    try:
        entry = normalize_entry(_payload(data, **kwargs))
    except LedgerValidationError as exc:
        frappe.throw(str(exc), title="Invalid ledger entry")

    doc = frappe.get_doc(
        {
            "doctype": ENTRY_DOCTYPE,
            "posted_on": entry.posted_on,
            "household_member": entry.household_member,
            "account": entry.account,
            "direction": entry.direction,
            "amount": float(entry.amount),
            "currency": entry.currency,
            "merchant": entry.merchant,
            "category": entry.category,
            "tags": ", ".join(entry.tags),
            "source_text": entry.source_text,
            "note": entry.note,
            "confidence": entry.confidence * 100,
            "created_by_agent": int(entry.created_by_agent),
        }
    )
    doc.insert()
    frappe.db.commit()
    return _entry_to_dict(doc)


@frappe.whitelist()
def list_entries(filters: Any = None, limit: int = 50) -> list[dict[str, Any]]:
    """List ledger entries with optional Frappe-style filters."""

    parsed_filters = frappe.parse_json(filters) if isinstance(filters, str) else filters
    rows = frappe.get_all(
        ENTRY_DOCTYPE,
        fields=[
            "name",
            "posted_on",
            "household_member",
            "account",
            "direction",
            "amount",
            "currency",
            "merchant",
            "category",
            "tags",
            "source_text",
            "note",
            "confidence",
            "created_by_agent",
        ],
        filters=parsed_filters,
        order_by="posted_on desc, creation desc",
        limit_page_length=int(limit or 50),
    )
    return [_entry_to_dict(row) for row in rows]


@frappe.whitelist()
def get_summary(filters: Any = None) -> dict[str, Any]:
    """Return household spending summary for dashboards and assistants."""

    entries = list_entries(filters=filters, limit=500)
    budgets = frappe.get_all(
        BUDGET_DOCTYPE,
        fields=["category", "limit_amount", "currency", "period_start", "period_end"],
        limit_page_length=200,
    )
    return summarize(entries, budgets)


@frappe.whitelist()
def agent_execute(operation: str, payload: Any = None) -> dict[str, Any]:
    """Single RPC surface for LLM agents that prefer one callable tool."""

    body = _payload(payload)
    if operation == "create_entry":
        return {"operation": operation, "result": create_entry(body)}
    if operation == "list_entries":
        return {"operation": operation, "result": list_entries(body.get("filters"), body.get("limit", 50))}
    if operation == "get_summary":
        return {"operation": operation, "result": get_summary(body.get("filters"))}
    if operation == "suggest_tags":
        return {"operation": operation, "result": suggest_tags(body)}
    frappe.throw(f"Unsupported operation: {operation}", title="Invalid agent operation")


@frappe.whitelist()
def openapi_spec() -> dict[str, Any]:
    """Expose a compact machine-readable API description for tools."""

    return json.loads(
        json.dumps(
            {
                "name": "Family Accounting API",
                "base_path": "/api/method/family_accounting.api",
                "methods": {
                    "create_entry": {"payload": "Ledger entry JSON", "returns": "created entry"},
                    "list_entries": {"payload": "optional filters", "returns": "entries[]"},
                    "get_summary": {"payload": "optional filters", "returns": "analytics summary"},
                    "suggest_tags": {"payload": "partial entry", "returns": "category/tags/confidence"},
                    "agent_execute": {"payload": "operation + payload", "returns": "operation result"},
                },
            }
        )
    )
