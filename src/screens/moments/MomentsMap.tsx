import { Camera, Check, Pencil, Send, WifiOff, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMapInstance } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLang } from '@/app/i18n'
import { useStore } from '@/app/store'
import { Polaroid } from '@/components/cards/Polaroid'
import { FULL_BLEED } from '@/components/layout/nav'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import type { Moment, MomentPhoto } from '@/data/moments'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { useBreakpoint } from '@/lib/useMedia'
import { useOnline } from '@/lib/useOnline'
import { supabase } from '@/lib/supabase'
import { GalleryDock, GallerySheet, type GalleryFilter, type Snap } from './FloatingGallery'
import { MomentCardActions } from './MomentCardActions'

const DEFAULT_USER = { x: 760, y: 1050 }
type MapFilter = 'all' | 'food' | 'place' | 'mine' | 'today' | 'week' | 'month' | 'older'

type MomentRecord = Moment & { latitude: number | null; longitude: number | null; authorId: string | null; storagePath: string }
type TravelerAccount = { id: string; name: string; nickname: string; avatar_url: string | null; email: string | null }

function MapLibreSurface({ moments, onSelect }: { moments: MomentRecord[]; onSelect: (id: string) => void }) {
  const { lang, t } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMapInstance | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    maplibregl.setWorkerUrl(maplibreWorkerUrl)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [120.9842, 14.5995],
      zoom: 12.5,
      locale: {
        'NavigationControl.ZoomIn': t('Mag-zoom in', 'Zoom in'),
        'NavigationControl.ZoomOut': t('Mag-zoom out', 'Zoom out'),
        'NavigationControl.ResetBearing': t('I-reset ang direksyon', 'Reset bearing'),
      },
      style: {
        version: 8,
        sources: {
          fallback: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { kind: 'water' },
                  geometry: { type: 'Polygon', coordinates: [[[120.91, 14.52], [120.96, 14.52], [120.96, 14.72], [120.91, 14.72], [120.91, 14.52]]] },
                },
                {
                  type: 'Feature',
                  properties: { kind: 'water' },
                  geometry: { type: 'LineString', coordinates: [[120.91, 14.61], [120.98, 14.61], [121.04, 14.62], [121.1, 14.61]] },
                },
                {
                  type: 'Feature',
                  properties: { kind: 'road' },
                  geometry: { type: 'LineString', coordinates: [[120.96, 14.54], [120.98, 14.61], [120.99, 14.67], [121.01, 14.72]] },
                },
                {
                  type: 'Feature',
                  properties: { kind: 'road' },
                  geometry: { type: 'LineString', coordinates: [[120.94, 14.58], [121.02, 14.59], [121.08, 14.6]] },
                },
              ],
            },
          },
          osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' },
        },
        layers: [
          { id: 'fallback-background', type: 'background', paint: { 'background-color': '#f4e4d2' } },
          { id: 'fallback-water', type: 'fill', source: 'fallback', filter: ['==', ['get', 'kind'], 'water'], paint: { 'fill-color': '#b9dbe1' } },
          { id: 'fallback-roads', type: 'line', source: 'fallback', filter: ['==', ['get', 'kind'], 'road'], paint: { 'line-color': '#fffaf3', 'line-width': 3 } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.9 } },
        ],
      },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left')
    mapRef.current = map
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [lang, t])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const sync = () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      moments.forEach((moment) => {
        if (moment.latitude == null || moment.longitude == null) return
        const marker = document.createElement('button')
        marker.type = 'button'
        marker.dataset.momentMarker = moment.id
        marker.className = 'relative flex h-[54px] w-12 items-start justify-center bg-transparent p-0 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3A78F2]'
        marker.ariaLabel = moment.caption || moment.place
        const image = document.createElement('img')
        image.src = moment.src
        image.alt = ''
        image.className = 'relative z-[1] h-11 w-11 rounded-full border-[3px] border-primary bg-white object-cover shadow-[0_6px_14px_-4px_rgba(58,26,14,0.55)]'
        marker.append(image)
        const pointer = document.createElement('span')
        pointer.className = 'absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-primary'
        pointer.setAttribute('aria-hidden', 'true')
        marker.append(pointer)
        marker.addEventListener('click', () => onSelectRef.current(moment.id))
        const mapMarker = new maplibregl.Marker({ element: marker, anchor: 'bottom' }).setLngLat([moment.longitude, moment.latitude]).addTo(map)
        markersRef.current.push(mapMarker)
      })
    }
    if (map.isStyleLoaded()) sync()
    else map.once('load', sync)
    return () => {
      map.off('load', sync)
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
    }
  }, [moments])

  return <div ref={containerRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-label={t('OpenStreetMap ng Moments', 'OpenStreetMap Moments map')} />
}

