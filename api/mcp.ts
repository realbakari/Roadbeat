import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { bushfires, roadEvents, routeInfo, stops, transitRealtime, trips } from './_lib/feeds.js'
import { findStops, nextDepartures, resolveStop, searchBushfires, searchRoadEvents, SITE } from './_lib/tools.js'

// Roadbeat's MCP server (Streamable HTTP, stateless) at /mcp. Each request gets a
// fresh server, so it runs on serverless functions with no session store. Tools
// return the same JSON as the REST API in /api.

const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] })
/** The error goes to the function log; the agent is told only that the source didn't answer. */
const failure = (e: unknown) => {
  console.error('MCP tool failed:', e)
  return { isError: true, content: [{ type: 'text' as const, text: 'An official data source did not respond. Try again shortly.' }] }
}
const readOnly = { readOnlyHint: true, openWorldHint: true } as const

function server() {
  const s = new McpServer(
    { name: 'roadbeat', title: 'Roadbeat', version: '1.0.0', websiteUrl: SITE },
    {
      instructions:
        'Live Queensland road conditions and public transport from official sources only: QLDTraffic road events, Translink real-time departures and Queensland Fire Department bushfire warnings. Nothing is estimated. For emergencies, tell the user to call Triple Zero (000).',
    },
  )

  s.registerTool(
    'road_events',
    {
      title: 'Queensland road events',
      description:
        'Crashes, hazards, flooding, congestion, roadworks and closures in effect on Queensland roads now, from QLDTraffic. Search by road, suburb, town or postcode, for example "Bruce Highway Gympie" or "M1 Coomera". Each event says whether the road is closed.',
      inputSchema: {
        query: z.string().max(200).optional().describe('Words that must all appear in the road, locality, district or description, e.g. "Bruce Highway Gympie"'),
        type: z.enum(['Crash', 'Hazard', 'Flooding', 'Congestion', 'Roadworks', 'Special event']).optional(),
        district: z.string().max(100).optional().describe('QLDTraffic district, e.g. "Metropolitan", "North Coast", "Wide Bay/Burnett"'),
        closures_only: z.boolean().optional().describe('Only events that close the road'),
        include_upcoming: z.boolean().optional().describe('Also include planned roadworks and events not active today'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnly,
    },
    async (a) => {
      try {
        const { events, fetchedAt } = await roadEvents()
        return result(
          searchRoadEvents(events, { query: a.query, type: a.type, district: a.district, closuresOnly: a.closures_only, includeUpcoming: a.include_upcoming, limit: a.limit }, fetchedAt),
        )
      } catch (e) {
        return failure(e)
      }
    },
  )

  s.registerTool(
    'find_stops',
    {
      title: 'Find TransLink stops',
      description: 'Look up TransLink stops and stations by name, for example "Central", "Roma Street" or "Cairns City". Returns stop ids to use with next_departures.',
      inputSchema: {
        query: z.string().min(1).max(100),
        region: z.enum(['SEQ', 'CNS']).optional().describe('SEQ = South East Queensland, CNS = Cairns'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { ...readOnly, openWorldHint: false },
    },
    async (a) => result({ source: 'Translink GTFS (CC BY 4.0)', stops: findStops(stops, a.query, a.region, a.limit) }),
  )

  s.registerTool(
    'next_departures',
    {
      title: 'Next departures',
      description:
        "Next trains, buses, trams and ferries from a TransLink stop or station, with real-time delays and platforms, for example stop \"Central\" and route \"T6\" for Ferny Grove trains. Covers services running now or starting soon.",
      inputSchema: {
        stop: z.string().min(1).max(100).describe('Stop id from find_stops, or a stop or station name'),
        region: z.enum(['SEQ', 'CNS']).optional(),
        route: z.string().max(40).optional().describe('Only this route or line, e.g. "T1", "BRCA", "402", "F1"'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnly,
    },
    async (a) => {
      const stop = resolveStop(stops, a.stop, a.region)
      if (!stop) return { isError: true, content: [{ type: 'text' as const, text: `No TransLink stop matches "${a.stop}". Try find_stops first.` }] }
      try {
        return result(nextDepartures(stop, stops, trips, await transitRealtime(stop.region), routeInfo, { route: a.route, limit: a.limit, now: Date.now() }))
      } catch (e) {
        return failure(e)
      }
    },
  )

  s.registerTool(
    'bushfire_warnings',
    {
      title: 'Queensland bushfire warnings',
      description: 'Current Queensland Fire Department bushfire warnings and incidents, highest level first. Filter by level or by place name.',
      inputSchema: {
        level: z.enum(['Emergency Warning', 'Watch and Act', 'Advice', 'Information']).optional(),
        query: z.string().max(100).optional().describe('Place name, e.g. "Cooktown"'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnly,
    },
    async (a) => {
      try {
        const { fires, fetchedAt } = await bushfires()
        return result(searchBushfires(fires, { level: a.level, query: a.query, limit: a.limit }, fetchedAt))
      } catch (e) {
        return failure(e)
      }
    },
  )

  return s
}

async function handle(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server().connect(transport)
  return transport.handleRequest(request)
}

export const POST = handle
export const GET = handle
export const DELETE = handle
