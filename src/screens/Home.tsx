import { Bell, ChevronRight, Heart, MapPin, Search as SearchIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useGreetingName } from '@/app/account'
import { useLang } from '@/app/i18n'
import { useStore } from '@/app/store'
import { ForYou, GuestBanner } from '@/components/home/ForYou'
import { CategoryTile, categories } from '@/components/cards/CategoryTile'
import { InstallBanner, OfflineBanner } from '@/components/layout/Banners'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabase'
import { distanceInKm, formatDistance } from '@/lib/geo'

export function HomeHeader() {
  const navigate = useNavigate()
  const name = useGreetingName()
  const { t } = useLang()
  const { saved } = useStore()
  const [sheet, setSheet] = useState<'notif' | 'saved' | null>(null)
  const [location, setLocation] = useState(t('Pumili ng lokasyon', 'Choose a location'))
  const [locating, setLocating] = useState(false)

  type ReverseGeocode = {
    address?: {
      house_number?: string
      road?: string
      suburb?: string
      neighbourhood?: string
      village?: string
      city_district?: string
      city?: string
      town?: string
      municipality?: string
      state?: string
      country?: string
    }
    locality?: string
    city?: string
    localAdminRegion?: string
    principalSubdivision?: string
    localityInfo?: {
      administrative?: Array<{ name?: string; description?: string }>
      informative?: Array<{ name?: string; description?: string }>
    }
  }

  const formatLocation = (data: ReverseGeocode) => {
    if (data.address) {
      const address = data.address
      const street = [address.house_number && `#${address.house_number}`, address.road].filter(Boolean).join(' ')
      const locality = address.suburb || address.neighbourhood || address.village
      const city = address.city || address.town || address.municipality
      const precise = [street, locality, city].filter(Boolean)
      if (precise.length) return precise.join(', ')
    }
    const administrative = data.localityInfo?.administrative ?? []
    const informative = data.localityInfo?.informative ?? []
    const streetEntries = informative.filter((item) => /street|road|avenue|highway|kalye/i.test(item.name ?? ''))
    const entries = [...streetEntries, ...informative, ...administrative]
    const isGeneric = (value: string) => /^(central|north|south|east|west|ncr|metro manila|national capital region)$/i.test(value.trim())
    const clean = (value?: string) => value?.trim().replace(/,?\s*(NCR|Central)$/i, '') || undefined
    const street = clean(streetEntries[0]?.name)
    const barangay = clean(entries.find((item) => /barangay|village|district|suburb|neighbou?rhood|locality/i.test(`${item.name} ${item.description}`))?.name)
    const locality = clean(data.locality)
    const city = clean(data.city || data.localAdminRegion)
    return [street, barangay, locality, city].filter((value, index, values) => value && !isGeneric(value) && values.indexOf(value) === index).join(', ')
  }

  const locate = () => {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
        setLocation(fallback)
        try {
          const detailedResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}&format=jsonv2&addressdetails=1&accept-language=en`,
          )
          if (detailedResponse.ok) {
            const data = (await detailedResponse.json()) as ReverseGeocode
            const address = formatLocation(data)
            if (address) setLocation(address)
          } else {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(coords.latitude)}&longitude=${encodeURIComponent(coords.longitude)}&localityLanguage=fil`,
            )
            if (response.ok) {
              const data = (await response.json()) as ReverseGeocode
              const address = formatLocation(data)
              if (address) setLocation(address)
            }
          }
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocation(t('Hindi nakuha ang lokasyon', 'Location unavailable'))
        setLocating(false)
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    )
  }

  useEffect(() => {
    locate()
  }, [])

  return (
    <header className="relative bg-primary pt-safe">
      {/* subtle woven pattern */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]" aria-hidden>
        <defs>
          <pattern id="weave" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 14h28M14 0v28" stroke="#2B130A" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#weave)" />
      </svg>
      <div className="relative mx-auto max-w-[1040px] px-4 pb-12 pt-3 md:px-6">
        <div className="flex items-center justify-between gap-2">
          <button onClick={locate} className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-white/25 pl-2 pr-3 text-ink" aria-label={t('Kunin ang kasalukuyang lokasyon', 'Get your current location')}>
            <span className="min-w-0 text-left leading-tight">
              <span className="block font-display text-[11px] font-medium opacity-80">{t('Lokasyon', 'Location')}</span>
              <span className="block max-w-[180px] truncate font-display text-[14px] font-semibold">{locating ? t('Kinukuha…', 'Getting location…') : location}</span>
            </span>
          </button>
          <div className="flex gap-1.5">
            <HeaderButton label={t('Mga abiso', 'Notifications')} onClick={() => setSheet('notif')}>
              <Bell size={21} strokeWidth={1.75} />
            </HeaderButton>
            <HeaderButton label={t('Naka-save', 'Saved')} onClick={() => setSheet('saved')}>
              <Heart size={21} strokeWidth={1.75} />
            </HeaderButton>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[32px] font-bold leading-[1.1] tracking-tight text-white">
              {t('Kumusta,', 'Hello,')} <br className="md:hidden" />
              {name}!
            </h1>
            <p className="mt-1 font-display text-[15px] font-medium text-ink">{t('Saan tayo kakain at gagala ngayon?', 'Where will we eat and explore today?')}</p>
          </div>
          <Jimbot expression="waving" size={96} className="-mb-6 -mr-1 shrink-0 rounded-full ring-4 ring-cream/80" />
        </div>
      </div>
      <div className="absolute inset-x-0 -bottom-7 z-10 mx-auto max-w-[1040px] px-4 md:px-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/search')}
          className="flex h-14 w-full items-center gap-3 rounded-[18px] bg-surface px-4 text-left shadow-float dark:bg-elevated"
        >
          <SearchIcon size={22} strokeWidth={1.75} className="shrink-0 text-link" />
          <span className="truncate text-body text-fg-2">{t('Hanapin ang kainan, pasyalan, o lugar...', 'Search for dining, places, or locations...')}</span>
        </motion.button>
      </div>

      <Sheet open={sheet === 'notif'} onClose={() => setSheet(null)} title={t('Mga abiso', 'Notifications')}>
        <ul className="space-y-2">
          <li className="py-8 text-center text-body text-fg-2">{t('Wala pang abiso.', 'No notifications yet.')}</li>
        </ul>
      </Sheet>
      <Sheet open={sheet === 'saved'} onClose={() => setSheet(null)} title={`${t('Naka-save', 'Saved')} (${saved.length})`}>
        <div className="flex flex-col items-center py-6 text-center">
          <Jimbot expression="sleeping" variant="standalone" size={110} />
          <p className="mt-3 text-body text-fg-2">{saved.length ? `${saved.length} ${t('naka-save.', 'saved.')}` : t('Wala ka pang naka-save.', 'You have no saved items yet.')}</p>
        </div>
      </Sheet>
    </header>
  )
}

function HeaderButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      onClick={onClick}
      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/25 text-ink"
    >
      {children}
    </motion.button>
  )
}

function Categories() {
  const navigate = useNavigate()
  const { t } = useLang()
  return (
    <section aria-label={t('Mga kategorya', 'Categories')} className="grid grid-cols-4 gap-x-2 gap-y-3 px-4 @2xl:grid-cols-8 md:px-0">
      {categories.map((c) => (
        <CategoryTile key={c} category={c} onClick={() => navigate(`/search?cat=${encodeURIComponent(c)}`)} />
      ))}
    </section>
  )
}


function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <main className="pb-32 md:pb-12">
      <HomeHeader />
      <div className="@container mx-auto mt-11 max-w-[1040px] space-y-7 md:px-6">{children}</div>
    </main>
  )
}

export function HomeV1() {
  return (
    <HomeLayout>
      <OfflineBanner />
      <GuestBanner />
      <Categories />
      <ForYou />
      <NearbyBusinesses />
      <EmptyDatabaseState />
    </HomeLayout>
  )
}

export function HomeFull() {
  return (
    <HomeLayout>
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <Categories />
      <ForYou />
      <NearbyBusinesses />
      <EmptyDatabaseState />
    </HomeLayout>
  )
}

type NearbyBusiness = {
  id: string
  name: string
  business_type: string | null
  address: string
  city: string
  latitude: number
  longitude: number
  distanceKm: number
}

