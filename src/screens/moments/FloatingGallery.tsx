import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { animate, motion, useMotionValue, type PanInfo } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useLang } from '@/app/i18n'
import { Polaroid, PolaroidSkeleton } from '@/components/cards/Polaroid'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import type { Moment } from '@/data/moments'
import { cn } from '@/lib/cn'
import { MomentCardActions } from './MomentCardActions'

export type Snap = 'closed' | 'peek' | 'half' | 'full'
export type GalleryFilter = 'all' | 'mine' | 'trips' | 'log'

type Props = {
  title: string
  moments: Moment[]
  dateLocale?: string
  filter: GalleryFilter
  setFilter: (f: GalleryFilter) => void
  loading?: boolean
  onOpen: (m: Moment) => void
  onSave: (m: Moment) => void
  onDelete: (m: Moment) => void
  busyMomentId?: string | null
}

function Header({ title, count, compact }: { title: string; count: number; compact?: boolean }) {
  const navigate = useNavigate()
  const { t } = useLang()
  return (
    <div className="flex items-center justify-between gap-3 px-4">
      <div className="min-w-0">
        <h2 className={cn('truncate font-display font-semibold leading-tight', compact ? 'text-[18px]' : 'text-[20px]')}>{title}</h2>
        <p className="text-caption text-fg-2">{t(`${count} larawan sa Moments mo`, `${count} ${count === 1 ? 'photo' : 'photos'} in your Moments`)}</p>
      </div>
      <Button size="sm" className="!px-3 text-[13px]" icon={<Plus size={15} />} onClick={() => navigate('/moments/create')}>
        {t('Gumawa ng Moment', 'Create Moment')}
      </Button>
    </div>
  )
}

function Filters({ filter, setFilter }: Pick<Props, 'filter' | 'setFilter'>) {
  const { t } = useLang()
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
      {([
        ['all', t('Lahat', 'All')],
        ['mine', t('Akin', 'Mine')],
        ['trips', t('Mga Biyahe', 'Trips')],
        ['log', t('Tala ng Biyahe', 'Travel log')],
      ] as const).map(([v, l]) => (
        <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>
          {l}
        </Chip>
      ))}
    </div>
  )
}

function Empty() {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center px-6 py-4 text-center">
      <Jimbot expression="sleeping" variant="standalone" size={90} />
      <p className="mt-2 text-body text-fg-2">{t('Walang larawan sa bahaging ito ng mapa. I-drag ang mapa o kunan ang una!', 'No photos in this part of the map. Drag the map or capture your first one!')}</p>
    </div>
  )
}

