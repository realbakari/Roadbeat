import { StoryMark } from '../components/NewsStoryRow'
import { timeAgo } from '../lib/format'
import { storySourceLine, type NewsStory } from '../lib/newsStories'

/**
 * The dashboard's "What's happening" strip: the stories headlineStories() picks,
 * with official notices marked as such. Each opens the story in the app.
 */
export function WhatsHappening({ stories, now }: { stories: NewsStory[] | null; now: number }) {
  if (!stories?.length) return null
  return (
    <section aria-label="What's happening" className="grid shrink-0 gap-2 rounded-xl bg-kumo-base p-3 ring ring-kumo-line">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-kumo-strong">What's happening</h2>
        <span className="text-xs text-kumo-subtle">Headlines from news outlets and official sources. News reports aren't verified.</span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {stories.map((s) => (
          <li key={s.id}>
            <a href={`/#news/${encodeURIComponent(s.id)}`} className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-kumo-tint">
              <StoryMark story={s} />
              <span className="grid min-w-0 gap-0.5">
                <span className="line-clamp-2 text-sm font-medium text-kumo-strong">{s.items[0].title}</span>
                <span className="truncate text-xs text-kumo-subtle">
                  {storySourceLine(s)} · {timeAgo(s.latest, now)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
