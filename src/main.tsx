import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Toasty } from '@cloudflare/kumo'
import { IconContext } from '@phosphor-icons/react'
import { Analytics } from '@vercel/analytics/react'
import { Root } from './Root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Icons are decorative unless one says otherwise: buttons and text carry the words. A provider
        replaces Phosphor's defaults rather than adding to them, so they're all restated here. */}
    <IconContext.Provider value={{ color: 'currentColor', size: '1em', weight: 'regular', mirrored: false, 'aria-hidden': true }}>
      <Toasty>
        <Root />
      </Toasty>
    </IconContext.Provider>
    <Analytics />
  </StrictMode>,
)
