import unittest

from family_accounting.ledger_core import (
    LedgerValidationError,
    minimal_expense_payload,
    normalize_entry,
    suggest_tags,
    summarize,
)


class LedgerCoreTest(unittest.TestCase):
    def test_suggest_tags_returns_agent_agnostic_schema(self):
        suggestion = suggest_tags(
            {
                "merchant": "Wellcome",
                "source_text": "weekly supermarket groceries",
                "amount": 320,
                "household_member": "Victor",
            }
        )

        self.assertEqual(suggestion["category"], "Groceries")
        self.assertIn("allowed_categories", suggestion["llm_context"])
        self.assertIn("supermarket", suggestion["tags"])

    def test_normalize_entry_validates_and_fills_tags(self):
        entry = normalize_entry(
            {
                "posted_on": "2026-06-20",
                "household_member": "Partner",
                "account": "Cash",
                "amount": "128.456",
                "merchant": "MTR",
                "source_text": "MTR top up",
            }
        )

        self.assertEqual(str(entry.amount), "128.46")
        self.assertEqual(entry.category, "Transport")
        self.assertIn("mtr", entry.tags)

    def test_invalid_amount_raises(self):
        with self.assertRaises(LedgerValidationError):
            normalize_entry({"household_member": "Victor", "account": "Cash", "amount": 0})

    def test_minimal_expense_payload_uses_safe_defaults(self):
        payload = minimal_expense_payload({"amount": 33, "description": "MTR top up"})
        entry = normalize_entry(payload)

        self.assertEqual(entry.household_member, "Victor")
        self.assertEqual(entry.account, "Quick Capture")
        self.assertEqual(entry.direction, "Expense")
        self.assertEqual(entry.category, "Transport")
        self.assertEqual(entry.source_text, "MTR top up")

    def test_summarize_entries(self):
        summary = summarize(
            [
                {"direction": "Expense", "amount": 100, "category": "Dining", "household_member": "Victor", "posted_on": "2026-06-01"},
                {"direction": "Income", "amount": 500, "category": "Income", "household_member": "Victor", "posted_on": "2026-06-02"},
            ],
            [{"category": "Dining", "limit_amount": 80}],
        )

        self.assertEqual(summary["expense"], 100.0)
        self.assertEqual(summary["income"], 500.0)
        self.assertEqual(summary["net"], 400.0)
        self.assertEqual(summary["budget_alerts"][0]["status"], "over")


if __name__ == "__main__":
    unittest.main()
