import { describe, expect, it } from 'vitest'
import { parseCouncilEvents } from './bccDashboard'

const row = {
  subject: ' Precious ',
  web_link: 'https://www.brisbane.qld.gov.au/trumba?trumbaEmbed=view%3Devent%26eventid%3D182353296',
  location: 'Museum of Brisbane, Brisbane City',
  start_datetime: '2025-04-06T14:00:00+00:00',
  end_datetime: '2027-04-01T14:00:00+00:00',
  formatteddatetime: 'Ongoing through Thursday, 1 April 2027',
  description: '<p>What makes a collection?</p><p>Open daily from 10am &#8211; 5pm.</p>',
  event_type: ['Art', 'Free'],
  eventimage: 'https://www.trumba.com/i/DgBpY5Z7rbRnjMvJ7LJHq5jB.jpg',
  venue: 'Museum of Brisbane, Brisbane City',
  venueaddress: 'Museum of Brisbane, Brisbane City Hall, 64 Adelaide Street, Brisbane City',
  venuetype: 'General Council venue',
  primaryeventtype: 'Exhibitions',
  cost: 'Free',
  age: 'Suitable for all ages.',
  bookings: '<p>No bookings required.&#160;</p>',
  bookingsrequired: 'No',
  meetingpoint: null,
  requirements: null,
  agerange: ['Seniors'],
  status: null,
  geolocation: { lon: 153.0241, lat: -27.4691 },
}

describe('parseCouncilEvents', () => {
  it('reads every published detail, as text, with Trumba id and position', () => {
    const [e] = parseCouncilEvents([row])
    expect(e).toMatchObject({
      id: '182353296',
      title: 'Precious',
      description: 'What makes a collection?\nOpen daily from 10am – 5pm.',
      venue: 'Museum of Brisbane, Brisbane City',
      address: 'Museum of Brisbane, Brisbane City Hall, 64 Adelaide Street, Brisbane City',
      venueType: 'General Council venue',
      start: Date.parse('2025-04-06T14:00:00+00:00'),
      end: Date.parse('2027-04-01T14:00:00+00:00'),
      when: 'Ongoing through Thursday, 1 April 2027',
      url: row.web_link,
      types: ['Art', 'Free'],
      primaryType: 'Exhibitions',
      cost: 'Free',
      age: 'Suitable for all ages.',
      ageRange: ['Seniors'],
      bookings: 'No bookings required.',
      bookingsRequired: false,
      meetingPoint: null,
      requirements: null,
      image: 'https://www.trumba.com/i/DgBpY5Z7rbRnjMvJ7LJHq5jB.jpg',
      status: null,
      position: [153.0241, -27.4691],
    })
  })

  it('falls back to a hash id, keeps rows without a position, and drops rows without a subject', () => {
    const list = parseCouncilEvents([
      { ...row, web_link: null, geolocation: null, eventimage: null, status: 'Booked out', bookingsrequired: null },
      { ...row, subject: undefined },
    ])
    expect(list).toHaveLength(1)
    expect(list[0].id).toMatch(/^h[0-9a-z]+$/)
    expect(list[0]).toMatchObject({ url: null, position: null, image: null, status: 'Booked out', bookingsRequired: null })
  })
})
