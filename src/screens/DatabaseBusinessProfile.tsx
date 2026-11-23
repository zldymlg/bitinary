import {
  ArrowLeft,
  Clock3,
  Globe,
  ImageOff,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Star,
  ThumbsUp,
  Utensils,
} from "lucide-react"

import { useEffect, useState } from "react"

import { useNavigate } from "react-router"
import { useAccount } from "@/app/account"
import { useLang } from "@/app/i18n"

import { StateView } from "@/components/states/States"
import { Skeleton } from "@/components/ui/Skeleton"

import { resolveBusinessAsset } from "@/biz/db/assets"
import { loadQuickUpdate } from "@/biz/db/quickUpdates"
import { activeQuickUpdate, type QuickUpdate } from "@/biz/quickUpdateState"
import { supabase } from "@/lib/supabase"

type Business = {
  id: string

  name: string

  business_type: string | null

  price_range: string | null

  address: string

  city: string

  contact_name: string

  mobile: string

  landline: string

  about: string

  specialties: string[]

  languages: string[]

  logo_url: string | null

  cover_url: string | null

  links: {
    website?: string
    facebook?: string
    instagram?: string
    tiktok?: string
  } | null
}

type BusinessHour = {
  day_of_week: number
  opens_at: string | null
  closes_at: string | null
  is_closed: boolean
  all_day: boolean
}

type MenuItem = {
  id: string
  name: string
  price: number
  category: string
}

type BusinessPhoto = {
  id: string
  storage_path: string
  is_cover: boolean
  sort_order: number
}

type BusinessPost = {
  id: string

  post_type: string

  title: string | null

  body: string

  media_urls: string[]

  video_url: string | null

  published_at: string | null

  created_at: string

  likes: number

  comments_count: number
}

type BusinessReview = {
  id: string

  author_id: string | null

  stars: number

  body: string

  photo_urls: string[]

  visited: boolean

  reply: string | null

  created_at: string
}

type BusinessComment = {
  id: string
  post_id: string
  author_id: string | null
  body: string
  reply: string | null
  created_at: string
}

type Tab = "posts" | "reviews" | "about" | "menu" | "photos"
type TabConfig = {
  id: Tab
  label: string
}
type ProfileData = {
  business: Business

  hours: BusinessHour[]

  menu: MenuItem[]

  photos: BusinessPhoto[]

  posts: BusinessPost[]

  reviews: BusinessReview[]

  comments: BusinessComment[]

  likedPostIds: string[]

  socialInteractionsEnabled: boolean

  media: Map<string, string>

  failedMediaPaths: Set<string>
}

const DAYS = [
  "Lunes",
  "Martes",
  "Miyerkules",
  "Huwebes",
  "Biyernes",
  "Sabado",
  "Linggo",
]

const TABS: TabConfig[] = [
  { id: "posts", label: "Mga post" },

  { id: "reviews", label: "Reviews" },

  { id: "about", label: "Impormasyon" },

  { id: "menu", label: "Menu" },

  { id: "photos", label: "Mga larawan" },
]

function PublicQuickUpdate({ businessId }: { businessId: string }) {
  const { t } = useLang()
  const [update, setUpdate] = useState<QuickUpdate | null>(null)

  useEffect(() => {
    let active = true
    let generation = 0
    const refresh = () => {
      const request = ++generation
      void loadQuickUpdate(businessId).then(({ data }) => {
        if (active && request === generation) setUpdate(data)
      })
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      window.removeEventListener("focus", refresh)
    }
  }, [businessId])

  useEffect(() => {
    if (!update) return
    const timeout = window.setTimeout(
      () => setUpdate((current) => activeQuickUpdate(current)),
      Math.max(0, Date.parse(update.expires_at) - Date.now()) + 10,
    )
    return () => window.clearTimeout(timeout)
  }, [update])

  const current = activeQuickUpdate(update)
  if (!current) return null
  const flags = [
    current.status === "open" && t("Bukas ngayon", "Open today"),
    current.status === "closed" && t("Sarado ngayong araw", "Closed today"),
    current.sold_out && t("Ubos na", "Sold out"),
    current.long_queue && t("Mahaba ang pila", "Long queue"),
  ].filter(Boolean)
  if (!flags.length && !current.special) return null

  return (
    <section aria-label={t("Update ng negosyo", "Business update")} className="mt-4 space-y-2 rounded-xl border border-line bg-sunken p-3 text-sm">
      {flags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {flags.map((flag) => <li key={String(flag)} className="rounded-full bg-surface px-3 py-1 font-semibold text-fg">{flag}</li>)}
        </ul>
      )}
      {current.special && <p className="break-words"><strong>{t("Espesyal ngayong araw", "Today’s special")}</strong> · {current.special}</p>}
    </section>
  )
}

