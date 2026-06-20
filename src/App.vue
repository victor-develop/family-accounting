<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Button, FormControl, TabButtons } from 'frappe-ui'
import {
  agentExecute,
  clearEntries,
  createEntry,
  createMinimalExpense,
  exportEntries,
  getSummary,
  listEntries,
  suggestTags,
} from './api'
import type { Direction, EntryFilters, LedgerEntry, LedgerSummary, TagSuggestion } from './types'

type AppTab = 'record' | 'ledger' | 'analytics' | 'api'

const prefersCompactMobile = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(max-width: 860px)').matches

const activeTab = ref<AppTab>('record')
const entries = ref<LedgerEntry[]>([])
const summary = ref<LedgerSummary | null>(null)
const suggestion = ref<TagSuggestion | null>(null)
const apiResult = ref('')
const status = ref('')
const loading = ref(false)
const detailsOpen = ref(!prefersCompactMobile)
const filtersOpen = ref(false)
const actionsOpen = ref(false)
const confirmClearOpen = ref(false)
const today = new Date().toISOString().slice(0, 10)

const quickDraft = reactive({
  amount: 0,
  description: '',
})

const draft = reactive({
  posted_on: today,
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
  { label: 'Record', value: 'record' as AppTab, iconLeft: 'lucide-plus', iconClass: 'lucide-plus' },
  { label: 'Ledger', value: 'ledger' as AppTab, iconLeft: 'lucide-list-filter', iconClass: 'lucide-list-filter' },
  {
    label: 'Analytics',
    value: 'analytics' as AppTab,
    iconLeft: 'lucide-chart-no-axes-combined',
    iconClass: 'lucide-chart-no-axes-combined',
  },
  { label: 'LLM API', value: 'api' as AppTab, iconLeft: 'lucide-bot', iconClass: 'lucide-bot' },
]

const primaryTabs = tabs.filter((tab) => tab.value !== 'api')

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
const quickCanSave = computed(() => Number(quickDraft.amount) > 0 && quickDraft.description.trim().length > 0)
const hasActiveFilters = computed(() => Object.values(filters).some(Boolean))
const topCategory = computed(() => categoryBreakdown.value[0] || null)
const topMember = computed(() => memberBreakdown.value[0] || null)

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

async function saveMinimalExpense() {
  if (!quickCanSave.value) return
  loading.value = true
  try {
    const created = await createMinimalExpense({
      amount: Number(quickDraft.amount),
      description: quickDraft.description,
    })
    status.value = `Saved quick expense ${formatMoney(created.amount)} as ${created.category}.`
    quickDraft.amount = 0
    quickDraft.description = ''
    await loadData()
    activeTab.value = 'ledger'
    detailsOpen.value = false
  } finally {
    loading.value = false
  }
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
    detailsOpen.value = false
  } finally {
    loading.value = false
  }
}

