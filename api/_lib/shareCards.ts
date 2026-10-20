import { fireCard, missingCard, newsCard, roadCard, warningCard, type CardSource, type ShareCard } from '../../src/lib/shareCard.js'
import { bushfires, qldWarnings, roadEvents } from './feeds.js'
import { loadSnapshot } from './newsIngest.js'

// Finds the share card for a timeline post from the live official feeds, for
// the link-preview page and its image. A post the server can't find, or a
// source it doesn't read (Translink alerts), gets a card that says so.

export const CARD_SOURCES = ['road', 'fire', 'warning', 'transit', 'news'] as const satisfies readonly CardSource[]

export async function findCard(source: CardSource, id: string): Promise<ShareCard> {
  if (source === 'road') {
    const { events } = await roadEvents()
    const e = events.find((x) => String(x.properties.id) === id)
    return e ? roadCard(e) : missingCard(source, id)
  }
  if (source === 'fire') {
    const { fires } = await bushfires()
    const f = fires.find((x) => x.id === id)
    return f ? fireCard(f) : missingCard(source, id)
  }
  if (source === 'warning') {
    const w = (await qldWarnings()).find((x) => x.id === id)
    return w ? warningCard(w) : missingCard(source, id)
  }
  if (source === 'news') {
    // A story's id is its first report's id.
    const item = (await loadSnapshot())?.items.find((x) => x.id === id)
    return item ? newsCard(item) : missingCard(source, id)
  }
  return missingCard(source, id)
}

