import { BadgeCheck, Bookmark, Captions, CaptionsOff, Clock, Heart, MapPin, MapPinPlus, MessageCircle, Play, Send, Share, Volume2, VolumeX } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAccount } from '@/app/account'
import { useLang } from '@/app/i18n'
import { useStore } from '@/app/store'
import { BizLogo, ReelMedia } from '@/components/cards/ReelCard'
import { BackButton } from '@/components/layout/TopBar'
import { Jimbot } from '@/components/mascot/Jimbot'
import { ShareSheet, shareOrFallback } from '@/components/ShareSheet'
import { OfflineState, StateView } from '@/components/states/States'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { SponsoredTag, VerifiedPill } from '@/components/ui/Pill'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { placeById } from '@/data/places'
import { reelComments, reels, type Reel } from '@/data/reels'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { compact } from '@/lib/format'
import { isDatabaseBusinessId, persistSavedPlace } from '@/lib/savedPlaces'
import { useOnline } from '@/lib/useOnline'

const DURATION = 9 // seconds per reel preview

export function ReelsViewer() {
  const { id } = useParams()
  const forced = getForcedState()
  const online = useOnline()
  const startIndex = Math.max(0, reels.findIndex((r) => r.id === id))
  const [active, setActive] = useState(startIndex)
  const [muted, setMuted] = useState(true)
  const { subtitles, setSubtitles } = useStore()
  const [comments, setComments] = useState(false)
  const [share, setShare] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const list = forced === 'empty' ? [] : reels

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: startIndex * el.clientHeight })
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { root: el, threshold: 0.6 },
    )
    el.querySelectorAll('[data-index]').forEach((n) => io.observe(n))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const r = list[active]
    if (r) navigate(`/reels/${r.id}${location.search}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const next = () => {
    const el = ref.current
    if (el && active < list.length - 1) el.scrollTo({ top: (active + 1) * el.clientHeight, behavior: 'smooth' })
  }

  const current = list[active]
  const place = current ? placeById(current.placeId) : undefined

  return (
    <main className="fixed inset-0 bg-[#0D0604] text-white" style={{ colorScheme: 'dark' }}>
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))] md:px-6">
        <BackButton tone="dark" />
        <span className="flex items-center gap-2 font-display text-[17px] font-semibold drop-shadow">
          Reels <PhaseTag phase="P3" />
        </span>
        <div className="flex gap-2">
          <button
            aria-label={subtitles ? 'Itago ang captions' : 'Ipakita ang Tagalog captions'}
            aria-pressed={subtitles}
            onClick={() => setSubtitles(!subtitles)}
            className="glass-dark flex h-11 w-11 items-center justify-center rounded-full"
          >
            {subtitles ? <Captions size={20} /> : <CaptionsOff size={20} />}
          </button>
          <button aria-label={muted ? 'I-unmute' : 'I-mute'} aria-pressed={!muted} onClick={() => setMuted((m) => !m)} className="glass-dark flex h-11 w-11 items-center justify-center rounded-full">
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {!online ? (
        <div className="flex h-full items-center justify-center">
          <OfflineState tone="dark" body="Hindi ma-play ang Reels nang walang internet. Subukan ulit kapag may signal na." />
        </div>
      ) : forced === 'loading' ? (
        <ReelSkeleton />
      ) : !list.length ? (
        <div className="flex h-full items-center justify-center">
          <StateView tone="dark" expression="sleeping" title="Wala pang Reels dito" body="Wala pang nagpo-post ng video malapit sa iyo. Balikan mo mamaya!" action="Bumalik sa Home" onAction={() => navigate('/')} />
        </div>
      ) : (
        <div ref={ref} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
          {list.map((r, i) => (
            <ReelSlide
              key={r.id}
              reel={r}
              index={i}
              active={i === active}
              buffering={forced === 'buffering' && i === active}
              onEnded={next}
              onComments={() => setComments(true)}
              onShare={() => shareOrFallback({ title: placeById(r.placeId)!.name, text: r.caption }, () => setShare(true))}
            />
          ))}
        </div>
      )}

      <Sheet open={comments} onClose={() => setComments(false)} title={`${current ? compact(current.comments) : ''} komento`}>
        <ul className="space-y-4">
          {reelComments.map((c) => (
            <li key={c.name + c.text} className="flex gap-3">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-semibold text-white', c.owner ? 'bg-primary' : 'bg-brown-mid')}>{c.name[0]}</span>
              <div>
                <p className="text-[14px]">
                  <b className="font-display font-semibold">{c.name}</b> {c.owner && <BadgeCheck size={14} className="inline text-ok" />} <span className="text-fg-2">· {c.time}</span>
                </p>
                <p className="text-body">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => e.preventDefault()} className="mt-5 flex items-center gap-2 rounded-full bg-sunken pl-4 pr-1.5 dark:bg-elevated">
          <input placeholder="Magkomento…" className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-fg-2" aria-label="Komento" />
          <button aria-label="Ipadala" className="flex h-10 w-10 items-center justify-center rounded-full bg-deep text-white">
            <Send size={17} />
          </button>
        </form>
      </Sheet>
      <ShareSheet open={share} onClose={() => setShare(false)} title={place?.name ?? 'Reel'} />
    </main>
  )
}

function ReelSlide({
  reel,
  index,
  active,
  buffering,
  onEnded,
  onComments,
  onShare,
}: {
  reel: Reel
  index: number
  active: boolean
  buffering: boolean
  onEnded: () => void
  onComments: () => void
  onShare: () => void
}) {
  const place = placeById(reel.placeId)!
  const navigate = useNavigate()
  const { t } = useLang()
  const { dataSaver, subtitles, saved, toggleSaved, addStop, showToast } = useStore()
  const { requireAccount, session } = useAccount()
  const [liked, setLiked] = useState(false)
  const [following, setFollowing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [paused, setPaused] = useState(false)
  const [userPlay, setUserPlay] = useState(false)
  const autoplay = !dataSaver || userPlay
  const playing = active && autoplay && !paused && !buffering
  const isSaved = saved.includes(place.id)

  useEffect(() => {
    if (!active) {
      setPaused(false)
      setUserPlay(false)
    }
  }, [active])

  return (
    <section data-index={index} className="relative flex h-full w-full snap-start snap-always items-center justify-center" aria-label={`Reel ${index + 1} ng ${reels.length}`}>
      <div className="relative h-full w-full overflow-hidden md:aspect-[9/16] md:h-[calc(100%-32px)] md:w-auto md:rounded-[28px]">
        <button className="absolute inset-0" aria-label={playing ? 'I-pause' : 'I-play'} onClick={() => (autoplay ? setPaused((p) => !p) : setUserPlay(true))}>
          <ReelMedia reel={reel} playing={playing} className={cn(!playing && '[animation-play-state:paused]')} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent via-40% to-black/85" />

        <AnimatePresence>
          {active && !autoplay && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserPlay(true)}
              className="glass-dark absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-[24px] px-5 py-4"
            >
              <Play size={36} fill="white" />
              <span className="font-display text-[13px] font-medium">Data saver · I-tap para i-play</span>
            </motion.button>
          )}
          {active && autoplay && paused && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-dark pointer-events-none absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
              <Play size={34} fill="white" className="ml-1" />
            </motion.span>
          )}
          {buffering && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center bg-black/50" aria-busy="true">
              <Skeleton className="absolute inset-0 rounded-none bg-white/10" />
              <span className="glass-dark relative rounded-full px-4 py-2 font-display text-[14px] font-medium">{t('Naglo-load…', 'Loading…')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* right action stack */}
        <div className="absolute bottom-[200px] right-2.5 z-10 flex flex-col items-center gap-3.5">
          <Action label={compact(reel.likes + (liked ? 1 : 0))} aria={liked ? 'Alisin ang like' : 'I-like'} onClick={() => setLiked((v) => !v)}>
            <Heart size={27} className={liked ? 'text-[#FF5A5A]' : ''} fill={liked ? 'currentColor' : 'none'} />
          </Action>
          <Action label={compact(reel.comments)} aria="Mga komento" onClick={onComments}>
            <MessageCircle size={27} />
          </Action>
          <Action
            label={isSaved ? 'Naka-save' : 'I-save'}
            aria="I-save"
            onClick={async () => {
              if (!isSaved && !requireAccount('Para ma-save ang lugar na ito.')) return
              try {
                if (isDatabaseBusinessId(place.id)) {
                  if (session?.kind !== 'user' || !session.accountId) {
                    showToast({ text: 'Hindi ma-verify ang iyong account. Mag-sign in ulit at subukan muli.' })
                    return
                  }
                  await persistSavedPlace(session.accountId, place.id, !isSaved)
                }
                toggleSaved(place.id)
                if (!isSaved) showToast({ text: 'Na-save ang lugar!', expression: 'celebrating' })
              } catch (error: unknown) {
                showToast({ text: error instanceof Error ? error.message : 'Could not update saved places.' })
              }
            }}
          >
            <Bookmark size={26} fill={isSaved ? 'currentColor' : 'none'} />
          </Action>
          <Action label="I-share" aria="I-share" onClick={onShare}>
            <Share size={25} />
          </Action>
          <Action
            label="Itinerary"
            aria="Idagdag sa itinerary"
            highlight
            onClick={() => {
              if (!requireAccount('Para maidagdag ito sa trip mo.')) return
              addStop('it1', { id: `${place.id}-${Date.now()}`, time: '5:00 PM', name: place.name, placeId: place.id, kind: 'Pagkain', cost: place.menu[0]?.price ?? 0 })
              showToast({ text: 'Naidagdag sa itinerary mo!', expression: 'celebrating', action: { label: 'Tingnan', to: '/itinerary/it1' } })
            }}
          >
            <MapPinPlus size={25} />
          </Action>
        </div>

        {/* bottom info */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
          {subtitles && active && (
            <p className="pointer-events-none mb-4 pr-16 text-center">
              <span className="rounded-lg bg-black/65 px-2 py-1 font-display text-[16px] font-medium leading-8 [box-decoration-break:clone]">{reel.subtitle}</span>
            </p>
          )}
          <div className="pr-16">
            <div className="flex items-center gap-2">
              <BizLogo placeId={place.id} size={38} />
              <span className="truncate font-display text-[16px] font-semibold">{place.name}</span>
              <BadgeCheck size={18} className="shrink-0 text-[#7BE09A]" aria-label="Verified" />
              <button
                onClick={() => setFollowing((f) => !f)}
                className={cn('h-8 shrink-0 rounded-full px-3 font-display text-[13px] font-semibold', following ? 'border border-white/50 text-white' : 'bg-white text-ink')}
              >
                {following ? 'Sinusundan' : 'Sundan'}
              </button>
            </div>
            {reel.sponsored && <SponsoredTag className="mt-2" />}
            <button onClick={() => setExpanded((e) => !e)} className={cn('mt-2 block text-left text-[15px] leading-[21px]', !expanded && 'line-clamp-2')}>
              {reel.caption} <span className="font-semibold text-[#FFB27A]">{reel.hashtags.join(' ')}</span>
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold">
              <VerifiedPill days={place.verifiedDays} size="sm" />
              <span>{place.priceRange} {place.priceText}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {place.distance}
              </span>
            </div>
          </div>

          {/* floating shop card */}
          <div className="glass-dark mt-3 rounded-[20px] p-2.5">
            <div className="flex items-center gap-3">
              <img src={`https://images.unsplash.com/${place.image}?auto=format&fit=crop&w=120&h=120&q=60`} alt="" className="h-11 w-11 shrink-0 rounded-[12px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-[#FFB27A]">Bisitahin ang shop</p>
                <p className="truncate font-display text-[15px] font-semibold leading-tight">{place.name}</p>
              </div>
              <p className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-white/85">
                <Clock size={12} /> {place.hours}
              </p>
            </div>
            <button onClick={() => navigate(`/shop/${place.id}`)} className="mt-2 h-10 w-full rounded-full bg-primary font-display text-[14px] font-semibold text-ink">
              Tingnan ang detalye
            </button>
          </div>

          {/* progress */}
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/25" aria-hidden>
            {active && (
              <div
                key={`${reel.id}-${autoplay}`}
                className="h-full origin-left rounded-full bg-primary"
                style={{
                  animation: `progress ${DURATION}s linear forwards`,
                  animationPlayState: playing ? 'running' : 'paused',
                }}
                onAnimationEnd={onEnded}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Action({ children, label, aria, onClick, highlight }: { children: React.ReactNode; label: string; aria: string; onClick: () => void; highlight?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={aria} className="flex w-14 flex-col items-center gap-0.5">
      <span className={cn('flex h-12 w-12 items-center justify-center rounded-full', highlight ? 'bg-primary text-ink' : 'glass-dark')}>{children}</span>
      <span className="font-display text-[12px] font-semibold drop-shadow">{label}</span>
    </motion.button>
  )
}

function ReelSkeleton() {
  return (
    <div className="relative mx-auto h-full w-full overflow-hidden md:aspect-[9/16] md:h-[calc(100%-32px)] md:w-auto md:translate-y-4 md:rounded-[28px]">
      <div className="absolute inset-0 animate-pulse bg-[#2A150C]" />
      <div className="absolute bottom-[200px] right-3 space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
      <div className="absolute inset-x-4 bottom-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
        <div className="h-16 w-full animate-pulse rounded-[20px] bg-white/10" />
      </div>
    </div>
  )
}
