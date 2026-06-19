import { createApp } from 'vue'
import { FrappeUI } from 'frappe-ui'
import App from './App.vue'
import 'frappe-ui/style.css'
import './styles.css'

createApp(App).use(FrappeUI).mount('#app')
