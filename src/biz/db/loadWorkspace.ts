import { emptyBusiness, type BusinessProfile, type Day } from "@/app/account"

import { normalizeBizType } from "@/data/themes"

import { supabase } from "@/lib/supabase"

import type { BizData } from "../store"

import type {
  Comment,
  Notif,
  Post,
  Review,
} from "../seed"

import {
  loadComments,
  loadHours,
  loadMenuItems,
  loadNotifications,
  loadOwnedBusiness,
  loadPhotos,
  loadPosts,
  loadReviews,
} from "./index"

import { execute, type DbResult } from "./result"

const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export async function loadOwnedWorkspace(): Promise<DbResult<BizData | null>> {
  return execute(async () => {
    const businessResult = await loadOwnedBusiness()

    if (businessResult.error) throw new Error(businessResult.error)

    if (!businessResult.data) return null

    const businessId = businessResult.data.id

    const [
      hoursResult,

      menuResult,

      photosResult,

      postsResult,

      commentsResult,

      reviewsResult,

      notificationsResult,
    ] = await Promise.all([
      loadHours(businessId),

      loadMenuItems(businessId),

      loadPhotos(businessId),

      loadPosts(businessId),

      loadComments(businessId),

      loadReviews(businessId),

      loadNotifications(),
    ])

    const results = [
      hoursResult,

      menuResult,

      photosResult,

      postsResult,

      commentsResult,

      reviewsResult,

      notificationsResult,
    ]

    const failure = results.find((result) => result.error)

    if (failure?.error) throw new Error(failure.error)

    const hours = hoursResult.data ?? []

    const menu = menuResult.data ?? []

    const photos = photosResult.data ?? []

    const posts = postsResult.data ?? []

    const comments = commentsResult.data ?? []

    const reviews = reviewsResult.data ?? []

    const notifications = notificationsResult.data ?? []

    const row = businessResult.data

    const hoursByDay = { ...emptyBusiness.hours }

    for (const hour of hours) {
      const day = DAYS[hour.day_of_week]

      if (day)
        hoursByDay[day] = {
          open: hour.opens_at?.slice(0, 5) ?? "",

          close: hour.closes_at?.slice(0, 5) ?? "",

          closed: hour.is_closed,

          allDay: hour.all_day,
        }
    }

    const profile: BusinessProfile = {
      ...emptyBusiness,

      id: row.id,

      status: row.setup_status ?? emptyBusiness.status,

      name: row.name,

      type: normalizeBizType(row.business_type),

      price: row.price_range ?? undefined,

      address: row.address,

      city: row.city,

      pin:
        row.latitude != null && row.longitude != null
          ? { lat: row.latitude, lng: row.longitude }
          : undefined,

      hours: hoursByDay,

      contactName: row.contact_name,

      mobile: row.mobile,

      landline: row.landline,

      about: row.about,

      specialties: row.specialties ?? [],

      languages: row.languages ?? [],

      goals: row.goals ?? [],

      cover:
        row.cover_url ??
        photos.find((photo) => photo.is_cover)?.storage_path ??
        undefined,

      photos: photos

        .filter((photo) => !photo.is_cover)

        .sort((a, b) => a.sort_order - b.sort_order)

        .map((photo) => photo.storage_path),

      menu: menu

        .sort((a, b) => a.sort_order - b.sort_order)

        .map((item) => ({
          id: item.id,

          name: item.name,

          price: String(item.price),

          category: item.category,
        })),

      logo: row.logo_url ?? undefined,

      links: row.links ?? emptyBusiness.links,

      verification: {
        method: row.verification_method ?? undefined,

        files: row.verification_files ?? [],

        onsiteDate: row.onsite_date ?? undefined,

        status: row.verification_status,
      },

      live: row.live,

      liveAt: row.live_at ?? undefined,
    }

    const asDate = (value: string | null, backup: string) => value ?? backup

    const mapPosts: Post[] = posts.map((post) => ({
      id: post.id,

      type: post.post_type,

      title: post.title ?? undefined,

      text: post.body,

      media: post.media_urls ?? [],

      video: post.video_url ?? undefined,

      status: post.status,

      at: asDate(post.published_at ?? post.scheduled_at, post.created_at),

      views: post.views,

      likes: post.likes,

      saves: post.saves,

      comments: post.comments_count,
    }))

    const mapComments: Comment[] = comments.map((comment) => ({
      id: comment.id,

      postId: comment.post_id,

      authorId: comment.author_id ?? undefined,

      nick: comment.author_id ?? "",

      text: comment.body,

      at: comment.created_at,

      fresh: Date.now() - new Date(comment.created_at).getTime() < 86_400_000,

      hidden: comment.hidden,

      reported: comment.reported_reason ?? undefined,

      reply: comment.reply ?? undefined,

      blocked: comment.blocked,
    }))

    const mapReviews: Review[] = reviews.map((review) => ({
      id: review.id,

      nick: review.author_id ?? "",

      authorId: review.author_id ?? undefined,

      stars: review.stars,

      text: review.body,

      photos: review.photo_urls ?? [],

      at: review.created_at,

      checkin:
        review.checkin_at && review.checkin_via
          ? { at: review.checkin_at, via: review.checkin_via }
          : null,

      reply: review.reply ?? undefined,

      fresh: Date.now() - new Date(review.created_at).getTime() < 86_400_000,

      hidden: review.hidden,
    }))

    const mapNotifications: Notif[] = notifications.map((notification) => ({
      id: notification.id,

      kind: notification.kind as Notif["kind"],

      en: notification.title,

      tl: notification.title,

      at: notification.created_at,

      to: notification.target ?? "",

      read: notification.read_at != null,
    }))

    const auth = await supabase.auth.getUser()

    if (auth.error) throw new Error(auth.error.message)

    const user = auth.data.user
    if (!user)
      throw new Error("Sign in as the business owner to load profile data.")

    const ownerProfileResult = await supabase
      .from("profiles")
      .select("name, nickname, mobile")
      .eq("id", user.id)
      .maybeSingle()

    if (ownerProfileResult.error)
      throw new Error(ownerProfileResult.error.message)
    const ownerProfile = ownerProfileResult.data

    const data: BizData = {
      langPref: null,

      session: user
        ? {
            method: user.phone ? "mobile" : "email",

            contact: user.email ?? user.phone ?? "",
          }
        : null,

      resume: null,

      profile: {
        name:
          ownerProfile?.name ||
          String(
            user.user_metadata?.name ?? user.user_metadata?.full_name ?? "",
          ),

        nickname: ownerProfile?.nickname ?? "",

        email: user?.email ?? "",

        mobile: ownerProfile?.mobile || user?.phone || "",
      },

      business: profile,

      updated: {},

      quick: { state: "open", soldOut: false, longQueue: false, special: "" },

      branches: [],

      activeBranch: "",

      staff: [],

      posts: mapPosts,

      comments: mapComments,

      reviews: mapReviews,

      cases: [],

      deals: [],

      boosts: [],

      requests: [],

      reservations: { enabled: false, tables: 0, maxParty: 0, slot: 0 },

      queue: { open: false, waiting: 0 },

      notifs: mapNotifications,

      prefs: {
        jimbotMatch: false,

        channel: "notif",

        notif: {
          reviews: true,

          comments: true,

          reports: true,

          weekly: true,

          deals: true,
        },
      },

      qrToken: "",

      blocked: [],

      reportsUsed: 0,
    }

    return data
  })
}
