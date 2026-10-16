import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Toasty } from '@cloudflare/kumo'
import { Analytics } from '@vercel/analytics/react'
import { Root } from './Root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toasty>
      <Root />
    </Toasty>
    <Analytics />
  </StrictMode>,
)
