import { describe, expect, it } from 'vitest'
import { parseAirQuality, worstRating } from './airQuality'

// Cut down from the feed as published at 10:00 on 16 October 2026.
const XML = `<?xml version="1.0"?>
<airdata provider="Department of Environment and Science" state="Queensland" country="Australia">
  <category name="Air Quality" measurementhour="10" measurementdate="2026-10-16">
   <region name="North Queensland" information="https://apps.des.qld.gov.au/air-quality/region/?region=ayr">
     <station name="Ayr" information="https://apps.des.qld.gov.au/air-quality/stations/?station=ayr1" longitude="147.4059" latitude="-19.5839" measurementhour="10" measurementdate="2026-10-16">
       <measurement name="Particle PM10" rating_name="Good" rating="2" index="-2222">-1111</measurement>
       <measurement name="Ozone" rating_name="" rating="" index="">-9999</measurement>
     </station>
   </region>
   <region name="Whitsunday" information="https://apps.des.qld.gov.au/air-quality/region/?region=bow">
     <station name="West Mackay" information="https://apps.des.qld.gov.au/air-quality/stations/?station=mac" longitude="149.1549" latitude="-21.1595" measurementhour="10" measurementdate="2026-10-16">
       <measurement name="Visibility" rating_name="Very Good" rating="1" index="12.8">30</measurement>
       <measurement name="Particle PM10" rating_name="Good" rating="2" index="39.6">19.8</measurement>
       <measurement name="Particle PM2.5" rating_name="Good" rating="2" index="35.5">7.1</measurement>
     </station>
     <station name="No code" information="https://apps.des.qld.gov.au/air-quality/" longitude="1" latitude="1" measurementhour="10" measurementdate="2026-10-16"></station>
   </region>
  </category>
</airdata>`

describe('parseAirQuality', () => {
  const stations = parseAirQuality(XML)

  it("reads each station's code, region, position, hour and the department's ratings", () => {
    expect(stations.map((s) => s.id)).toEqual(['ayr1', 'mac'])
    const mac = stations[1]
    expect(mac).toMatchObject({ name: 'West Mackay', region: 'Whitsunday', position: [149.1549, -21.1595], measuredAt: Date.parse('2026-10-16T10:00:00+10:00') })
    expect(mac.measurements[1]).toEqual({ name: 'Particle PM10', units: 'µg/m³', value: 19.8, gap: null, index: 39.6, rating: 2, ratingName: 'Good' })
    expect(mac.measurements[0].units).toBe('Mm⁻¹')
  })

  it('keeps offline and missing readings as gaps, with no rating', () => {
    expect(stations[0].measurements).toEqual([
      { name: 'Particle PM10', units: 'µg/m³', value: null, gap: 'offline', index: null, rating: null, ratingName: null },
      { name: 'Ozone', units: 'ppm', value: null, gap: 'no data', index: null, rating: null, ratingName: null },
    ])
  })

  it("rates a station by its worst rated measurement, or not at all", () => {
    expect(worstRating(stations[1])).toBe(2)
    expect(worstRating(stations[0])).toBeNull()
  })
})