export function DatabaseBusinessProfile({ id }: { id: string }) {
  const navigate = useNavigate()
  const { session, profile, requireAccount } = useAccount()
  const { t } = useLang()

  const [data, setData] = useState<ProfileData | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>("posts")

  const [refreshVersion, setRefreshVersion] = useState(0)

  const viewerId =
    session?.kind === "user" && session.role === "traveler"
      ? session.accountId
      : undefined

  useEffect(() => {
    let active = true

    void (async () => {
      const [businessRes, hoursRes, menuRes, photosRes, postsRes, reviewsRes] =
        await Promise.all([
          supabase

            .from("businesses")

            .select(
              "id, name, business_type, price_range, address, city, contact_name, mobile, landline, about, specialties, languages, logo_url, cover_url, links",
            )

            .eq("id", id)

            .eq("live", true)

            .eq("verification_status", "verified")

            .maybeSingle(),

          supabase
            .from("business_hours")
            .select("day_of_week, opens_at, closes_at, is_closed, all_day")
            .eq("business_id", id)
            .order("day_of_week"),

          supabase
            .from("menu_items")
            .select("id, name, price, category")
            .eq("business_id", id)
            .order("sort_order"),

          supabase
            .from("business_photos")
            .select("id, storage_path, is_cover, sort_order")
            .eq("business_id", id)
            .order("sort_order"),

          supabase

            .from("posts")

            .select(
              "id, post_type, title, body, media_urls, video_url, published_at, created_at, likes, comments_count",
            )

            .eq("business_id", id)

            .eq("status", "published")

            .order("published_at", { ascending: false }),

          supabase

            .from("reviews")

            .select(
              "id, author_id, stars, body, photo_urls, visited, reply, created_at",
            )

            .eq("business_id", id)

            .eq("hidden", false)

            .order("created_at", { ascending: false }),
        ])

      if (!active) return

      const queryError =
        businessRes.error ??
        hoursRes.error ??
        menuRes.error ??
        photosRes.error ??
        postsRes.error ??
        reviewsRes.error

      if (queryError) {
        setError(queryError.message)

        setLoading(false)

        return
      }

      if (!businessRes.data) {
        setError("Hindi na live o verified ang negosyong ito.")

        setLoading(false)

        return
      }

      const posts = (postsRes.data ?? []) as BusinessPost[]

      const postIds = posts.map((post) => post.id)

      let comments: BusinessComment[] = []

      if (postIds.length) {
        const { data: commentData, error: commentError } = await supabase

          .from("comments")

          .select("id, post_id, author_id, body, reply, created_at")

          .in("post_id", postIds)

          .eq("hidden", false)

          .eq("blocked", false)

          .order("created_at")

        if (!active) return

        if (commentError) {
          setError(commentError.message)

          setLoading(false)

          return
        }

        comments = ((commentData ?? []) as BusinessComment[])
      }

      let likedPostIds: string[] = []
      let socialInteractionsEnabled = true
      if (viewerId && postIds.length) {
        const { data: likeData, error: likeError } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", viewerId)
          .in("post_id", postIds)

        if (!active) return

        if (likeError) {
          console.error(
            "Post interactions are unavailable until the database migration is applied.",
            likeError,
          )
          socialInteractionsEnabled = false
        } else {
          likedPostIds = (likeData ?? []).map(
            (like: { post_id: string }) => like.post_id,
          )
        }
      }

      const photos = (photosRes.data ?? []) as BusinessPhoto[]

      const reviews = (reviewsRes.data ?? []) as BusinessReview[]

      const coverPath =
        businessRes.data.cover_url ??
        photos.find((photo) => photo.is_cover)?.storage_path

      const videoPaths = new Set(
        posts
          .map((post) => post.video_url)
          .filter((path): path is string => !!path),
      )

      const mediaPaths = [
        ...new Set(
          [
            businessRes.data.logo_url,

            coverPath,

            ...photos.map((photo) => photo.storage_path),

            ...posts.flatMap((post) => [
              ...(post.media_urls ?? []),
              post.video_url,
            ]),

            ...reviews.flatMap((review) => review.photo_urls ?? []),
          ].filter((path): path is string => !!path),
        ),
      ]

      const resolvedMedia = await Promise.all(
        mediaPaths.map(async (path) => {
          try {
            const url = await resolveBusinessAsset(
              path,
              videoPaths.has(path) ? "video" : "image",
            )
            return { path, url, failed: false }
          } catch (mediaError) {
            console.error("Business media could not be resolved.", mediaError)
            return {
              path,
              url: "",
              failed: true,
            }
          }
        }),
      )

      if (!active) return

      setData({
        business: businessRes.data as Business,

        hours: (hoursRes.data ?? []) as BusinessHour[],

        menu: (menuRes.data ?? []) as MenuItem[],

        photos,

        posts,

        reviews,

        comments,

        likedPostIds,

        socialInteractionsEnabled,

        media: new Map(
          resolvedMedia
            .filter((item) => item.url)
            .map((item) => [item.path, item.url]),
        ),

        failedMediaPaths: new Set(
          resolvedMedia.filter((item) => item.failed).map((item) => item.path),
        ),
      })

      void (async () => {
        try {
          const { error: trackingError } = await supabase.rpc(
            "track_business_profile_view",
            { p_business_id: id },
          )
          if (trackingError) {
            console.error(
              "Business profile view could not be recorded.",
              trackingError,
            )
          }
        } catch (trackingError) {
          console.error(
            "Business profile view could not be recorded.",
            trackingError,
          )
        }
      })()

      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [id, refreshVersion, viewerId])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setRefreshVersion((version) => version + 1), 250)
    }
    const channel = supabase
      .channel(`shop-details-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "businesses",
          filter: `id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `business_id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reviews",
          filter: `business_id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_hours",
          filter: `business_id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `business_id=eq.${id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_photos",
          filter: `business_id=eq.${id}`,
        },
        refresh,
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [id])

  if (loading)
    return (
      <main className="mx-auto max-w-[960px] space-y-4 px-4 pb-24 pt-6" aria-busy="true" aria-label={t("Kinukuha ang profile ng negosyo", "Loading business profile")}>
        <Skeleton className="h-56 w-full rounded-[24px]" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 shrink-0 rounded-[18px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-44 w-full rounded-[20px]" />
        <Skeleton className="h-44 w-full rounded-[20px]" />
      </main>
    )

  if (error || !data) {
    return (
      <StateView
        expression="unsure"
        title="Hindi maipakita ang profile"
        body={error ?? "Subukan ulit mamaya."}
        action="Bumalik sa search"
        onAction={() => navigate("/search")}
      />
    )
  }

  const {
    business,
    hours,
    menu,
    photos,
    posts,
    reviews,
    comments,
    likedPostIds,
    socialInteractionsEnabled,
    media,
    failedMediaPaths,
  } = data

  const rating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length
    : 0

  const coverPath =
    business.cover_url ?? photos.find((photo) => photo.is_cover)?.storage_path
  const cover = coverPath ? media.get(coverPath) : undefined
  const logo = business.logo_url ? media.get(business.logo_url) : undefined
  const profileImage = cover ?? logo
  const unavailablePhotos = photos.filter((photo) =>
    failedMediaPaths.has(photo.storage_path),
  ).length

  const phone = business.mobile || business.landline

  const website = safeWebUrl(business.links?.website)

  return (
    <main className="min-h-dvh bg-bg pb-24">
      <div className="mx-auto max-w-[1100px] md:px-6 md:pt-6">
        <div className="relative h-[260px] overflow-hidden bg-gradient-to-br from-[#3A1A0E] via-[#8A3D12] to-[#E0A100] md:h-[380px] md:rounded-t-[28px]">
          <BusinessImage
            src={cover}
            fallbackSrc={logo}
            alt={`${business.name} cover`}
            className="h-full w-full object-cover"
            loading="eager"
            storagePath={coverPath}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/20" />
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Bumalik"
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur transition hover:bg-black/65"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <Star size={13} fill="currentColor" /> Verified na negosyo
          </span>
        </div>

        <header className="border-b border-line bg-surface px-4 pb-5 shadow-card md:rounded-b-[28px] md:px-8">
          <div className="relative z-10 -mt-12 flex flex-wrap items-end gap-4">
            <div className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[30px] border-4 border-surface bg-sunken shadow-xl">
              <BusinessImage
                src={logo}
                fallbackSrc={cover}
                alt={`${business.name} logo`}
                className="h-full w-full rounded-[25px] object-cover"
                storagePath={business.logo_url ?? undefined}
              />
            </div>
            <div className="min-w-[220px] flex-1 pb-1">
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
                {business.name}
              </h1>
              <p className="mt-1 text-sm font-medium text-fg-2">
                {[business.business_type, business.price_range]
                  .filter(Boolean)
                  .join(" · ") || "Negosyo"}
                {(business.city || business.address) &&
                  ` · ${[business.city, business.address].filter(Boolean).join(", ")}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-display text-sm font-semibold text-ink shadow-md transition hover:brightness-105"
                >
                  <Phone size={16} /> Tawagan
                </a>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-sunken px-4 font-display text-sm font-semibold text-fg transition hover:bg-sunken/70 dark:bg-elevated"
                >
                  <Globe size={16} /> Website
                </a>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-fg-2">
            {reviews.length ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 font-semibold text-fg">
                  <Star size={15} fill="currentColor" className="text-amber" />
                  {rating.toFixed(1)} ({reviews.length}{" "}
                  {reviews.length === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="rounded-full bg-sunken px-3 py-1 font-medium dark:bg-elevated">
                Bagong profile
              </span>
            )}
            {business.specialties?.length > 0 && (
              <span className="rounded-full bg-sunken px-3 py-1 dark:bg-elevated">
                {business.specialties.slice(0, 3).join(" · ")}
              </span>
            )}
          </div>
          <PublicQuickUpdate key={business.id} businessId={business.id} />
          <nav
            role="tablist"
            aria-label="Mga seksyon ng profile"
            className="no-scrollbar -mb-4 mt-4 flex gap-2 overflow-x-auto border-t border-line pt-1"
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`shrink-0 border-b-[3px] px-4 py-3 font-display text-sm font-semibold ${
                  tab === item.id
                    ? "border-primary text-primary"
                    : "border-transparent text-fg-2 hover:bg-sunken dark:hover:bg-elevated"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="grid gap-5 px-4 pt-5 md:px-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <InfoCard title="Impormasyon">
              {business.about && (
                <p className="whitespace-pre-line text-sm leading-6">
                  {business.about}
                </p>
              )}
              <ul className="mt-3 space-y-3 text-sm">
                {(business.address || business.city) && (
                  <InfoLine icon={<MapPin size={17} />}>
                    {[business.address, business.city]
                      .filter(Boolean)
                      .join(", ")}
                  </InfoLine>
                )}
                {phone && (
                  <InfoLine icon={<Phone size={17} />}>
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                      className="hover:underline"
                    >
                      {phone}
                    </a>
                  </InfoLine>
                )}
                {business.languages?.length > 0 && (
                  <InfoLine icon={<Globe size={17} />}>
                    Wika: {business.languages.join(", ")}
                  </InfoLine>
                )}
                {business.specialties?.length > 0 && (
                  <InfoLine icon={<Star size={17} />}>
                    {business.specialties.join(" · ")}
                  </InfoLine>
                )}
              </ul>
            </InfoCard>
            {!!hours.length && (
              <InfoCard title="Oras ng negosyo">
                <ul className="space-y-2 text-sm">
                  {hours.map((hour) => (
                    <li
                      key={hour.day_of_week}
                      className="flex justify-between gap-3"
                    >
                      <span>{DAYS[hour.day_of_week] ?? "Araw"}</span>
                      <span className="text-right text-fg-2">
                        {hour.is_closed
                          ? "Sarado"
                          : hour.all_day
                            ? "Buong araw"
                            : `${formatTime(hour.opens_at)}–${formatTime(hour.closes_at)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}
            {photos.length > 0 && (
              <InfoCard title="Mga larawan">
                <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
                  {photos.slice(0, 6).map((photo) => {
                    const src = media.get(photo.storage_path)

                    return (
                      <BusinessImage
                        key={photo.id}
                        src={src}
                        fallbackSrc={profileImage}
                        alt={`${business.name} photo`}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                        storagePath={photo.storage_path}
                      />
                    )
                  })}
                </div>
              </InfoCard>
            )}
          </aside>

          <section className="min-w-0">
            {tab === "posts" && (
              <PostsFeed
                posts={posts}
                comments={comments}
                likedPostIds={likedPostIds}
                interactionsEnabled={socialInteractionsEnabled}
                media={media}
                businessName={business.name}
                businessLogo={logo}
                businessLogoPath={business.logo_url ?? undefined}
                businessCover={cover}
                viewerAvatar={profile.avatar}
                viewerId={viewerId}
                session={session}
                requireAccount={requireAccount}
                onLikeChanged={(postId, liked) => {
                  setData((current) => {
                    if (!current) return current
                    const wasLiked = current.likedPostIds.includes(postId)
                    if (wasLiked === liked) return current
                    return {
                      ...current,
                      likedPostIds: liked
                        ? [...current.likedPostIds, postId]
                        : current.likedPostIds.filter((id) => id !== postId),
                      posts: current.posts.map((post) =>
                        post.id === postId
                          ? {
                              ...post,
                              likes: Math.max(0, post.likes + (liked ? 1 : -1)),
                            }
                          : post,
                      ),
                    }
                  })
                }}
                onCommentAdded={(comment) => {
                  setData((current) => {
                    if (!current) return current
                    if (current.comments.some((item) => item.id === comment.id))
                      return current
                    return {
                      ...current,
                      comments: [...current.comments, comment],
                      posts: current.posts.map((post) =>
                        post.id === comment.post_id
                          ? { ...post, comments_count: post.comments_count + 1 }
                          : post,
                      ),
                    }
                  })
                }}
              />
            )}
            {tab === "reviews" && (
              <ReviewsFeed
                businessId={business.id}
                reviews={reviews}
                rating={rating}
                media={media}
                fallbackSrc={profileImage}
                failedMediaPaths={failedMediaPaths}
                viewerAvatar={profile.avatar}
                viewerName={profile.nickname || profile.name || "You"}
                session={session}
                requireAccount={requireAccount}
                onSaved={() => setRefreshVersion((version) => version + 1)}
              />
            )}
            {tab === "about" && (
              <AboutSection business={business} hours={hours} />
            )}
            {tab === "menu" && <MenuSection menu={menu} />}
            {tab === "photos" && (
              <PhotosSection
                photos={photos}
                media={media}
                fallbackSrc={profileImage}
                unavailableCount={unavailablePhotos}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[22px] bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-h3">{title}</h2>
      {children}
    </section>
  )
}

function InfoLine({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-fg-2">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function ProfileAvatar({
  name,
  src,
  size = 32,
}: {
  name: string
  src?: string
  size?: number
}) {
  const [failedSrc, setFailedSrc] = useState<string>()
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-[#e4e6eb] text-xs font-semibold text-[#4b4f56] dark:bg-elevated dark:text-fg-2"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

function BusinessImage({
  src,
  fallbackSrc,
  alt,
  className,
  loading = "lazy",
  storagePath,
  assetKind = "image",
}: {
  src?: string
  fallbackSrc?: string
  alt: string
  className: string
  loading?: "eager" | "lazy"
  storagePath?: string
  assetKind?: "image" | "video"
}) {
  const { t } = useLang()
  const [failed, setFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const [retried, setRetried] = useState(false)
  const [refreshedSrc, setRefreshedSrc] = useState<string>()

  useEffect(() => {
    let active = true
    setFailed(false)
    setFallbackFailed(false)
    setRetried(false)
    setRefreshedSrc(undefined)

    if (!src && storagePath) {
      setRetried(true)
      void resolveBusinessAsset(storagePath, assetKind)
        .then((url) => {
          if (active) setRefreshedSrc(url)
        })
        .catch((error: unknown) => {
          console.error("Business media could not be refreshed.", error)
          if (active) setFailed(true)
        })
    }

    return () => {
      active = false
    }
  }, [src, storagePath, assetKind])

  const imageSrc =
    !failed && (refreshedSrc || src)
      ? (refreshedSrc ?? src)
      : fallbackSrc && fallbackSrc !== src && !fallbackFailed
        ? fallbackSrc
        : undefined

  if (!imageSrc) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={`${className} grid place-items-center bg-gradient-to-br from-[#4B271A] to-[#D96A17] text-white`}
      >
        <ImageOff size={24} aria-hidden />
        {storagePath && (
          <span className="text-xs font-medium">
            {t("Hindi available ang larawan", "Image unavailable")}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (storagePath && !retried) {
          setRetried(true)
          void resolveBusinessAsset(storagePath, assetKind, true)
            .then(setRefreshedSrc)
            .catch((error: unknown) => {
              console.error("Business media could not be refreshed.", error)
              setFailed(true)
            })
        } else if (failed) {
          setFallbackFailed(true)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

function PostsFeed({
  posts,
  comments,
  likedPostIds,
  interactionsEnabled,
  media,
  businessName,
  businessLogo,
  businessLogoPath,
  businessCover,
  viewerAvatar,
  viewerId,
  session,
  requireAccount,
  onLikeChanged,
  onCommentAdded,
}: {
  posts: BusinessPost[]
  comments: BusinessComment[]
  likedPostIds: string[]
  interactionsEnabled: boolean
  media: Map<string, string>
  businessName: string
  businessLogo?: string
  businessLogoPath?: string
  businessCover?: string
  viewerAvatar?: string
  viewerId?: string
  session: ReturnType<typeof useAccount>["session"]
  requireAccount: ReturnType<typeof useAccount>["requireAccount"]
  onLikeChanged: (postId: string, liked: boolean) => void
  onCommentAdded: (comment: BusinessComment) => void
}) {
  const { t } = useLang()
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{
    postId: string
    message: string
  } | null>(null)

  if (!posts.length)
    return (
      <EmptyPanel
        title="Wala pang post"
        body="Kapag nagbahagi ng update ang negosyo, makikita mo rito."
      />
    )

  return (
    <div className="space-y-4">
      {!interactionsEnabled && (
        <p
          role="status"
          className="rounded-xl bg-sunken px-4 py-3 text-sm text-fg-2"
        >
          {t(
            "Hindi pa naka-enable ang social interactions. Kailangan munang i-update ang database.",
            "Post interactions are unavailable until the database migration is applied.",
          )}
        </p>
      )}
      {posts.map((post) => {
        const postComments = comments.filter(
          (comment) => comment.post_id === post.id,
        )
        const liked = likedPostIds.includes(post.id)
        const expanded = expandedPostId === post.id

        const date = post.published_at ?? post.created_at

        return (
          <article
            key={post.id}
            className="overflow-hidden rounded-[22px] bg-surface shadow-card"
          >
            <div className="flex items-center gap-3 p-4">
              {businessLogo || businessLogoPath ? (
                <BusinessImage
                  src={businessLogo}
                  fallbackSrc={businessCover}
                  alt={`${businessName} logo`}
                  className="h-11 w-11 shrink-0 rounded-[15px] object-cover"
                  loading="eager"
                  storagePath={businessLogoPath}
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-primary font-display font-bold text-ink">
                  {businessName.trim().charAt(0).toUpperCase() || "B"}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display font-semibold">
                  {post.title || businessName}
                </p>
                <p className="text-xs text-fg-2">
                  {formatDate(date)} ·{" "}
                  {post.post_type === "reel"
                    ? "Video"
                    : post.post_type === "blog"
                      ? "Article"
                      : "Post"}
                </p>
              </div>
            </div>
            {post.body && (
              <p className="whitespace-pre-line px-4 pb-4 text-[15px] leading-6">
                {post.body}
              </p>
            )}
            {post.video_url && media.get(post.video_url) ? (
              <video
                controls
                playsInline
                src={media.get(post.video_url)}
                className="max-h-[520px] w-full bg-black"
              />
            ) : null}
            {!!post.media_urls?.length && (
              <div
                className={`grid gap-1 ${
                  post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {post.media_urls.slice(0, 4).map((path) => {
                  const src = media.get(path)

                  return (
                    <BusinessImage
                      key={path}
                      src={src}
                      alt={`${businessName} post photo`}
                      className="max-h-[500px] min-h-40 w-full object-cover"
                      loading="lazy"
                      storagePath={path}
                    />
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2 text-sm text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                {post.likes > 0 && (
                  <>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0866ff] text-white">
                      <ThumbsUp size={12} fill="currentColor" />
                    </span>
                    {post.likes}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActionError(null)
                  setExpandedPostId(expanded ? null : post.id)
                }}
                className="hover:underline"
              >
                {post.comments_count} {t("komento", "comments")}
              </button>
            </div>
            <div className="mx-4 h-px bg-line" />
            <div className="grid grid-cols-2 gap-1 px-2 py-1">
              <button
                type="button"
                disabled={!interactionsEnabled || pendingPostId === post.id}
                aria-pressed={liked}
                onClick={async () => {
                  setActionError(null)
                  if (
                    !requireAccount(
                      t(
                        "Mag-sign in para mag-like.",
                        "Sign in to like this post.",
                      ),
                    )
                  )
                    return
                  if (!viewerId || session?.role !== "traveler") {
                    setActionError({
                      postId: post.id,
                      message: t(
                        "Traveler account lang ang puwedeng mag-like.",
                        "Only traveler accounts can like posts.",
                      ),
                    })
                    return
                  }
                  setPendingPostId(post.id)
                  try {
                    const result = liked
                      ? await supabase
                          .from("post_likes")
                          .delete()
                          .eq("post_id", post.id)
                          .eq("user_id", viewerId)
                      : await supabase.from("post_likes").insert({
                          post_id: post.id,
                          user_id: viewerId,
                        })
                    if (result.error) throw result.error
                    onLikeChanged(post.id, !liked)
                  } catch (error) {
                    console.error(
                      "Business post like could not be saved.",
                      error,
                    )
                    setActionError({
                      postId: post.id,
                      message:
                        error instanceof Error
                          ? error.message
                          : t(
                              "Hindi na-save ang like. Subukan ulit.",
                              "The like could not be saved. Try again.",
                            ),
                    })
                  } finally {
                    setPendingPostId(null)
                  }
                }}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:bg-sunken ${
                  liked ? "text-[#0866ff]" : "text-fg-2"
                } disabled:opacity-50`}
              >
                <ThumbsUp size={18} fill={liked ? "currentColor" : "none"} />
                {liked ? t("Nagustuhan", "Liked") : t("Like", "Like")}
              </button>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => {
                  setActionError(null)
                  setExpandedPostId(expanded ? null : post.id)
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-fg-2 transition hover:bg-sunken"
              >
                <MessageCircle size={18} />
                {t("Magkomento", "Comment")}
              </button>
            </div>
            {actionError?.postId === post.id && (
              <p role="alert" className="px-4 pb-2 text-sm text-red-600">
                {actionError.message}
              </p>
            )}
            {expanded && (
              <div className="space-y-3 border-t border-line px-4 py-3">
                {postComments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <ProfileAvatar
                      name={comment.author_id === viewerId ? "You" : "Traveler"}
                      src={
                        comment.author_id === viewerId
                          ? viewerAvatar
                          : undefined
                      }
                    />
                    <div className="min-w-0">
                      <div className="rounded-2xl bg-sunken px-3 py-2 text-sm dark:bg-elevated">
                        <p className="mb-0.5 text-xs font-semibold">
                          {comment.author_id === viewerId
                            ? t("Ikaw", "You")
                            : t("Biyahero", "Traveler")}
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {comment.body}
                        </p>
                      </div>
                      {comment.reply && (
                        <p className="ml-3 mt-1 border-l-2 border-line pl-2 text-xs text-fg-2">
                          {t("Sagot ng negosyo:", "Business reply:")}{" "}
                          {comment.reply}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {!interactionsEnabled ? (
                  <p className="text-sm text-fg-2">
                    {t(
                      "Hindi pa available ang pagkomento.",
                      "Commenting is not available yet.",
                    )}
                  </p>
                ) : session?.kind === "user" &&
                  session.role === "traveler" &&
                  viewerId ? (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      const body = (drafts[post.id] ?? "").trim()
                      if (!body || pendingPostId === post.id) return
                      if (
                        !requireAccount(
                          t(
                            "Mag-sign in para magkomento.",
                            "Sign in to comment.",
                          ),
                        )
                      )
                        return
                      setActionError(null)
                      setPendingPostId(post.id)
                      try {
                        const { data: comment, error: commentError } =
                          await supabase
                            .from("comments")
                            .insert({
                              post_id: post.id,
                              author_id: viewerId,
                              body,
                            })
                            .select(
                              "id, post_id, author_id, body, reply, created_at",
                            )
                            .single()
                        if (commentError) throw commentError
                        onCommentAdded(comment as BusinessComment)
                        setDrafts((current) => ({ ...current, [post.id]: "" }))
                      } catch (error) {
                        console.error(
                          "Business post comment could not be saved.",
                          error,
                        )
                        setActionError({
                          postId: post.id,
                          message:
                            error instanceof Error
                              ? error.message
                              : t(
                                  "Hindi na-save ang komento. Subukan ulit.",
                                  "The comment could not be saved. Try again.",
                                ),
                        })
                      } finally {
                        setPendingPostId(null)
                      }
                    }}
                  >
                    <ProfileAvatar name="You" src={viewerAvatar} />
                    <label className="sr-only" htmlFor={`comment-${post.id}`}>
                      {t("Mag-iwan ng komento", "Write a comment")}
                    </label>
                    <textarea
                      id={`comment-${post.id}`}
                      value={drafts[post.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))
                      }
                      maxLength={2000}
                      required
                      rows={1}
                      placeholder={t(
                        "Mag-iwan ng komento…",
                        "Write a comment…",
                      )}
                      className="min-h-10 min-w-0 flex-1 resize-none rounded-2xl bg-sunken px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0866ff]/30 dark:bg-elevated"
                    />
                    <button
                      type="submit"
                      aria-label={t("Ipadala ang komento", "Post comment")}
                      disabled={
                        pendingPostId === post.id ||
                        !(drafts[post.id] ?? "").trim()
                      }
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0866ff] text-white disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                ) : session?.kind === "user" ? (
                  <p className="text-sm text-fg-2">
                    {t(
                      "Traveler account lang ang puwedeng magkomento.",
                      "Only traveler accounts can comment.",
                    )}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      requireAccount(
                        t(
                          "Mag-sign in bilang biyahero para magkomento.",
                          "Sign in as a traveler to comment.",
                        ),
                      )
                    }
                    className="text-sm font-medium text-primary underline"
                  >
                    {t("Mag-sign in para magkomento.", "Sign in to comment.")}
                  </button>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function ReviewsFeed({
  businessId,
  reviews,
  rating,
  media,
  fallbackSrc,
  failedMediaPaths,
  viewerAvatar,
  viewerName,
  session,
  requireAccount,
  onSaved,
}: {
  businessId: string
  reviews: BusinessReview[]
  rating: number
  media: Map<string, string>
  fallbackSrc?: string
  failedMediaPaths: Set<string>
  viewerAvatar?: string
  viewerName: string
  session: ReturnType<typeof useAccount>["session"]
  requireAccount: ReturnType<typeof useAccount>["requireAccount"]
  onSaved: () => void
}) {
  const { t } = useLang()
  const [formOpen, setFormOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const myReview =
    session?.kind === "user"
      ? reviews.find((review) => review.author_id === session.accountId)
      : undefined
  const distribution = [5, 4, 3, 2, 1].map(
    (stars) => reviews.filter((review) => review.stars === stars).length,
  )

  const openForm = () => {
    if (
      !requireAccount(
        t(
          "Mag-sign in para makapag-iwan ng review.",
          "Sign in to leave a review.",
        ),
      )
    )
      return
    if (session?.role !== "traveler") {
      setError(
        t(
          "Traveler account lang ang puwedeng mag-review.",
          "Only traveler accounts can leave reviews.",
        ),
      )
      return
    }
    setStars(myReview?.stars ?? 0)
    setBody(myReview?.body ?? "")
    setError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (session?.kind !== "user" || session.role !== "traveler") return
    const text = body.trim()
    if (!stars) {
      setError(t("Pumili ng star rating.", "Choose a star rating."))
      return
    }
    if (text.length < 10) {
      setError(
        t(
          "Magsulat ng hindi bababa sa 10 character.",
          "Write at least 10 characters.",
        ),
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      const request = myReview
        ? supabase
            .from("reviews")
            .update({ stars, body: text })
            .eq("id", myReview.id)
            .eq("author_id", session.accountId)
            .select("id")
            .single()
        : supabase
            .from("reviews")
            .insert({
              business_id: businessId,
              author_id: session.accountId,
              stars,
              body: text,
            })
            .select("id")
            .single()
      const { error: saveError } = await request
      if (saveError) throw saveError
      setFormOpen(false)
      setNotice(t("Salamat sa review mo!", "Thanks for your review!"))
      onSaved()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t(
              "Hindi ma-save ang review. Subukan ulit.",
              "Could not save your review. Please try again.",
            ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {session?.kind !== "user" || session.role === "traveler" ? (
        <button
          type="button"
          onClick={openForm}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-display text-sm font-semibold text-ink shadow-md"
        >
          <Star size={16} />{" "}
          {myReview
            ? t("I-edit ang review mo", "Edit your review")
            : t("Mag-iwan ng review", "Write a review")}
        </button>
      ) : null}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok"
        >
          {notice}
        </p>
      )}
      {error && !formOpen && (
        <p
          role="alert"
          className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {formOpen && (
        <form
          onSubmit={submitReview}
          className="space-y-4 rounded-[22px] bg-surface p-5 shadow-card"
        >
          <div className="flex items-center gap-3">
            <ProfileAvatar name={viewerName} src={viewerAvatar} size={40} />
            <p className="font-display font-semibold">{viewerName}</p>
          </div>
          <h2 className="text-h3">
            {myReview
              ? t("I-edit ang review mo", "Edit your review")
              : t("Ibahagi ang karanasan mo", "Share your experience")}
          </h2>
          <fieldset>
            <legend className="text-sm font-semibold">
              {t("Star rating", "Star rating")}
            </legend>
            <div
              className="mt-2 flex gap-1"
              role="radiogroup"
              aria-label={t("Star rating", "Star rating")}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={stars === value}
                  aria-label={t(
                    `${value} bituin`,
                    `${value} ${value === 1 ? "star" : "stars"}`,
                  )}
                  onClick={() => setStars(value)}
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken"
                >
                  <Star
                    size={27}
                    className={value <= stars ? "text-amber" : "text-line"}
                    fill={value <= stars ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <label
            className="block text-sm font-semibold"
            htmlFor="business-review"
          >
            {t("Review", "Review")}
            <textarea
              id="business-review"
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 1000))}
              maxLength={1000}
              rows={4}
              placeholder={t(
                "Kumusta ang iyong karanasan?",
                "How was your experience?",
              )}
              className="mt-2 w-full resize-y rounded-[16px] border border-line bg-bg px-3 py-2.5 font-normal text-fg outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-2">{body.length}/1000</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (setFormOpen(false), setError(null))}
                className="h-10 rounded-full px-4 text-sm font-semibold text-fg-2"
              >
                {t("Kanselahin", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-ink disabled:opacity-50"
              >
                <Send size={15} />{" "}
                {saving ? t("Sine-save…", "Saving…") : t("I-post", "Post")}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
      <section className="rounded-[22px] bg-surface p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-display text-4xl font-bold">
              {rating ? rating.toFixed(1) : "—"}
            </p>
            <Stars value={rating} />
            <p className="mt-1 text-xs text-fg-2">
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </p>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {distribution.map((count, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className="w-6">{5 - index}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken dark:bg-elevated">
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{
                      width: `${
                        reviews.length ? (count / reviews.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="w-5 text-right text-fg-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {!reviews.length ? (
        <EmptyPanel
          title="Wala pang reviews"
          body="Wala pang naisusumiteng review ang mga biyahero."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[22px] bg-surface p-4 shadow-card"
            >
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  name={
                    session?.kind === "user" &&
                    review.author_id === session.accountId
                      ? viewerName
                      : "Traveler"
                  }
                  src={
                    session?.kind === "user" &&
                    review.author_id === session.accountId
                      ? viewerAvatar
                      : undefined
                  }
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">
                    {session?.kind === "user" &&
                    review.author_id === session.accountId
                      ? t("Ikaw", "You")
                      : t("Biyahero", "Traveler")}
                  </p>
                  <span className="text-xs text-fg-2">
                    {formatDate(review.created_at)}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Stars value={review.stars} />
                <span className="text-sm font-semibold">{review.stars}.0</span>
                {review.visited && (
                  <span className="text-xs text-ok">Bumisita</span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6">
                {review.body}
              </p>
              {!!review.photo_urls?.length && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {review.photo_urls.slice(0, 6).map((path) => (
                    <BusinessImage
                      key={path}
                      src={media.get(path)}
                      fallbackSrc={fallbackSrc}
                      alt="Larawan sa review"
                      className="aspect-square w-full rounded-xl object-cover"
                      loading="lazy"
                      storagePath={path}
                    />
                  ))}
                </div>
              )}
              {review.photo_urls.some((path) => failedMediaPaths.has(path)) && (
                <p role="status" className="mt-2 text-xs text-fg-2">
                  May kapalit na larawan para sa review na ito.
                </p>
              )}
              {review.reply && (
                <p className="mt-3 rounded-xl bg-sunken p-3 text-sm dark:bg-elevated">
                  <b>Sagot ng negosyo:</b> {review.reply}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function AboutSection({
  business,
  hours,
}: {
  business: Business
  hours: BusinessHour[]
}) {
  return (
    <div className="space-y-4">
      <InfoCard title="Tungkol sa negosyo">
        <p className="whitespace-pre-line text-sm leading-6">
          {business.about ||
            "Wala pang dagdag na paglalarawan ang negosyong ito."}
        </p>
        {business.specialties?.length > 0 && (
          <TagList title="Mga specialty" values={business.specialties} />
        )}
        {business.languages?.length > 0 && (
          <TagList title="Mga wika" values={business.languages} />
        )}
        {!!business.contact_name && (
          <p className="mt-4 text-sm text-fg-2">
            Contact person: {business.contact_name}
          </p>
        )}
      </InfoCard>
      {!!hours.length && (
        <InfoCard title="Oras ng negosyo">
          <ul className="space-y-3 text-sm">
            {hours.map((hour) => (
              <li key={hour.day_of_week} className="flex justify-between gap-4">
                <span>{DAYS[hour.day_of_week] ?? "Araw"}</span>
                <span className="text-fg-2">
                  {hour.is_closed
                    ? "Sarado"
                    : hour.all_day
                      ? "Buong araw"
                      : `${formatTime(hour.opens_at)}–${formatTime(hour.closes_at)}`}
                </span>
              </li>
            ))}
          </ul>
        </InfoCard>
      )}
    </div>
  )
}

function MenuSection({ menu }: { menu: MenuItem[] }) {
  if (!menu.length)
    return (
      <EmptyPanel
        title="Walang menu"
        body="Wala pang menu o serbisyo na idinagdag ang negosyo."
      />
    )

  return (
    <section className="overflow-hidden rounded-[22px] bg-surface shadow-card">
      <h2 className="flex items-center gap-2 border-b border-line p-4 text-h3">
        <Utensils size={19} /> Menu at serbisyo
      </h2>
      <ul>
        {menu.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 border-b border-line p-4 last:border-0"
          >
            <span>
              <span className="block font-semibold">{item.name}</span>
              {item.category && (
                <span className="text-xs text-fg-2">{item.category}</span>
              )}
            </span>
            <span className="font-display font-semibold">
              ₱{Number(item.price).toLocaleString("fil-PH")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PhotosSection({
  photos,
  media,
  fallbackSrc,
  unavailableCount,
}: {
  photos: BusinessPhoto[]
  media: Map<string, string>
  fallbackSrc?: string
  unavailableCount: number
}) {
  if (!photos.length)
    return (
      <EmptyPanel
        title="Wala pang larawan"
        body="Wala pang larawang idinagdag ang negosyo."
      />
    )

  return (
    <div className="space-y-3">
      {unavailableCount > 0 && (
        <p
          role="status"
          className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-fg-2 shadow-card"
        >
          May {unavailableCount} larawan na wala na sa storage
          {fallbackSrc
            ? "; ipinapakita ang cover photo bilang kapalit."
            : "; ipinapakita ang placeholder."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo) => (
          <BusinessImage
            key={photo.id}
            src={media.get(photo.storage_path)}
            fallbackSrc={fallbackSrc}
            alt="Larawan ng negosyo"
            className="aspect-square w-full rounded-2xl object-cover"
            loading="lazy"
            storagePath={photo.storage_path}
          />
        ))}
      </div>
    </div>
  )
}

type TagListProps = {
  title: string
  values: string[]
}

function TagList({ title, values }: TagListProps) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-sunken px-3 py-1.5 text-xs dark:bg-elevated"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  )
}

type EmptyPanelProps = {
  title: string
  body: string
}

function EmptyPanel({ title, body }: EmptyPanelProps) {
  return (
    <section className="rounded-[22px] bg-surface p-8 text-center shadow-card">
      <h2 className="text-h3">{title}</h2>
      <p className="mt-2 text-sm text-fg-2">{body}</p>
    </section>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span
      aria-label={`${value.toFixed(1)} sa 5 bituin`}
      className="inline-flex items-center gap-0.5 text-amber"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          fill={star <= Math.round(value) ? "currentColor" : "none"}
          strokeWidth={star <= Math.round(value) ? 0 : 1.5}
        />
      ))}
    </span>
  )
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "—"
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fil-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function safeWebUrl(value: string | undefined) {
  if (!value?.trim()) return null

  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`

  try {
    const parsed = new URL(url)

    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : null
  } catch {
    return null
  }
}
