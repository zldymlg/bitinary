export type DailyViews = { date: string; views: number }
type DailyViewRow = { stat_date: string; views: number | null }

const DAY_MS = 86_400_000

export function utcDateKeys(now = new Date(), days = 30): string[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Array.from({ length: days }, (_, index) => new Date(today.getTime() - (days - index - 1) * DAY_MS).toISOString().slice(0, 10))
}

export function buildDailyViews(rows: DailyViewRow[], now = new Date(), days = 30): DailyViews[] {
  const dates = utcDateKeys(now, days)
  const viewsByDate = new Map(rows.map((row) => [row.stat_date, Number(row.views) || 0]))
  return dates.map((date) => ({ date, views: viewsByDate.get(date) ?? 0 }))
}
