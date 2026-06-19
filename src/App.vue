<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Button, FormControl, TabButtons } from 'frappe-ui'
import { agentExecute, createEntry, getSummary, listEntries, suggestTags } from './api'
import type { Direction, EntryFilters, LedgerEntry, LedgerSummary, TagSuggestion } from './types'

const activeTab = ref('record')
const entries = ref<LedgerEntry[]>([])
const summary = ref<LedgerSummary | null>(null)
const suggestion = ref<TagSuggestion | null>(null)
const apiResult = ref('')
const status = ref('')
const loading = ref(false)

const draft = reactive({
  posted_on: '2026-06-20',
  household_member: 'Victor',
  account: 'HSBC Visa',
  direction: 'Expense' as Direction,
  amount: 0,
  currency: 'HKD',
  merchant: '',
  category: 'Uncategorized',
  tags: '',
  source_text: '',
  note: '',
})

const filters = reactive<EntryFilters>({
  q: '',
  household_member: '',
  category: '',
  direction: '',
})

const tabs = [
  { label: 'Record', value: 'record', iconLeft: 'lucide-plus' },
  { label: 'Ledger', value: 'ledger', iconLeft: 'lucide-list-filter' },
  { label: 'Analytics', value: 'analytics', iconLeft: 'lucide-chart-no-axes-combined' },
  { label: 'LLM API', value: 'api', iconLeft: 'lucide-bot' },
]

const directionOptions = [
  { label: 'Expense', value: 'Expense' },
  { label: 'Income', value: 'Income' },
  { label: 'Transfer', value: 'Transfer' },
]

const categoryOptions = [
  'Groceries',
  'Dining',
  'Housing',
  'Utilities',
  'Transport',
  'Education',
  'Healthcare',
  'Travel',
  'Gifts',
  'Subscriptions',
  'Income',
  'Savings',
  'Uncategorized',
].map((category) => ({ label: category, value: category }))

const memberOptions = computed(() => {
  const members = new Set(['Victor', 'Partner', ...entries.value.map((entry) => entry.household_member)])
  return [{ label: 'All members', value: '' }, ...[...members].map((member) => ({ label: member, value: member }))]
})

const filterCategoryOptions = computed(() => [
  { label: 'All categories', value: '' },
  ...categoryOptions,
])

const filterDirectionOptions = [
  { label: 'All directions', value: '' },
  ...directionOptions,
]

const categoryBreakdown = computed(() =>
  Object.entries(summary.value?.by_category || {}).sort((a, b) => b[1] - a[1]),
)

const memberBreakdown = computed(() =>
  Object.entries(summary.value?.by_member || {}).sort((a, b) => b[1] - a[1]),
)

const monthBreakdown = computed(() =>
  Object.entries(summary.value?.by_month || {}).sort((a, b) => a[0].localeCompare(b[0])),
)

const maxCategorySpend = computed(() => Math.max(1, ...categoryBreakdown.value.map(([, value]) => value)))
const maxMonthSpend = computed(() => Math.max(1, ...monthBreakdown.value.map(([, value]) => value)))

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as EntryFilters
    const [nextEntries, nextSummary] = await Promise.all([
      listEntries(cleanFilters),
      getSummary(cleanFilters),
    ])
    entries.value = nextEntries
    summary.value = nextSummary
  } finally {
    loading.value = false
  }
}

async function runSuggest() {
  suggestion.value = await suggestTags({ ...draft, amount: Number(draft.amount), tags: splitTags(draft.tags) })
  draft.category = suggestion.value.category
  draft.tags = suggestion.value.tags.join(', ')
  status.value = `Suggested ${suggestion.value.category} with ${Math.round(suggestion.value.confidence * 100)}% confidence.`
}

async function saveEntry() {
  loading.value = true
  try {
    const created = await createEntry({
      ...draft,
      amount: Number(draft.amount),
      tags: splitTags(draft.tags),
    })
    status.value = `Saved ${created.merchant || created.category} for ${formatMoney(created.amount)}.`
    resetDraft()
    await loadData()
    activeTab.value = 'ledger'
  } finally {
    loading.value = false
  }
}

async function callAgentSummary() {
  const result = await agentExecute<LedgerSummary>('get_summary', { filters })
  apiResult.value = JSON.stringify(result, null, 2)
}