async function downloadLedger(format: 'json' | 'csv') {
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as EntryFilters
  const exported = await exportEntries(cleanFilters, format)
  const content = exported.content || JSON.stringify(exported.entries || [], null, 2)
  const blob = new Blob([content], { type: exported.content_type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exported.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  status.value = `Exported ${exported.entry_count} entries as ${format.toUpperCase()}.`
  actionsOpen.value = false
}

function requestClearLedger() {
  confirmClearOpen.value = true
  actionsOpen.value = false
}

async function confirmClearLedger() {
  loading.value = true
  try {
    const result = await clearEntries()
    status.value = `Cleared ${result.deleted} entries.`
    confirmClearOpen.value = false
    await loadData()
  } finally {
    loading.value = false
  }
}

function clearAllFilters() {
  filters.q = ''
  filters.household_member = ''
  filters.category = ''
  filters.direction = ''
  void loadData()
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

function setTab(tab: AppTab) {
  activeTab.value = tab
  actionsOpen.value = false
  if (tab !== 'ledger') filtersOpen.value = false
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
      <div class="brand-block">
        <p class="eyebrow">Frappe Family Accounting</p>
        <h1>Family Ledger</h1>
        <p class="mobile-context">
          {{ formatMoney(summary?.expense || 0) }} this month · {{ summary?.entry_count || 0 }} entries
        </p>
      </div>
      <div class="desktop-tabs">
        <TabButtons v-model="activeTab" :buttons="tabs" aria-label="Main sections" />
      </div>
      <div class="mobile-dev-nav" role="radiogroup" aria-label="Developer section">
        <button
          type="button"
          role="radio"
          aria-label="LLM API"
          :aria-checked="activeTab === 'api'"
          :class="{ active: activeTab === 'api' }"
          @click="setTab('api')"
        >
          <span class="nav-icon lucide-bot" aria-hidden="true" />
          <span>LLM API</span>
        </button>
      </div>
    </header>

    <section class="summary-strip" aria-label="Household summary">
      <div class="metric">
        <span>Monthly spend</span>
        <strong data-testid="monthly-spend">{{ formatMoney(summary?.expense || 0) }}</strong>
      </div>
      <div class="metric metric-secondary">
        <span>Income</span>
        <strong>{{ formatMoney(summary?.income || 0) }}</strong>
      </div>
      <div class="metric">
        <span>Net</span>
        <strong :class="{ positive: (summary?.net || 0) >= 0, negative: (summary?.net || 0) < 0 }">
          {{ formatMoney(summary?.net || 0) }}
        </strong>
      </div>
      <div class="metric metric-secondary">
        <span>Entries</span>
        <strong>{{ summary?.entry_count || 0 }}</strong>
      </div>
    </section>

    <section v-if="activeTab === 'record'" class="work-grid record-grid">
      <div class="record-stack">
        <section class="panel minimal-panel" aria-label="Minimal expense record">
          <div class="panel-title">
            <h2>Quick Add</h2>
            <p aria-live="polite">{{ status }}</p>
          </div>
          <div class="minimal-row">
            <FormControl
              v-model="quickDraft.amount"
              type="number"
              label="Expense amount"
              required
              min="0"
              step="0.01"
              inputmode="decimal"
            />
            <FormControl v-model="quickDraft.description" label="Description" required placeholder="Lunch, taxi, groceries..." />
            <Button
              type="button"
              icon-left="lucide-save"
              theme="blue"
              variant="solid"
              size="md"
              :disabled="!quickCanSave"
              :loading="loading"
              @click="saveMinimalExpense"
            >
              Save
            </Button>
          </div>
        </section>

        <button
          type="button"
          class="details-toggle"
          :aria-expanded="detailsOpen"
          aria-controls="full-record-form"
          @click="detailsOpen = !detailsOpen"
        >
          <span class="nav-icon lucide-sliders-horizontal" aria-hidden="true" />
          <span>{{ detailsOpen ? 'Hide details' : 'Add details' }}</span>
          <span class="toggle-chevon lucide-chevron-down" aria-hidden="true" />
        </button>

        <form
          v-show="detailsOpen"
          id="full-record-form"
          class="panel form-panel"
          aria-label="Record a ledger entry"
          @submit.prevent="saveEntry"
        >
          <div class="panel-title">
            <h2>Full Record</h2>
            <p>Structured fields</p>
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
            <FormControl v-model="draft.amount" type="number" label="Amount" required min="0" step="0.01" inputmode="decimal" />
            <FormControl v-model="draft.currency" label="Currency" required />
          </div>
          <div class="two-col">
            <FormControl v-model="draft.merchant" label="Merchant" placeholder="Wellcome, MTR, school..." />
            <FormControl v-model="draft.category" type="select" label="Category" :options="categoryOptions" />
          </div>
          <FormControl v-model="draft.tags" label="Tags" placeholder="comma-separated tags" />
          <FormControl v-model="draft.note" type="textarea" label="Family note" />
          <div v-if="suggestion" class="inline-suggestion" aria-live="polite">
            <div>
              <span>Category</span>
              <strong>{{ suggestion.category }}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{{ Math.round(suggestion.confidence * 100) }}%</strong>
            </div>
            <p>{{ suggestion.reason }}</p>
          </div>
          <div class="button-row">
            <Button type="button" icon-left="lucide-sparkles" variant="outline" size="md" @click="runSuggest">
              Smart tag
            </Button>
            <Button type="submit" icon-left="lucide-save" theme="blue" variant="solid" size="md" :loading="loading">
              Save entry
            </Button>
          </div>
        </form>
      </div>

      <aside v-if="suggestion || entries.length" class="panel insight-panel" :aria-label="suggestion ? 'Smart tag result' : 'Latest entries'">
        <div class="panel-title">
          <h2>{{ suggestion ? 'Tag Result' : 'Latest entries' }}</h2>
          <p>{{ suggestion ? suggestion.reason : 'Recent family activity' }}</p>
        </div>
        <div v-if="suggestion" class="suggestion-box">
          <span>Category</span>
          <strong>{{ suggestion?.category || draft.category }}</strong>
        </div>
        <div v-if="suggestion" class="suggestion-box">
          <span>Confidence</span>
          <strong>{{ suggestion ? `${Math.round(suggestion.confidence * 100)}%` : 'Pending' }}</strong>
        </div>
        <div v-if="splitTags(draft.tags).length" class="tag-row" aria-label="Suggested tags">
          <span v-for="tag in splitTags(draft.tags)" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <div v-if="entries.length" class="mini-ledger">
          <h3 v-if="suggestion">Latest entries</h3>
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
        <div>
          <h2>Ledger</h2>
          <p aria-live="polite">{{ status }}</p>
        </div>
        <div class="button-row ledger-actions desktop-actions">
          <Button icon-left="lucide-download" variant="outline" @click="downloadLedger('json')">JSON</Button>
          <Button icon-left="lucide-file-down" variant="outline" @click="downloadLedger('csv')">CSV</Button>
          <Button icon-left="lucide-trash-2" variant="outline" theme="red" :loading="loading" @click="requestClearLedger">Clear</Button>
          <Button icon-left="lucide-refresh-cw" variant="outline" @click="loadData">Refresh</Button>
        </div>
        <button
          type="button"
          class="mobile-action-trigger"
          :aria-expanded="actionsOpen"
          aria-controls="ledger-actions-menu"
          @click="actionsOpen = !actionsOpen"
        >
          <span class="nav-icon lucide-ellipsis" aria-hidden="true" />
          <span>Actions</span>
        </button>
      </div>
      <div v-if="actionsOpen" id="ledger-actions-menu" class="mobile-actions-menu">
        <Button icon-left="lucide-download" variant="outline" @click="downloadLedger('json')">JSON</Button>
        <Button icon-left="lucide-file-down" variant="outline" @click="downloadLedger('csv')">CSV</Button>
        <Button icon-left="lucide-refresh-cw" variant="outline" @click="loadData">Refresh</Button>
        <Button icon-left="lucide-trash-2" variant="outline" theme="red" :loading="loading" @click="requestClearLedger">Clear</Button>
      </div>
      <div class="ledger-search">
        <FormControl v-model="filters.q" label="Search" placeholder="merchant, tag, note" @change="loadData" />
        <button
          type="button"
          class="filter-toggle"
          :aria-expanded="filtersOpen"
          aria-controls="ledger-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <span class="nav-icon lucide-list-filter" aria-hidden="true" />
          <span>Filters</span>
        </button>
      </div>
      <div v-if="hasActiveFilters" class="active-filters" aria-label="Active filters">
        <span v-if="filters.q" class="filter-chip">Search: {{ filters.q }}</span>
        <span v-if="filters.household_member" class="filter-chip">Member: {{ filters.household_member }}</span>
        <span v-if="filters.category" class="filter-chip">Category: {{ filters.category }}</span>
        <span v-if="filters.direction" class="filter-chip">Type: {{ filters.direction }}</span>
        <button type="button" class="clear-filters" @click="clearAllFilters">Clear filters</button>
      </div>
      <div v-show="filtersOpen" id="ledger-filters" class="filters">
        <FormControl v-model="filters.household_member" type="select" label="Member" :options="memberOptions" @update:model-value="loadData" />
        <FormControl v-model="filters.category" type="select" label="Category" :options="filterCategoryOptions" @update:model-value="loadData" />
        <FormControl v-model="filters.direction" type="select" label="Type" :options="filterDirectionOptions" @update:model-value="loadData" />
      </div>
      <div v-if="!entries.length" class="empty-state" data-testid="ledger-empty">
        <h3>{{ hasActiveFilters ? 'No matching entries' : 'No entries yet' }}</h3>
        <p>{{ hasActiveFilters ? 'Adjust the filters to widen the view.' : 'Quick Add is ready when the next family spend happens.' }}</p>
        <Button v-if="hasActiveFilters" icon-left="lucide-x" variant="outline" @click="clearAllFilters">Clear filters</Button>
        <Button v-else icon-left="lucide-plus" theme="blue" variant="solid" @click="setTab('record')">Record expense</Button>
      </div>
      <div v-else class="entry-list" data-testid="ledger-list">
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
        <div class="analytics-insight" aria-label="Spending insight summary">
          <span>Total spend</span>
          <strong>{{ formatMoney(summary?.expense || 0) }}</strong>
          <p>
            {{ topCategory ? `${topCategory[0]} leads at ${formatMoney(topCategory[1])}` : 'No spending yet.' }}
            {{ topMember ? `${topMember[0]} has ${formatMoney(topMember[1])} recorded.` : '' }}
          </p>
        </div>
        <div class="panel-title">
          <h2>Category Spend</h2>
          <p>{{ categoryBreakdown.length }} active categories</p>
        </div>
        <div v-if="categoryBreakdown.length" class="bar-list" aria-label="Spending by category">
          <div v-for="[category, value] in categoryBreakdown" :key="category" class="bar-row">
            <div>
              <strong>{{ category }}</strong>
              <span>{{ formatMoney(value) }}</span>
            </div>
            <div class="bar-track"><span :style="barStyle(value, maxCategorySpend)" /></div>
          </div>
        </div>
        <div v-else class="empty-state compact">
          <h3>No spending yet</h3>
          <p>Analytics will fill in after the first saved expense.</p>
          <Button icon-left="lucide-plus" theme="blue" variant="solid" @click="setTab('record')">Record expense</Button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">
          <h2>Member View</h2>
          <p>Expense split</p>
        </div>
        <div v-if="memberBreakdown.length" class="member-list">
          <div v-for="[member, value] in memberBreakdown" :key="member" class="member-row">
            <span>{{ member }}</span>
            <strong>{{ formatMoney(value) }}</strong>
          </div>
        </div>
        <div v-else class="empty-state compact">
          <h3>No member split</h3>
          <p>Saved expenses will show the household split here.</p>
        </div>
        <div class="panel-title secondary">
          <h2>Monthly Trend</h2>
          <p>Expense only</p>
        </div>
        <div v-if="monthBreakdown.length" class="month-chart" aria-label="Monthly spending trend">
          <div v-for="[month, value] in monthBreakdown" :key="month" class="month-bar">
            <span :style="{ height: `${Math.max(12, Math.round((value / maxMonthSpend) * 132))}px` }" />
            <b>{{ month }}</b>
          </div>
        </div>
        <div v-else class="empty-state compact">
          <h3>No monthly trend</h3>
          <p>The trend appears once expenses span the ledger timeline.</p>
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
          <code>/api/method/family_accounting.api.create_minimal_expense</code>
          <code>/api/method/family_accounting.api.list_entries</code>
          <code>/api/method/family_accounting.api.get_summary</code>
          <code>/api/method/family_accounting.api.suggest_tags</code>
          <code>/api/method/family_accounting.api.export_entries</code>
          <code>/api/method/family_accounting.api.clear_entries</code>
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

    <nav class="mobile-tabbar" role="radiogroup" aria-label="Main sections">
      <button
        v-for="tab in primaryTabs"
        :key="tab.value"
        type="button"
        role="radio"
        :aria-checked="activeTab === tab.value"
        :class="{ active: activeTab === tab.value }"
        @click="setTab(tab.value)"
      >
        <span :class="['nav-icon', tab.iconClass]" aria-hidden="true" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div v-if="confirmClearOpen" class="modal-backdrop">
      <section
        class="confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-ledger-title"
        aria-describedby="clear-ledger-copy"
      >
        <h2 id="clear-ledger-title">Clear family ledger?</h2>
        <p id="clear-ledger-copy">This removes every saved entry from the current household ledger.</p>
        <div class="button-row">
          <Button variant="outline" @click="confirmClearOpen = false">Cancel</Button>
          <Button theme="red" variant="solid" icon-left="lucide-trash-2" :loading="loading" @click="confirmClearLedger">
            Clear ledger
          </Button>
        </div>
      </section>
    </div>
  </main>
</template>
