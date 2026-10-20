import { useEffect, useRef } from 'react'
import type { PostView } from '../lib/posts'
import { VIEWS } from './navigation'

// The timeline's keyboard shortcuts, listed in ShortcutsDialog: j and k move
// between posts, Enter opens one, a post's own keys work on the focused post
// (the buttons carry them in aria-keyshortcuts), 1–3 pick a tab, g then a
// letter goes elsewhere, / or ⌘K searches, ? lists them and Escape goes
// back from a post.
// Nothing fires while typing or while a dialog is open.

/** Pages "g" then a letter goes to. */
export const GO_TO: { key: string; href: string; label: string }[] = [
  { key: 'm', href: '/', label: 'the map' },
  { key: 'd', href: '/dashboard', label: 'the dashboard' },
  { key: 's', href: '/status', label: 'feed status' },
]

interface Actions {
  onView: (view: PostView) => void
  onOpen: (id: string) => void
  onBack: () => void
  onHelp: () => void
  onSearch: () => void
  /** A post's own page is showing, rather than the feed. */
  onPost: boolean
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** The posts on screen, and the one with focus (or inside focus). */
function postsAndCurrent() {
  const posts = [...document.querySelectorAll<HTMLElement>('article[data-post]')]
  const current = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>('article[data-post]') : null
  return { posts, current }
}

function focusPost(el: HTMLElement | undefined) {
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest' })
}

export function useTimelineKeys(actions: Actions) {
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })
  useEffect(() => {
    let goPending: ReturnType<typeof setTimeout> | null = null
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target) || document.querySelector('[role="dialog"]')) return
      const a = latest.current
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        a.onSearch()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        a.onSearch()
        return
      }
      if (goPending) {
        clearTimeout(goPending)
        goPending = null
        const to = GO_TO.find((g) => g.key === e.key)
        if (to) {
          e.preventDefault()
          location.assign(to.href)
        }
        return
      }
      if (e.key === 'g') {
        goPending = setTimeout(() => (goPending = null), 1000)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        a.onHelp()
        return
      }
      if (e.key === 'Escape' && a.onPost) {
        e.preventDefault()
        a.onBack()
        return
      }
      const view = VIEWS.find((v) => v.key === e.key)
      if (view && !a.onPost) {
        e.preventDefault()
        a.onView(view.value)
        return
      }
      const { posts, current } = postsAndCurrent()
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        if (!current) {
          // Start from the first post whose top is on screen.
          focusPost(posts.find((p) => p.getBoundingClientRect().bottom > 80))
          return
        }
        const i = posts.indexOf(current)
        focusPost(posts[e.key === 'j' ? i + 1 : i - 1])
        return
      }
      if (!current) return
      if (e.key === 'Enter' && document.activeElement === current) {
        e.preventDefault()
        const id = current.dataset.post
        if (id) a.onOpen(id)
        return
      }
      // A post's own keys: m (on the map), s (share), y (copy link), o (updates).
      const button = current.querySelector<HTMLElement>(`[aria-keyshortcuts="${CSS.escape(e.key)}"]`)
      if (button) {
        e.preventDefault()
        button.click()
      }
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
      if (goPending) clearTimeout(goPending)
    }
  }, [])
}
