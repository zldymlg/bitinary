import { CloudCheck, GripVertical, Pencil, Plus, Save, Share, Sparkles, Trash2 } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAccount } from '@/app/account'
import { useItineraryStops, useStore } from '@/app/store'
import { BackButton } from '@/components/layout/TopBar'
import { Jimbot } from '@/components/mascot/Jimbot'
import { ShareSheet, shareOrFallback } from '@/components/ShareSheet'
import { StateView } from '@/components/states/States'
import { Button, IconButton } from '@/components/ui/Button'
import { ProgressRing } from '@/components/ui/Charts'
import { CautionPill, ClosingPill, Pill, VerifiedPill } from '@/components/ui/Pill'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLang } from '@/app/i18n'
import { itineraryById, stopsTotal, type Stop } from '@/data/itineraries'
import { placeById } from '@/data/places'
import { cn } from '@/lib/cn'
import { peso } from '@/lib/format'
import { useOpen } from '@/lib/useOpen'
import { supabase } from '@/lib/supabase'

export function ItineraryScreen() {
  const { id = '' } = useParams()
  return itineraryById(id) ? <ItineraryView id={id} /> : <SavedItineraryDetail id={id} />
}

type SavedItinerary = { id: string; title: string; subtitle: string | null; area: string | null; budget: number }
type SavedItineraryStop = { id: string; business_id: string | null; stop_time: string; name: string; kind: string; cost: number; note: string | null }

function SavedItineraryDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(null)
  const [stops, setStops] = useState<SavedItineraryStop[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error } = await supabase
        .from('itineraries')
        .select('id, title, subtitle, area, budget')
        .eq('id', id)
        .eq('is_saved', true)
        .maybeSingle()
      if (!active) return
      if (error) {
        console.error('Saved itinerary lookup failed', error)
        setFailed(true)
        setLoading(false)
        return
      }
      if (!data) {
        setLoading(false)
        return
      }
      setItinerary({ ...data, budget: Number(data.budget) })
      const { data: savedStops, error: stopsError } = await supabase
        .from('itinerary_stops')
        .select('id, business_id, stop_time, name, kind, cost, note')
        .eq('itinerary_id', id)
        .order('sort_order', { ascending: true })
      if (!active) return
      if (stopsError) {
        console.error('Saved itinerary stops lookup failed', stopsError)
        setFailed(true)
      } else {
        setStops((savedStops ?? []).map((stop) => ({ ...stop, cost: Number(stop.cost) })))
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <main className="mx-auto max-w-[760px] space-y-4 px-4 py-8" aria-busy="true" aria-label={t('Kinukuha ang naka-save na itinerary', 'Loading saved itinerary')}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-20 w-full rounded-[18px]" />
        ))}
      </main>
    )
  }
  if (failed || !itinerary) {
    return (
      <StateView
        expression="unsure"
        title={failed ? 'Hindi ma-load ang itinerary' : 'Walang ganitong naka-save na itinerary'}
        body={failed ? 'Hindi ma-access ang database. Subukan ulit mamaya.' : 'Baka tinanggal na ito o wala kang pahintulot na makita ito.'}
        action="Bumalik"
        onAction={() => navigate(-1)}
      />
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[760px] pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl">
        <BackButton />
        <div className="min-w-0">
          <p className="text-caption text-fg-2">Naka-save na itinerary · {itinerary.area || 'Lugar unavailable'}</p>
          <h1 className="truncate text-h2">{itinerary.title}</h1>
        </div>
      </div>
      {itinerary.subtitle && <p className="px-4 pt-4 text-body text-fg-2">{itinerary.subtitle}</p>}
      <p className="mx-4 mt-4 rounded-2xl bg-surface px-4 py-3 font-semibold">Budget: ₱{itinerary.budget.toLocaleString()}</p>
      <section className="space-y-2 px-4 pt-4">
        <h2 className="text-h3">Mga hinto</h2>
        {stops.length ? stops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            disabled={!stop.business_id}
            onClick={() => stop.business_id && navigate(`/shop/${stop.business_id}`)}
            className="card flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
          >
            <span className="w-20 shrink-0 text-sm text-fg-2">{stop.stop_time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{stop.name}</span>
              <span className="block text-sm text-fg-2">{[stop.kind, stop.note].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="shrink-0 text-sm">₱{stop.cost.toLocaleString()}</span>
          </button>
        )) : <p className="text-sm text-fg-2">Wala pang naka-save na hinto.</p>}
      </section>
    </main>
  )
}

