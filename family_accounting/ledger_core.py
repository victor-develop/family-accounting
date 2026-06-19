from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Iterable, Optional, Tuple, Union


CATEGORIES = [
    "Groceries",
    "Dining",
    "Housing",
    "Utilities",
    "Transport",
    "Education",
    "Healthcare",
    "Travel",
    "Gifts",
    "Subscriptions",
    "Income",
    "Savings",
    "Uncategorized",
]

KEYWORD_TAGS = {
    "Groceries": ["supermarket", "grocery", "market", "costco", "whole foods", "park n shop", "wellcome"],
    "Dining": ["restaurant", "cafe", "coffee", "dinner", "lunch", "breakfast", "takeout"],
    "Housing": ["rent", "mortgage", "property", "management fee"],
    "Utilities": ["electric", "water", "gas", "internet", "mobile", "phone", "utility"],
    "Transport": ["uber", "taxi", "mtr", "metro", "bus", "fuel", "parking"],
    "Education": ["school", "tuition", "course", "book", "class"],
    "Healthcare": ["doctor", "clinic", "hospital", "pharmacy", "medicine"],
    "Travel": ["hotel", "flight", "airline", "booking", "train"],
    "Gifts": ["gift", "birthday", "holiday", "red packet"],
    "Subscriptions": ["netflix", "spotify", "icloud", "subscription", "saas"],
    "Income": ["salary", "payroll", "bonus", "interest", "dividend"],
    "Savings": ["saving", "investment", "brokerage", "deposit"],
}


class LedgerValidationError(ValueError):
    """Raised when a ledger entry payload cannot be accepted."""


def money(value: Any) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError):
        raise LedgerValidationError("amount must be a number") from None
    if amount <= 0:
        raise LedgerValidationError("amount must be greater than zero")
    return amount


def normalize_tags(tags: Optional[Union[Iterable[str], str]]) -> list[str]:
    if not tags:
        return []
    if isinstance(tags, str):
        tags = [tag.strip() for tag in tags.replace(";", ",").split(",")]
    seen: set[str] = set()
    normalized: list[str] = []
    for tag in tags:
        clean = str(tag).strip().lower().replace(" ", "-")
        if clean and clean not in seen:
            seen.add(clean)
            normalized.append(clean)
    return normalized


def choose_category(text: str, direction: str = "Expense") -> Tuple[str, float, list[str]]:
    haystack = text.lower()
    matches: list[tuple[str, str]] = []
    for category, keywords in KEYWORD_TAGS.items():
        for keyword in keywords:
            if keyword in haystack:
                matches.append((category, keyword))
    if direction == "Income" and not matches:
        return "Income", 0.58, ["income"]
    if not matches:
        return "Uncategorized", 0.3, ["needs-review"]
    category = matches[0][0]
    confidence = min(0.96, 0.58 + 0.08 * len(matches))
    return category, confidence, sorted({match[1].replace(" ", "-") for match in matches[:4]})


def suggest_tags(payload: dict[str, Any]) -> dict[str, Any]:
    direction = str(payload.get("direction") or "Expense")
    text = " ".join(
        str(payload.get(key) or "")
        for key in ("source_text", "merchant", "note", "category")
    ).strip()
    category, confidence, tags = choose_category(text, direction)
    existing = normalize_tags(payload.get("tags"))
    merged = normalize_tags([*tags, *existing, str(payload.get("household_member") or "").lower()])
    if payload.get("amount"):
        try:
            amount = money(payload["amount"])
        except LedgerValidationError:
            amount = Decimal("0")
        if amount >= Decimal("1000"):
            merged.append("large-expense")
    return {
        "category": category,
        "tags": normalize_tags(merged),
        "confidence": confidence,
        "reason": f"Matched household ledger keywords for {category}.",
        "llm_context": {
            "task": "classify_household_transaction",
            "allowed_categories": CATEGORIES,
            "required_output_schema": {
                "category": "string",
                "tags": ["string"],
                "confidence": "number between 0 and 1",
                "reason": "short string",
            },
        },
    }


