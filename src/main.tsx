import { setupIonicReact } from '@ionic/react'
import '@ionic/react/css/core.css'
import '@ionic/react/css/display.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/padding.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/typography.css'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import { fullWidthSlideAnimation } from './lib/navAnimation'

setupIonicReact({
  mode: 'ios',
  navAnimation: fullWidthSlideAnimation,
})

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <App />,
)
