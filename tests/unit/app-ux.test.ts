// @vitest-environment happy-dom

import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerEntry, LedgerSummary, TagSuggestion } from '../../src/types'

vi.setConfig({ testTimeout: 10000 })

const api = vi.hoisted(() => ({
  agentExecute: vi.fn(),
  clearEntries: vi.fn(),
  createEntry: vi.fn(),
  createMinimalExpense: vi.fn(),
  exportEntries: vi.fn(),
  getSummary: vi.fn(),
  listEntries: vi.fn(),
  suggestTags: vi.fn(),
}))

vi.mock('../../src/api', () => api)

vi.mock('frappe-ui', () => ({
  Button: {
    name: 'Button',
    props: {
      disabled: Boolean,
      loading: Boolean,
      type: String,
    },
    emits: ['click'],
    template: `
      <button
        :type="type || 'button'"
        :disabled="disabled || loading"
        @click="$emit('click', $event)"
      >
        <slot />
      </button>
    `,
  },
  FormControl: {
    name: 'FormControl',
    props: {
      label: { type: String, required: true },
      modelValue: { type: [String, Number], default: '' },
      options: { type: Array, default: () => [] },
      placeholder: String,
      type: String,
    },
    emits: ['update:modelValue', 'change'],
    methods: {
      update(this: { $emit: (event: string, ...args: unknown[]) => void }, event: Event) {
        this.$emit('update:modelValue', (event.target as HTMLInputElement).value)
      },
    },
    template: `
      <label>
        <span>{{ label }}</span>
        <select
          v-if="type === 'select'"
          :aria-label="label"
          :value="modelValue"
          @change="update($event); $emit('change', $event)"
        >
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <textarea
          v-else-if="type === 'textarea'"
          :aria-label="label"
          :value="modelValue"
          :placeholder="placeholder"
          @input="update"
          @change="$emit('change', $event)"
        />
        <input
          v-else
          :aria-label="label"
          :type="type || 'text'"
          :value="modelValue"
          :placeholder="placeholder"
          @input="update"
          @change="$emit('change', $event)"
        />
      </label>
    `,
  },
  TabButtons: {
    name: 'TabButtons',
    props: {
      buttons: { type: Array, required: true },
      modelValue: String,
    },
    emits: ['update:modelValue'],
    template: `
      <div role="radiogroup">
        <button
          v-for="button in buttons"
          :key="button.value"
          type="button"
          role="radio"
          :aria-checked="modelValue === button.value"
          @click="$emit('update:modelValue', button.value)"
        >
          {{ button.label }}
        </button>
      </div>
    `,
  },
}))

const emptySummary: LedgerSummary = {
  entry_count: 0,
  income: 0,
  expense: 0,
  transfer: 0,
  net: 0,
  by_category: {},
  by_member: {},
  by_month: {},
  budget_alerts: [],
}

const transportEntry: LedgerEntry = {
  name: 'FAC-ENTRY-2026-0123',
  posted_on: '2026-06-20',
  household_member: 'Victor',
  account: 'Quick Capture',
  direction: 'Expense',
  amount: 42.5,
  currency: 'HKD',
  merchant: '',
  category: 'Transport',
  tags: ['mtr', 'commute'],
  source_text: 'MTR commute top up',
  note: 'MTR commute top up',
  confidence: 0.86,
  created_by_agent: false,
}

const summaryWithTransport: LedgerSummary = {
  ...emptySummary,
  entry_count: 1,
  expense: 42.5,
  net: -42.5,
  by_category: { Transport: 42.5 },
  by_member: { Victor: 42.5 },
  by_month: { '2026-06': 42.5 },
}

function setMobileMatchMedia(matches = true) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

async function mountApp() {
  const { default: App } = await import('../../src/App.vue')
  const wrapper = mount(App, {
    global: {
      stubs: {
        Button: buttonStub(),
        FormControl: formControlStub(),
        TabButtons: tabButtonsStub(),
      },
    },
  })
  await flushPromises()
  return wrapper
}

function buttonStub() {
  return defineComponent({
    name: 'Button',
    props: {
      disabled: Boolean,
      loading: Boolean,
      type: String,
    },
    emits: ['click'],
    template: `
      <button
        :type="type || 'button'"
        :disabled="disabled || loading"
        @click="$emit('click', $event)"
      >
        <slot />
      </button>
    `,
  })
}

function formControlStub() {
  return defineComponent({
    name: 'FormControl',
    props: {
      label: { type: String, required: true },
      modelValue: { type: [String, Number], default: '' },
      options: { type: Array, default: () => [] },
      placeholder: String,
      type: String,
    },
    emits: ['update:modelValue', 'change'],
    methods: {
      update(this: { $emit: (event: string, ...args: unknown[]) => void }, event: Event) {
        this.$emit('update:modelValue', (event.target as HTMLInputElement).value)
      },
    },
    template: `
      <label>
        <span>{{ label }}</span>
        <select
          v-if="type === 'select'"
          :aria-label="label"
          :value="modelValue"
          @change="update($event); $emit('change', $event)"
        >
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <textarea
          v-else-if="type === 'textarea'"
          :aria-label="label"
          :value="modelValue"
          :placeholder="placeholder"
          @input="update"
          @change="$emit('change', $event)"
        />
        <input
          v-else
          :aria-label="label"
          :type="type || 'text'"
          :value="modelValue"
          :placeholder="placeholder"
          @input="update"
          @change="$emit('change', $event)"
        />
      </label>
    `,
  })
}

