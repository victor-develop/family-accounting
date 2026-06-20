import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import express from 'express'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { LedgerStore } from './ledger'
import type { EntryFilters } from '../types'

interface ServerOptions {
  includeFrontend?: boolean
}

export async function createFamilyAccountingServer(options: ServerOptions = {}) {
  const includeFrontend = options.includeFrontend ?? true
  const app = express()
  const store = new LedgerStore()
  let vite: ViteDevServer | undefined

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, app: 'family-accounting' })
  })

  app.post('/api/dev/reset', (_request, response) => {
    store.reset()
    response.json({ message: { ok: true } })
  })

  app.all('/api/method/family_accounting.api.:method', (request, response) => {
    try {
      const method = request.params.method
      const payload = normalizePayload(request.method === 'GET' ? request.query : request.body)
      const result = dispatch(method, payload, store)
      response.json({ message: result })
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  if (includeFrontend) {
    if (process.env.SERVE_DIST === '1') {
      const distPath = path.resolve(process.cwd(), 'dist')
      app.use(express.static(distPath))
      app.use(async (_request, response, next) => {
        try {
          response
            .status(200)
            .set({ 'Content-Type': 'text/html' })
            .end(await fs.readFile(path.join(distPath, 'index.html'), 'utf-8'))
        } catch (error) {
          next(error)
        }
      })
    } else {
      vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom',
      })
      app.use(vite.middlewares)
      app.use(async (request, response, next) => {
        try {
          const url = request.originalUrl
          const indexPath = path.resolve(process.cwd(), 'index.html')
          const template = await fs.readFile(indexPath, 'utf-8')
          const html = await vite!.transformIndexHtml(url, template)
          response.status(200).set({ 'Content-Type': 'text/html' }).end(html)
        } catch (error) {
          vite!.ssrFixStacktrace(error as Error)
          next(error)
        }
      })
    }
  }

  return {
    app,
    store,
    async close() {
      await vite?.close()
    },
    listen(port = 4173, host = '127.0.0.1') {
      const server = app.listen(port, host)
      return {
        server,
        get url() {
          const address = server.address()
          const actualPort = typeof address === 'object' && address ? address.port : port
          return `http://${host}:${actualPort}`
        },
        async close() {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()))
          })
          await vite?.close()
        },
      }
    },
  }
}

function dispatch(method: string, payload: Record<string, unknown>, store: LedgerStore) {
  if (method === 'suggest_tags') return store.suggestTags(payload)
  if (method === 'create_entry') return store.createEntry(payload)
  if (method === 'create_minimal_expense') return store.createMinimalExpense({
    amount: Number(payload.amount),
    description: String(payload.description || ''),
    household_member: typeof payload.household_member === 'string' ? payload.household_member : undefined,
    account: typeof payload.account === 'string' ? payload.account : undefined,
    posted_on: typeof payload.posted_on === 'string' ? payload.posted_on : undefined,
    currency: typeof payload.currency === 'string' ? payload.currency : undefined,
    created_by_agent: Boolean(payload.created_by_agent),
  })
  if (method === 'list_entries') {
    return store.listEntries(parseFilters(payload.filters), Number(payload.limit || 50))
  }
  if (method === 'get_summary') return store.getSummary(parseFilters(payload.filters))
  if (method === 'export_entries') {
    return store.exportEntries(parseFilters(payload.filters), payload.format === 'csv' ? 'csv' : 'json')
  }
  if (method === 'clear_entries') return store.clearEntries(payload.confirm)
  if (method === 'agent_execute') {
    const operation = String(payload.operation || '')
    const agentPayload = normalizePayload(payload.payload || {})
    return { operation, result: store.agentExecute(operation, agentPayload) }
  }
  if (method === 'openapi_spec') {
    return {
      name: 'Family Accounting API',
      base_path: '/api/method/family_accounting.api',
      methods: [
        'create_entry',
        'create_minimal_expense',
        'list_entries',
        'get_summary',
        'suggest_tags',
        'export_entries',
        'clear_entries',
        'agent_execute',
      ],
    }
  }
  throw new Error(`Unknown API method: ${method}`)
}

function parseFilters(filters: unknown): EntryFilters {
  if (!filters) return {}
  if (typeof filters === 'string') return JSON.parse(filters) as EntryFilters
  return filters as EntryFilters
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  if (!payload) return {}
  if (typeof payload === 'string') return JSON.parse(payload) as Record<string, unknown>
  if (typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    if (typeof data.data === 'string') return JSON.parse(data.data) as Record<string, unknown>
    if (typeof data.data === 'object' && data.data) return data.data as Record<string, unknown>
    return data
  }
  return {}
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(currentFile).href) {
  const port = Number(process.env.PORT || 4173)
  const server = await createFamilyAccountingServer({ includeFrontend: true })
  const running = server.listen(port)
  console.log(`Family Accounting dev server listening on ${running.url}`)
}
