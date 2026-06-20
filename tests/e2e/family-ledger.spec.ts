import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/dev/reset')
  await page.goto('/')
})

test('records an entry with smart tagging and shows it in the ledger', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Family Ledger' })).toBeVisible()

  await ensureDetailsOpen(page)
  const fullForm = page.getByRole('form', { name: 'Record a ledger entry' })
  await fullForm.getByLabel('Receipt or chat text').fill('Wellcome weekly supermarket groceries for dinner')
  await fullForm.getByLabel('Amount').fill('245.80')
  await fullForm.getByLabel('Merchant').fill('Wellcome')
  await fullForm.getByLabel('Family note').fill('Shared dinner ingredients')
  await page.getByRole('button', { name: 'Smart tag' }).click()

  await expect(page.getByText('Groceries').first()).toBeVisible()
  await page.getByRole('button', { name: 'Save entry' }).click()

  await expect(page.getByTestId('ledger-list')).toContainText('Wellcome')
  await expect(page.getByTestId('ledger-list')).toContainText('Shared dinner ingredients')
})

test('records a minimal expense with only amount and description', async ({ page }) => {
  await page.getByLabel('Expense amount').fill('42.50')
  await page.getByLabel('Description').fill('MTR commute top up')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByTestId('ledger-list')).toContainText('MTR commute top up')
  await expect(page.getByTestId('ledger-list')).toContainText('Transport')
  await expect(page.getByTestId('ledger-list')).toContainText('Quick Capture')
})

test('filters the ledger and renders analytics', async ({ page }) => {
  await page.getByRole('radio', { name: 'Ledger' }).click()
  await page.getByLabel('Search').fill('MTR')
  await clickVisibleAction(page, 'Refresh')

  await expect(page.getByTestId('ledger-list')).toContainText('MTR')
  await page.getByRole('radio', { name: 'Analytics' }).click()
  await expect(page.getByRole('heading', { name: 'Category Spend' })).toBeVisible()
  await expect(page.getByText('Transport', { exact: true }).first()).toBeVisible()
})

test('runs LLM-facing agent API operations from the UI', async ({ page }) => {
  await page.getByRole('radio', { name: 'LLM API' }).click()
  await page.getByRole('button', { name: 'Call summary' }).click()
  await expect(page.getByTestId('api-result')).toContainText('get_summary')

  await page.getByRole('button', { name: 'Agent create demo' }).click()
  await expect(page.getByTestId('api-result')).toContainText('Coffee shop')
})

test('exports and clears ledger data from the ledger screen', async ({ page }) => {
  await page.getByRole('radio', { name: 'Ledger' }).click()

  const downloadPromise = page.waitForEvent('download')
  await clickVisibleAction(page, 'JSON')
  const download = await downloadPromise
  const downloadPath = await download.path()
  expect(download.suggestedFilename()).toMatch(/family-ledger.*\.json$/)
  expect(downloadPath).toBeTruthy()
  const content = await fs.readFile(downloadPath!, 'utf-8')
  expect(content).toContain('Wellcome weekly groceries')

  await clickVisibleAction(page, 'Clear')
  await expect(page.getByRole('dialog', { name: 'Clear family ledger?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Clear family ledger?' }).getByRole('button', { name: 'Clear ledger' }).click()
  await expect(page.locator('[data-testid="ledger-list"] article')).toHaveCount(0)
  await expect(page.getByTestId('ledger-empty')).toContainText('No entries yet')
})

async function ensureDetailsOpen(page: import('@playwright/test').Page) {
  const details = page.getByRole('button', { name: /Add details|Hide details/ })
  if ((await details.textContent())?.includes('Add details')) {
    await details.click()
  }
}

async function clickVisibleAction(page: import('@playwright/test').Page, name: string) {
  const exact = name === 'JSON' || name === 'CSV'
  if (await clickFirstVisible(page.getByRole('button', { name, exact }))) return
  await page.getByRole('button', { name: 'Actions' }).click()
  if (await clickFirstVisible(page.getByRole('button', { name, exact }))) return
  throw new Error(`Could not find visible action: ${name}`)
}

async function clickFirstVisible(locator: import('@playwright/test').Locator) {
  for (let index = 0; index < await locator.count(); index += 1) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible()) {
      await candidate.click()
      return true
    }
  }
  return false
}