export function ItineraryView({ id, embedded }: { id: string; embedded?: boolean }) {
  const it = itineraryById(id)
  const stops = useItineraryStops(id)
  const { setItineraryStops, showToast } = useStore()
  const [editing, setEditing] = useState(false)
  const [editStop, setEditStop] = useState<Stop | null>(null)
  const [share, setShare] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const open = useOpen()
  const { requireAccount, session } = useAccount()

  useEffect(() => {
    let active = true
    const userId = session?.kind === 'user' ? session.accountId : undefined
    setSaved(false)
    if (!userId) {
      return () => {
        active = false
      }
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('itineraries')
          .select('id')
          .eq('user_id', userId)
          .eq('source_key', `template:${id}`)
          .eq('is_saved', true)
          .maybeSingle()
        if (error) throw error
        if (active) setSaved(Boolean(data))
      } catch (error: unknown) {
        console.error('Could not load saved itinerary status:', error)
        if (active) showToast({ text: 'Hindi ma-check kung naka-save ang itinerary.', expression: 'unsure' })
      }
    })()

    return () => {
      active = false
    }
  }, [id, session?.accountId, session?.kind, showToast])

  if (!it) {
    return <StateView expression="unsure" title="Walang ganitong itinerary" body="Baka nabura na ito." action="Bumalik" onAction={() => navigate('/')} />
  }

  const spent = stopsTotal(stops)
  const remaining = it.budget - spent
  const over = remaining < 0

  const reorder = (next: Stop[]) => {
    // times belong to slots, so the schedule stays chronological
    const times = stops.map((s) => s.time)
    setItineraryStops(id, next.map((s, i) => ({ ...s, time: times[i] })))
  }

  return (
    <main className={cn('pb-32', !embedded && 'md:pb-12')}>
      {/* sticky budget header */}
      <div className={cn('sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-xl', embedded ? 'pr-14' : '')}>
        <div className={cn('mx-auto px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))]', !embedded && 'max-w-[760px] md:px-6 md:pt-6')}>
          <div className="flex items-center gap-2">
            {!embedded && <BackButton />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-caption text-fg-2">
                <Jimbot crop="head" size={20} animate={false} /> Itinerary ni Jimbot <PhaseTag phase="MVP" />
              </p>
              <h1 className="truncate text-h2">{it.title}</h1>
            </div>
            <IconButton label={editing ? 'Tapos na' : 'I-edit'} variant="glass" onClick={() => setEditing((e) => !e)} className={editing ? '!bg-primary !text-ink' : ''}>
              <Pencil size={19} />
            </IconButton>
            <IconButton label="I-share" variant="glass" onClick={() => shareOrFallback({ title: it.title, text: `Itinerary ko sa Bitinary: ${it.title}` }, () => setShare(true))}>
              <Share size={19} />
            </IconButton>
          </div>
          <div className="mt-3 flex items-center gap-4 rounded-[20px] bg-surface p-3 shadow-card">
            <ProgressRing value={spent / it.budget} size={68} stroke={8} color={over ? 'var(--c-danger)' : 'var(--c-primary)'}>
              <span className="font-display text-[15px] font-bold">{Math.round((spent / it.budget) * 100)}%</span>
            </ProgressRing>
            <dl className="grid flex-1 grid-cols-3 gap-2">
              <Stat label="Budget" value={peso(it.budget)} />
              <Stat label="Tantya" value={peso(spent)} />
              <Stat label={over ? 'Sobra' : 'Natitira'} value={peso(Math.abs(remaining))} tone={over ? 'danger' : 'ok'} />
            </dl>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Pill kind="verified" size="sm" icon={<CloudCheck size={13} />}>
              Available offline
            </Pill>
            <span className="text-caption text-fg-2">{stops.length} hinto · {it.area}</span>
          </div>
        </div>
      </div>

      <div className={cn('mx-auto px-4 pt-4', !embedded && 'max-w-[760px] md:px-6')}>
        {editing && (
          <p className="mb-3 rounded-2xl bg-caution-bg px-3 py-2 text-[14px] font-semibold text-caution">
            I-drag ang hawakan para ayusin ang pagkakasunod-sunod. I-tap ang hinto para baguhin.
          </p>
        )}
        <Reorder.Group axis="y" values={stops} onReorder={reorder} className="relative space-y-3">
          <span className="absolute bottom-6 left-[31px] top-6 w-[2px] rounded-full bg-line" aria-hidden />
          {stops.map((s) => (
            <TimelineRow
              key={s.id}
              stop={s}
              editing={editing}
              onOpen={() => (editing ? setEditStop(s) : s.placeId && open.place(s.placeId))}
            />
          ))}
        </Reorder.Group>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" icon={<Plus size={18} />} onClick={() => navigate('/search')}>
            Magdagdag
          </Button>
          <Button variant="secondary" icon={<Sparkles size={18} />} onClick={open.jimbot}>
            Kay Jimbot
          </Button>
        </div>
        <Button
          block
          size="lg"
          className="mt-3"
          icon={<Save size={20} />}
          disabled={saving}
          onClick={() => {
            if (!requireAccount('Para ma-save ang trip mo.')) return
            if (session?.kind !== 'user' || !session.accountId) return

            setSaving(true)
            void (async () => {
              try {
                const { error } = await supabase.rpc('save_traveler_itinerary', {
                  p_source_key: `template:${id}`,
                  p_title: it.title,
                  p_subtitle: it.subtitle,
                  p_budget: it.budget,
                  p_area: it.area,
                  p_stops: stops.map((stop, sort_order) => ({
                    stop_time: stop.time,
                    name: stop.name,
                    kind: stop.kind,
                    cost: stop.cost,
                    note: stop.note ?? null,
                    sort_order,
                  })),
                })
                if (error) throw error
                setSaved(true)
                setEditing(false)
                showToast({ text: saved ? 'Na-update ang itinerary!' : 'Na-save! Makikita mo ito kahit offline.', expression: 'celebrating' })
              } catch (error: unknown) {
              console.error('Could not save itinerary:', error)
              showToast({ text: 'Hindi na-save ang itinerary. Subukan ulit mamaya.', expression: 'unsure' })
              } finally {
                setSaving(false)
              }
            })()
          }}
        >
          {saving ? 'Sine-save…' : saved ? 'I-save ang pagbabago' : 'I-save ang itinerary'}
        </Button>
        <p className="mt-3 text-center text-caption text-fg-2">Ang lahat ng gastos ay tantya batay sa huling verified na presyo.</p>
      </div>

      <EditStopSheet
        stop={editStop}
        onClose={() => setEditStop(null)}
        onSave={(st) => setItineraryStops(id, stops.map((x) => (x.id === st.id ? st : x)))}
        onDelete={(st) => setItineraryStops(id, stops.filter((x) => x.id !== st.id))}
      />
      <ShareSheet open={share} onClose={() => setShare(false)} title={it.title} />
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[12px] text-fg-2">{label}</dt>
      <dd className={cn('font-display text-[16px] font-bold leading-tight', tone === 'ok' && 'text-ok', tone === 'danger' && 'text-danger')}>{value}</dd>
    </div>
  )
}

