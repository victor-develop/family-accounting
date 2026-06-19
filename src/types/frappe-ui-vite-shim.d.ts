declare module 'frappe-ui/vite' {
  import type { PluginOption } from 'vite'

  const frappeui: (options?: Record<string, unknown>) => PluginOption | PluginOption[]
  export default frappeui
}
