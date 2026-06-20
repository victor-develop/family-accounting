# UX Flow

## Record

The record view starts with a minimal expense mode: enter amount, enter description, save. The full form accepts structured fields or a messy receipt/chat line. Users can run smart tagging, inspect category confidence, edit the result, and save.

## Ledger

The ledger view supports searching by text, member, category, and direction. Each row shows date, member, account, category, tags, and signed amount. The toolbar supports JSON/CSV export and destructive clearing after browser confirmation.

## Analytics

Analytics shows household totals, category bars, member split, monthly trend, and budget alerts. Charts use accessible text labels and numeric values.

## LLM API

The LLM API view provides a working surface for the same calls an assistant would use in a family chat. It can fetch summary data or create a demo agent entry through `agent_execute`. The bundled skill requires user confirmation before any create operation.
