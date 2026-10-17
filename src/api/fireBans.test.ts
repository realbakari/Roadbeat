import { describe, expect, it } from 'vitest'
import { parseFireBans } from './fireBans'

// As QFD published it on 17 October 2026.
const NONE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:georss="http://www.georss.org/georss" xmlns="http://www.w3.org/2005/Atom">
<id>urn:uuid:372c07b3-67fc-4535-b474-b932069b5299</id>
<subtitle>Fireban for Queensland, provided by Queensland Fire Department</subtitle>
<title>This information provided as automated feed. All Date/Time values in UTC.</title>
<updated>2026-10-17T13:08:59.3952761Z</updated>
<entry>
<author><name>Queensland Fire Department</name></author>
<content>No current fire bans.</content>
<id>urn:uuid:4132e710-967d-4181-976d-f3a14d7cba41</id>
<published>2026-10-17T23:08:59+10:00</published>
<title>Updated  20261017230859.3927297</title>
<updated>2026-10-17T23:08:59+10:00</updated>
</entry>
</feed>`

describe('parseFireBans', () => {
  it('reads "No current fire bans." as none, with QFD\'s times', () => {
    const f = parseFireBans(NONE)
    expect(f.none).toBe(true)
    expect(f.bans).toEqual([{ id: 'urn:uuid:4132e710-967d-4181-976d-f3a14d7cba41', text: 'No current fire bans.', updatedAt: Date.parse('2026-10-17T13:08:59Z') }])
    expect(f.feedUpdatedAt).toBe(Date.parse('2026-10-17T13:08:59.395Z'))
  })

  it('keeps every ban entry as written, taking text from content, not the stamp title', () => {
    const xml = NONE.replace(
      /<entry>[\s\S]*<\/entry>/,
      `<entry><content>Local fire ban: Toowoomba Regional &amp; Lockyer Valley, until 11:59 pm Sunday.</content><id>a</id><title>Updated 2026</title><updated>2026-10-18T00:00:00+10:00</updated></entry>
<entry><summary><![CDATA[State of Fire Emergency: Darling Downs]]></summary><id>b</id><updated>2026-10-18T01:00:00+10:00</updated></entry>`,
    )
    const f = parseFireBans(xml)
    expect(f.none).toBe(false)
    expect(f.bans.map((b) => b.text)).toEqual(['Local fire ban: Toowoomba Regional & Lockyer Valley, until 11:59 pm Sunday.', 'State of Fire Emergency: Darling Downs'])
  })

  it('gives no bans for a feed without entries', () => {
    expect(parseFireBans('<feed><updated>2026-10-17T13:00:00Z</updated></feed>')).toEqual({ bans: [], none: false, feedUpdatedAt: Date.parse('2026-10-17T13:00:00Z') })
  })
})