function TravelLog({ moments, loading, onOpen, dateLocale }: Pick<Props, 'moments' | 'loading' | 'onOpen' | 'dateLocale'>) {
  const { t } = useLang()
  const groups = new Map<string, { name: string; moments: Moment[] }>()
  for (const moment of moments) {
    const name = moment.area.trim() || moment.place.trim() || t('Lugar na walang pangalan', 'Unlabeled place')
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { name, moments: [] }
    group.moments.push(moment)
    groups.set(key, group)
  }
  const orderedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      moments: group.moments.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)),
    }))
    .sort((a, b) => (Date.parse(b.moments[0]?.date ?? '') || 0) - (Date.parse(a.moments[0]?.date ?? '') || 0))
  const placeCount = new Set(moments.map((moment) => (moment.place.trim() || moment.area.trim()).toLowerCase()).filter(Boolean)).size

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4" aria-busy="true">
        <PolaroidSkeleton width="100%" />
        <PolaroidSkeleton width="100%" />
      </div>
    )
  }
  if (!moments.length) {
    return (
      <div className="flex flex-col items-center px-6 py-6 text-center">
        <Jimbot expression="sleeping" variant="standalone" size={90} />
        <p className="mt-2 text-body text-fg-2">{t('Lalabas dito ang mga Moment mo na may lokasyon.', 'Your Moments with a saved location will appear here.')}</p>
      </div>
    )
  }

  return (
    <section className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 pt-3" aria-label={t('Tala ng Biyahe', 'Travel log')}>
      <div className="mb-4 rounded-2xl bg-sunken px-4 py-3 dark:bg-elevated">
        <p className="font-display text-[15px] font-semibold">{t('Mga naitala mong pagbisita', 'Your recorded visits')}</p>
        <p className="mt-1 text-caption text-fg-2">
          {t(`${placeCount} lugar · ${moments.length} alaala`, `${placeCount} ${placeCount === 1 ? 'place' : 'places'} · ${moments.length} ${moments.length === 1 ? 'memory' : 'memories'}`)}
        </p>
      </div>
      <div className="space-y-5">
        {orderedGroups.map((group) => (
          <section key={group.name} aria-label={group.name}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold">{group.name}</h3>
              <span className="shrink-0 text-[12px] text-fg-2">
                {t(`${group.moments.length} Moment`, `${group.moments.length} ${group.moments.length === 1 ? 'memory' : 'memories'}`)}
              </span>
            </div>
            <div className="space-y-2">
              {group.moments.map((moment) => {
                const date = moment.date && !Number.isNaN(new Date(moment.date).getTime())
                  ? new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(moment.date))
                  : ''
                return (
                  <button
                    key={moment.id}
                    type="button"
                    onClick={() => onOpen(moment)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2 text-left transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-elevated"
                  >
                    <img src={moment.src} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{moment.place || moment.area || group.name}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-fg-2">{moment.caption || moment.trip || group.name}</span>
                      <span className="mt-1 block truncate text-[11px] text-fg-2">{[date, moment.trip].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function Row({ moments, loading, onOpen, onSave, onDelete, busyMomentId, dateLocale }: Pick<Props, 'moments' | 'loading' | 'onOpen' | 'onSave' | 'onDelete' | 'busyMomentId' | 'dateLocale'>) {
  if (loading)
    return (
      <div className="flex gap-4 overflow-hidden px-5 py-3" aria-busy="true">
        {[-3, 2, -2].map((t, i) => (
          <PolaroidSkeleton key={i} width={140} tilt={t} />
        ))}
      </div>
    )
  if (!moments.length) return <Empty />
  return (
    <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-5 pb-4 pt-3">
      {moments.map((m) => (
        <div key={m.id} className="snap-start">
          <Polaroid
            src={m.src}
            caption={m.caption}
            date={m.date}
            dateLocale={dateLocale}
            frame={m.frame}
            tilt={m.tilt}
            width={140}
            onClick={() => onOpen(m)}
            actions={<MomentCardActions canSave={!m.mine} canDelete={m.mine} busy={busyMomentId === m.id} onSave={() => onSave(m)} onDelete={() => onDelete(m)} />}
          />
        </div>
      ))}
    </div>
  )
}

function Masonry({ moments, loading, onOpen, onSave, onDelete, busyMomentId, dateLocale, cols = 2 }: Pick<Props, 'moments' | 'loading' | 'onOpen' | 'onSave' | 'onDelete' | 'busyMomentId' | 'dateLocale'> & { cols?: number }) {
  if (loading)
    return (
      <div className="grid grid-cols-2 gap-4 px-4 py-3" aria-busy="true">
        {[-2, 3, 2, -3].map((t, i) => (
          <PolaroidSkeleton key={i} width="100%" tilt={t} />
        ))}
      </div>
    )
  if (!moments.length) return <Empty />
  // manual masonry: distribute into columns (more robust than CSS multi-column)
  const columns: Moment[][] = Array.from({ length: cols }, () => [])
  moments.forEach((m, i) => columns[i % cols].push(m))
  return (
    <div className="flex gap-4 px-4 pb-6 pt-2">
      {columns.map((col, ci) => (
        <div key={ci} className={cn('flex min-w-0 flex-1 flex-col gap-5', ci % 2 === 1 && 'pt-6')}>
          {col.map((m) => (
            <Polaroid
              key={m.id}
              src={m.src}
              caption={m.caption}
              date={m.date}
              dateLocale={dateLocale}
              frame={m.frame}
              tilt={m.tilt * 0.7}
              width="100%"
              onClick={() => onOpen(m)}
              actions={<MomentCardActions canSave={!m.mine} canDelete={m.mine} busy={busyMomentId === m.id} onSave={() => onSave(m)} onDelete={() => onDelete(m)} />}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Mobile: floating glass bottom sheet with peek / half / full snap heights. */
export function GallerySheet({ snap, setSnap, containerH, bottomOffset, ...p }: Props & { snap: Snap; setSnap: (s: Snap) => void; containerH: number; bottomOffset: number }) {
  const { t } = useLang()
  const heights: Record<Snap, number> = {
    closed: 0,
    peek: 112,
    half: 372,
    full: Math.max(420, containerH - bottomOffset - 120),
  }
  const h = useMotionValue(heights[snap])
  const startH = useRef(0)

  useEffect(() => {
    const ctrl = animate(h, heights[snap], { type: 'spring', stiffness: 380, damping: 38 })
    return () => ctrl.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, containerH])

  const onPanEnd = (_: unknown, info: PanInfo) => {
    const projected = h.get() - info.velocity.y * 0.18
    if (projected < heights.peek * 0.55) return setSnap('closed')
    const order: Snap[] = ['peek', 'half', 'full']
    const best = order.reduce((a, b) => (Math.abs(heights[b] - projected) < Math.abs(heights[a] - projected) ? b : a))
    setSnap(best)
    animate(h, heights[best], { type: 'spring', stiffness: 380, damping: 38 })
  }

  if (snap === 'closed') return null

  return (
    <motion.section
      data-map-ui
      aria-label={t('Gallery ng Moments', 'Moments gallery')}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{ height: h, bottom: bottomOffset }}
      className="glass absolute inset-x-2 z-30 flex flex-col overflow-hidden rounded-[28px] shadow-float"
    >
      <motion.div
        onPanStart={() => (startH.current = h.get())}
        onPan={(_, info) => h.set(Math.max(60, Math.min(heights.full + 30, startH.current - info.offset.y)))}
        onPanEnd={onPanEnd}
        onTap={() => snap === 'peek' && setSnap('half')}
        className="shrink-0 cursor-grab touch-none pb-2 pt-2 active:cursor-grabbing"
      >
        <div className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-fg/25" />
        <Header title={p.title} count={p.moments.length} compact={snap === 'peek'} />
      </motion.div>
      {snap !== 'peek' && (
        <>
          <div className="shrink-0 pb-1">
            <Filters filter={p.filter} setFilter={p.setFilter} />
          </div>
          <div className={cn('min-h-0 flex-1', snap === 'full' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden')}>
            {p.filter === 'log' ? <TravelLog {...p} /> : snap === 'half' ? <Row {...p} /> : <Masonry {...p} />}
          </div>
        </>
      )}
    </motion.section>
  )
}

/** Tablet / desktop: floating docked panel with collapse button. */
export function GalleryDock({ collapsed, setCollapsed, ...p }: Props & { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const { t } = useLang()
  if (collapsed) {
    return (
      <button
        data-map-ui
        onClick={() => setCollapsed(false)}
        className="glass absolute right-4 top-4 z-30 flex h-12 items-center gap-2 rounded-full pl-4 pr-3 font-display text-[14px] font-semibold shadow-float"
      >
        {p.title} · {t(`${p.moments.length} larawan`, `${p.moments.length} ${p.moments.length === 1 ? 'photo' : 'photos'}`)} <ChevronDown size={18} />
      </button>
    )
  }
  return (
    <section data-map-ui aria-label={t('Gallery ng Moments', 'Moments gallery')} className="glass absolute bottom-4 right-4 top-4 z-30 flex w-[360px] flex-col overflow-hidden rounded-[28px] shadow-float">
      <div className="flex shrink-0 items-start gap-2 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <Header title={p.title} count={p.moments.length} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 pb-2 pr-3">
        <div className="min-w-0 flex-1">
          <Filters filter={p.filter} setFilter={p.setFilter} />
        </div>
        <button onClick={() => setCollapsed(true)} aria-label={t('I-collapse ang gallery', 'Collapse gallery')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-fg-2 dark:bg-elevated">
          <ChevronUp size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.filter === 'log' ? <TravelLog {...p} /> : <Masonry {...p} />}
      </div>
    </section>
  )
}
