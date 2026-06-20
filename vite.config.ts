import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'

const frappeBuild = process.env.FRAPPE_BUILD === '1'

export default defineConfig({
  plugins: [
    frappeui({
      frontendRoute: '/family-ledger',
      frappeProxy: false,
      jinjaBootData: false,
      buildConfig: false,
      frappeTypes: {
        input: {
          family_accounting: ['family_accounting_entry', 'family_accounting_budget'],
        },
        output: 'src/types/doctypes.ts',
      },
    }),
    vue(),
  ],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['feather-icons'],
  },
  build: frappeBuild
    ? {
        outDir: 'family_accounting/public/frontend',
        emptyOutDir: true,
        manifest: true,
      }
    : undefined,
  test: {
    environment: 'node',
    globals: true,
  },
})
