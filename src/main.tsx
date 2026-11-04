import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n.ts'
import App from './App.tsx'
import { AuthWrapper } from './Login.tsx'
import { PreferencesProvider } from './preferences/PreferencesContext.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <AuthWrapper>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthWrapper>
    </PreferencesProvider>
  </StrictMode>,
)
