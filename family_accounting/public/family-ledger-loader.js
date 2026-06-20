(async function loadFamilyLedger() {
  const base = '/assets/family_accounting/frontend'
  const manifestResponse = await fetch(`${base}/.vite/manifest.json`, { cache: 'no-cache' })
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load frontend manifest: ${manifestResponse.status}`)
  }
  const manifest = await manifestResponse.json()
  const entry = manifest['index.html'] || Object.values(manifest).find((item) => item && item.isEntry)
  if (!entry || !entry.file) {
    throw new Error('Frontend manifest does not contain an entry bundle')
  }
  for (const href of entry.css || []) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${base}/${href}`
    document.head.appendChild(link)
  }
  const script = document.createElement('script')
  script.type = 'module'
  script.src = `${base}/${entry.file}`
  document.body.appendChild(script)
})().catch((error) => {
  console.error(error)
  const root = document.getElementById('app')
  if (root) root.textContent = 'Unable to load Family Ledger.'
})
