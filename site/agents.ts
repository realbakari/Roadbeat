// Machine-readable descriptions of Roadbeat's public API (api/) and MCP server
// (api/mcp.ts), written into the build as /openapi.json and /.well-known/mcp.json.
// Keep these in step with the endpoints' query schemas.

const limit = { name: 'limit', in: 'query', description: 'Most results to return (1 to 50).', schema: { type: 'integer', minimum: 1, maximum: 50 } }
const region = { name: 'region', in: 'query', description: 'SEQ (South East Queensland) or CNS (Cairns).', schema: { type: 'string', enum: ['SEQ', 'CNS'] } }
const errors = {
  '400': { description: 'A query parameter is invalid. The body lists which.' },
  '502': { description: 'The official source did not respond. Try again shortly.' },
}
const ok = (description: string) => ({ description, content: { 'application/json': { schema: { type: 'object' } } } })

/** OpenAPI 3.1 description of the public API. `base` is the site address, or empty for a relative server URL. */
export function openApi(base: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Roadbeat API',
      version: '1.0.0',
      description:
        'Live Queensland road events, Translink departures and bushfire warnings, as the official sources publish them. Free, no key, read-only. Data © State of Queensland, CC BY 4.0: credit the source named in each response.',
    },
    servers: [{ url: base || '/' }],
    paths: {
      '/api/events': {
        get: {
          operationId: 'roadEvents',
          summary: 'Road events in effect on Queensland roads',
          parameters: [
            { name: 'q', in: 'query', description: 'Words that must all appear in the road, locality, district or description, e.g. "Bruce Highway Gympie".', schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['Crash', 'Hazard', 'Flooding', 'Congestion', 'Roadworks', 'Special event'] } },
            { name: 'district', in: 'query', description: 'QLDTraffic district, e.g. "Metropolitan".', schema: { type: 'string' } },
            { name: 'closures', in: 'query', description: 'Only events that close the road.', schema: { type: 'boolean' } },
            { name: 'upcoming', in: 'query', description: 'Also include planned roadworks and events not active today.', schema: { type: 'boolean' } },
            limit,
          ],
          responses: { '200': ok('Matching events, highest priority first.'), ...errors },
        },
      },
      '/api/stops': {
        get: {
          operationId: 'findStops',
          summary: 'Translink stops and stations by name',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, region, limit],
          responses: { '200': ok('Matching stops, stations first.'), '400': errors['400'] },
        },
      },
      '/api/departures': {
        get: {
          operationId: 'nextDepartures',
          summary: 'Next departures from a stop or station, from Translink real-time',
          parameters: [
            { name: 'stop', in: 'query', required: true, description: 'Stop id from /api/stops, or a stop or station name.', schema: { type: 'string' } },
            region,
            { name: 'route', in: 'query', description: 'Only this route or line, e.g. "T1", "402", "F1".', schema: { type: 'string' } },
            limit,
          ],
          responses: { '200': ok('Departures, soonest first.'), '404': { description: 'No stop matches.' }, ...errors },
        },
      },
      '/api/bushfires': {
        get: {
          operationId: 'bushfireWarnings',
          summary: 'Queensland Fire Department warnings and incidents',
          parameters: [
            { name: 'level', in: 'query', schema: { type: 'string', enum: ['Emergency Warning', 'Watch and Act', 'Advice', 'Information'] } },
            { name: 'q', in: 'query', description: 'Place name.', schema: { type: 'string' } },
            limit,
          ],
          responses: { '200': ok('Warnings, highest level first.'), ...errors },
        },
      },
    },
  }
}

/** MCP server card, for clients that discover servers at /.well-known/mcp. */
export function mcpCard(base: string) {
  return {
    name: 'roadbeat',
    title: 'Roadbeat',
    version: '1.0.0',
    description: 'Live Queensland road events, Translink departures and bushfire warnings from official sources. Read-only, no key.',
    websiteUrl: base || undefined,
    transport: { type: 'streamable-http', url: `${base}/mcp` },
    authentication: { required: false },
    tools: [
      { name: 'road_events', description: 'Road events in effect on Queensland roads, searchable by road and place.' },
      { name: 'find_stops', description: 'Translink stops and stations by name.' },
      { name: 'next_departures', description: 'Next departures from a stop or station, with real-time delays.' },
      { name: 'bushfire_warnings', description: 'Current Queensland Fire Department warnings and incidents.' },
    ],
    documentation: `${base}/llms.txt`,
  }
}