function NearbyBusinesses() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setStatus('denied'),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    )
  }, [])

  useEffect(() => {
    if (!position) return
    let active = true
    void (async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, business_type, address, city, latitude, longitude')
        .eq('live', true)
        .eq('verification_status', 'verified')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
      if (!active) return
      if (error) {
        setStatus('error')
        return
      }
      const sorted = data
        .map((business) => {
          const latitude = Number(business.latitude)
          const longitude = Number(business.longitude)
          return Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { ...business, latitude, longitude, distanceKm: distanceInKm(position, { latitude, longitude }) }
            : null
        })
        .filter((business): business is NearbyBusiness => business !== null)
        .filter((business) => /food|restaurant|cafe|coffee|kainan|kapihan|eat|meal/i.test(business.business_type ?? '') || !business.business_type)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 6)
      setBusinesses(sorted)
      setStatus('ready')
    })()
    return () => {
      active = false
    }
  }, [position])

  return (
    <section className="space-y-3 px-4 md:px-0" aria-label={t('Mga kainan na pinakamalapit sa iyo', 'Dining places nearest to you')}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2">{t('Pinakamalapit sa iyo', 'Nearest to you')}</h2>
          <p className="text-caption text-fg-2">{t('Batay sa iyong kasalukuyang lokasyon', 'Based on your current location')}</p>
        </div>
        <MapPin size={20} className="text-link" />
      </div>
      {status === 'loading' && (
        <div className="grid gap-3 md:grid-cols-2" role="status" aria-busy="true" aria-label={t('Kinukuha ang iyong lokasyon', 'Getting your location')}>
          {[0, 1].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card dark:bg-elevated">
              <Skeleton className="h-20 w-20 shrink-0 rounded-[14px]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}
      {status === 'denied' && <p className="rounded-2xl bg-surface p-5 text-body text-fg-2 shadow-card dark:bg-elevated">{t('Payagan ang pag-access sa lokasyon upang makita ang pinakamalapit na kainan.', 'Allow location access to see the nearest dining places.')}</p>}
      {status === 'error' && <p className="rounded-2xl bg-surface p-5 text-body text-fg-2 shadow-card dark:bg-elevated">{t('Hindi makuha ang mga kainan mula sa database.', 'Could not load dining places from the database.')}</p>}
      {status === 'ready' && !businesses.length && <p className="rounded-2xl bg-surface p-5 text-body text-fg-2 shadow-card dark:bg-elevated">{t('Wala pang nailathalang kainan na may lokasyon.', 'No published dining places with locations yet.')}</p>}
      {businesses.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {businesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => navigate(`/shop/${business.id}`)}
              aria-label={t(`Tingnan ang profile ng ${business.name}`, `View ${business.name} profile`)}
              className="group rounded-2xl bg-surface p-4 text-left shadow-card transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link dark:bg-elevated"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-[16px] font-semibold">{business.name}</span>
                <ChevronRight size={18} className="shrink-0 text-fg-2 transition group-hover:translate-x-0.5 group-hover:text-link" />
              </span>
              <span className="mt-1 block text-caption text-fg-2">{business.business_type || t('Kainan', 'Dining')} · {business.address || business.city || t('Hindi available ang lokasyon', 'Location unavailable')}</span>
              <span className="mt-2 flex items-center gap-1 text-caption font-semibold text-link">
                <MapPin size={14} /> {formatDistance(business.distanceKm)} {t('ang layo', 'away')} · {t('Tingnan ang profile', 'View profile')}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyDatabaseState() {
  const { t } = useLang()
  return (
    <section className="mx-4 rounded-[24px] bg-surface p-8 text-center shadow-card md:mx-0 dark:bg-elevated">
      <Jimbot expression="idea" variant="standalone" size={120} className="mx-auto" />
      <h2 className="mt-3 text-h2">{t('Wala pang nilalaman', 'No content yet')}</h2>
      <p className="mt-1 text-body text-fg-2">{t('Makikita rito ang mga lugar, negosyo, biyahe, promo, at Reels kapag may mga tala na sa database.', 'Places, businesses, trips, promotions, and Reels will appear here when records are available in the database.')}</p>
    </section>
  )
}
