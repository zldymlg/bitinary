import { BedDouble, ChevronRight, Coffee, Landmark, MapPin, Share2, SlidersHorizontal, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { JimbotItineraryDraft, JimbotBudget, JimbotPlaceRef, JimbotWarning } from '@/data/chat'
import { toTripView, type TripStop } from '@/lib/jimbotTrip'
import { cn } from '@/lib/cn'
import { Sheet } from '@/components/ui/Sheet'
import { TripMap } from '@/components/jimbot/trip/TripMap'
import { resolveBusinessImage } from '@/biz/db/assets'

const peso = (n: number) => `₱${n.toLocaleString()}`

function costLabel(s: TripStop) {
  if (s.estCost == null || s.costState === 'unknown') return '—'
  if (s.costState === 'estimated') return `≈ ${peso(s.estCost)}`
  return peso(s.estCost)
}

function categoryIcon(category: string | null): ReactNode {
  const c = (category ?? '').toLowerCase()
  if (/hostel|hotel|stay|resort|inn/.test(c)) return <BedDouble size={18} />
  if (/kapihan|cafe|coffee/.test(c)) return <Coffee size={18} />
  if (/kainan|food|resto|ramen|meal/.test(c)) return <Utensils size={18} />
  if (/pasyalan|park|museum|trail|landmark/.test(c)) return <Landmark size={18} />
  return <MapPin size={18} />
}

function TripPhoto({ source, className, fallback }: {
  source?: string | null
  className: string
  fallback: ReactNode
}) {
  const [resolved, setResolved] = useState<{ source: string; url: string }>()
  useEffect(() => {
    if (!source) return
    let active = true
    void resolveBusinessImage(source).then((url) => {
      if (active) setResolved({ source, url })
    }).catch(() => {
      if (active) setResolved(undefined)
    })
    return () => { active = false }
  }, [source])
  if (!resolved || resolved.source !== source) return fallback
  return <img src={resolved.url} alt="" className={className} onError={() => setResolved(undefined)} />
}

function directionsUrl(stop: TripStop) {
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`
}

export function TripItineraryCard({
  draft,
  budget,
  places,
  warnings,
  saved,
  focusMapToken,
  onOpenBusiness,
  onSave,
  onShare,
  onRefine,
}: {
  draft: JimbotItineraryDraft
  budget?: JimbotBudget | null
  places?: JimbotPlaceRef[]
  warnings?: JimbotWarning[]
  saved?: boolean
  focusMapToken?: number
  onOpenBusiness: (id: string) => void
  onSave: () => void
  onShare: () => void
  onRefine: (text: string) => void
}) {
  const trip = useMemo(
    () => toTripView({ itineraryDraft: draft, budget, places, warnings }, { includeTransfers: true }),
    [draft, budget, places, warnings],
  )
  const [mode, setMode] = useState<'day' | 'map'>('day')
  const [day, setDay] = useState(trip?.days[0]?.dayNumber ?? 1)
  const [open, setOpen] = useState<TripStop | null>(null)
  const [refineOpen, setRefineOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (focusMapToken == null) return
    setMode('map')
  }, [focusMapToken])

  if (!trip) return null
  const active = trip.days.find((d) => d.dayNumber === day) ?? trip.days[0]
  const stops = active.stops
  const preview = stops.slice(0, 3)
  const more = Math.max(0, stops.length - preview.length)
  const shown = expanded ? stops : preview
  const hero = stops.find((s) => s.photo)?.photo ?? places?.find((p) => p.photo)?.photo
  const lodgingId = draft.lodgingBusinessId
  const lodging = lodgingId ? places?.find((p) => p.businessId === lodgingId) : null

  const shape = stops.map((s) => s.name.split(' ')[0]).slice(0, 4).join(' → ')
  const approxTotal = trip.knownListed + trip.estimatedTotal
  const budgetLine =
    trip.budgetLimit == null
      ? trip.unknownCount > 0
        ? `≈ ${peso(approxTotal)} · ${trip.unknownCount} costs unconfirmed`
        : `≈ ${peso(approxTotal)}`
      : trip.unknownCount > 0
        ? `≈ ${peso(approxTotal)} of ${peso(trip.budgetLimit)} · ${trip.unknownCount} unconfirmed`
        : `${trip.over ? 'Over' : '≈'} ${peso(approxTotal)} of ${peso(trip.budgetLimit)}`

  return (
    <article className="overflow-hidden rounded-[22px] bg-[#2b1e18] text-[#f5f0eb] shadow-sm">
      <div className="relative h-36">
        <TripPhoto source={hero} className="h-full w-full object-cover"
          fallback={<div className="h-full w-full bg-gradient-to-br from-[#6b3a22] to-[#2b1e18]" />} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2b1e18] to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="mb-1 inline-flex rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-[#f5f0eb]">Verified spots</p>
          <h3 className="font-display text-[28px] font-semibold leading-none">{trip.destination}</h3>
          <p className="mt-1 text-[13px] text-[#c6b5a9]">
            {trip.durationDays} {trip.durationDays === 1 ? 'day' : 'days'}
            {trip.budgetLimit != null ? ` · ${peso(trip.budgetLimit)} budget` : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3">
        <p className={cn('text-[13px]', trip.over ? 'text-[#e5766a]' : 'text-[#c6b5a9]')}>{budgetLine}</p>

        <div className="flex min-h-11 overflow-hidden rounded-full bg-[#35251e] p-1">
          {trip.days.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setMode('day')
                setDay(d.dayNumber)
                setExpanded(false)
              }}
              className={cn(
                'min-h-9 flex-1 rounded-full px-2 text-[13px] transition-colors duration-150',
                mode === 'day' && day === d.dayNumber ? 'bg-[#ef7f27] text-white' : 'text-[#c6b5a9]',
              )}
            >
              Day {d.dayNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode('map')}
            className={cn(
              'min-h-9 flex-1 rounded-full px-2 text-[13px] transition-colors duration-150',
              mode === 'map' ? 'bg-[#ef7f27] text-white' : 'text-[#c6b5a9]',
            )}
          >
            Map
          </button>
        </div>

        {mode === 'map' ? (
          <TripMap stops={stops} onSelect={setOpen} />
        ) : (
          <>
            {shape && <p className="px-1 text-[12px] text-[#a38d7f]">{shape}</p>}
            {lodging && (
              <div className="flex items-center gap-2 rounded-xl bg-[#35251e] px-3 py-2 text-[13px] text-[#c6b5a9]">
                <BedDouble size={16} className="text-[#f09a50]" />
                <span className="min-w-0 flex-1 truncate">{lodging.name ?? 'Stay'} · lodging anchor</span>
              </div>
            )}
            <ol className="overflow-hidden rounded-2xl bg-[#35251e]">
              {shown.map((s, idx) => (
                <li key={s.id}>
                  {s.transferFromPreviousMinutes != null && (
                    <p className="border-t border-white/[0.08] px-3 py-1.5 pl-[4.25rem] text-[11px] text-[#a38d7f]">
                      {s.transferLabel ?? 'Transfer'} · {s.transferFromPreviousMinutes} min
                      {s.transferCost ? ` · ≈ ${peso(s.transferCost)}` : ''}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(s)}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left',
                      idx > 0 && !s.transferFromPreviousMinutes && 'border-t border-white/[0.08]',
                    )}
                  >
                    <span className="w-11 shrink-0 text-[13px] text-[#c6b5a9]">{s.time ?? '—'}</span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#2b1e18] text-[#f09a50]">
                      <TripPhoto source={s.photo} className="h-full w-full object-cover" fallback={categoryIcon(s.category)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{s.name}</span>
                      <span className="block truncate text-[13px] text-[#a38d7f]">{s.category}</span>
                    </span>
                    <span className="text-[13px] text-[#f5f0eb]">{costLabel(s)}</span>
                    <ChevronRight size={16} className="text-[#a38d7f]" />
                  </button>
                </li>
              ))}
            </ol>
            {more > 0 && !expanded && (
              <button type="button" onClick={() => setExpanded(true)} className="w-full text-center text-[13px] text-[#f09a50]">
                +{more} more
              </button>
            )}
          </>
        )}

        <button type="button" onClick={() => setBudgetOpen((v) => !v)} className="w-full rounded-2xl bg-[#35251e] p-3 text-left">
          <p className="text-[12px] uppercase tracking-wide text-[#a38d7f]">
            {trip.budgetConfidence === 'solid' ? 'Listed total' : trip.budgetConfidence === 'rough' ? 'Rough total' : 'Incomplete total'}
          </p>
          <p className={cn('font-display text-[22px] font-semibold', trip.over && 'text-[#e5766a]')}>
            {trip.unknownCount > 0 ? `≈ ${peso(approxTotal)}` : peso(approxTotal)}
            {trip.budgetLimit != null ? ` / ${peso(trip.budgetLimit)}` : ''}
          </p>
          {(trip.stayTotal > 0 || trip.daySpendTotal > 0) && (
            <p className="mt-1 text-[12px] text-[#c6b5a9]">
              Stay {peso(trip.stayTotal)} + day spend ≈ {peso(trip.daySpendTotal)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-[#c6b5a9]">
            {trip.over
              ? 'Over the budget you set.'
              : trip.budgetLimit != null
                ? trip.unknownCount > 0
                  ? 'May lumampas, some prices unconfirmed.'
                  : 'Fits the known estimates.'
                : 'No budget limit set.'}
          </p>
          {trip.over && (
            <button
              type="button"
              className="mt-2 min-h-11 w-full rounded-full bg-[#ef7f27]/40 px-3 text-sm font-medium text-[#f5f0eb]"
              onClick={(e) => {
                e.stopPropagation()
                onRefine('Pasukin sa budget, gawing mas mura ang plan.')
              }}
            >
              Make it fit
            </button>
          )}
          {budgetOpen &&
            trip.lines.map((l, i) => (
              <p key={i} className="mt-1 flex justify-between text-[12px]">
                <span>
                  {l.label}
                  {l.estimate ? ' (est.)' : ''}
                </span>
                <span>{peso(l.amount)}</span>
              </p>
            ))}
        </button>

        <div className="flex gap-2">
          <button type="button" onClick={onSave} className="min-h-11 flex-1 rounded-full bg-[#ef7f27] px-4 text-sm font-semibold text-white">
            {saved ? 'Saved' : 'Save plan'}
          </button>
          <button type="button" aria-label="Refine" onClick={() => setRefineOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#35251e]">
            <SlidersHorizontal size={18} />
          </button>
          <button type="button" aria-label="Share" onClick={onShare} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#35251e]">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? 'Stop'}>
        {open && (
          <div className="space-y-3 text-sm">
            <TripPhoto source={open.photo} className="h-36 w-full rounded-xl object-cover"
              fallback={<div className="flex h-24 items-center justify-center rounded-xl bg-sunken text-[#f09a50]">{categoryIcon(open.category)}</div>} />
            <p className="text-fg-2">{open.area}</p>
            <p>
              {open.time ?? 'Time not set'} · {open.category}
            </p>
            <p>{open.estCost == null || open.costState === 'unknown' ? 'Price varies / unknown' : `${costLabel(open)} (${open.costState})`}</p>
            <a
              href={directionsUrl(open)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#ef7f27] font-semibold text-white"
            >
              Directions
            </a>
            <button type="button" className="min-h-11 w-full rounded-full bg-primary text-white" onClick={() => onOpenBusiness(open.businessId)}>
              Open shop
            </button>
            <button
              type="button"
              className="min-h-11 w-full rounded-full border border-line"
              onClick={() => {
                onRefine(`Palitan ang ${open.name}, same area and budget.`)
                setOpen(null)
              }}
            >
              Swap this stop
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={refineOpen} onClose={() => setRefineOpen(false)} title="Refine">
        <div className="flex flex-col gap-2">
          {[
            ['Make it fit', 'Pasukin sa budget, gawing mas mura ang plan.'],
            ['Cheaper', 'Pwede bang mas mura ang version nito?'],
            ['Shorter travel', 'Paikliin ang biyahe, mas malapit na stops.'],
            ['Swap a stop', `Palitan ang ${active.stops[0]?.name ?? 'isang stop'}, same area and budget.`],
          ].map(([label, text]) => (
            <button
              key={label}
              type="button"
              className="min-h-11 rounded-xl bg-sunken px-3 text-left"
              onClick={() => {
                setRefineOpen(false)
                onRefine(text)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>
    </article>
  )
}
