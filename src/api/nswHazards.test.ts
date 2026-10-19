import { describe, expect, it } from 'vitest'
import { nswHazardHeading, nswHazardLines, parseNswHazards } from './nswHazards'

const feature = (id: number, lat: number, over: Record<string, unknown> = {}) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [153.52, lat] },
  properties: {
    mainCategory: 'BREAKDOWN',
    subCategoryA: 'Truck',
    displayName: 'BREAKDOWN Truck',
    headline: '',
    incidentKind: 'Unplanned',
    isMajor: false,
    ended: false,
    adviceA: 'Reduce your speed',
    adviceB: 'Exercise caution',
    adviceC: ' ',
    otherAdvice: '<p><strong>Use the left lane.</strong>&nbsp;</p>',
    diversions: '',
    attendingGroups: ['Transport for NSW'],
    expectedDelay: -1,
    speedLimit: -1,
    created: 1792384363000,
    lastUpdated: 1792384363960,
    roads: [
      {
        mainStreet: 'M1 Pacific Motorway',
        locationQualifier: 'just past',
        crossStreet: 'Gold Coast Highway',
        suburb: 'Tweed Heads West',
        region: 'North Coast NSW',
        impactedLanes: [{ affectedDirection: 'Northbound', extent: 'Affected', description: 'Shoulder' }],
      },
    ],
    encodedPolylines: [],
    ...over,
  },
})

describe('parseNswHazards', () => {
  it('keeps hazards north of the border line, with their published fields', () => {
    const [h, ...rest] = parseNswHazards('incident', { features: [feature(291576, -28.2), feature(1, -33.8)] })
    expect(rest).toEqual([])
    expect(h).toMatchObject({
      id: 'incident-291576',
      sourceId: 291576,
      category: 'BREAKDOWN',
      subCategory: 'Truck',
      title: 'BREAKDOWN Truck',
      advice: ['Reduce your speed', 'Exercise caution'],
      otherAdvice: 'Use the left lane.',
      diversions: null,
      expectedDelay: null,
      speedLimit: null,
      attending: ['Transport for NSW'],
      roads: [{ street: 'M1 Pacific Motorway', qualifier: 'just past', cross: 'Gold Coast Highway', lanes: [{ direction: 'Northbound', extent: 'Affected', description: 'Shoulder' }] }],
    })
    expect(nswHazardHeading(h)).toBe('Breakdown · Truck')
    const [fourWd] = parseNswHazards('incident', { features: [feature(8, -28.9, { mainCategory: 'OPEN TO  4WD ONLY', subCategoryA: 'null' })] })
    expect(nswHazardHeading(fourWd)).toBe('Open to 4WD only')
  })

  it('writes a planned hazard’s schedule from its published periods, in NSW time as written', () => {
    const periods = [
      { closureType: 'ROAD_CLOSURE', roadextent: 'Closed', roadtype: 'Tunnel', direction: 'Both directions', finishTime: '5:00am', fromDay: 'Monday', startTime: '7:00pm', toDay: '' },
      { closureType: 'ROAD_CLOSURE', roadextent: 'Closed', roadtype: 'Road', direction: 'Both directions', finishTime: '', fromDay: 'Every Day', startTime: 'all day', toDay: '' },
      { fromDay: '', startTime: '' },
    ]
    const [h] = parseNswHazards('roadwork', { features: [feature(7, -28.6, { periods })] })
    expect(h?.schedule).toEqual(['Monday, 7:00pm to 5:00am: Tunnel closed, both directions', 'Every Day, all day: Road closed, both directions'])
  })

  it('keeps a hazard whose published extent reaches the border area, even if its point is south of it', () => {
    // From 29.0° S down to 30.0° S along 153.0° E.
    const line = '~`_pD_yyd\\~hbE?'
    const [h] = parseNswHazards('roadwork', { features: [feature(2, -30, { encodedPolylines: [{ coords: line }] })] })
    expect(nswHazardLines(h!)[0]).toEqual([
      [153, -29],
      [153, -30],
    ])
  })

  it('skips ended hazards, items without a point or category, and reads "null" as missing', () => {
    const out = parseNswHazards('flood', {
      features: [feature(3, -28.5, { ended: true }), feature(4, -28.5, { mainCategory: '' }), { id: 5, geometry: null, properties: {} }, feature(6, -28.5, { subCategoryA: 'null' })],
    })
    expect(out.map((h) => [h.id, h.subCategory])).toEqual([['flood-6', null]])
  })
})
