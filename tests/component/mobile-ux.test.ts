// @vitest-environment happy-dom

import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { Direction, EntryFilters, LedgerEntry, LedgerSummary, TagSuggestion } from '../../src/types'

vi.setConfig({ testTimeout: 10000 })

const apiMocks = vi.hoisted(() => ({
  agentExecute: vi.fn(),
  clearEntries: vi.fn(),
  createEntry: vi.fn(),
  createMinimalExpense: vi.fn(),
  exportEntries: vi.fn(),
  getSummary: vi.fn(),
  listEntries: vi.fn(),
  suggestTags: vi.fn(),
}))

vi.mock('../../src/api', () => apiMocks)

vi.mock('frappe-ui', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')

  const Button = defineComponent({
    name: 'Button',
    props: {
      disabled: Boolean,
      loading: Boolean,
      type: {
        type: String,
        default: 'button',
      },
    },
    emits: ['click'],
    setup(props, { emit, slots }) {
      return () =>
        h(
          'button',
          {
            disabled: props.disabled || props.loading || undefined,
            type: props.type,
            onClick: (event: MouseEvent) => emit('click', event),
          },
          slots.default?.(),
        )
    },
  })

  const FormControl = defineComponent({
    name: 'FormControl',
    props: {
      label: {
        type: String,
        required: true,
      },
      min: String,
      modelValue: [String, Number],
      options: {
        type: Array,
        default: () => [],
      },
      placeholder: String,
      required: Boolean,
      step: String,
      type: {
        type: String,
        default: 'text',
      },
    },
    emits: ['change', 'update:modelValue'],
    setup(props, { emit }) {
      const emitValue = (event: Event) => {
        const element = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        const nextValue = props.type === 'number' ? Number(element.value) : element.value
        emit('update:modelValue', nextValue)
        emit('change', nextValue)
      }

      return () => {
        const controlProps = {
          'aria-label': props.label,
          onChange: emitValue,
          onInput: emitValue,
          placeholder: props.placeholder,
          required: props.required || undefined,
          value: props.modelValue ?? '',
        }

        const control =
          props.type === 'textarea'
            ? h('textarea', controlProps)
            : props.type === 'select'
              ? h(
                  'select',
                  controlProps,
                  (props.options as Array<{ label?: string; value?: string } | string>).map((option) => {
                    const label = typeof option === 'string' ? option : option.label || option.value || ''
                    const value = typeof option === 'string' ? option : option.value ?? option.label ?? ''
                    return h('option', { value }, label)
                  }),
                )
              : h('input', {
                  ...controlProps,
                  min: props.min,
                  step: props.step,
                  type: props.type,
                })

        return h('label', { class: 'form-control' }, [h('span', props.label), control])
      }
    },
  })

  const TabButtons = defineComponent({
    name: 'TabButtons',
    props: {
      buttons: {
        type: Array,
        required: true,
      },
      modelValue: String,
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'div',
          {
            'aria-label': attrs['aria-label'] || 'Sections',
            role: 'radiogroup',
          },
          (props.buttons as Array<{ label: string; value: string }>).map((button) =>
            h(
              'button',
              {
                'aria-checked': props.modelValue === button.value ? 'true' : 'false',
                role: 'radio',
                type: 'button',
                onClick: () => emit('update:modelValue', button.value),
              },
              button.label,
            ),
          ),
        )
    },
  })

  return { Button, FormControl, TabButtons }
})

const emptySummary: LedgerSummary = {
  budget_alerts: [],
  by_category: {},
  by_member: {},
  by_month: {},
  entry_count: 0,
  expense: 0,
  income: 0,
  net: 0,
  transfer: 0,
}

const wrappers: VueWrapper[] = []
let mockEntries: LedgerEntry[] = []

beforeEach(() => {
  vi.resetModules()
  mockEntries = []
  vi.clearAllMocks()
  setMobileViewport()

  apiMocks.listEntries.mockImplementation(async (filters: EntryFilters = {}) => filterEntries(filters))
  apiMocks.getSummary.mockImplementation(async (filters: EntryFilters = {}) => summarize(filterEntries(filters)))
  apiMocks.createMinimalExpense.mockImplementation(async ({ amount, description }) => {
    const entry = makeEntry({
      account: 'Quick Capture',
      amount,
      category: inferCategory(description),
      merchant: description,
      source_text: description,
    })
    mockEntries = [entry, ...mockEntries]
    return entry
  })
  apiMocks.createEntry.mockImplementation(async (payload: Partial<LedgerEntry>) => {
    const entry = makeEntry(payload)
    mockEntries = [entry, ...mockEntries]
    return entry
  })
  apiMocks.suggestTags.mockResolvedValue({
    category: 'Transport',
    confidence: 0.92,
    llm_context: {
      allowed_categories: ['Transport', 'Dining'],
      required_output_schema: {},
      task: 'classify_household_transaction',
    },
    reason: 'Matched commute language.',
    tags: ['commute'],
  } satisfies TagSuggestion)
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.unmount()
  }
  document.body.innerHTML = ''
})