function TimelineRow({ stop, editing, onOpen }: { stop: Stop; editing: boolean; onOpen: () => void }) {
  const controls = useDragControls()
  const place = stop.placeId ? placeById(stop.placeId) : undefined
  const [time, ampm] = stop.time.includes(' ') && /AM|PM/.test(stop.time) ? stop.time.split(' ') : [stop.time, '']
  return (
    <Reorder.Item value={stop} dragListener={false} dragControls={controls} className="relative flex items-stretch gap-3" whileDrag={{ scale: 1.02, zIndex: 10 }}>
      <div className="relative z-10 flex w-[64px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-primary px-1 py-2 text-ink">
        <span className="text-center font-display text-[15px] font-bold leading-none">{time}</span>
        {ampm && <span className="mt-0.5 font-display text-[11px] font-semibold">{ampm}</span>}
      </div>
      <div className="card flex min-w-0 flex-1 items-center gap-2 p-3">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-caption text-fg-2">{stop.kind}</p>
          <p className="truncate font-display text-[16px] font-semibold">{stop.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {place ? <VerifiedPill days={place.verifiedDays} size="sm" /> : <CautionPill>Tantya lang</CautionPill>}
            {place?.status === 'closingSoon' && <ClosingPill size="sm" at={place.closesAt} />}
          </div>
        </button>
        <div className="shrink-0 text-right">
          <p className="font-display text-[16px] font-bold">{peso(stop.cost)}</p>
          <p className="font-display text-[10px] font-semibold tracking-[0.12em] text-fg-2">TANTYA</p>
        </div>
        <button
          aria-label={`Ilipat ang ${stop.name}`}
          onPointerDown={(e) => controls.start(e)}
          className={cn('-mr-1 flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing', !editing && 'opacity-60')}
        >
          <GripVertical size={20} />
        </button>
      </div>
    </Reorder.Item>
  )
}

function EditStopSheet({ stop, onClose, onSave, onDelete }: { stop: Stop | null; onClose: () => void; onSave: (s: Stop) => void; onDelete: (s: Stop) => void }) {
  const [draft, setDraft] = useState<Stop | null>(null)
  const s = draft?.id === stop?.id ? draft : stop
  return (
    <Sheet open={!!stop} onClose={onClose} title="Baguhin ang hinto">
      {s && (
        <div className="space-y-4">
          <p className="font-display text-[17px] font-semibold">{s.name}</p>
          <label className="block">
            <span className="text-caption text-fg-2">Oras</span>
            <input
              value={s.time}
              onChange={(e) => setDraft({ ...s, time: e.target.value })}
              className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-body outline-none focus:border-primary dark:bg-elevated"
            />
          </label>
          <label className="block">
            <span className="text-caption text-fg-2">Tantyang gastos (₱)</span>
            <input
              type="number"
              inputMode="numeric"
              value={s.cost}
              onChange={(e) => setDraft({ ...s, cost: Number(e.target.value) || 0 })}
              className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-body outline-none focus:border-primary dark:bg-elevated"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="danger" icon={<Trash2 size={18} />} onClick={() => (onDelete(s), onClose())}>
              Alisin
            </Button>
            <Button block onClick={() => (onSave(s), onClose())}>
              I-save
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
