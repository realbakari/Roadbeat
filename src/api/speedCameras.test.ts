import { describe, expect, it } from 'vitest'
import { parseSpeedCameras } from './speedCameras'

const placemark = (name: string, site: string, coords: string) =>
  `<Placemark><name>${name}</name><description><![CDATA[${site}]]></description><styleUrl>#icon-503</styleUrl><Point><coordinates>
            ${coords}
          </coordinates></Point></Placemark>`

describe('parseSpeedCameras', () => {
  it('reads each camera type, site and published point', () => {
    const kml = `<kml><Document><Folder>
      ${placemark('Camera type: Fixed speed camera', 'Airport Link Tunnel (Northbound), Windsor', '153.032944,-27.425768,0')}
      ${placemark('Camera type: combined red light/speed camera', 'Kingston Road, Loganlea at intersection with Station Road', '153.121849,-27.668638,0')}
      ${placemark('Camera type: red light camera\n', 'Ann St &amp; Edward St, Brisbane City', '153.0275,-27.4655,0')}
      ${placemark('Camera type: Point-to-point speed camera system', 'Legacy Way (Toowong to Kelvin Grove)', '152.99,-27.47,0')}
    </Folder></Document></kml>`
    const cams = parseSpeedCameras(kml)
    expect(cams.map((c) => c.type)).toEqual(['fixed', 'combined', 'redlight', 'p2p'])
    expect(cams[0]).toEqual({ id: 'fixed-153.03294--27.42577', type: 'fixed', site: 'Airport Link Tunnel (Northbound), Windsor', position: [153.032944, -27.425768] })
    expect(cams[2].site).toBe('Ann St & Edward St, Brisbane City')
  })

  it('leaves out placemarks with no type it names or no point', () => {
    const kml = placemark('Something else', 'x', '153,-27,0') + '<Placemark><name>Camera type: Fixed speed camera</name><LineString><coordinates>1,2 3,4</coordinates></LineString></Placemark>'
    expect(parseSpeedCameras(kml)).toEqual([])
    expect(parseSpeedCameras('')).toEqual([])
  })
})
