import { describe, expect, it } from 'vitest'
import { parseBulletins, parseCameras, parseCentres, parseCouncilNotices, parseEnergexOutages } from './councilDashboard'

// Cut down from the dashboards' feeds as published on 16 October 2026.
const rights = { ownership: 'QIT Plus', disclaimer: 'The Owner accepts no responsibility for the correctness of the data provided in this feed' }

describe('parseBulletins', () => {
  it("reads each bulletin's title, text and Microsoft JSON dates", () => {
    const json = {
      type: 'FeatureCollection',
      rights,
      features: [
        {
          id: 8709574,
          type: 'Feature',
          geometry: null,
          properties: {
            id: 8709574,
            title: 'Flood siren testing in Fernvale and Lowood Thursday 29 October 2026 ',
            description: '<p>Somerset Regional Council will test its community flood early warning sirens on Thursday, 29 October.</p>',
            created: '/Date(1791953466970)/',
            updated: '/Date(1791953576997)/',
          },
        },
        { properties: { title: 'Queensland Fire &amp; Rescue\n\nRecruitment', description: null, created: '/Date(1790132404630)/', updated: null } },
        { properties: { title: null, description: 'No title', created: '/Date(1)/', updated: null } },
      ],
    }
    expect(parseBulletins(json)).toEqual([
      {
        title: 'Flood siren testing in Fernvale and Lowood Thursday 29 October 2026',
        description: '<p>Somerset Regional Council will test its community flood early warning sirens on Thursday, 29 October.</p>',
        created: 1791953466970,
        updated: 1791953576997,
      },
      { title: 'Queensland Fire & Rescue Recruitment', description: '', created: 1790132404630, updated: null },
    ])
  })

  it('rejects a response that is not a feature collection', () => {
    expect(() => parseBulletins('{"type":"FeatureCollection"}')).toThrow()
  })
})

describe('parseCentres', () => {
  it("keeps each centre's name, type, address, status and point as the council lists them", () => {
    const json = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            organisation: 'Fraser Coast Regional Council',
            buildingname: 'Community Sandbag Filling Point - Hervey Bay - Football Field Car Park',
            buildingtype: 'Sandbag Filling Point',
            buildingaddress: '225 Boundary Rd, Torquay QLD 4655, Australia',
            status: 'Open',
            note: '',
            group_id: 6104,
          },
          geometry: { type: 'Point', coordinates: [152.864761473022, -25.299838518227] },
        },
        { properties: { buildingname: 'No position', buildingtype: 'Evacuation Centre', buildingaddress: null, status: 'Open' }, geometry: null },
      ],
    }
    expect(parseCentres(json)).toEqual([
      {
        name: 'Community Sandbag Filling Point - Hervey Bay - Football Field Car Park',
        type: 'Sandbag Filling Point',
        address: '225 Boundary Rd, Torquay QLD 4655, Australia',
        status: 'Open',
        note: null,
        position: [152.864761473022, -25.299838518227],
      },
    ])
  })
})

describe('parseCameras', () => {
  it("keeps each camera's description, type, locality, image address and point", () => {
    const json = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [152.90006, -27.60364] },
          properties: { id: 174, url: null, description: 'Brisbane River - Goodna Boat Ramp, Goodna', direction: null, district: 'Div 2', locality: 'Goodna', image_url: 'https://portal.sightmaster.com.au/latest/3211', typeName: 'Flood Camera', additional_detail: '<p><span>Images are typically updated every 10 minutes.</span></p>', showInCameraPage: true },
        },
        { geometry: null, properties: { id: 1, description: 'No point', image_url: 'https://x/1.jpg' } },
        { geometry: { type: 'Point', coordinates: [1, 1] }, properties: { id: 2, description: 'No image', image_url: null } },
      ],
    }
    expect(parseCameras(json)).toEqual([
      { id: 174, description: 'Brisbane River - Goodna Boat Ramp, Goodna', type: 'Flood Camera', locality: 'Goodna', direction: null, image: 'https://portal.sightmaster.com.au/latest/3211', note: 'Images are typically updated every 10 minutes.', position: [152.90006, -27.60364] },
    ])
  })
})

