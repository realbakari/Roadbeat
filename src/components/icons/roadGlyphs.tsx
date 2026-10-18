import { CarProfileIcon, CarSimpleIcon, type Icon, type IconProps } from '@phosphor-icons/react'
import { forwardRef } from 'react'

// Road event pictograms Phosphor lacks, drawn in the style of the ones
// Queenslanders already know from QLDTraffic and road signs: a crashed car, a
// queue of cars for congestion, and the worker with a shovel from the
// roadworks sign. Each takes Phosphor's props (size, color), so it can stand
// in for a Phosphor icon on the map and in lists. They're Roadbeat's own
// drawings, not copies of QLDTraffic's image files.

type Props = IconProps & { title?: string }

/** The 256-unit Phosphor-sized canvas each glyph draws in. */
const Frame = forwardRef<SVGSVGElement, Props & { children: React.ReactNode }>(function Frame({ size = 16, color = 'currentColor', title, children, ...rest }, ref) {
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...(rest as React.SVGProps<SVGSVGElement>)}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
})

/** A car tipped forward with impact lines: QLDTraffic's crash pictogram. */
export const CrashIcon = forwardRef<SVGSVGElement, Props>(function CrashIcon(p, ref) {
  return (
    <Frame ref={ref} {...p}>
    <>
      <g transform="rotate(-24 116 150)">
        <svg x="8" y="40" width="200" height="200">
          <CarProfileIcon size={200} weight="fill" color={p.color ?? 'currentColor'} />
        </svg>
      </g>
      <g stroke={p.color ?? 'currentColor'} strokeWidth="24" strokeLinecap="round">
        <line x1="214" y1="150" x2="244" y2="138" />
        <line x1="206" y1="184" x2="238" y2="196" />
        <line x1="190" y1="210" x2="204" y2="238" />
      </g>
    </>
    </Frame>
  )
}) as unknown as Icon

/** Two cars nose to tail, seen from the front: QLDTraffic's congestion pictogram. */
export const QueueIcon = forwardRef<SVGSVGElement, Props>(function QueueIcon(p, ref) {
  const c = p.color ?? 'currentColor'
  return (
    <Frame ref={ref} {...p}>
    <>
      <svg x="52" y="8" width="152" height="120">
        <CarSimpleIcon size={152} weight="fill" color={c} />
      </svg>
      <svg x="28" y="104" width="200" height="150">
        <CarSimpleIcon size={200} weight="fill" color={c} />
      </svg>
    </>
    </Frame>
  )
}) as unknown as Icon

/** A worker digging beside a mound: the figure on Australia's roadworks sign. */
export const WorkerIcon = forwardRef<SVGSVGElement, Props>(function WorkerIcon(p, ref) {
  const c = p.color ?? 'currentColor'
  return (
    <Frame ref={ref} {...p}>
    <>
      <circle cx="96" cy="44" r="24" />
      <g stroke={c} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M100 84 L80 150" />
        <path d="M80 150 L50 218" />
        <path d="M80 150 L118 214" />
        <path d="M96 100 L150 124" />
      </g>
      <g stroke={c} strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M128 92 L196 196" />
      </g>
      <path d="M180 190 l34 -14 l14 32 l-34 14 z" />
      <path d="M150 236 C170 196 222 190 248 236 Z" />
    </>
    </Frame>
  )
}) as unknown as Icon
