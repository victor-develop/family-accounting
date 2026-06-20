# Mobile UX Optimization Plan

## Scope

This plan covers the current Family Ledger Vue/Frappe UI in `src/App.vue` and `src/styles.css`, plus the captured journey states in `docs/user-journey`. It is intentionally a UX plan only: no implementation code, no landing page, and no changes outside the real app experience.

Design goals: family warm, smooth, mobile-first, minimal friction, fast record flow, readable ledger and analytics, 44px+ touch targets, progressive disclosure for advanced fields, and no page-level horizontal scroll.

## Current Mobile UX Risks

- The first screen is not focused enough on recording. The always-visible title, tab group, and four summary metrics can push the quick expense form below the fold on small phones.
- Primary navigation lives in the topbar. Once users scroll down Record or Ledger, switching sections requires returning to the top, which is slower than a mobile-first tab pattern.
- `LLM API` has equal weight with Record, Ledger, and Analytics. That is useful for development, but it dilutes the family-facing app loop.
- The quick record concept is strong, but the full form is exposed immediately below it. On mobile, this makes the app feel more like bookkeeping than "log this family spend quickly."
- The Tag Result panel shows a pending/empty state before the user asks for smart tagging. This adds visual noise to the default recording path.
- Ledger shows export, clear, refresh, search, and all filters together. On mobile this can crowd the main job: find and scan entries.
- The destructive Clear action sits near routine export actions and uses browser confirmation, which feels abrupt and is easy to mis-tap.
- Ledger cards stack vertically on mobile, which can push the amount away from the merchant/category and reduce scan speed.
- Analytics is readable for the current small dataset, but monthly bars can risk horizontal overflow as data grows. The charts also need stronger text summaries for accessibility.
- Custom surfaces do not yet define a clear 44px touch target standard, safe-area behavior, focus behavior, or reduced-motion expectations.

## Priority Plan

### P0: Make Quick Record The Mobile First Screen

- Keep Record as the default app screen.
- On 375px-wide phones, users should see app identity, compact household context, amount, description, and Save without needing to scroll.
- Compress the summary area on mobile. Prioritize Monthly spend and Net; make Income and Entries secondary.
- Keep the warm mint/white visual tone, but reduce vertical bulk and heavy shadows on mobile so the page feels lighter while scrolling.
- Rename "Minimal Expense" to a warmer, clearer label such as "Quick Add" or "Quick Expense."
- Disable Save until amount and description are valid.
- Show save feedback immediately with short copy, for example "Saved HK$72.30 as Transport."

### P1: Use Mobile-First Primary Navigation

- Use bottom navigation on mobile for the family-facing sections: Record, Ledger, Analytics.
- Keep icon plus text label for every nav item.
- Make each nav item at least 44px tall, preferably 48px, with clear selected state.
- Keep the bottom nav reachable from every scroll position.
- Add enough bottom spacing so content and buttons are never hidden behind the nav or the mobile gesture area.
- Move `LLM API` out of primary mobile navigation. Keep it desktop-visible, behind More, or behind a developer/internal access path.

### P1: Progressive Disclosure For Full Record Form

- Keep quick capture as two required fields: Amount and Description.
- Place full structured fields behind an "Add details" disclosure on mobile.
- In expanded details, group fields in a natural order:
  - Receipt/chat text.
  - Date and Type.
  - Member and Account.
  - Merchant and Category.
  - Tags and Family note.
- Keep Smart tag secondary to Save. It should feel helpful, not required.
- Hide the Tag Result panel until a suggestion exists.
- After smart tagging, show category, confidence, tags, and reason near the fields being updated.
- Keep Recent entries lightweight. Do not show a large empty recent area before any entries exist.

### P1: Make Ledger Search-First

- On mobile, order Ledger as: title/status, search, active filters, entries, secondary actions.
- Make Search the dominant control.
- Move Member, Category, and Type into filter chips or a compact filter sheet.
- Show active filters as removable chips.
- Move JSON export, CSV export, Refresh, and Clear into an Actions menu on mobile.
- Visually separate Clear from routine actions.
- Replace browser confirmation with an app-styled confirmation sheet or modal that has Cancel and destructive Clear actions.
- Preserve the API-level explicit confirmation requirement.
- Add empty states:
  - No entries yet: offer Record expense.
  - No matching results: offer Clear filters.

