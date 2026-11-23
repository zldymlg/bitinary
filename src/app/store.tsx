import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePersistentState } from '@/lib/usePersistentState'
import { itineraries, type Stop } from '@/data/itineraries'
import type { Moment } from '@/data/moments'
import type { Expression } from '@/components/mascot/Jimbot'
import { supabase } from '@/lib/supabase'

export type ToastMsg = { id: number; text: string; expression?: Expression; action?: { label: string; to: string } }
export type Panel = { type: 'shop'; id: string } | { type: 'itinerary'; id: string } | { type: 'jimbot' } | null

type Store = {
  onboarded: boolean
  setOnboarded: (v: boolean) => void
  saved: string[]
  toggleSaved: (id: string) => void
  removeSaved: (id: string) => void
  itineraryStops: Record<string, Stop[]>
  setItineraryStops: (id: string, stops: Stop[]) => void
  addStop: (itId: string, stop: Stop) => void
  myMoments: Moment[]
  addMoment: (m: Moment) => boolean
  removeMoment: (id: string) => void
  dataSaver: boolean
  setDataSaver: (v: boolean) => void
  subtitles: boolean
  setSubtitles: (v: boolean) => void
  installDismissed: boolean
  setInstallDismissed: (v: boolean) => void
  cameraTipSeen: boolean
  setCameraTipSeen: (v: boolean) => void
  toast: ToastMsg | null
  showToast: (t: Omit<ToastMsg, 'id'>) => void
  dismissToast: () => void
  panel: Panel
  setPanel: (p: Panel) => void
  resetAll: () => void
}

const Ctx = createContext<Store | null>(null)
// Limitado ang local Moments list para hindi lumaki nang walang hanggan ang browser storage.
const MAX_MOMENTS = 20

export function StoreProvider({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = usePersistentState('onboarded', false)
  const [saved, setSaved] = usePersistentState<string[]>('saved', [])
  const [itineraryStops, setStopsMap] = usePersistentState<Record<string, Stop[]>>('itineraryStops', {})
  const [myMoments, setMoments] = usePersistentState<Moment[]>('moments', [])
  const [dataSaver, setDataSaver] = usePersistentState('dataSaver', false)
  const [subtitles, setSubtitles] = usePersistentState('subtitles', true)
  const [installDismissed, setInstallDismissed] = usePersistentState('installDismissed', false)
  const [cameraTipSeen, setCameraTipSeen] = usePersistentState('cameraTipSeen', false)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [panel, setPanel] = useState<Panel>(null)

  useEffect(() => {
    let request = 0
    const loadSavedPlaces = async (userId: string | null) => {
      const currentRequest = ++request
      if (!userId) {
        setSaved([])
        return
      }

      setSaved([])
      const { data, error } = await supabase
        .from('saved_places')
        .select('business_id')
        .eq('user_id', userId)

      if (error) {
        console.error('Could not load saved businesses:', error.message)
        return
      }
      if (currentRequest === request) setSaved((data ?? []).map((row) => row.business_id))
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void loadSavedPlaces(session?.user.id ?? null)
      }
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not read the current session for saved businesses:', error.message)
        return
      }
      void loadSavedPlaces(data.session?.user.id ?? null)
    }).catch((error: unknown) => {
      console.error('Could not read the current session for saved businesses:', error)
    })

    return () => {
      request += 1
      authListener.subscription.unsubscribe()
    }
  }, [setSaved])

  const showToast = useCallback((t: Omit<ToastMsg, 'id'>) => setToast({ ...t, id: Date.now() }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const toggleSaved = useCallback(
    (id: string) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    [setSaved],
  )
  const removeSaved = useCallback((id: string) => setSaved((places) => places.filter((placeId) => placeId !== id)), [setSaved])
  const setItineraryStops = useCallback(
    (id: string, stops: Stop[]) => setStopsMap((m) => ({ ...m, [id]: stops })),
    [setStopsMap],
  )
  const addStop = useCallback(
    (itId: string, stop: Stop) =>
      setStopsMap((m) => {
        const base = m[itId] ?? itineraries.find((i) => i.id === itId)?.stops ?? []
        if (base.some((s) => s.placeId && s.placeId === stop.placeId)) return m
        return { ...m, [itId]: [...base, stop] }
      }),
    [setStopsMap],
  )
  const addMoment = useCallback(
    (mo: Moment) => {
      let ok = true
      setMoments((list) => {
        const next = [mo, ...list]
        if (next.length > MAX_MOMENTS) ok = false
        return next.slice(0, MAX_MOMENTS)
      })
      return ok
    },
    [setMoments],
  )
  const removeMoment = useCallback((id: string) => setMoments((list) => list.filter((moment) => moment.id !== id)), [setMoments])

  const resetAll = useCallback(() => {
    setOnboarded(false)
    setSaved([])
    setStopsMap({})
    setMoments([])
    setCameraTipSeen(false)
    setInstallDismissed(false)
  }, [setOnboarded, setSaved, setStopsMap, setMoments, setCameraTipSeen, setInstallDismissed])

  const value = useMemo<Store>(
    () => ({
      onboarded,
      setOnboarded,
      saved,
      toggleSaved,
      removeSaved,
      itineraryStops,
      setItineraryStops,
      addStop,
      myMoments,
      addMoment,
      removeMoment,
      dataSaver,
      setDataSaver,
      subtitles,
      setSubtitles,
      installDismissed,
      setInstallDismissed,
      cameraTipSeen,
      setCameraTipSeen,
      toast,
      showToast,
      dismissToast,
      panel,
      setPanel,
      resetAll,
    }),
    [onboarded, setOnboarded, saved, toggleSaved, removeSaved, itineraryStops, setItineraryStops, addStop, myMoments, addMoment, removeMoment, dataSaver, setDataSaver, subtitles, setSubtitles, installDismissed, setInstallDismissed, cameraTipSeen, setCameraTipSeen, toast, showToast, dismissToast, panel, resetAll],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOptionalStore() {
  return useContext(Ctx)
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}

export function useItineraryStops(id: string) {
  const { itineraryStops } = useStore()
  return itineraryStops[id] ?? itineraries.find((i) => i.id === id)?.stops ?? []
}
