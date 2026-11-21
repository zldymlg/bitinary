import { CalendarPlus, Clock, ExternalLink, MapPin, MoreHorizontal, Navigation, PenLine, Phone, Share, Star, Tag, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Dropdown from 'react-bootstrap/Dropdown'
import Nav from 'react-bootstrap/Nav'
import Placeholder from 'react-bootstrap/Placeholder'
import Tab from 'react-bootstrap/Tab'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAccount } from '@/app/account'
import { useLang } from '@/app/i18n'
import { useBusinessFeed } from '@/app/social'
import { useStore } from '@/app/store'
import { AddToItinerarySheet } from '@/components/AddToItinerarySheet'
import { HeartButton } from '@/components/cards/ListingCard'
import { ReelCard } from '@/components/cards/ReelCard'
import { BackButton } from '@/components/layout/TopBar'
import { MiniMap } from '@/components/map/MiniMap'
import { BizLogo, PersonAvatar } from '@/components/profile/Bits'
import { PhotoViewer } from '@/components/profile/bs'
import { IntroCard, MenuCard, PhotosCard } from '@/components/profile/Intro'
import { CommentsSheet, PostCard } from '@/components/profile/PostCard'
import { ReviewSheet, ReviewsTab } from '@/components/profile/Reviews'
import { ShareSheet, shareOrFallback } from '@/components/ShareSheet'
import { StateView } from '@/components/states/States'
import { Button } from '@/components/ui/Button'
import { ClosingPill, Pill, QueuePill, VerifiedPill } from '@/components/ui/Pill'
import { placeById, type Place } from '@/data/places'
import { reels } from '@/data/reels'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { img, peso } from '@/lib/format'
import { googleMapsDirectionsUrl } from '@/lib/maps'
import { useMediaQuery } from '@/lib/useMedia'
import { DatabaseBusinessProfile } from './DatabaseBusinessProfile'

type TabKey = 'posts' | 'reviews' | 'menu' | 'photos' | 'reels' | 'about'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts', label: 'Mga Post' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'menu', label: 'Menu' },
  { key: 'photos', label: 'Larawan' },
  { key: 'reels', label: 'Reels' },
  { key: 'about', label: 'About' },
]

export function ShopDetailScreen() {
  const { id = '' } = useParams()
  return <ShopDetail id={id} />
}

/** Facebook-style business profile. `embedded` is the compact desktop side-panel version. */
export function ShopDetail({ id, embedded }: { id: string; embedded?: boolean }) {
  const place = placeById(id)
  if (!place) return <DatabaseBusinessProfile id={id} />
  return <Profile key={place.id} place={place} embedded={embedded} />
}

