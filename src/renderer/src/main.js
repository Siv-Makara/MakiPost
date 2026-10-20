import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/kantumruy-pro/khmer-400.css'
import '@fontsource/kantumruy-pro/khmer-600.css'
import './styles/main.css'
import App from './App.vue'
import { useAppearanceStore } from './stores/appearance'
import { useTabsStore } from './stores/tabs'
import { useEnvironmentsStore } from './stores/environments'
import { useHistoryStore } from './stores/history'
import { useGeneralStore } from './stores/general'

async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())

  // Load the theme and last session before the first paint, so nothing flashes.
  const [appearance, session, environments, history, general] = await Promise.all([
    window.sar.settings.get('appearance'),
    window.sar.settings.get('session'),
    window.sar.settings.get('environments'),
    window.sar.history.get(),
    window.sar.settings.get('general')
  ])
  useGeneralStore().init(general)
  useAppearanceStore().init(appearance)
  useEnvironmentsStore().init(environments)
  useHistoryStore().init(history)
  useTabsStore().restore(session)

  app.mount('#app')
}

bootstrap()