function tabButtonsStub() {
  return defineComponent({
    name: 'TabButtons',
    props: {
      buttons: { type: Array, required: true },
      modelValue: String,
    },
    emits: ['update:modelValue'],
    template: `
      <div role="radiogroup">
        <button
          v-for="button in buttons"
          :key="button.value"
          type="button"
          role="radio"
          :aria-checked="modelValue === button.value"
          @click="$emit('update:modelValue', button.value)"
        >
          {{ button.label }}
        </button>
      </div>
    `,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setMobileMatchMedia(true)
  api.listEntries.mockResolvedValue([])
  api.getSummary.mockResolvedValue(emptySummary)
  api.clearEntries.mockResolvedValue({ ok: true, deleted: 1 })
  api.exportEntries.mockResolvedValue({
    format: 'json',
    filename: 'family-ledger.json',
    content_type: 'application/json',
    entry_count: 0,
    entries: [],
    content: '[]',
  })
})

describe('mobile-first Family Ledger UX', () => {
  it('keeps full details collapsed on mobile and expands them on request', async () => {
    const wrapper = await mountApp()

    const form = wrapper.get('#full-record-form')
    expect((form.element as HTMLElement).style.display).toBe('none')
    expect(wrapper.get('.details-toggle').text()).toContain('Add details')

    await wrapper.get('.details-toggle').trigger('click')

    expect((form.element as HTMLElement).style.display).not.toBe('none')
    expect(wrapper.get('.details-toggle').text()).toContain('Hide details')
    expect(wrapper.text()).toContain('Full Record')
  })

  it('saves a valid Quick Add expense and moves the family back to Ledger', async () => {
    api.createMinimalExpense.mockImplementation(async () => {
      api.listEntries.mockResolvedValue([transportEntry])
      api.getSummary.mockResolvedValue(summaryWithTransport)
      return transportEntry
    })
    const wrapper = await mountApp()

    const quickSave = () => wrapper.findAll('button').find((button) => button.text().trim() === 'Save')!
    expect(quickSave().attributes('disabled')).toBeDefined()

    await wrapper.get('input[aria-label="Expense amount"]').setValue('42.5')
    await wrapper.get('input[aria-label="Description"]').setValue('MTR commute top up')
    await quickSave().trigger('click')
    await flushPromises()

    expect(api.createMinimalExpense).toHaveBeenCalledWith({
      amount: 42.5,
      description: 'MTR commute top up',
    })
    expect(wrapper.text()).toContain('Saved quick expense HK$42.50 as Transport.')
    expect(wrapper.get('[data-testid="ledger-list"]').text()).toContain('MTR commute top up')
  })

  it('keeps LLM API out of the mobile primary tabbar while leaving it reachable', async () => {
    const wrapper = await mountApp()

    const primaryNav = wrapper.get('.mobile-tabbar')
    expect(primaryNav.text()).toContain('Record')
    expect(primaryNav.text()).toContain('Ledger')
    expect(primaryNav.text()).toContain('Analytics')
    expect(primaryNav.text()).not.toContain('LLM API')

    await wrapper.get('.mobile-dev-nav button').trigger('click')

    expect(wrapper.text()).toContain('Agent Surface')
  })

  it('shows empty and no-result ledger states with recoverable actions', async () => {
    const wrapper = await mountApp()

    await wrapper.findAll('.mobile-tabbar button')[1].trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="ledger-empty"]').text()).toContain('No entries yet')

    await wrapper.get('input[aria-label="Search"]').setValue('school')
    await wrapper.get('input[aria-label="Search"]').trigger('change')
    await flushPromises()

    expect(wrapper.get('[data-testid="ledger-empty"]').text()).toContain('No matching entries')
    await wrapper.get('.clear-filters').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ledger-empty"]').text()).toContain('No entries yet')
  })

  it('uses an app confirmation sheet for clearing instead of browser confirm', async () => {
    api.listEntries.mockResolvedValue([transportEntry])
    api.getSummary.mockResolvedValue(summaryWithTransport)
    window.confirm = vi.fn()
    const browserConfirm = vi.spyOn(window, 'confirm')
    const wrapper = await mountApp()

    await wrapper.findAll('.mobile-tabbar button')[1].trigger('click')
    await wrapper.get('.mobile-action-trigger').trigger('click')
    await wrapper.findAll('#ledger-actions-menu button').at(3)!.trigger('click')

    expect(browserConfirm).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Clear family ledger?')

    await wrapper.get('[role="dialog"] button:last-child').trigger('click')
    await flushPromises()

    expect(api.clearEntries).toHaveBeenCalled()
  })

  it('renders smart tag feedback near expanded details', async () => {
    const suggestion: TagSuggestion = {
      category: 'Groceries',
      tags: ['wellcome', 'weekly-shop'],
      confidence: 0.91,
      reason: 'Matched family grocery keywords.',
      llm_context: {
        task: 'classify_household_transaction',
        allowed_categories: ['Groceries'],
        required_output_schema: {},
      },
    }
    api.suggestTags.mockResolvedValue(suggestion)
    const wrapper = await mountApp()

    await wrapper.get('.details-toggle').trigger('click')
    await wrapper.get('textarea[aria-label="Receipt or chat text"]').setValue('Wellcome weekly groceries')
    await wrapper.findAll('button').find((button) => button.text().includes('Smart tag'))!.trigger('click')
    await flushPromises()

    expect(wrapper.get('.inline-suggestion').text()).toContain('Groceries')
    expect(wrapper.get('.inline-suggestion').text()).toContain('91%')
    expect(wrapper.get('.inline-suggestion').text()).toContain('Matched family grocery keywords.')
  })
})
