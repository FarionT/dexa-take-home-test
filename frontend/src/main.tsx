// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('index.html is missing <div id="root">')

createRoot(rootElement).render(
  // <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  // </StrictMode>,
)
