import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/dev/reset')
  await page.goto('/')
})

test('records an entry with smart tagging and shows it in the ledger', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Family Ledger' })).toBeVisible()

  await page.getByLabel('Receipt or chat text').fill('Wellcome weekly supermarket groceries for dinner')
  await page.getByLabel('Amount').fill('245.80')
  await page.getByLabel('Merchant').fill('Wellcome')
  await page.getByLabel('Family note').fill('Shared dinner ingredients')
  await page.getByRole('button', { name: 'Smart tag' }).click()

  await expect(page.getByText('Groceries').first()).toBeVisible()
  await page.getByRole('button', { name: 'Save entry' }).click()

  await expect(page.getByTestId('ledger-list')).toContainText('Wellcome')
  await expect(page.getByTestId('ledger-list')).toContainText('Shared dinner ingredients')
})

test('filters the ledger and renders analytics', async ({ page }) => {
  await page.getByRole('radio', { name: 'Ledger' }).click()
  await page.getByLabel('Search').fill('MTR')
  await page.getByRole('button', { name: 'Refresh' }).click()

  await expect(page.getByTestId('ledger-list')).toContainText('MTR')
  await page.getByRole('radio', { name: 'Analytics' }).click()
  await expect(page.getByRole('heading', { name: 'Category Spend' })).toBeVisible()
  await expect(page.getByText('Transport')).toBeVisible()
})

test('runs LLM-facing agent API operations from the UI', async ({ page }) => {
  await page.getByRole('radio', { name: 'LLM API' }).click()
  await page.getByRole('button', { name: 'Call summary' }).click()
  await expect(page.getByTestId('api-result')).toContainText('get_summary')

  await page.getByRole('button', { name: 'Agent create demo' }).click()
  await expect(page.getByTestId('api-result')).toContainText('Coffee shop')
})
