import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'

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
  test: {
    environment: 'node',
    globals: true,
  },
})
