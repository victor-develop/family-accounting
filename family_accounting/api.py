from __future__ import annotations

import csv
import json
from io import StringIO
from typing import Any

import frappe

from family_accounting.ledger_core import (
    LedgerValidationError,
    minimal_expense_payload,
    normalize_entry,
    suggest_tags as suggest,
    summarize,
)


ENTRY_DOCTYPE = "Family Accounting Entry"
BUDGET_DOCTYPE = "Family Accounting Budget"
ENTRY_FIELDS = [
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
]


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
    as_dict = getattr(doc, "as_dict", None)
    data = as_dict() if callable(as_dict) else dict(doc)
    tags = data.get("tags") or ""
    if isinstance(tags, str):
        data["tags"] = [tag.strip() for tag in tags.split(",") if tag.strip()]
    if data.get("confidence") and float(data["confidence"]) > 1:
        data["confidence"] = float(data["confidence"]) / 100
    if "created_by_agent" in data:
        data["created_by_agent"] = bool(data["created_by_agent"])
    return data


def _frappe_filters(filters: Any = None) -> tuple[dict[str, Any], list[list[str]]]:
    parsed = frappe.parse_json(filters) if isinstance(filters, str) else (filters or {})
    db_filters: dict[str, Any] = {}
    or_filters: list[list[str]] = []
    if parsed.get("household_member"):
        db_filters["household_member"] = parsed["household_member"]
    if parsed.get("category"):
        db_filters["category"] = parsed["category"]
    if parsed.get("direction"):
        db_filters["direction"] = parsed["direction"]
    q = str(parsed.get("q") or "").strip()
    if q:
        pattern = f"%{q}%"
        or_filters = [
            ["merchant", "like", pattern],
            ["note", "like", pattern],
            ["source_text", "like", pattern],
            ["category", "like", pattern],
            ["household_member", "like", pattern],
            ["tags", "like", pattern],
        ]
    return db_filters, or_filters


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
def create_minimal_expense(data: Any = None, **kwargs: Any) -> dict[str, Any]:
    """Create an expense with only amount and description plus safe defaults."""

    try:
        payload = minimal_expense_payload(_payload(data, **kwargs))
    except LedgerValidationError as exc:
        frappe.throw(str(exc), title="Invalid minimal expense")
    return create_entry(payload)


@frappe.whitelist()
def list_entries(filters: Any = None, limit: int = 50) -> list[dict[str, Any]]:
    """List ledger entries with optional Frappe-style filters."""

    db_filters, or_filters = _frappe_filters(filters)
    rows = frappe.get_all(
        ENTRY_DOCTYPE,
        fields=ENTRY_FIELDS,
        filters=db_filters,
        or_filters=or_filters,
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
def export_entries(filters: Any = None, format: str = "json", limit: int = 1000) -> dict[str, Any]:
    """Export ledger rows as JSON data or CSV text."""

    entries = list_entries(filters=filters, limit=limit)
    file_format = "csv" if format == "csv" else "json"
    filename = f"family-ledger.{file_format}"
    if file_format == "csv":
        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=ENTRY_FIELDS)
        writer.writeheader()
        for entry in entries:
            row = {field: entry.get(field, "") for field in ENTRY_FIELDS}
            row["tags"] = ";".join(entry.get("tags") or [])
            writer.writerow(row)
        return {
            "format": "csv",
            "filename": filename,
            "content_type": "text/csv",
            "entry_count": len(entries),
            "content": buffer.getvalue(),
        }
    return {
        "format": "json",
        "filename": filename,
        "content_type": "application/json",
        "entry_count": len(entries),
        "entries": entries,
        "content": json.dumps(entries, default=str, indent=2),
    }


@frappe.whitelist()
def clear_entries(confirm: Any = None) -> dict[str, Any]:
    """Clear all ledger entries after an explicit confirmation token."""

    if confirm != "CLEAR_FAMILY_LEDGER":
        frappe.throw("confirm must be CLEAR_FAMILY_LEDGER", title="Confirmation required")
    names = frappe.get_all(ENTRY_DOCTYPE, pluck="name", limit_page_length=10000)
    for name in names:
        frappe.delete_doc(ENTRY_DOCTYPE, name, ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "deleted": len(names)}


@frappe.whitelist()
def agent_execute(operation: str, payload: Any = None) -> dict[str, Any]:
    """Single RPC surface for LLM agents that prefer one callable tool."""

    body = _payload(payload)
    if operation == "create_entry":
        return {"operation": operation, "result": create_entry(body)}
    if operation == "create_minimal_expense":
        return {"operation": operation, "result": create_minimal_expense(body)}
    if operation == "list_entries":
        return {"operation": operation, "result": list_entries(body.get("filters"), body.get("limit", 50))}
    if operation == "get_summary":
        return {"operation": operation, "result": get_summary(body.get("filters"))}
    if operation == "suggest_tags":
        return {"operation": operation, "result": suggest_tags(body)}
    if operation == "export_entries":
        return {
            "operation": operation,
            "result": export_entries(body.get("filters"), body.get("format", "json"), body.get("limit", 1000)),
        }
    if operation == "clear_entries":
        return {"operation": operation, "result": clear_entries(body.get("confirm"))}
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
                    "create_minimal_expense": {
                        "payload": "amount + description",
                        "returns": "created expense entry",
                    },
                    "list_entries": {"payload": "optional filters", "returns": "entries[]"},
                    "get_summary": {"payload": "optional filters", "returns": "analytics summary"},
                    "suggest_tags": {"payload": "partial entry", "returns": "category/tags/confidence"},
                    "export_entries": {"payload": "optional filters + format", "returns": "JSON entries or CSV text"},
                    "clear_entries": {"payload": "confirm token", "returns": "deleted count"},
                    "agent_execute": {"payload": "operation + payload", "returns": "operation result"},
                },
            }
        )
    )