describe('planned mobile UX component contract', () => {
  it('keeps Quick Add invalid until amount and description are ready', async () => {
    const wrapper = await mountApp()
    const save = findButton(wrapper, /^Save$/)

    expect(save.attributes('disabled')).toBeDefined()

    await findField(wrapper, /expense amount|amount/i).setValue('72.30')
    expect(save.attributes('disabled')).toBeDefined()

    await findField(wrapper, /^description$/i).setValue('MTR commute top up')
    expect(save.attributes('disabled')).toBeUndefined()
  })

  it('saves a Quick Add expense through the minimal API and announces feedback', async () => {
    const wrapper = await mountApp()

    await findField(wrapper, /expense amount|amount/i).setValue('72.30')
    await findField(wrapper, /^description$/i).setValue('MTR commute top up')
    await findButton(wrapper, /^Save$/).trigger('click')
    await flushPromises()

    expect(apiMocks.createMinimalExpense).toHaveBeenCalledWith({
      amount: 72.3,
      description: 'MTR commute top up',
    })
    expect(apiMocks.createEntry).not.toHaveBeenCalled()
    expect(apiMocks.listEntries).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="ledger-list"]').text()).toContain('MTR commute top up')
    expect(wrapper.get('[data-testid="ledger-list"]').text()).toContain('Quick Capture')
    expect(liveRegionText(wrapper)).toMatch(/Saved.*HK\$72\.30.*Transport/i)
  })

  it('starts with full record details collapsed and expands them on request', async () => {
    const wrapper = await mountApp()

    expect(findField(wrapper, /^receipt or chat text$/i).isVisible()).toBe(false)
    expect(findField(wrapper, /^member$/i).isVisible()).toBe(false)
    expect(findField(wrapper, /^account$/i).isVisible()).toBe(false)

    await findButton(wrapper, /add details|full details/i).trigger('click')
    await flushPromises()

    expect(findField(wrapper, /^receipt or chat text$/i).exists()).toBe(true)
    expect(findField(wrapper, /^date$/i).exists()).toBe(true)
    expect(findField(wrapper, /^type$/i).exists()).toBe(true)
    expect(findField(wrapper, /^member$/i).exists()).toBe(true)
    expect(findField(wrapper, /^account$/i).exists()).toBe(true)
    expect(findField(wrapper, /^merchant$/i).exists()).toBe(true)
    expect(findField(wrapper, /^category$/i).exists()).toBe(true)
    expect(findField(wrapper, /^tags$/i).exists()).toBe(true)
    expect(findField(wrapper, /^family note$/i).exists()).toBe(true)
  })

  it('uses a mobile primary nav for Record, Ledger, and Analytics without promoting LLM API', async () => {
    mockEntries = [
      makeEntry({
        amount: 39.9,
        category: 'Transport',
        merchant: 'MTR',
        source_text: 'MTR commute',
      }),
    ]
    const wrapper = await mountApp()
    const nav = findPrimaryMobileNav(wrapper)

    expect(nav.text()).toContain('Record')
    expect(nav.text()).toContain('Ledger')
    expect(nav.text()).toContain('Analytics')
    expect(nav.text()).not.toContain('LLM API')

    await findButton(nav, /^Ledger$/).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Ledger')

    await findButton(nav, /^Analytics$/).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Category Spend')
  })

  it('validates empty ledger and no-result states when the implementation renders them', async () => {
    const wrapper = await mountApp()

    await findButton(wrapper, /^Ledger$/).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="ledger-list"] article')).toHaveLength(0)

    const emptyCopy = findOptionalText(wrapper, /no entries yet|no spending yet/i)
    if (emptyCopy) {
      expect(wrapper.text()).toMatch(/record expense|quick add/i)
    }

    await findField(wrapper, /^search$/i).setValue('not-present-in-ledger')
    await flushPromises()
    expect(apiMocks.listEntries).toHaveBeenLastCalledWith({ q: 'not-present-in-ledger' })
    expect(wrapper.findAll('[data-testid="ledger-list"] article')).toHaveLength(0)

    const noResultCopy = findOptionalText(wrapper, /no matching|no results/i)
    if (noResultCopy) {
      expect(wrapper.text()).toMatch(/clear filters/i)
    }
  })
})

