// Queensland Government aerial imagery: the "Queensland imagery: Latest state
// program (all users)" basemap service, the best openly available imagery
// from 2022 or older, with Planet's Q3 2017 satellite mosaic where there are
// no aerial photos. The service's own licence (its item information) is CC
// BY-SA, with its copyright text on every copy and the acknowledgement below
// on any product containing it; data.qld.gov.au lists it as CC BY 4.0, so the
// stricter terms are followed. Planet's part is reproduced under the State's
// licence from Planet, so Roadbeat only shows the service's tiles, never
// copies or re-hosts them. The tile server sends CORS headers.

export const QLD_AERIAL_TILES = 'https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer/tile/{z}/{y}/{x}'

/** The deepest level of the service's tile cache (1:564). */
export const QLD_AERIAL_MAX_ZOOM = 20

/**
 * The service's published full extent (west, south, east, north), converted
 * from Web Mercator; outside it the tile server answers 404.
 */
export const QLD_AERIAL_BOUNDS: [number, number, number, number] = [137.74, -29.52, 153.76, -9.0]

/** The service's copyright text, as its licence asks to be shown on every copy, and its licence. */
export const QLD_AERIAL_CREDIT =
  'Includes material © State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development); © Planet Labs Netherlands B.V. reproduced under licence from Planet and Geoplex, all rights reserved, 2026. CC BY-SA.'

/** The acknowledgement the licence asks for on any digital product containing the imagery. */
export const QLD_AERIAL_ACKNOWLEDGEMENT =
  'In consideration of the State of Queensland permitting use of this data you acknowledge and agree that the State gives no warranty in relation to the data (including accuracy, reliability, completeness, currency or suitability) and accepts no liability (including without limitation, liability in negligence) for any loss, damage or costs (including consequential damage) relating to any use of the data.'

export const QLD_AERIAL_PAGE = 'https://www.data.qld.gov.au/dataset/queensland-imagery-latest-state-program-public-basemap-service'