async function callAgentCreateDemo() {
  const result = await agentExecute<LedgerEntry>('create_entry', {
    posted_on: '2026-06-20',
    household_member: 'Partner',
    account: 'Agent Inbox',
    direction: 'Expense',
    amount: 88,
    currency: 'HKD',
    merchant: 'Coffee shop',
    source_text: 'Coffee shop family breakfast',
    note: 'Created through agent_execute',
    created_by_agent: true,
  })
  apiResult.value = JSON.stringify(result, null, 2)
  await loadData()
}

function resetDraft() {
  draft.amount = 0
  draft.merchant = ''
  draft.source_text = ''
  draft.note = ''
  draft.category = 'Uncategorized'
  draft.tags = ''
  suggestion.value = null
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function formatMoney(value: number, currency = 'HKD') {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function barStyle(value: number, max: number) {
  return { width: `${Math.max(4, Math.round((value / max) * 100))}%` }
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Frappe Family Accounting</p>
        <h1>Family Ledger</h1>
      </div>
      <TabButtons v-model="activeTab" :buttons="tabs" aria-label="Main sections" />
    </header>

    <section class="summary-strip" aria-label="Household summary">
      <div class="metric">
        <span>Monthly spend</span>
        <strong data-testid="monthly-spend">{{ formatMoney(summary?.expense || 0) }}</strong>
      </div>
      <div class="metric">
        <span>Income</span>
        <strong>{{ formatMoney(summary?.income || 0) }}</strong>
      </div>
      <div class="metric">
        <span>Net</span>
        <strong :class="{ positive: (summary?.net || 0) >= 0, negative: (summary?.net || 0) < 0 }">
          {{ formatMoney(summary?.net || 0) }}
        </strong>
      </div>
      <div class="metric">
        <span>Entries</span>
        <strong>{{ summary?.entry_count || 0 }}</strong>
      </div>
    </section>

    <section v-if="activeTab === 'record'" class="work-grid record-grid">
      <form class="panel form-panel" aria-label="Record a ledger entry" @submit.prevent="saveEntry">
        <div class="panel-title">
          <h2>Quick Record</h2>
          <p aria-live="polite">{{ status }}</p>
        </div>
        <FormControl v-model="draft.source_text" type="textarea" label="Receipt or chat text" placeholder="Paste a receipt line or family chat message" />
        <div class="two-col">
          <FormControl v-model="draft.posted_on" type="date" label="Date" required />
          <FormControl v-model="draft.direction" type="select" label="Type" :options="directionOptions" required />
        </div>
        <div class="two-col">
          <FormControl v-model="draft.household_member" label="Member" required />
          <FormControl v-model="draft.account" label="Account" required />
        </div>
        <div class="two-col">
          <FormControl v-model="draft.amount" type="number" label="Amount" required min="0" step="0.01" />
          <FormControl v-model="draft.currency" label="Currency" required />
        </div>
        <div class="two-col">
          <FormControl v-model="draft.merchant" label="Merchant" placeholder="Wellcome, MTR, school..." />
          <FormControl v-model="draft.category" type="select" label="Category" :options="categoryOptions" />
        </div>
        <FormControl v-model="draft.tags" label="Tags" placeholder="comma-separated tags" />
        <FormControl v-model="draft.note" type="textarea" label="Family note" />
        <div class="button-row">
          <Button type="button" icon-left="lucide-sparkles" variant="outline" size="md" @click="runSuggest">
            Smart tag
          </Button>
          <Button type="submit" icon-left="lucide-save" theme="blue" variant="solid" size="md" :loading="loading">
            Save entry
          </Button>
        </div>
      </form>

      <aside class="panel insight-panel" aria-label="Smart tag result">
        <div class="panel-title">
          <h2>Tag Result</h2>
          <p>{{ suggestion ? suggestion.reason : 'Ready for local rules or any LLM agent output.' }}</p>
        </div>
        <div class="suggestion-box">
          <span>Category</span>
          <strong>{{ suggestion?.category || draft.category }}</strong>
        </div>
        <div class="suggestion-box">
          <span>Confidence</span>
          <strong>{{ suggestion ? `${Math.round(suggestion.confidence * 100)}%` : 'Pending' }}</strong>
        </div>
        <div class="tag-row" aria-label="Suggested tags">
          <span v-for="tag in splitTags(draft.tags)" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <div class="mini-ledger">
          <h3>Latest entries</h3>
          <article v-for="entry in entries.slice(0, 4)" :key="entry.name" class="entry-row compact">
            <div>
              <strong>{{ entry.merchant || entry.category }}</strong>
              <span>{{ entry.household_member }} · {{ entry.category }}</span>
            </div>
            <b>{{ formatMoney(entry.amount, entry.currency) }}</b>
          </article>
        </div>
      </aside>
    </section>

    <section v-else-if="activeTab === 'ledger'" class="panel ledger-panel">
      <div class="panel-title">
        <h2>Ledger</h2>
        <Button icon-left="lucide-refresh-cw" variant="outline" @click="loadData">Refresh</Button>
      </div>
      <div class="filters">
        <FormControl v-model="filters.q" label="Search" placeholder="merchant, tag, note" @change="loadData" />
        <FormControl v-model="filters.household_member" type="select" label="Member" :options="memberOptions" @update:model-value="loadData" />
        <FormControl v-model="filters.category" type="select" label="Category" :options="filterCategoryOptions" @update:model-value="loadData" />
        <FormControl v-model="filters.direction" type="select" label="Type" :options="filterDirectionOptions" @update:model-value="loadData" />
      </div>
      <div class="entry-list" data-testid="ledger-list">
        <article v-for="entry in entries" :key="entry.name" class="entry-row">
          <div class="entry-main">
            <strong>{{ entry.merchant || entry.category }}</strong>
            <span>{{ entry.posted_on }} · {{ entry.household_member }} · {{ entry.account }}</span>
            <span v-if="entry.note" class="entry-note">{{ entry.note }}</span>
            <div class="tag-row">
              <span class="tag">{{ entry.category }}</span>
              <span v-for="tag in entry.tags" :key="`${entry.name}-${tag}`" class="tag muted">{{ tag }}</span>
            </div>
          </div>
          <div class="entry-amount" :class="entry.direction.toLowerCase()">
            {{ entry.direction === 'Income' ? '+' : '-' }}{{ formatMoney(entry.amount, entry.currency) }}
          </div>
        </article>
      </div>
    </section>

    <section v-else-if="activeTab === 'analytics'" class="work-grid analytics-grid">
      <div class="panel">
        <div class="panel-title">
          <h2>Category Spend</h2>
          <p>{{ categoryBreakdown.length }} active categories</p>
        </div>
        <div class="bar-list" aria-label="Spending by category">
          <div v-for="[category, value] in categoryBreakdown" :key="category" class="bar-row">
            <div>
              <strong>{{ category }}</strong>
              <span>{{ formatMoney(value) }}</span>
            </div>
            <div class="bar-track"><span :style="barStyle(value, maxCategorySpend)" /></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">
          <h2>Member View</h2>
          <p>Expense split</p>
        </div>
        <div class="member-list">
          <div v-for="[member, value] in memberBreakdown" :key="member" class="member-row">
            <span>{{ member }}</span>
            <strong>{{ formatMoney(value) }}</strong>
          </div>
        </div>
        <div class="panel-title secondary">
          <h2>Monthly Trend</h2>
          <p>Expense only</p>
        </div>
        <div class="month-chart" aria-label="Monthly spending trend">
          <div v-for="[month, value] in monthBreakdown" :key="month" class="month-bar">
            <span :style="{ height: `${Math.max(12, Math.round((value / maxMonthSpend) * 132))}px` }" />
            <b>{{ month }}</b>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="work-grid api-grid">
      <div class="panel">
        <div class="panel-title">
          <h2>Agent Surface</h2>
          <p>Single RPC and method-specific endpoints share the same contract.</p>
        </div>
        <div class="endpoint-list">
          <code>/api/method/family_accounting.api.create_entry</code>
          <code>/api/method/family_accounting.api.list_entries</code>
          <code>/api/method/family_accounting.api.get_summary</code>
          <code>/api/method/family_accounting.api.suggest_tags</code>
          <code>/api/method/family_accounting.api.agent_execute</code>
        </div>
        <div class="button-row">
          <Button icon-left="lucide-chart-pie" theme="blue" variant="solid" @click="callAgentSummary">
            Call summary
          </Button>
          <Button icon-left="lucide-send" variant="outline" @click="callAgentCreateDemo">
            Agent create demo
          </Button>
        </div>
      </div>
      <div class="panel result-panel">
        <div class="panel-title">
          <h2>API Result</h2>
          <p>Frappe-style JSON response payload</p>
        </div>
        <pre data-testid="api-result">{{ apiResult || 'No API call yet.' }}</pre>
      </div>
    </section>
  </main>
</template>