@dataclass
class LedgerEntry:
    posted_on: str
    household_member: str
    account: str
    direction: str
    amount: Decimal
    currency: str = "HKD"
    merchant: str = ""
    category: str = "Uncategorized"
    tags: list[str] = field(default_factory=list)
    source_text: str = ""
    note: str = ""
    confidence: float = 0
    created_by_agent: bool = False
    name: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        data = self.__dict__.copy()
        data["amount"] = float(self.amount)
        return data


def normalize_entry(payload: dict[str, Any]) -> LedgerEntry:
    required = ["household_member", "account", "amount"]
    missing = [key for key in required if not payload.get(key)]
    if missing:
        raise LedgerValidationError(f"missing required fields: {', '.join(missing)}")

    direction = str(payload.get("direction") or "Expense").title()
    if direction not in {"Expense", "Income", "Transfer"}:
        raise LedgerValidationError("direction must be Expense, Income, or Transfer")

    suggested = suggest_tags(payload)
    category = str(payload.get("category") or suggested["category"])
    if category not in CATEGORIES:
        category = "Uncategorized"

    return LedgerEntry(
        posted_on=str(payload.get("posted_on") or date.today().isoformat()),
        household_member=str(payload["household_member"]).strip(),
        account=str(payload["account"]).strip(),
        direction=direction,
        amount=money(payload["amount"]),
        currency=str(payload.get("currency") or "HKD").upper(),
        merchant=str(payload.get("merchant") or "").strip(),
        category=category,
        tags=normalize_tags(payload.get("tags") or suggested["tags"]),
        source_text=str(payload.get("source_text") or "").strip(),
        note=str(payload.get("note") or "").strip(),
        confidence=float(payload.get("confidence") or suggested["confidence"]),
        created_by_agent=bool(payload.get("created_by_agent")),
        name=payload.get("name"),
    )


def summarize(entries: Iterable[dict[str, Any]], budgets: Iterable[dict[str, Any]] | None = None) -> dict[str, Any]:
    totals = {"income": Decimal("0"), "expense": Decimal("0"), "transfer": Decimal("0")}
    by_category: dict[str, Decimal] = {}
    by_member: dict[str, Decimal] = {}
    by_month: dict[str, Decimal] = {}

    normalized_entries = list(entries)
    for raw in normalized_entries:
        amount = Decimal(str(raw.get("amount", 0)))
        direction = str(raw.get("direction") or "Expense").lower()
        if direction not in totals:
            direction = "expense"
        totals[direction] += amount
        if direction == "expense":
            category = str(raw.get("category") or "Uncategorized")
            member = str(raw.get("household_member") or "Unknown")
            month = str(raw.get("posted_on") or "")[:7] or "undated"
            by_category[category] = by_category.get(category, Decimal("0")) + amount
            by_member[member] = by_member.get(member, Decimal("0")) + amount
            by_month[month] = by_month.get(month, Decimal("0")) + amount

    budget_alerts = []
    for budget in budgets or []:
        category = str(budget.get("category") or "")
        limit = Decimal(str(budget.get("limit_amount") or budget.get("limit") or 0))
        spent = by_category.get(category, Decimal("0"))
        if limit > 0:
            budget_alerts.append(
                {
                    "category": category,
                    "limit": float(limit),
                    "spent": float(spent),
                    "ratio": float((spent / limit).quantize(Decimal("0.01"))),
                    "status": "over" if spent > limit else "ok",
                }
            )

    return {
        "entry_count": len(normalized_entries),
        "income": float(totals["income"]),
        "expense": float(totals["expense"]),
        "transfer": float(totals["transfer"]),
        "net": float(totals["income"] - totals["expense"]),
        "by_category": {key: float(value) for key, value in sorted(by_category.items())},
        "by_member": {key: float(value) for key, value in sorted(by_member.items())},
        "by_month": {key: float(value) for key, value in sorted(by_month.items())},
        "budget_alerts": budget_alerts,
    }
