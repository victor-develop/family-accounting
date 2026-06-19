# Family Ledger

Family Ledger is a small household accounting system built as a Frappe Framework app with a Frappe UI front end. It supports recording expenses and income, searching ledger history, spending analytics, provider-neutral tag suggestions, and LLM-friendly APIs for family chat assistants.

## What Is Included

- Frappe app metadata, hooks, whitelisted methods, and DocTypes.
- Frappe UI + Vue 3 + Tailwind front end for record, ledger, analytics, and agent API flows.
- Provider-neutral smart tagging contract. The app ships deterministic baseline rules and exposes an LLM schema that any agent can use.
- Local Vite/Express dev harness that mirrors Frappe `/api/method/...` routes for fast browser and API tests.
- Codex-style skill package in `llm/skills/family-accounting-assistant`.

## Product Flows

1. Record an entry from a receipt line or family chat message.
2. Run smart tagging to fill category, tags, confidence, and LLM context.
3. Save the entry to the household ledger.
4. Search by merchant, note, category, member, direction, or tag.
5. Review monthly totals, category spend, member split, trends, and budget alerts.
6. Let an LLM assistant call method-specific APIs or the single `agent_execute` RPC.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

The local server exposes the same API shape as the Frappe app:

```text
/api/method/family_accounting.api.create_entry
/api/method/family_accounting.api.list_entries
/api/method/family_accounting.api.get_summary
/api/method/family_accounting.api.suggest_tags
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
```

During active front-end work, run the local Vite harness. For production Frappe serving, wire the Vite build output into Frappe assets as the next deployment step.

## LLM Assistant Skill

The portable skill lives at:

```text
llm/skills/family-accounting-assistant
```

Use it when a family chat assistant needs to record spending, summarize budgets, search transactions, or classify receipts. Its reference file documents exact endpoint names and payload shapes.