### P2: Improve Ledger Card Scanning

- Keep each mobile entry card compact and consistent.
- Top row should show merchant/category on the left and signed amount on the right.
- Second row should show date, member, and account.
- Note and tags should remain available but visually secondary.
- Keep plus/minus signs in amount text so transaction direction is not color-only.
- Use tabular numbers for amounts.

### P2: Make Analytics Insight-First

- On mobile, show a short insight summary before charts: biggest category, total spend, and member split.
- Order sections as Category Spend, Member View, then Monthly Trend.
- Keep direct numeric values beside every bar.
- Avoid relying on color alone. Use labels and values for all chart meaning.
- Prevent page-level horizontal scroll. If months overflow, only the chart area may scroll horizontally, and it should visibly indicate that behavior.
- Add a text summary for charts for screen readers and low-vision users.
- Add an empty state after clearing entries: "No spending yet" with a Record expense action.

## Exact Surface Changes

### Record

- First mobile viewport should prioritize Quick Add.
- Amount should use a decimal-friendly mobile keyboard.
- Description should be a short, plain text field with visible label.
- Save should be full-width or very easy to hit on small phones.
- Full details should start collapsed.
- Smart tag result should appear only after Smart tag is used.
- Save, Smart tag, and validation feedback should be announced accessibly.

### Ledger

- Search should appear before exports and destructive actions.
- Filters should be collapsed or chip-based on mobile.
- Export/Clear/Refresh should become secondary mobile actions.
- Clear requires a custom confirmation step.
- Entry cards should keep amount visible near the title.
- Empty and no-results states should include a next action.

### Analytics

- Start with plain-language insight, then visual charts.
- Keep Category Spend and Member View readable as lists.
- Monthly Trend must handle many months without causing full-page horizontal scroll.
- Charts need labels, values, and screen-reader summaries.

### Navigation

- Mobile primary nav should be bottom-positioned and persistent.
- Include only Record, Ledger, and Analytics in primary mobile nav.
- Keep `LLM API` accessible for development without making it a core family tab.
- Preserve predictable tab switching and active state.

## Accessibility And Touch Targets

- All interactive controls must have at least a 44px by 44px hit area.
- Keep at least 8px spacing between adjacent touch targets.
- Use visible labels for inputs; placeholders are helper text only.
- Keep mobile body/input text at 16px or larger.
- Ensure focus moves predictably when changing sections or opening/closing sheets.
- Keep status messages in polite live regions.
- Destructive confirmation should trap focus while open and return focus when closed.
- Active nav and active filters need semantic selected/current state.
- Support reduced motion. Any transitions should be short and functional.
- Maintain color contrast for text, icons, borders, disabled states, and chart marks.
- Do not convey income/expense, active filters, chart categories, or errors by color alone.
- Respect top and bottom safe areas for nav, sheets, and sticky actions.

## Regression Risks To Preserve

- Minimal expense creation must still require only amount and description.
- After saving a quick expense, the entry must still be visible in Ledger.
- Smart tagging must still surface category, tags, confidence, and reason.
- Full entry creation must preserve all current fields and defaults.
- Ledger search and filters must continue to work.
- JSON and CSV export must remain available.
- Clear ledger must keep explicit confirmation and API-level protection.
- Analytics must still show summary totals, category spend, member split, and monthly trend.
- Existing LLM/API validation surface must remain available for development workflows.
- Existing tests that rely on `ledger-list`, `monthly-spend`, and accessible labels should be preserved or intentionally updated.

## Recommended Tests

- Add mobile Playwright coverage for 375px, 390px, and mobile landscape widths.
- Verify no page-level horizontal scroll on Record, Ledger, and Analytics.
- Verify Quick Add fields and Save are visible in the first mobile viewport.
- Verify Save disabled/enabled behavior for invalid and valid quick entries.
- Verify bottom nav remains reachable after scrolling.
- Verify Ledger search, filters, exports, clear confirmation, empty state, and no-results state.
- Verify Analytics with 0 entries, 1 entry, and many months of data.
- Verify keyboard tab order, focus return from sheets/modals, and screen-reader names for nav/actions.
- Verify touch targets are at least 44px.
- Verify reduced-motion mode does not rely on animation for comprehension.
- Keep running the existing unit, API, Python, and e2e suites after UX changes.
