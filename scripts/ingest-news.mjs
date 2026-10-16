// Reads every news monitor feed once, the same way api/news-ingest.ts does, and
// prints what each source gave and the stories it groups into. Nothing is stored.
// Run with `npm run news:ingest` to check the feeds from your own machine.
import { createServer } from 'vite'

// Vite loads the TypeScript server modules, so this runs without a build.
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { ingest } = await server.ssrLoadModule('/api/_lib/newsIngest.ts')
  const { groupStories, publisherList, storyLocatedLine } = await server.ssrLoadModule('/src/lib/newsStories.ts')
  const started = Date.now()
  const snapshot = await ingest(null)
  console.log(`Read ${snapshot.sources.length} feeds in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  console.table(snapshot.sources.map(({ id, publisher, ok, count, error }) => ({ id, publisher, ok, items: count, error: error ?? '' })))

  const stories = groupStories(snapshot.items)
  const located = stories.filter((s) => s.places.length).length
  const onRoads = stories.filter((s) => s.roads.length).length
  console.log(`${snapshot.items.length} items in ${stories.length} stories; ${located} located on the map, ${onRoads} on a named road\n`)
  for (const s of stories.slice(0, Number(process.argv[2] ?? 40))) {
    console.log(`[${s.kind}${s.live ? ', live blog' : ''}] ${s.items[0].title}\n    Reported by ${publisherList(s.publishers)} · ${storyLocatedLine(s) ?? 'No place matched'}`)
  }
  if (snapshot.sources.some((s) => !s.ok)) process.exitCode = 1
} finally {
  await server.close()
}
