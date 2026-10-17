import { describe, expect, it } from 'vitest'
import { imageBeforeLayer, imageOpacity, labelLayers, type StyleLayer } from './satelliteStyle'

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

describe('imageBeforeLayer', () => {
  it('puts the image under the first road, so roads and names draw on top', () => {
    expect(imageBeforeLayer(POSITRON)).toBe('tunnel_motorway_casing')
  })

  it('falls back to the first label when a style has no roads', () => {
    expect(imageBeforeLayer(POSITRON.filter((l) => l['source-layer'] !== 'transportation' && l['source-layer'] !== 'boundary'))).toBe('highway-name-minor')
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
  })
})