describe('parseCouncilNotices', () => {
  it("reads a council's notice with its type, dates, answers and shape", () => {
    const json = {
      type: 'FeatureCollection',
      features: [
        {
          geometry: { type: 'LineString', coordinates: [[147.315366, -19.66873], [147.314714, -19.67519]] },
          properties: {
            id: 8104,
            outage_type: 'Water',
            road_name: 'Lena Rd, Mount Kelly',
            start_date: '2026-09-27T21:00:00Z',
            end_date: '2026-10-18T21:00:00Z',
            updated_on: '2026-09-25T01:41:36.9176237Z',
            responses: [
              { key: 'Incident', value: 'Planned' },
              { key: 'Short Description of Outage', value: 'Council will be undertaking planned maintenance works.' },
              { key: 'Location Description ', value: 'Lena Road, Mount Kelly' },
            ],
          },
        },
        { geometry: null, properties: { id: 1, outage_type: 'Water', road_name: 'No shape', start_date: null, end_date: null, updated_on: null } },
      ],
    }
    expect(parseCouncilNotices(json)).toEqual([
      {
        id: 8104,
        type: 'Water',
        title: 'Lena Rd, Mount Kelly',
        details: 'Council will be undertaking planned maintenance works.',
        incident: 'Planned',
        start: Date.parse('2026-09-27T21:00:00Z'),
        end: Date.parse('2026-10-18T21:00:00Z'),
        updated: Date.parse('2026-09-25T01:41:36.9176237Z'),
        geometry: { type: 'LineString', coordinates: [[147.315366, -19.66873], [147.314714, -19.67519]] },
      },
    ])
  })
})

describe('parseEnergexOutages', () => {
  it('reads an outage with either restore time format', () => {
    const outage = { event: 'INCD-987430-g', cause: 'Emergency Repairs', status: 'Awaiting', council: 'Ipswich City', postcode: '', suburb: 'CHUWAR', customersAffected: '19', restoreTime: '2026-10-16T12:30:00+10:00', etrFlag: 'UP', streets: ['ALLAWAH RD', 'HORTON DR'] }
    expect(parseEnergexOutages([{ Outage: outage }, { Outage: { ...outage, event: 'x', restoreTime: '/Date(1792110600000)/' } }, { Outage: { ...outage, suburb: '' } }])).toEqual([
      { event: 'INCD-987430-g', cause: 'Emergency Repairs', status: 'Awaiting', council: 'Ipswich City', suburb: 'CHUWAR', customers: 19, restore: Date.parse('2026-10-16T12:30:00+10:00'), streets: ['ALLAWAH RD', 'HORTON DR'] },
      { event: 'x', cause: 'Emergency Repairs', status: 'Awaiting', council: 'Ipswich City', suburb: 'CHUWAR', customers: 19, restore: 1792110600000, streets: ['ALLAWAH RD', 'HORTON DR'] },
    ])
  })

  it("rejects the platform's HTML error page", () => {
    expect(() => parseEnergexOutages('<!DOCTYPE html>')).toThrow()
  })
})

// How councils with nothing to list answered on 17 October 2026: Weipa Town's
// getCameras and Cloncurry's dashOutages. Each means "none", not a fault.
describe('optional feeds that list nothing', () => {
  it('reads a null feature list as no cameras', () => {
    expect(parseCameras({ type: null, features: null, rights })).toEqual([])
  })

  it('reads a bare empty array as no notices', () => {
    expect(parseCouncilNotices([])).toEqual([])
  })

  it('reads an empty Energex relay as no outages', () => {
    expect(parseEnergexOutages([])).toEqual([])
    expect(parseEnergexOutages(null)).toEqual([])
  })
})
