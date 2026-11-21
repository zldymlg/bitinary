import { BadgeCheck, ChevronDown, ChevronRight, Clock, MapPin, Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CategoryTile, categories } from '@/components/cards/CategoryTile'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLang, useT } from '@/app/i18n'
import type { Category } from '@/data/places'
import { StateView } from '@/components/states/States'
import { Chip } from '@/components/ui/Chip'
import { resolveBusinessImage } from '@/biz/db/assets'
import { Sheet } from '@/components/ui/Sheet'
import { usePersistentState } from '@/lib/usePersistentState'
import { supabase } from '@/lib/supabase'

const prices = ['₱', '₱₱', '₱₱₱'] as const
type SearchBusiness = {
  id: string
  name: string
  business_type: string | null
  price_range: string | null
  address: string
  city: string
  about: string
  specialties: string[]
  logo_url: string | null
  cover_url: string | null
}

export function SearchScreen() {
  const { t } = useLang()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const cat = (params.get('cat') as Category | null) ?? null
  const [area, setArea] = useState<string | null>(null)
  const [price, setPrice] = useState<string | null>(null)
  const [openNow, setOpenNow] = useState(false)
  const [sheet, setSheet] = useState<'cat' | 'area' | 'price' | null>(null)
  const [recent, setRecent] = usePersistentState<string[]>('recentSearches', [])
  const [results, setResults] = useState<SearchBusiness[]>([])
  const [areaOptions, setAreaOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(q)

  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v) p.set(k, v)
        else p.delete(k)
        return p
      },
      { replace: true },
    )

  // Keep local text in sync when q changes externally (e.g. clicking a recent search)
  useEffect(() => { setText(q) }, [q])

  const active = !!(q || cat || area || price || openNow)
  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    void (async () => {
      let { data, error } = await supabase
        .from('businesses')
        .select('id, name, business_type, price_range, address, city, about, specialties, logo_url, cover_url')
        .eq('live', true)
        .eq('verification_status', 'verified')
      if (
        error &&
        error.message.toLowerCase().includes('logo_url') &&
        (error.code === '42703' || error.code === 'PGRST204')
      ) {
        console.warn('Business logos are unavailable until the profile-picture migration is applied.')
        const fallback = await supabase
          .from('businesses')
          .select('id, name, business_type, price_range, address, city, about, specialties, cover_url')
          .eq('live', true)
          .eq('verification_status', 'verified')
        data =
          fallback.data?.map((business) => ({ ...business, logo_url: null })) ??
          null
        error = fallback.error
      }
      if (!active) return
      if (error) {
        setLoadError(true)
        setResults([])
      } else {
        const businesses = data as SearchBusiness[]
        const needle = q.toLowerCase().trim()
        setAreaOptions([...new Set(businesses.flatMap((business) => [business.city, business.address].filter(Boolean)))].slice(0, 20))
        setResults(
          businesses.filter((business) => {
            if (cat && !(business.business_type ?? '').toLowerCase().includes(cat.toLowerCase())) return false
            if (area && !`${business.address} ${business.city}`.toLowerCase().includes(area.toLowerCase())) return false
            if (price && business.price_range !== price) return false
            if (openNow && !business.about.toLowerCase().includes('open')) return false
            if (!needle) return true
            const hay = [business.name, business.business_type, business.address, business.city, business.about, ...(business.specialties ?? [])].join(' ').toLowerCase()
            return needle.split(/\s+/).every((word) => hay.includes(word))
          }),
        )
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [q, cat, area, price, openNow])

  const commit = (term: string) => {
    set('q', term)
    if (term.trim()) setRecent((r) => [term, ...r.filter((x) => x !== term)].slice(0, 6))
  }

  return (
    <main className="@container mx-auto max-w-[1040px] pb-32 md:px-6 md:pb-12">
      <header className="sticky top-0 z-20 bg-bg/90 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl md:px-0 md:pt-8">
        <h1 className="mb-3 flex items-center gap-2 text-title">
          Search
        </h1>
        <div className="flex items-center gap-2">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              commit(inputRef.current?.value ?? '')
              inputRef.current?.blur()
            }}
            className="flex h-12 flex-1 items-center gap-2 rounded-[16px] bg-surface px-3.5 shadow-card dark:bg-elevated"
          >
            <SearchIcon size={20} className="shrink-0 text-link" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value); set('q', e.target.value) }}
              placeholder={t('Kainan, pasyalan, o lugar', 'Dining, attractions, or places')}
              aria-label={t('Hanapin', 'Search')}
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-2"
            />
            {text && (
              <button type="button" aria-label={t('Burahin', 'Clear')} onClick={() => { setText(''); set('q', null) }} className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-fg-2 dark:bg-surface">
                <X size={16} />
              </button>
            )}
          </form>
          {active && (
            <button
              onClick={() => {
                setParams({}, { replace: true })
                setArea(null)
                setPrice(null)
                setOpenNow(false)
                navigate('/search', { replace: true })
              }}
              className="h-11 px-1 font-display text-[16px] font-medium text-link"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip active={!!cat} onClick={() => setSheet('cat')} trailing={<ChevronDown size={15} />}>
            {cat ?? t('Kategorya', 'Category')}
          </Chip>
          <Chip active={!!area} onClick={() => setSheet('area')} trailing={<ChevronDown size={15} />}>
            {area ?? t('Lugar', 'Area')}
          </Chip>
          <Chip active={!!price} onClick={() => setSheet('price')} trailing={<ChevronDown size={15} />}>
            {price ?? t('Presyo', 'Price')}
          </Chip>
          <Chip active={openNow} onClick={() => setOpenNow((v) => !v)}>
            {t('Bukas ngayon', 'Open now')}
          </Chip>
        </div>
      </header>

      {!active ? (
        <div className="space-y-7 px-4 pt-4 md:px-0">
          {recent.length > 0 && (
            <section>
              <h2 className="mb-1 text-h3">{t('Mga huling hinanap', 'Recent searches')}</h2>
              <ul>
                {recent.map((r) => (
                  <li key={r} className="flex items-center border-b border-line">
                    <button onClick={() => commit(r)} className="flex h-12 flex-1 items-center gap-3 text-left text-body">
                      <Clock size={18} className="text-muted" /> {r}
                    </button>
                    <button aria-label={t(`Alisin ang ${r}`, `Remove ${r}`)} onClick={() => setRecent((x) => x.filter((y) => y !== r))} className="flex h-11 w-11 items-center justify-center text-muted">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-h3">{t('Mga kategorya', 'Categories')}</h2>
            <div className="grid grid-cols-4 gap-2 @2xl:grid-cols-8">
              {categories.map((c) => (
                <CategoryTile key={c} category={c} onClick={() => set('cat', c)} />
              ))}
            </div>
          </section>
        </div>
      ) : loading ? (
        <div className="space-y-3 px-4 pt-8 md:px-0" role="status" aria-busy="true" aria-label={t('Kinukuha ang mga negosyo mula sa database', 'Loading businesses from the database')}>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3 shadow-card sm:p-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <StateView expression="unsure" title={t('Hindi ma-load ang search', "Couldn't load search")} body={t('Hindi ma-access ang database. Subukan ulit mamaya.', "Can't access the database. Try again later.")} />
      ) : results.length ? (
        <section className="px-4 pt-3 md:px-0">
          <p className="mb-3 text-caption text-fg-2" aria-live="polite">
            {results.length} {t('resulta · lahat ay verified', 'results · all verified')}
          </p>
          <div className="divide-y divide-line rounded-[20px] border border-line bg-surface px-3 shadow-card sm:px-5">
            {results.map((business) => (
              <BusinessResult key={business.id} business={business} />
            ))}
          </div>
        </section>
      ) : (
        <StateView
          expression="unsure"
          title={t('Wala akong nahanap', 'No matches found')}
          body={t(`Walang verified na lugar para sa "${q || cat || area || price}". Hindi ako manghuhula, kaya subukan ang ibang salita o tanggalin ang filter.`, `No verified places for "${q || cat || area || price}". I don't guess, so try other words or remove a filter.`)}
          action={t('Tanggalin ang filter', 'Clear filters')}
          onAction={() => {
            setParams({}, { replace: true })
            setArea(null)
            setPrice(null)
            setOpenNow(false)
          }}
        />
      )}

      <Sheet open={sheet === 'cat'} onClose={() => setSheet(null)} title={t('Kategorya', 'Category')}>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => (
            <CategoryTile
              key={c}
              category={c}
              onClick={() => {
                set('cat', cat === c ? null : c)
                setSheet(null)
              }}
            />
          ))}
        </div>
      </Sheet>
      <OptionSheet open={sheet === 'area'} title={t('Lugar', 'Area')} options={areaOptions} value={area} onPick={(v) => (setArea(v), setSheet(null))} onClose={() => setSheet(null)} />
      <OptionSheet open={sheet === 'price'} title={t('Presyo', 'Price')} options={[...prices]} value={price} onPick={(v) => (setPrice(v), setSheet(null))} onClose={() => setSheet(null)} />
    </main>
  )
}

function BusinessResult({ business }: { business: SearchBusiness }) {
  const { t } = useLang()
  const [images, setImages] = useState<string[]>([])
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    let active = true
    setImages([])
    setImageIndex(0)
    const imagePaths = [business.cover_url, business.logo_url].filter(
      (path): path is string => !!path,
    )

    void (async () => {
      const resolved: string[] = []
      for (const path of imagePaths) {
        try {
          resolved.push(await resolveBusinessImage(path))
        } catch (error) {
          console.error(`Business image could not be loaded for ${business.id}.`, error)
        }
      }
      if (active) setImages(resolved)
    })()

    return () => {
      active = false
    }
  }, [business.id, business.cover_url, business.logo_url])

  return (
    <Link
      to={`/shop/${business.id}`}
      aria-label={t(`Tingnan ang profile ng ${business.name}`, `View ${business.name} profile`)}
      className="group flex gap-3 py-4 transition-colors hover:bg-sunken/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-4 sm:py-5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sunken dark:bg-elevated sm:h-14 sm:w-14">
        {images[imageIndex] ? (
          <img
            src={images[imageIndex]}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageIndex((index) => index + 1)}
          />
        ) : null}
      </span>
      <article className="min-w-0 flex-1 self-center">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-[16px] font-semibold leading-tight text-link group-hover:underline sm:text-[18px]">
            {business.name}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-medium text-ok">
            <BadgeCheck size={13} />
            Verified
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] text-fg-2">
          {business.business_type || t('Negosyo', 'Business')}
          {business.price_range && <> <span aria-hidden>·</span> {business.price_range}</>}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-fg-2">
          <MapPin size={13} className="shrink-0" />
          <span className="line-clamp-1">
            {[business.address, business.city].filter(Boolean).join(', ') || 'Address unavailable'}
          </span>
        </p>
        {(business.about || !!business.specialties.length) && (
          <p className="mt-1.5 line-clamp-2 text-[13px] text-fg-2">
            {business.about || `Known for ${business.specialties.slice(0, 3).join(', ')}.`}
          </p>
        )}
      </article>
      <span className="self-center text-muted transition group-hover:translate-x-0.5 group-hover:text-link" aria-hidden>
        <ChevronRight size={18} />
      </span>
    </Link>
  )
}

function OptionSheet({ open, title, options, value, onPick, onClose }: { open: boolean; title: string; options: string[]; value: string | null; onPick: (v: string | null) => void; onClose: () => void }) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-wrap gap-2">
        <Chip active={!value} onClick={() => onPick(null)}>
          {t('Lahat', 'All')}
        </Chip>
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onPick(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </Sheet>
  )
}
