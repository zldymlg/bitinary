import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '@/lib/usePersistentState'

export type Lang = 'tl' | 'en'
type Ctx = { lang: Lang; setLang: (l: Lang) => void; chosen: boolean; t: (tl: string, en: string) => string }
const C = createContext<Ctx | null>(null)

const queryLang = (): Lang | null => {
  const l = new URLSearchParams(window.location.search).get('lang')
  return l === 'tl' || l === 'en' ? l : null
}

/** English unless the device's primary language is Tagalog/Filipino. */
export const deviceLang = (): Lang => {
  if (typeof navigator === 'undefined') return 'en'
  const primary = navigator.languages?.[0] || navigator.language || ''
  return /^(tl|fil)([-_]|$)/i.test(primary) ? 'tl' : 'en'
}

/** Tagalog/English ito; inuuna ang `?lang=` para sa Screen Index frames. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<Lang | null>('lang', null)
  const forced = useMemo(queryLang, [])
  const lang: Lang = forced ?? stored ?? deviceLang()
  useEffect(() => {
    document.documentElement.lang = lang === 'tl' ? 'tl' : 'en'
  }, [lang])
  const t = useCallback((tl: string, en: string) => (lang === 'en' ? en : tl), [lang])
  return <C.Provider value={{ lang, setLang: setStored, chosen: !!stored || !!forced, t }}>{children}</C.Provider>
}

/** Pinapagamit nito sa Business app ang sariling language setting sa shared components. */
export function LangOverride({ lang, setLang, chosen = true, children }: { lang: Lang; setLang: (l: Lang) => void; chosen?: boolean; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = lang === 'tl' ? 'tl' : 'en'
  }, [lang])
  const t = useCallback((tl: string, en: string) => (lang === 'en' ? en : tl), [lang])
  return <C.Provider value={{ lang, setLang, chosen, t }}>{children}</C.Provider>
}

export function useLang() {
  const c = useContext(C)
  if (!c) throw new Error('useLang outside LangProvider')
  return c
}

/** Shorthand: const t = useT(); t('Tagalog', 'English') */
export function useT() {
  return useLang().t
}
