/** Review helpers: `?state=offline|empty|loading|permission|...` and `?theme=light|dark` force a screen state. */
export function getForcedState(): string | null {
  if (typeof window === 'undefined') return null
  if (/(^|\/)biz(?:\/|$)/.test(window.location.pathname) && !isBizPreview()) return null
  return new URLSearchParams(window.location.search).get('state')
}

/** Business examples only run in framed development previews. */
export function isBizPreview() {
  return import.meta.env.DEV && typeof window !== 'undefined' &&
    window.self !== window.top && /(^|\/)biz(?:\/|$)/.test(window.location.pathname) && isEmbed()
}

export function isForced(state: string) {
  return getForcedState() === state
}

/** Screen Index frames load screens with `?embed=1`; they must not write resume points. */
export function isEmbed() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('embed')
}