function MomentTravelerTagger({
  momentId,
  collaborators,
  onAdd,
}: {
  momentId: string
  collaborators: TravelerAccount[]
  onAdd: (account: TravelerAccount) => void
}) {
  const { t } = useLang()
  const { showToast } = useStore()
  const [tagQuery, setTagQuery] = useState('')
  const [tagResults, setTagResults] = useState<TravelerAccount[]>([])
  const [tagSearchStatus, setTagSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tagQuery.trim().length < 2) {
      setTagResults([])
      setTagSearchStatus('idle')
      return
    }
    let active = true
    setTagSearchStatus('loading')
    const timeout = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_moment_travelers', { p_query: tagQuery.trim() })
      if (error) {
        if (active) {
          setTagSearchStatus('error')
          showToast({ text: t(`Hindi mahanap ang mga account: ${error.message}`, `Could not search accounts: ${error.message}`), expression: 'unsure' })
        }
        return
      }
      if (active) {
        setTagResults(((data ?? []) as TravelerAccount[]).filter((account) => !collaborators.some((tagged) => tagged.id === account.id)))
        setTagSearchStatus('ready')
      }
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [momentId, tagQuery, collaborators])

  return (
    <>
      <label className="mt-4 block">
        <span className="text-caption text-fg-2">{t('Mag-tag ng account', 'Tag an account')}</span>
        <input
          ref={tagInputRef}
          value={tagQuery}
          onChange={(event) => setTagQuery(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('Pangalan, palayaw, o email', 'Name, nickname, or email')}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated"
        />
      </label>
      <p className="mt-1 text-[12px] text-fg-2">{t('Maghanap gamit ang pangalan o palayaw, o ilagay ang buong email address. Pagkatapos, piliin ang biyaherong ita-tag.', 'Search by name or nickname, or enter the full email address. Then choose the traveler to tag.')}</p>
      {tagSearchStatus === 'loading' && <p className="mt-2 text-[13px] text-fg-2">{t('Naghahanap ng mga account…', 'Searching accounts…')}</p>}
      {!!tagResults.length && (
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          <p className="border-b border-line px-3 py-2 text-[12px] font-semibold text-fg-2">{t('Mga taong mapagpipilian', 'People you can tag')}</p>
          {tagResults.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onAdd(account)
                window.requestAnimationFrame(() => tagInputRef.current?.focus({ preventScroll: true }))
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-[14px] hover:bg-sunken dark:hover:bg-elevated"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary">
                {account.avatar_url ? <img src={account.avatar_url} alt="" className="h-full w-full object-cover" /> : (account.nickname || account.name).slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block">{account.nickname || account.name}</span>
                {account.email && <span className="block truncate text-[12px] text-fg-2">{account.email}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {tagSearchStatus === 'ready' && tagQuery.trim().length >= 2 && !tagResults.length && <p className="mt-2 text-[13px] text-fg-2">{t('Walang nahanap na biyaherong tumutugma.', 'No matching travelers found.')}</p>}
    </>
  )
}

export function MomentsMap() {
  const [params] = useSearchParams()
  const forced = getForcedState()
  const online = useOnline()
  const bp = useBreakpoint()
  const navigate = useNavigate()
  const { lang, t } = useLang()
  const { removeMoment, showToast } = useStore()
  const [size, setSize] = useState({ w: 0, h: 0 })
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const initialSnap = (['peek', 'half', 'full'].includes(forced ?? '') ? forced : params.get('gallery')) as Snap | null
  const [snap, setSnap] = useState<Snap>(initialSnap ?? 'closed')
  const [docked, setDocked] = useState(false)
  const [mapFilter, setMapFilter] = useState<MapFilter>(params.get('f') === 'mine' ? 'mine' : 'all')
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>(params.get('f') === 'mine' ? 'mine' : 'all')
  const [selected, setSelected] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Moment | null>(null)
  const [dbMoments, setDbMoments] = useState<MomentRecord[]>([])
  const [loadingMoments, setLoadingMoments] = useState(true)
  const [busyMomentId, setBusyMomentId] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<TravelerAccount[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ caption: '', date: '', place: '', area: '', trip: '' })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const sharedMomentHandledRef = useRef(false)

  const mobile = bp === 'mobile'
  const tabBar = mobile ? 88 : 0

  useEffect(() => {
    const element = mapContainerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const loadMoments = async () => {
      // Private ang image bucket, kaya signed URL ang kailangan bago ipakita ang Moment sa mapa.
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (active) setCurrentUserId(userData.user?.id ?? null)
        const { data, error } = await supabase.from('moments').select('id, author_id, storage_path, caption, visited_at, place_name, area, latitude, longitude, kind, trip, frame, tilt, on_map').order('created_at', { ascending: false })
        if (error) throw error
        if (!active) return
        const momentIds = (data ?? []).map((row) => row.id)
        const photosByMoment = new Map<string, MomentPhoto[]>()
        if (momentIds.length) {
          const { data: photoRows, error: photosError } = await supabase
            .from('moment_photos')
            .select('id, moment_id, author_id, storage_path')
            .in('moment_id', momentIds)
            .order('created_at')
          if (photosError) throw photosError
          for (const photo of photoRows ?? []) {
            const { data: signed, error: signError } = await supabase.storage.from('images').createSignedUrl(photo.storage_path, 3600)
            if (signError) {
              console.error('Moment collaborator photo could not be loaded.', { path: photo.storage_path, error: signError })
              continue
            }
            const photos = photosByMoment.get(photo.moment_id) ?? []
            photos.push({
              id: photo.id,
              src: signed.signedUrl,
              authorId: photo.author_id,
              storagePath: photo.storage_path,
            })
            photosByMoment.set(photo.moment_id, photos)
          }
        }
        const rows: MomentRecord[] = []
        for (const row of data ?? []) {
          let src = row.storage_path.startsWith('http') ? row.storage_path : undefined
          if (!src) {
            const { data: signed, error: signError } = await supabase.storage.from('images').createSignedUrl(row.storage_path, 3600)
            if (signError) {
              console.error('Moment image could not be loaded.', { path: row.storage_path, error: signError })
              continue
            }
            src = signed?.signedUrl
          }
          if (!src) continue
          rows.push({
            id: String(row.id),
            src,
            caption: row.caption ?? '',
            date: row.visited_at ?? '',
            place: row.place_name ?? '',
            area: row.area ?? '',
            map: DEFAULT_USER,
            kind: row.kind && (row.kind.toLowerCase().includes('pagkain') || row.kind.toLowerCase().includes('food')) ? 'Pagkain' : 'Pasyalan',
            mine: row.author_id === userData.user?.id,
            trip: row.trip ?? undefined,
            frame: (row.frame ?? 'classic') as Moment['frame'],
            tilt: Number(row.tilt ?? 0),
            onMap: Boolean(row.on_map),
            latitude: row.latitude == null ? null : Number(row.latitude),
            longitude: row.longitude == null ? null : Number(row.longitude),
            authorId: row.author_id ?? null,
            storagePath: row.storage_path,
            collaborator: row.author_id !== userData.user?.id,
            photos: photosByMoment.get(row.id) ?? [],
          })
        }
        if (active) setDbMoments(rows)
      } catch (error) {
        console.error('Moments could not be loaded.', error)
        if (active) showToast({
          text: error instanceof Error
            ? t(`Hindi ma-load ang Moments: ${error.message}`, `Moments could not be loaded: ${error.message}`)
            : t('Hindi ma-load ang Moments.', 'Moments could not be loaded.'),
          expression: 'unsure',
        })
      } finally {
        if (active) setLoadingMoments(false)
      }
    }
    void loadMoments()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!viewer) {
      setCollaborators([])
      setEditing(false)
      return
    }
    let active = true
    setDraft({ caption: viewer.caption, date: viewer.date, place: viewer.place, area: viewer.area, trip: viewer.trip ?? '' })
    const loadCollaborators = async () => {
      const { data, error } = await supabase.rpc('list_moment_collaborators', { p_moment_id: viewer.id })
      if (error) {
        showToast({ text: t(`Hindi ma-load ang mga naka-tag: ${error.message}`, `Could not load tagged travelers: ${error.message}`), expression: 'unsure' })
        return
      }
      if (active) setCollaborators((data ?? []) as TravelerAccount[])
    }
    void loadCollaborators()
    return () => {
      active = false
    }
  }, [viewer?.id])

  useEffect(() => {
    const momentId = params.get('moment')
    if (!momentId || loadingMoments || sharedMomentHandledRef.current) return
    sharedMomentHandledRef.current = true
    const existing = dbMoments.find((moment) => moment.id === momentId)
    if (existing) {
      setViewer(existing)
      setSnap('half')
      return
    }
    let active = true
    const openSharedMoment = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (active) setCurrentUserId(userData.user?.id ?? null)
        const { data: row, error } = await supabase.from('moments').select('id, author_id, storage_path, caption, visited_at, place_name, area, latitude, longitude, kind, trip, frame, tilt, on_map').eq('id', momentId).single()
        if (error) throw error
        const { data: signed, error: signError } = await supabase.storage.from('images').createSignedUrl(row.storage_path, 3600)
        if (signError) throw signError
        const { data: photos, error: photosError } = await supabase.from('moment_photos').select('id, author_id, storage_path').eq('moment_id', momentId).order('created_at')
        if (photosError) throw photosError
        const extraPhotos: MomentPhoto[] = []
        for (const photo of photos ?? []) {
          const { data: photoUrl, error: photoSignError } = await supabase.storage.from('images').createSignedUrl(photo.storage_path, 3600)
          if (photoSignError) {
            console.error('A shared Moment photo could not be loaded.', { path: photo.storage_path, error: photoSignError })
            continue
          }
          extraPhotos.push({ id: photo.id, authorId: photo.author_id, storagePath: photo.storage_path, src: photoUrl.signedUrl })
        }
        if (!active) return
        setViewer({
          id: row.id,
          src: signed.signedUrl,
          caption: row.caption ?? '',
          date: row.visited_at ?? '',
          place: row.place_name ?? '',
          area: row.area ?? '',
          map: DEFAULT_USER,
          kind: row.kind && (row.kind.toLowerCase().includes('food') || row.kind.toLowerCase().includes('pagkain')) ? 'Pagkain' : 'Pasyalan',
          mine: row.author_id === userData.user?.id,
          authorId: row.author_id,
          collaborator: row.author_id !== userData.user?.id,
          trip: row.trip ?? undefined,
          frame: (row.frame ?? 'classic') as Moment['frame'],
          tilt: Number(row.tilt ?? 0),
          onMap: Boolean(row.on_map),
          photos: extraPhotos,
        })
        setSnap('half')
      } catch (error) {
        if (active) showToast({
          text: error instanceof Error ? t(`Hindi mabuksan ang Moment na ito: ${error.message}`, `This Moment could not be opened: ${error.message}`) : t('Hindi mabuksan ang Moment na ito.', 'This Moment could not be opened.'),
          expression: 'unsure',
        })
      }
    }
    void openSharedMoment()
    return () => {
      active = false
    }
  }, [params, loadingMoments, dbMoments])

  const all = useMemo(() => (forced === 'empty' ? [] : dbMoments), [dbMoments, forced])
  const momentsLoading = forced === 'loading' || loadingMoments
  const visible = useMemo(() => {
    const now = Date.now()
    return all.filter((m) => {
      const age = now - new Date(m.date).getTime()
      if (mapFilter === 'mine' && !m.mine) return false
      if (mapFilter === 'food') return m.kind === 'Pagkain'
      if (mapFilter === 'place') return m.kind === 'Pasyalan'
      if (mapFilter === 'today') return age >= 0 && age < 24 * 60 * 60 * 1000
      if (mapFilter === 'week') return age >= 0 && age < 7 * 24 * 60 * 60 * 1000
      if (mapFilter === 'month') return age >= 0 && age < 30 * 24 * 60 * 60 * 1000
      if (mapFilter === 'older') return age >= 30 * 24 * 60 * 60 * 1000
      return true
    })
  }, [all, mapFilter])
  const shown = useMemo(() => visible.filter((moment) => moment.onMap && moment.latitude != null && moment.longitude != null), [visible])
  const travelLogMoments = useMemo(
    () => all.filter((moment) => moment.mine && moment.onMap && moment.latitude != null && moment.longitude != null),
    [all],
  )

  const area = { name: 'Manila', x: DEFAULT_USER.x, y: DEFAULT_USER.y, total: all.length }
  const viewerDate = viewer?.date ? new Date(viewer.date) : null
  const formattedViewerDate = viewerDate && !Number.isNaN(viewerDate.getTime())
    ? new Intl.DateTimeFormat(lang === 'en' ? 'en-PH' : 'fil-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(viewerDate)
    : null
  const selectedCluster = selected ? { items: shown.filter((moment) => moment.id === selected) } : undefined
  const galleryItems = galleryFilter === 'log'
    ? travelLogMoments
    : [...(selectedCluster?.items ?? []), ...visible.filter((m) => !selectedCluster?.items.includes(m))].filter((m) =>
        galleryFilter === 'mine' ? m.mine : galleryFilter === 'trips' ? !!m.trip : true,
      )
  const deleteMoment = async (moment: Moment) => {
    if (!moment.mine || busyMomentId) return
    if (!window.confirm(t('I-delete ang Moment na ito? Hindi na ito mababawi.', 'Delete this Moment? This cannot be undone.'))) return
    setBusyMomentId(moment.id)
    try {
      const { data: row, error: lookupError } = await supabase.from('moments').select('storage_path').eq('id', moment.id).maybeSingle()
      if (lookupError) throw lookupError
      if (!row) throw new Error(t('Hindi makita ang Moment na ito.', 'This Moment could not be found.'))
      const { data: photos, error: photosError } = await supabase.from('moment_photos').select('storage_path').eq('moment_id', moment.id)
      if (photosError) throw photosError
      const paths = [row?.storage_path, ...(photos ?? []).map((photo) => photo.storage_path)].filter((path): path is string => !!path && !path.startsWith('http'))
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from('images').remove(paths)
        if (storageError) throw storageError
      }
      const { error } = await supabase.from('moments').delete().eq('id', moment.id)
      if (error) throw error
      removeMoment(moment.id)
      setDbMoments((items) => items.filter((item) => item.id !== moment.id))
      setViewer(null)
      setSelected(null)
    } catch (error) {
      showToast({
        text: error instanceof Error ? t(`Hindi ma-delete ang Moment: ${error.message}`, `Could not delete the Moment: ${error.message}`) : t('Hindi ma-delete ang Moment.', 'Could not delete the Moment.'),
        expression: 'unsure',
      })
    } finally {
      setBusyMomentId(null)
    }
  }

  const copyMoment = async (moment: Moment) => {
    if (busyMomentId) return
    setBusyMomentId(moment.id)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw new Error(t('Mag-sign in para makopya ang Moment.', 'Sign in to copy this Moment.'))
      const { data: row, error: rowError } = await supabase
        .from('moments')
        .select('storage_path, caption, visited_at, place_name, area, latitude, longitude, kind, trip, frame, tilt, on_map')
        .eq('id', moment.id)
        .single()
      if (rowError) throw rowError
      const { data: blob, error: downloadError } = await supabase.storage.from('images').download(row.storage_path)
      if (downloadError) throw downloadError
      const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'jpg'
      const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('images').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
      if (uploadError) throw uploadError
      const { data: signed, error: signError } = await supabase.storage.from('images').createSignedUrl(path, 3600)
      if (signError) {
        const { error: cleanupError } = await supabase.storage.from('images').remove([path])
        if (cleanupError) console.error('Failed to remove a copied Moment image after signing failed.', cleanupError)
        throw signError
      }
      const { data: copy, error: insertError } = await supabase.from('moments').insert({
        author_id: userData.user.id,
        storage_path: path,
        caption: row.caption,
        visited_at: row.visited_at,
        place_name: row.place_name,
        area: row.area,
        latitude: row.latitude,
        longitude: row.longitude,
        kind: row.kind,
        trip: row.trip,
        frame: row.frame,
        tilt: row.tilt,
        on_map: row.on_map,
      }).select('id').single()
      if (insertError) {
        const { error: cleanupError } = await supabase.storage.from('images').remove([path])
        if (cleanupError) console.error('Failed to remove a copied Moment image after insert failure.', cleanupError)
        throw insertError
      }
      const copied: MomentRecord = {
        ...moment,
        id: copy.id,
        src: signed.signedUrl,
        mine: true,
        collaborator: false,
        authorId: userData.user.id,
        storagePath: path,
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        photos: [],
      }
      setDbMoments((items) => [copied, ...items])
      showToast({ text: t('Na-save ang kopya sa Moments mo.', 'A copy was saved to your Moments.'), expression: 'celebrating' })
    } catch (error) {
      showToast({
        text: error instanceof Error ? t(`Hindi makopya ang Moment: ${error.message}`, `Could not copy the Moment: ${error.message}`) : t('Hindi makopya ang Moment.', 'Could not copy the Moment.'),
        expression: 'unsure',
      })
    } finally {
      setBusyMomentId(null)
    }
  }

  const shareMoment = async (moment: Moment) => {
    try {
      const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
      const url = new URL(`${basePath}moments/map`, window.location.origin)
      url.searchParams.set('moment', moment.id)
      const title = moment.caption || t('Moment ko', 'My Moment')
      const text = `${title}\n${url.toString()}`
      if (!navigator.share) {
        await navigator.clipboard.writeText(text)
        showToast({ text: t('Na-kopya ang link ng Moment.', 'Moment link copied.'), expression: 'celebrating' })
        return
      }
      const { data: row, error: rowError } = await supabase.from('moments').select('storage_path').eq('id', moment.id).single()
      if (rowError) throw rowError
      const { data: blob, error: downloadError } = await supabase.storage.from('images').download(row.storage_path)
      if (downloadError) throw downloadError
      const mimeType = blob.type || 'image/jpeg'
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'jpg'
      const file = new File([blob], `bitinary-moment.${extension}`, { type: mimeType })
      const canShareFile = navigator.canShare?.({ files: [file] }) ?? false
      if (canShareFile) await navigator.share({ title, text, files: [file] })
      else await navigator.share({ title, text, url: url.toString() })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showToast({
        text: error instanceof Error ? t(`Hindi ma-share ang Moment: ${error.message}`, `Could not share the Moment: ${error.message}`) : t('Hindi ma-share ang Moment.', 'Could not share the Moment.'),
        expression: 'unsure',
      })
    }
  }

  const saveDetails = async () => {
    if (!viewer || busyMomentId || !(viewer.mine || viewer.collaborator)) return
    if (!draft.date) {
      showToast({ text: t('Pumili ng petsa para sa Moment.', 'Choose a date for the Moment.'), expression: 'unsure' })
      return
    }
    setBusyMomentId(viewer.id)
    try {
      const { error } = await supabase.from('moments').update({
        caption: draft.caption,
        visited_at: draft.date,
        place_name: draft.place,
        area: draft.area,
        trip: draft.trip || null,
      }).eq('id', viewer.id)
      if (error) throw error
      const updated = { ...viewer, caption: draft.caption, date: draft.date, place: draft.place, area: draft.area, trip: draft.trip || undefined }
      setViewer(updated)
      setDbMoments((items) => items.map((item) => (item.id === viewer.id ? { ...item, ...updated } : item)))
      setEditing(false)
      showToast({ text: t('Na-update ang detalye ng Moment.', 'Moment details updated.'), expression: 'celebrating' })
    } catch (error) {
      showToast({
        text: error instanceof Error ? t(`Hindi ma-update ang Moment: ${error.message}`, `Could not update the Moment: ${error.message}`) : t('Hindi ma-update ang Moment.', 'Could not update the Moment.'),
        expression: 'unsure',
      })
    } finally {
      setBusyMomentId(null)
    }
  }

  const addPhoto = async (file: File | undefined) => {
    if (!file || !viewer || busyMomentId || !(viewer.mine || viewer.collaborator)) return
    if (!file.type.startsWith('image/')) {
      showToast({ text: t('Pumili ng image file.', 'Choose an image file.'), expression: 'unsure' })
      return
    }
    setBusyMomentId(viewer.id)
    let path: string | null = null
    let photoId: string | null = null
    let uploaded = false
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw new Error(t('Mag-sign in para magdagdag ng larawan.', 'Sign in to add a photo.'))
      path = `${userData.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      uploaded = true
      const { data: added, error: insertError } = await supabase.from('moment_photos').insert({
        moment_id: viewer.id,
        author_id: userData.user.id,
        storage_path: path,
      }).select('id').single()
      if (insertError) throw insertError
      photoId = added.id
      const { data: signed, error: signError } = await supabase.storage.from('images').createSignedUrl(path, 3600)
      if (signError) throw signError
      const photo: MomentPhoto = { id: added.id, src: signed.signedUrl, authorId: userData.user.id, storagePath: path }
      const updated = { ...viewer, photos: [...(viewer.photos ?? []), photo] }
      setViewer(updated)
      setDbMoments((items) => items.map((item) => (item.id === viewer.id ? { ...item, photos: updated.photos } : item)))
      showToast({ text: t('Naidagdag ang larawan sa Moment.', 'Photo added to the Moment.'), expression: 'celebrating' })
    } catch (error) {
      if (path && uploaded) {
        if (photoId) {
          const { error: deleteRowError } = await supabase.from('moment_photos').delete().eq('id', photoId)
          if (deleteRowError) console.error('Failed to remove a Moment photo record after upload failed.', deleteRowError)
        }
        const { error: cleanupError } = await supabase.storage.from('images').remove([path])
        if (cleanupError) console.error('Failed to remove a Moment photo after upload failed.', cleanupError)
      }
      showToast({
        text: error instanceof Error ? t(`Hindi maidaragdag ang larawan: ${error.message}`, `Could not add the photo: ${error.message}`) : t('Hindi maidaragdag ang larawan.', 'Could not add the photo.'),
        expression: 'unsure',
      })
    } finally {
      setBusyMomentId(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const addCollaborator = async (account: TravelerAccount) => {
    if (!viewer || !viewer.mine || !currentUserId) return
    const { error } = await supabase.from('moment_collaborators').insert({
      moment_id: viewer.id,
      user_id: account.id,
      added_by: currentUserId,
    })
    if (error) {
      showToast({ text: t(`Hindi ma-tag ang account: ${error.message}`, `Could not tag the account: ${error.message}`), expression: 'unsure' })
      return
    }
    setCollaborators((items) => [...items, account])
    const { error: notificationError } = await supabase.rpc('notify_moment_collaborator', { p_moment_id: viewer.id, p_user_id: account.id })
    if (notificationError) {
      showToast({ text: t(`Na-tag ang traveler pero hindi naipadala ang abiso: ${notificationError.message}`, `The traveler was tagged, but the notification could not be sent: ${notificationError.message}`), expression: 'unsure' })
      return
    }
    showToast({ text: t(`Na-tag si ${account.nickname || account.name}.`, `${account.nickname || account.name} was tagged.`), expression: 'celebrating' })
  }

  const removeCollaborator = async (account: TravelerAccount) => {
    if (!viewer || !viewer.mine) return
    const { error } = await supabase.from('moment_collaborators').delete().eq('moment_id', viewer.id).eq('user_id', account.id)
    if (error) {
      showToast({ text: t(`Hindi maalis ang tag: ${error.message}`, `Could not remove the tag: ${error.message}`), expression: 'unsure' })
      return
    }
    setCollaborators((items) => items.filter((item) => item.id !== account.id))
  }

  return (
    <main className={cn(FULL_BLEED, 'overflow-hidden bg-[var(--map-land)]')}>
      {/* map surface */}
      <div ref={mapContainerRef} className="absolute inset-0" aria-label={t('Mapa ng Moments. I-drag para gumalaw, i-pinch para mag-zoom.', 'Moments map. Drag to move and pinch to zoom.')} role="application">
        <MapLibreSurface
          moments={shown}
          onSelect={(id) => {
            setSelected(id)
            const moment = shown.find((item) => item.id === id)
            if (moment) setViewer(moment)
            if (mobile) setSnap(snap === 'closed' || snap === 'peek' ? 'half' : snap)
            else setDocked(false)
          }}
        />
      </div>

      {/* top floating controls */}
      <div className={cn('pointer-events-none absolute top-0 z-20 space-y-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))]', mobile ? 'inset-x-0' : 'left-0 right-[392px]')}>
        <div className="flex items-center justify-center gap-2">
          <div className="pointer-events-auto" data-map-ui>
            <Segmented tone="glass" label={t('Mode ng Moments', 'Moments mode')} value="map" onChange={(v) => v === 'camera' && navigate('/moments')} options={[{ value: 'camera', label: t('Camera', 'Camera') }, { value: 'map', label: t('Mapa', 'Map') }]} />
          </div>
          <PhaseTag phase="P3" />
        </div>
        <div className="no-scrollbar pointer-events-auto mx-auto flex max-w-[520px] gap-2 overflow-x-auto pb-2" data-map-ui>
          {([
            ['all', t('Lahat', 'All')],
            ['food', t('Pagkain', 'Food')],
            ['place', t('Pasyalan', 'Places')],
            ['mine', t('Akin', 'Mine')],
            ['today', t('Ngayon', 'Today')],
            ['week', t('7 araw', '7 days')],
            ['month', t('30 araw', '30 days')],
            ['older', t('Mas luma', 'Older')],
          ] as const).map(([v, l]) => (
            <Chip key={v} tone="glass" active={mapFilter === v} onClick={() => setMapFilter(v)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      {/* hint / states */}
      <AnimatePresence>
        {!online && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass absolute left-1/2 top-[184px] z-20 flex w-[min(92%,420px)] -translate-x-1/2 items-center gap-3 rounded-[20px] p-3 shadow-float" data-map-ui>
            <Jimbot expression="sleeping" variant="standalone" size={56} />
            <p className="flex-1 text-[14px] font-semibold text-fg">
              <WifiOff size={15} className="mr-1 inline text-caution" />
              {t('Offline ka. Naka-cache na mapa at mga Moment mo lang ang makikita.', 'You are offline. Only the cached map and your Moments are available.')}
            </p>
          </motion.div>
        )}
        {online && !shown.length && !momentsLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass absolute left-1/2 top-1/2 z-20 flex w-[min(88%,360px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-[28px] p-5 text-center shadow-float" data-map-ui>
            <Jimbot expression="sleeping" variant="standalone" size={110} />
            <p className="mt-2 text-h3 text-fg">{t('Wala pang Moments dito', 'No Moments here yet')}</p>
            <p className="mt-1 text-[15px] text-fg-2">{t('Kunan ang unang larawan mo at lalabas ito sa mapa.', 'Capture your first photo and it will appear on the map.')}</p>
            <Button className="mt-4" onClick={() => navigate('/moments')}>
              {t('Buksan ang camera', 'Open camera')}
            </Button>
          </motion.div>
        )}
        {online && !!shown.length && mobile && snap === 'closed' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute left-3 right-[72px] z-20 flex h-11 w-fit max-w-[calc(100%-84px)] items-center gap-2 truncate rounded-full pl-1.5 pr-4 font-display text-[13px] font-medium text-fg shadow-float" style={{ bottom: tabBar + 14 }} data-map-ui>
            <Jimbot crop="head" size={32} expression="pointing" animate={false} /> {t('I-tap ang pin para sa mga larawan', 'Tap a pin to view photos')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* gallery */}
      {mobile ? (
        <GallerySheet
          snap={snap}
          setSnap={setSnap}
          containerH={size.h}
          bottomOffset={tabBar}
          title={area.name}
          moments={galleryItems}
          dateLocale={lang === 'en' ? 'en-PH' : 'fil-PH'}
          filter={galleryFilter}
          setFilter={setGalleryFilter}
          loading={momentsLoading}
          onOpen={setViewer}
          onSave={(moment) => void copyMoment(moment)}
          onDelete={(moment) => void deleteMoment(moment)}
          busyMomentId={busyMomentId}
        />
      ) : (
        <GalleryDock collapsed={docked} setCollapsed={setDocked} title={area.name} moments={galleryItems} dateLocale={lang === 'en' ? 'en-PH' : 'fil-PH'} filter={galleryFilter} setFilter={setGalleryFilter} loading={momentsLoading} onOpen={setViewer} onSave={(moment) => void copyMoment(moment)} onDelete={(moment) => void deleteMoment(moment)} busyMomentId={busyMomentId} />
      )}

      {/* moment viewer */}
      <Sheet open={!!viewer} onClose={() => setViewer(null)} title={viewer?.place}>
        {viewer && (
          <div className="flex flex-col items-center pb-2 pt-2">
            <Polaroid
              src={viewer.src}
              caption={viewer.caption}
              date={viewer.date}
              dateLocale={lang === 'en' ? 'en-PH' : 'fil-PH'}
              place={viewer.place}
              frame={viewer.frame}
              tilt={viewer.tilt}
              width={260}
              actions={<MomentCardActions canSave={!viewer.mine} canDelete={viewer.mine} busy={busyMomentId === viewer.id} onSave={() => void copyMoment(viewer)} onDelete={() => void deleteMoment(viewer)} />}
            />
            <p className="mt-4 text-caption text-fg-2">
              {viewer.mine ? t('Ikaw ang gumawa', 'Created by you') : t('Ibinahagi sa iyo', 'Shared with you')}
              {formattedViewerDate && ` · ${formattedViewerDate}`}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" icon={<Send size={16} />} onClick={() => void shareMoment(viewer)}>
                {t('I-share', 'Share')}
              </Button>
              {(viewer.mine || viewer.collaborator) && (
                <Button size="sm" variant="outline" icon={<Pencil size={16} />} onClick={() => setEditing((value) => !value)}>
                  {editing ? t('Isara ang edit', 'Close edit') : t('I-edit ang detalye', 'Edit details')}
                </Button>
              )}
              {(viewer.mine || viewer.collaborator) && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) => void addPhoto(event.currentTarget.files?.[0])}
                    aria-label={t('Magdagdag ng larawan sa Moment', 'Add a photo to this Moment')}
                  />
                  <Button size="sm" variant="outline" icon={<Camera size={16} />} disabled={busyMomentId === viewer.id} onClick={() => photoInputRef.current?.click()}>
                    {t('Magdagdag ng larawan', 'Add photo')}
                  </Button>
                </>
              )}
            </div>

            {editing && (
              <section className="mt-5 w-full space-y-3 rounded-[22px] border border-line bg-sunken/70 p-4 dark:bg-elevated" aria-label={t('I-edit ang Moment', 'Edit Moment')}>
                <label className="block">
                  <span className="text-caption text-fg-2">{t('Caption', 'Caption')}</span>
                  <input value={draft.caption} onChange={(event) => setDraft((value) => ({ ...value, caption: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-caption text-fg-2">{t('Petsa', 'Date')}</span>
                    <input type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
                  </label>
                  <label className="block">
                    <span className="text-caption text-fg-2">{t('Lugar', 'Place')}</span>
                    <input value={draft.place} onChange={(event) => setDraft((value) => ({ ...value, place: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-caption text-fg-2">{t('Lugar o lungsod', 'Area or city')}</span>
                  <input value={draft.area} onChange={(event) => setDraft((value) => ({ ...value, area: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
                </label>
                <label className="block">
                  <span className="text-caption text-fg-2">{t('Pangalan ng biyahe (opsyonal)', 'Trip name (optional)')}</span>
                  <input value={draft.trip} onChange={(event) => setDraft((value) => ({ ...value, trip: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
                </label>
                <Button block disabled={busyMomentId === viewer.id} icon={<Check size={17} />} onClick={() => void saveDetails()}>
                  {t('I-save ang detalye', 'Save details')}
                </Button>
              </section>
            )}

            {!!viewer.photos?.length && (
              <section className="mt-5 w-full">
                <h3 className="mb-2 text-body font-semibold">{t('Mga dagdag na larawan', 'More photos')}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {viewer.photos.map((photo) => (
                    <img key={photo.id} src={photo.src} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            {viewer.mine && (
              <section className="mt-5 w-full rounded-[22px] border border-line bg-surface p-4">
                <h3 className="text-body font-semibold">{t('Mga naka-tag na biyahero', 'Tagged travelers')}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {collaborators.map((account) => (
                    <span key={account.id} className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pl-3 pr-1 text-[13px] dark:bg-elevated">
                      {account.nickname || account.name}
                      <button type="button" aria-label={t(`Alisin si ${account.nickname || account.name}`, `Remove ${account.nickname || account.name}`)} onClick={() => void removeCollaborator(account)} className="grid h-7 w-7 place-items-center rounded-full text-fg-2 hover:bg-danger-bg hover:text-danger">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {!collaborators.length && <span className="text-caption text-fg-2">{t('Wala pang naka-tag.', 'No one is tagged yet.')}</span>}
                </div>
                <MomentTravelerTagger
                  momentId={viewer.id}
                  collaborators={collaborators}
                  onAdd={(account) => void addCollaborator(account)}
                />
              </section>
            )}

            <p className="mt-4 text-center text-caption text-fg-2">
              {viewer.mine ? t('Pribado maliban kung mag-tag o mag-share ka.', 'Private unless you tag someone or share it.') : t('Ikaw at ang gumawa lang ang may access.', 'Only you and the creator can access this Moment.')}
            </p>
          </div>
        )}
      </Sheet>
    </main>
  )
}
