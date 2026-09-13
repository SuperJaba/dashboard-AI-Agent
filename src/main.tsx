import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthWrapper } from './Login.tsx'
import { PreferencesProvider } from './preferences/PreferencesContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <AuthWrapper>
        <App />
      </AuthWrapper>
    </PreferencesProvider>
  </StrictMode>,
)
