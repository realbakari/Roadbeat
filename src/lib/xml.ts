import { decodeEntities } from './newsText.js'

// The little XML reading the app's feeds need: RSS, Atom and KML from
// publishers who send well-formed, shallow documents. A regex per element is
// enough for those, and keeps a full XML parser out of the bundle and the
// server functions in api/, which share this.

/** Unwraps CDATA sections, keeping their text as written. */
export const cdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')

/**
 * The content of the first `<name>` element in `block`, attributes allowed,
 * with CDATA unwrapped and entities left as written, or null when there is no
 * such element. For text that is decoded later (such as by `plainText`).
 */
export function xmlTag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)
  return m ? cdata(m[1]).trim() : null
}

/** As `xmlTag`, with the entities decoded, for text shown as it is. */
export function xmlText(block: string, name: string): string | null {
  const raw = xmlTag(block, name)
  return raw == null ? null : decodeEntities(raw).trim()
}