function Profile({ place, embedded }: { place: Place; embedded?: boolean }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { requireAccount } = useAccount()
  const { showToast, setPanel } = useStore()
  const live = useBusinessFeed(place.id)
  const forced = getForcedState()
  const feed = forced === 'empty' ? { ...live, posts: [], reviews: [] } : live
  const loading = forced === 'loading'
  // Facebook two-column layout only on the full page, from 1024px.
  const fb = useMediaQuery('(min-width: 1024px)') && !embedded

  // The desktop side panel shares the page URL, so its params are prefixed.
  const k = (n: string) => (embedded ? `p${n}` : n)
  const tab = (TABS.some((t) => t.key === params.get(k('tab'))) ? params.get(k('tab')) : 'posts') as TabKey
  const commentsId = params.get(k('comments'))
  const reviewOpen = !!params.get(k('review'))
  const setParam = (name: string, v: string | null, push = false) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k(name), v)
    else n.delete(k(name))
    setParams(n, { replace: !push, preventScrollReset: true })
  }

  const [addOpen, setAddOpen] = useState(false)
  const [share, setShare] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ list: string[]; i: number } | null>(null)

  const photos = useMemo(() => [...new Set([...(place.gallery ?? [place.image]), ...feed.posts.filter((p) => p.kind !== 'video').flatMap((p) => p.media), ...feed.reviews.flatMap((r) => r.photos)])], [place, feed.posts, feed.reviews])
  const openPhoto = (m: string) => setViewer({ list: photos.includes(m) ? photos : [m], i: Math.max(0, photos.indexOf(m)) })
  const commentsPost = commentsId ? (feed.posts.find((p) => p.id === commentsId) ?? null) : null
  const placeReels = reels.filter((r) => r.placeId === place.id)
  const menu = live.menu?.length ? live.menu.map((m) => ({ name: m.name, price: Number(m.price) || 0, note: m.category })) : place.menu

  const writeReview = () => {
    if (!requireAccount('Para makapag-review ng negosyo.')) return
    setParam('review', live.myReview ? 'edit' : 'new', true)
  }
  const sharePlace = (text = `Tingnan ang ${place.name} sa Bitinary`) => shareOrFallback({ title: place.name, text }, () => setShare(true))
  const goTab = (t: TabKey) => setParam('tab', t === 'posts' ? null : t)

  const actions = (
    <div className={cn('gap-2', fb ? 'flex flex-wrap items-center justify-end' : 'mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]')}>
      <Button icon={<PenLine size={18} />} onClick={writeReview} className={cn(!fb && 'whitespace-nowrap !px-3')}>
        {live.myReview ? 'I-edit ang review' : 'Mag-review'}
      </Button>
      <Button variant="secondary" icon={<CalendarPlus size={18} />} onClick={() => setAddOpen(true)} className={cn(!fb && 'whitespace-nowrap !px-3')}>
        <span className="truncate">Sa itinerary</span>
      </Button>
      <Dropdown align="end">
        <Dropdown.Toggle as="button" bsPrefix="bitinary-more" aria-label="Iba pang opsyon" className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-fg dark:bg-elevated">
          <MoreHorizontal size={20} />
        </Dropdown.Toggle>
        <Dropdown.Menu className="min-w-[220px] rounded-[18px] border border-line p-1.5 shadow-float">
          <Dropdown.Item as="button" onClick={() => sharePlace()} className="flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium">
            <Share size={18} className="text-link" /> I-share ang profile
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )

  const identity = (
    <div className={cn(fb ? 'min-w-0 flex-1 pb-2 pt-4' : 'mt-3')}>
      <h1 className={cn(fb ? 'text-[32px] font-bold leading-tight' : 'text-title', 'font-display')}>{place.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-body text-fg-2">
        <span className="inline-flex items-center gap-1 font-display font-semibold text-fg">
          <Star size={16} className="text-amber" fill="currentColor" strokeWidth={0} /> {feed.stats.rating.toFixed(1)}
        </span>
        <button onClick={() => goTab('reviews')} className="hover:underline">
          ({feed.stats.reviewCount.toLocaleString()} review)
        </button>
        <span aria-hidden>·</span>
        <span>{place.category}</span>
        <span aria-hidden>·</span>
        <span>{place.area}</span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <VerifiedPill days={place.verifiedDays} />
        {place.status === 'closingSoon' ? <ClosingPill at={place.closesAt} /> : place.status === 'closed' ? <Pill kind="neutral">Sarado ngayon</Pill> : <Pill kind="open">Bukas ngayon</Pill>}
        {place.queue && <QueuePill queue={place.queue} />}
      </div>
    </div>
  )

  const postsList = feed.posts.length ? (
    <div className="space-y-3">
      <p className="text-caption text-fg-2">Sample data</p>
      {feed.posts.map((p) => (
        <PostCard key={p.id} post={p} place={place} feed={feed} onComments={() => setParam('comments', p.id, true)} onShare={() => sharePlace(`${place.name}: ${p.title ?? p.text}`)} onPhoto={openPhoto} />
      ))}
    </div>
  ) : (
    <StateView expression="camera" size={110} title="Wala pang post" body="Hindi pa nagpo-post ang negosyong ito. Balikan mo mamaya!" className="py-8" />
  )

  const panes: Record<TabKey, ReactNode> = {
    posts: fb ? (
      <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-6">
        <aside className="sticky top-6 space-y-4">
          <IntroCard place={place} />
          <PhotosCard photos={photos} onOpen={(i) => setViewer({ list: photos, i })} onAll={() => goTab('photos')} />
          <MenuCard menu={menu} onAll={() => goTab('menu')} />
        </aside>
        <div className="mx-auto w-full max-w-[680px] space-y-3">
          <Composer nick={live.nick} place={place} onClick={writeReview} />
          {postsList}
        </div>
      </div>
    ) : (
      postsList
    ),
    reviews: <ReviewsTab place={place} feed={feed} onWrite={writeReview} onPhoto={openPhoto} highlight={highlight} />,
    menu: (
      <div>
        <ul className="overflow-hidden rounded-[20px] bg-surface shadow-card">
          {menu.map((m, i) => (
            <li key={m.name + i} className={cn('flex items-center justify-between gap-3 px-4 py-3.5', i && 'border-t border-line')}>
              <div>
                <p className="text-body font-semibold">{m.name}</p>
                {m.note && <p className="text-caption text-fg-2">{m.note}</p>}
              </div>
              <span className="font-display text-[16px] font-semibold">{peso(m.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-caption text-fg-2">{live.menu?.length ? 'Galing mismo sa may-ari ang menu na ito. Maaaring magbago.' : `Huling na-verify ang presyo ${place.verifiedDays} araw na ang nakalipas. Maaaring magbago.`}</p>
      </div>
    ),
    photos: (
      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-[20px] md:grid-cols-4">
        {photos.map((p, i) => (
          <button key={p} onClick={() => setViewer({ list: photos, i })} className="aspect-square overflow-hidden bg-sunken" aria-label={`Larawan ${i + 1}`}>
            <img src={p.startsWith('data:') || p.startsWith('http') ? p : img(p, 400, 400)} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
    ),
    reels: placeReels.length ? (
      <div className="flex flex-wrap gap-3">
        {placeReels.map((r) => (
          <ReelCard key={r.id} reel={r} />
        ))}
      </div>
    ) : (
      <StateView expression="camera" size={110} title="Wala pang reels" body="Hindi pa nagpo-post ng video ang shop na ito." className="py-6" />
    ),
    about: <About place={place} />,
  }

  return (
    <main className={cn('relative', embedded ? 'pb-10' : 'pb-32 md:pb-16')}>
      {/* Cover + logo */}
      <div className={cn('relative', !embedded && (fb ? 'mx-auto max-w-[1100px] px-6 pt-6' : 'md:mx-6 md:mt-6'))}>
        <div className={cn('relative overflow-hidden', embedded ? 'h-[160px]' : fb ? 'h-[340px] rounded-b-[24px] rounded-t-[24px]' : 'h-[210px] md:h-[320px] md:rounded-[28px]')}>
          <img src={img(place.image, 1600, 700)} alt="" width={1600} height={700} fetchPriority="high" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/20" />
          <div className={cn('absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]', embedded && 'pr-16')}>
            {!embedded ? <BackButton /> : <span />}
            <div className="flex gap-2">
              <button aria-label="I-share" onClick={() => sharePlace()} className="glass flex h-11 w-11 items-center justify-center rounded-full shadow-float">
                <Share size={19} />
              </button>
              <HeartButton id={place.id} />
            </div>
          </div>
        </div>
        {fb ? (
          <div className="flex items-end gap-5 px-6">
            <BizLogo place={place} size={140} className="-mt-16 ring-4 ring-bg" />
            {identity}
            <div className="pb-3">{actions}</div>
          </div>
        ) : (
          <div className={cn('relative px-4', !embedded && 'md:px-8')}>
            <BizLogo place={place} size={embedded ? 76 : 104} className={cn('ring-4 ring-bg', embedded ? '-mt-10' : '-mt-12 md:-mt-16')} />
          </div>
        )}
      </div>

      <div className={cn('px-4', !embedded && (fb ? 'mx-auto max-w-[1100px] px-6' : 'md:mx-auto md:max-w-[820px] md:px-6'))}>
        {!fb && identity}
        {!fb && actions}
        {embedded && (
          <Button
            variant="ghost"
            block
            className="mt-2"
            icon={<ExternalLink size={17} />}
            onClick={() => {
              setPanel(null)
              navigate(`/shop/${place.id}`)
            }}
          >
            Tingnan ang buong profile
          </Button>
        )}

        <Tab.Container activeKey={tab} onSelect={(key) => key && goTab(key as TabKey)}>
          {/* Tabs: segmented pills on phones and the side panel, Facebook underline tabs on desktop. */}
          <div className={cn('sticky z-20 -mx-4 bg-bg/95 px-4 backdrop-blur', fb ? 'top-0 mt-4 border-b border-line' : 'top-0 mt-4 py-2 pt-[max(8px,env(safe-area-inset-top))] md:pt-2', embedded && 'pt-2')}>
            <div className="no-scrollbar overflow-x-auto">
              <Nav as="div" role="tablist" aria-label="Mga seksyon ng profile" className={cn('flex flex-nowrap', fb ? 'gap-1' : 'h-10 min-w-[480px] items-center rounded-full bg-sunken p-1 dark:bg-elevated')}>
                {TABS.map((t) => (
                  <Nav.Item key={t.key} as="div" className={cn(fb ? '' : 'h-8 flex-1')}>
                    <Nav.Link
                      as="button"
                      eventKey={t.key}
                      className={cn(
                        'whitespace-nowrap font-display text-[14px] font-medium transition-colors',
                        fb
                          ? cn('relative h-14 rounded-none border-0 px-4 py-0 text-[15px]', tab === t.key ? 'text-link after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary' : 'text-fg-2 hover:bg-sunken dark:hover:bg-elevated')
                          : cn('h-8 w-full rounded-full px-3 py-0', tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-fg-2'),
                      )}
                    >
                      {t.label}
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>
            </div>
          </div>

          <div className={cn(fb ? 'mt-6' : 'mt-3')}>
            {loading ? (
              <LoadingCards />
            ) : (
              <Tab.Content>
                {TABS.map((t) => (
                  <Tab.Pane key={t.key} eventKey={t.key} className={cn(fb && t.key !== 'posts' && 'mx-auto max-w-[820px]')}>
                    {tab === t.key && panes[t.key]}
                  </Tab.Pane>
                ))}
              </Tab.Content>
            )}
          </div>
        </Tab.Container>
      </div>

      <CommentsSheet post={commentsPost} place={place} feed={feed} onClose={() => setParam('comments', null)} />
      <ReviewSheet
        open={reviewOpen}
        onClose={() => setParam('review', null)}
        place={place}
        feed={live}
        onSaved={(rid) => {
          const n = new URLSearchParams(params)
          n.delete(k('review'))
          n.set(k('tab'), 'reviews')
          setParams(n, { replace: true, preventScrollReset: true })
          setHighlight(rid)
          showToast({ text: 'Salamat sa review mo!', expression: 'celebrating' })
        }}
      />
      <PhotoViewer photos={viewer?.list ?? []} index={viewer?.i ?? null} onClose={() => setViewer(null)} onIndex={(i) => setViewer((v) => v && { ...v, i })} />
      <AddToItinerarySheet place={place} open={addOpen} onClose={() => setAddOpen(false)} />
      <ShareSheet open={share} onClose={() => setShare(false)} title={place.name} />
    </main>
  )
}

/** Facebook-like "write something" box that opens the review form. */
function Composer({ nick, place, onClick }: { nick: string; place: Place; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[24px] bg-surface p-3 shadow-card">
      <PersonAvatar name={nick} size={40} />
      <button onClick={onClick} className="h-11 min-w-0 flex-1 truncate rounded-full bg-sunken px-4 text-left text-[15px] text-fg-2 hover:bg-line/60 dark:bg-elevated">
        Ano ang masasabi mo tungkol sa {place.name}?
      </button>
      <button onClick={onClick} aria-label="Mag-review" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-amber hover:bg-sunken dark:hover:bg-elevated">
        <Star size={22} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  )
}

function LoadingCards() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Naglo-load">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-[24px] bg-surface p-4 shadow-card">
          <Placeholder as="div" animation="glow" className="flex items-center gap-2.5">
            <Placeholder className="h-10 w-10 rounded-[12px] bg-sunken" />
            <Placeholder className="h-4 w-40 rounded-full bg-sunken" />
          </Placeholder>
          <Placeholder as="div" animation="glow">
            <Placeholder className="h-4 w-full rounded-full bg-sunken" />
          </Placeholder>
          <Placeholder as="div" animation="glow">
            <Placeholder className="aspect-[4/3] w-full rounded-[18px] bg-sunken" />
          </Placeholder>
        </div>
      ))}
    </div>
  )
}

function About({ place }: { place: Place }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const directionsUrl = googleMapsDirectionsUrl(
    `${place.name}, ${place.area}, Manila, Philippines`,
  )
  return (
    <div className="space-y-4">
      <p className="text-body">{place.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {place.tags.map((t) => (
          <Pill key={t} icon={<Tag size={12} />}>
            {t}
          </Pill>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Fact icon={<Clock size={18} />} label="Oras" value={place.hours} />
        <Fact icon={<Wallet size={18} />} label="Presyo" value={`${place.priceRange} ${place.priceText}`} />
        <Fact icon={<MapPin size={18} />} label="Layo" value={place.distance} />
      </div>
      <div className="card overflow-hidden">
        <MiniMap x={place.map.x} y={place.map.y} label={place.name} className="h-[150px] w-full" />
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold">{place.area}, Maynila</p>
            <p className="text-caption text-fg-2">{place.distance} mula sa iyo</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" icon={<MapPin size={16} />} onClick={() => navigate('/moments/map')}>
              Mapa
            </Button>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Find route"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3 font-display text-sm font-semibold text-ink"
              >
                <Navigation size={16} /> {t('Hanapin ang ruta', 'Find route')}
              </a>
            )}
          </div>
        </div>
      </div>
      <dl className="overflow-hidden rounded-[20px] bg-surface text-body shadow-card">
        <Row icon={<Phone size={18} />} label="Contact" value={place.contact} />
        <Row icon={<Clock size={18} />} label="Oras" value={place.hours} />
      </dl>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-card">
      <div className="text-link">{icon}</div>
      <p className="mt-1.5 text-[12px] text-fg-2">{label}</p>
      <p className="line-clamp-2 font-display text-[13px] font-semibold leading-tight">{value}</p>
    </div>
  )
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <span className="text-fg-2">{icon}</span>
      <dt className="w-20 text-fg-2">{label}</dt>
      <dd className={cn('flex-1 text-right', !value && 'italic text-fg-2')}>{value ?? 'Wala pang impormasyon'}</dd>
    </div>
  )
}