async function mountApp() {
  const { default: App } = await import('../../src/App.vue')
  const wrapper = mount(App, { attachTo: document.body })
  wrappers.push(wrapper)
  await flushPromises()
  await flushPromises()
  await nextTick()
  return wrapper
}

function setMobileViewport() {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390, writable: true })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844, writable: true })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const maxWidth = query.match(/max-width:\s*(\d+)px/)
    return {
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: maxWidth ? window.innerWidth <= Number(maxWidth[1]) : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }
  })
}

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const amount = Number(overrides.amount ?? 72.3)
  const sourceText = overrides.source_text || overrides.merchant || 'MTR commute top up'
  const category = overrides.category || inferCategory(sourceText)

  return {
    account: 'HSBC Visa',
    amount,
    category,
    confidence: 0.9,
    created_by_agent: false,
    currency: 'HKD',
    direction: 'Expense' as Direction,
    household_member: 'Victor',
    merchant: overrides.merchant || sourceText,
    name: `FAC-ENTRY-${mockEntries.length + 1}`,
    note: '',
    posted_on: '2026-06-20',
    source_text: sourceText,
    tags: category === 'Transport' ? ['commute'] : [],
    ...overrides,
  }
}

function inferCategory(text = '') {
  return /mtr|taxi|commute|transport/i.test(text) ? 'Transport' : 'Uncategorized'
}

function filterEntries(filters: EntryFilters = {}) {
  return mockEntries.filter((entry) => {
    const q = filters.q?.toLowerCase()
    if (q && ![entry.merchant, entry.source_text, entry.note, entry.category, ...entry.tags].join(' ').toLowerCase().includes(q)) {
      return false
    }
    if (filters.household_member && entry.household_member !== filters.household_member) return false
    if (filters.category && entry.category !== filters.category) return false
    if (filters.direction && entry.direction !== filters.direction) return false
    return true
  })
}

function summarize(entries: LedgerEntry[]): LedgerSummary {
  return entries.reduce<LedgerSummary>(
    (summary, entry) => {
      summary.entry_count += 1
      if (entry.direction === 'Income') {
        summary.income += entry.amount
      } else if (entry.direction === 'Transfer') {
        summary.transfer += entry.amount
      } else {
        summary.expense += entry.amount
        summary.by_category[entry.category] = (summary.by_category[entry.category] || 0) + entry.amount
        summary.by_member[entry.household_member] = (summary.by_member[entry.household_member] || 0) + entry.amount
        summary.by_month[entry.posted_on.slice(0, 7)] = (summary.by_month[entry.posted_on.slice(0, 7)] || 0) + entry.amount
      }
      summary.net = summary.income - summary.expense
      return summary
    },
    { ...emptySummary, by_category: {}, by_member: {}, by_month: {} },
  )
}

function queryField(wrapper: VueWrapper, label: RegExp) {
  return wrapper.findAll('input, select, textarea').find((field) => label.test(field.attributes('aria-label') || ''))
}

function findField(wrapper: VueWrapper, label: RegExp) {
  const field = queryField(wrapper, label)
  if (!field) throw new Error(`Unable to find field matching ${label}`)
  return field
}

function queryButton(wrapper: VueWrapper | DOMWrapper<Element>, label: RegExp) {
  return wrapper
    .findAll('button, summary, [role="button"], [role="radio"]')
    .find((button) => label.test(button.text().trim()) || label.test(button.attributes('aria-label') || ''))
}

function findButton(wrapper: VueWrapper | DOMWrapper<Element>, label: RegExp) {
  const button = queryButton(wrapper, label)
  if (!button) throw new Error(`Unable to find button matching ${label}`)
  return button
}

function findPrimaryMobileNav(wrapper: VueWrapper) {
  const nav = [
    wrapper.find('[data-testid="mobile-primary-nav"]'),
    wrapper.find('nav[aria-label*="Mobile"]'),
    wrapper.find('nav[aria-label*="Primary"]'),
    wrapper.find('nav[aria-label="Main sections"]'),
    wrapper.find('[aria-label="Main sections"]'),
  ].find((candidate) => candidate.exists())

  if (!nav) throw new Error('Unable to find primary mobile navigation')
  return nav
}

function liveRegionText(wrapper: VueWrapper) {
  return wrapper.findAll('[aria-live="polite"]').map((region) => region.text()).join(' ')
}

function findOptionalText(wrapper: VueWrapper, text: RegExp) {
  return text.test(wrapper.text())
}
