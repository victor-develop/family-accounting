# Family Ledger

Family Ledger is a small household accounting system built as a Frappe Framework app with a Frappe UI front end. It supports recording expenses and income, searching ledger history, spending analytics, provider-neutral tag suggestions, and LLM-friendly APIs for family chat assistants.

## What Is Included

- Frappe app metadata, hooks, whitelisted methods, and DocTypes.
- Frappe UI + Vue 3 + Tailwind front end for record, ledger, analytics, and agent API flows.
- Provider-neutral smart tagging contract. The app ships deterministic baseline rules and exposes an LLM schema that any agent can use.
- Minimal expense capture that only needs an amount and a description.
- JSON/CSV export and explicit-confirmation ledger clearing.
- Local Vite/Express dev harness that mirrors Frappe `/api/method/...` routes for fast browser and API tests.
- Codex-style skill package in `llm/skills/family-accounting-assistant`.

## Product Flows

1. Record an entry from a receipt line or family chat message.
2. Use minimal mode for quick expenses with just amount and description.
3. Run smart tagging to fill category, tags, confidence, and LLM context.
4. Save the entry to the household ledger.
5. Search by merchant, note, category, member, direction, or tag.
6. Review monthly totals, category spend, member split, trends, and budget alerts.
7. Export JSON/CSV or clear the ledger after explicit confirmation.
8. Let an LLM assistant call method-specific APIs or the single `agent_execute` RPC.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

The local server exposes the same API shape as the Frappe app:

```text
/api/method/family_accounting.api.create_entry
/api/method/family_accounting.api.create_minimal_expense
/api/method/family_accounting.api.list_entries
/api/method/family_accounting.api.get_summary
/api/method/family_accounting.api.suggest_tags
/api/method/family_accounting.api.export_entries
/api/method/family_accounting.api.clear_entries
/api/method/family_accounting.api.agent_execute
```

## Tests

```bash
npm run test:unit
npm run test:api
npm run test:python
npm run test:e2e
npm test
```

The browser tests use Playwright and start the local dev harness automatically.

## Install In Frappe

From a bench:

```bash
bench get-app family_accounting https://github.com/victor-develop/family-accounting
bench --site your-site install-app family_accounting
bench --site your-site migrate
npm run build:frappe
bench build --app family_accounting
```

During active front-end work, run the local Vite harness. For Frappe serving, `npm run build:frappe` writes Vite assets to `family_accounting/public/frontend`; `/family-ledger` reads the generated manifest.

Frappe stores ledger data in the site database as DocType tables, including `tabFamily Accounting Entry` and `tabFamily Accounting Budget`. On the local bench used for development, that means MariaDB for the selected site.

## LLM Assistant Skill

The portable skill lives at:

```text
llm/skills/family-accounting-assistant
```

Use it when a family chat assistant needs to record spending, summarize budgets, search transactions, or classify receipts. Its reference file documents exact endpoint names and payload shapes.

The skill requires a user confirmation before any `create_entry`, `create_minimal_expense`, or equivalent `agent_execute` create operation. It is model/provider agnostic; agents can use Z.ai/GLM, OpenAI-compatible, Anthropic-compatible, or other LLM hosts to fill the same API contract.
