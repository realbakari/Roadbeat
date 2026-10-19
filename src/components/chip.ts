/**
 * Classes for a toggle chip (a button with aria-pressed): one size everywhere,
 * 28px tall with 14px text (36px on touch screens, from index.css). On is a
 * heavier brand ring and medium weight, so it reads by shape as well as colour.
 * `rounded-md` keeps it from looking like a status Badge.
 */
export function chipClass(on: boolean, extra = '') {
  const state = on ? 'bg-kumo-tint font-medium text-kumo-strong ring-2 ring-kumo-brand' : 'text-kumo-default ring-kumo-line hover:bg-kumo-tint'
  return `chip inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap ring ${state} ${extra}`
}
