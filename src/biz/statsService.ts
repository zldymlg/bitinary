import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildDailyViews, utcDateKeys, type DailyViews } from './analyticsDates'

export type { DailyViews } from './analyticsDates'
export type BizStats = {
  dailyViews: DailyViews[]
  ratingAll: number | null
  reviewCount: number
  loading: boolean
  isDatabaseBacked: boolean
  error: string | null
}

export function buildZeroStats(error: string | null = null, isDatabaseBacked = false): BizStats {
  return {
    dailyViews: utcDateKeys().map((date) => ({ date, views: 0 })),
    ratingAll: null,
    reviewCount: 0,
    loading: false,
    isDatabaseBacked,
    error,
  }
}

/** Fetches only owner-scoped profile views and aggregate visible-review data. */
export async function fetchDatabaseStats(options: {
  businessId?: string
  live?: boolean
}): Promise<BizStats> {
  if (!options.live) return buildZeroStats()

  const businessId = options.businessId
  if (!businessId) return buildZeroStats('This business has not been saved to the database yet.')

  try {
    const now = new Date()
    const dates = utcDateKeys(now)
    const [summaryRes, dailyRes] = await Promise.all([
      supabase.rpc('get_business_review_summary', { p_business_id: businessId }).maybeSingle(),
      supabase
        .from('business_daily_stats')
        .select('stat_date, views')
        .eq('business_id', businessId)
        .gte('stat_date', dates[0])
        .lte('stat_date', dates[dates.length - 1]),
    ])

    if (summaryRes.error) throw summaryRes.error
    if (dailyRes.error) throw dailyRes.error
    const summary = summaryRes.data as { review_count: unknown; average_rating: unknown } | null
    if (!summary) throw new Error('No analytics access for this business.')
    const reviewCount = Number(summary.review_count)
    const rawRating = summary.average_rating
    const averageRating = rawRating == null ? null : Number(rawRating)
    if (!Number.isSafeInteger(reviewCount) || reviewCount < 0 || (averageRating != null && (!Number.isFinite(averageRating) || averageRating < 1 || averageRating > 5))) {
      throw new Error('Invalid analytics summary response.')
    }

    return {
      dailyViews: buildDailyViews(dailyRes.data ?? [], now),
      ratingAll: averageRating == null ? null : Number(averageRating.toFixed(1)),
      reviewCount,
      loading: false,
      isDatabaseBacked: true,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load business analytics.'
    return buildZeroStats(message)
  }
}

/** Hook for reactive owner-scoped business statistics. */
export function useBizStats(options?: {
  businessId?: string
  live?: boolean
}): BizStats & { refresh: () => void } {
  const [stats, setStats] = useState<BizStats>(() => ({ ...buildZeroStats(), loading: true }))
  const businessId = options?.businessId
  const live = options?.live
  const generation = useRef(0)
  const request = useRef(0)
  const scope = useRef({ businessId, live })
  scope.current = { businessId, live }

  const refresh = useCallback(() => {
    const currentGeneration = generation.current
    const currentRequest = ++request.current
    setStats((current) => ({ ...current, loading: true, error: null }))
    void fetchDatabaseStats({ businessId, live }).then((next) => {
      if (scope.current.businessId === businessId && scope.current.live === live && generation.current === currentGeneration && request.current === currentRequest) setStats(next)
    })
  }, [businessId, live])

  useEffect(() => {
    let active = true
    const currentGeneration = ++generation.current
    setStats({ ...buildZeroStats(), loading: true })

    const loadStats = () => {
      const currentRequest = ++request.current
      void fetchDatabaseStats({ businessId, live }).then((next) => {
        if (active && scope.current.businessId === businessId && scope.current.live === live && generation.current === currentGeneration && request.current === currentRequest) setStats(next)
      })
    }

    loadStats()
    const channel =
      live && businessId
        ? supabase
            .channel(`business-analytics-${businessId}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'business_daily_stats', filter: `business_id=eq.${businessId}` },
              loadStats,
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'reviews', filter: `business_id=eq.${businessId}` },
              loadStats,
            )
            .subscribe((status) => {
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`Live business analytics subscription failed: ${status}`)
              }
            })
        : null

    return () => {
      active = false
      if (generation.current === currentGeneration) generation.current++
      if (channel) void supabase.removeChannel(channel)
    }
  }, [businessId, live])

  return useMemo(() => ({ ...stats, refresh }), [stats, refresh])
}
