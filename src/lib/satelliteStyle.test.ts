import { describe, expect, it } from 'vitest'
import { coveringFills, imageBeforeLayer, imageFadedZoom, imageOpacity, labelLayers, type StyleLayer } from './satelliteStyle'

// The head of OpenFreeMap's positron style, as served in October 2026.
const POSITRON: StyleLayer[] = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill', 'source-layer': 'water' },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'tunnel_motorway_casing', type: 'line', 'source-layer': 'transportation' },
  { id: 'highway_minor', type: 'line', 'source-layer': 'transportation' },
  { id: 'boundary_2', type: 'line', 'source-layer': 'boundary' },
  { id: 'highway-name-minor', type: 'symbol', 'source-layer': 'transportation_name', layout: { 'text-field': '{name}' } },
  { id: 'highway-shield-non-us', type: 'symbol', 'source-layer': 'transportation_name', layout: { 'icon-image': 'road_{ref_length}' } },
  { id: 'label_city', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': '{name}' } },
]

// The head of OpenFreeMap's dark style, as served in October 2026: a label before its buildings.
const DARK: StyleLayer[] = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill', 'source-layer': 'water' },
  { id: 'water_name', type: 'symbol', 'source-layer': 'water_name', layout: { 'text-field': '{name}' } },
  { id: 'building', type: 'fill', 'source-layer': 'building' },
  { id: 'aeroway-runway-casing', type: 'line', 'source-layer': 'aeroway' },
  { id: 'aeroway-area', type: 'fill', 'source-layer': 'aeroway' },
  { id: 'highway_area', type: 'fill', 'source-layer': 'transportation' },
  { id: 'highway_minor', type: 'line', 'source-layer': 'transportation' },
  { id: 'qldt-buildings-3d', type: 'fill-extrusion', 'source-layer': 'building' },
  { id: 'event-shapes', type: 'fill' },
]

describe('imageBeforeLayer', () => {
  it('puts the image under the first road, so roads and names draw on top', () => {
    expect(imageBeforeLayer(POSITRON)).toBe('tunnel_motorway_casing')
  })

  it('falls back to the first label when a style has no roads', () => {
    expect(imageBeforeLayer(POSITRON.filter((l) => l['source-layer'] !== 'transportation' && l['source-layer'] !== 'boundary'))).toBe('highway-name-minor')
  })
})

describe('coveringFills', () => {
  it("lists the base map's buildings and airports drawn above the image", () => {
    expect(imageBeforeLayer(DARK)).toBe('water_name')
    expect(coveringFills(DARK, 'water_name')).toEqual(['building', 'aeroway-area'])
  })

  it("leaves road areas, the 3D buildings switch and Roadbeat's own layers alone", () => {
    expect(coveringFills(DARK, 'water_name')).not.toContain('highway_area')
    expect(coveringFills(DARK, 'water_name')).not.toContain('qldt-buildings-3d')
    expect(coveringFills(DARK, 'water_name')).not.toContain('event-shapes')
  })

  it('lists nothing below the image, or when it has no layer to sit under', () => {
    expect(coveringFills(POSITRON, 'tunnel_motorway_casing')).toEqual([])
    expect(coveringFills(DARK, undefined)).toEqual([])
  })
})

describe('labelLayers', () => {
  it('lists the text layers, not icon-only ones like road shields', () => {
    expect(labelLayers(POSITRON)).toEqual(['highway-name-minor', 'label_city'])
  })
})

describe('imageOpacity', () => {
  it("fades the image out past the source's sharpest zoom", () => {
    expect(imageOpacity(6)).toEqual(['interpolate', ['linear'], ['zoom'], 7, 1, 10, 0.15])
    expect(imageFadedZoom(6)).toBe(10)
  })
})
