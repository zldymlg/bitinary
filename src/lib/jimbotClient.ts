import type {
  JimbotBudget,
  JimbotItineraryDraft,
  JimbotMap,
  JimbotPlaceDisplay,
  JimbotPlaceRef,
  Msg,
} from '@/data/chat'
import { supabase } from '@/lib/supabase'

export type JimbotBotFields = Omit<Extract<Msg, { role: 'bot' }>, 'id' | 'role' | 'expression'>

export type JimbotAiRequest = {
  message: string
  locale?: 'en' | 'tl'
  conversationId?: string | null
  planningContext?: Record<string, unknown> | null
  explicitConfirmed?: boolean
  history?: { role: 'user' | 'assistant'; content: string }[]
}

export type JimbotAiResult = {
  ok: boolean
  bot: JimbotBotFields
  payload: Record<string, unknown> | null
  savedItineraryId?: string | null
  traceId?: string
}

const FALLBACK_TEXT = 'Hindi ako makasagot ngayon. Subukan ulit mamaya.'

/** Local dev only: point at a `deno run` / `supabase functions serve` instance. */
const JIMBOT_FUNCTION_URL = import.meta.env.VITE_JIMBOT_FUNCTION_URL as string | undefined

const arr = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) && v.length ? (v as T[]) : undefined)

type BizRow = {
  id: string
  name: string
  city: string | null
  address: string | null
  price_range: string | null
  latitude: number | null
  longitude: number | null
  cover_url: string | null
}

function collectIds(bot: JimbotBotFields): string[] {
  const ids = new Set<string>()
  for (const p of bot.places ?? []) if (p.businessId) ids.add(p.businessId)
  for (const day of bot.itineraryDraft?.days ?? []) {
    for (const stop of day.stops ?? []) if (stop.businessId) ids.add(stop.businessId)
  }
  for (const id of bot.map?.businessIds ?? []) if (id) ids.add(id)
  for (const line of bot.budget?.lines ?? []) if (line.businessId) ids.add(line.businessId)
  for (const a of bot.actions ?? []) if (a.businessId) ids.add(a.businessId)
  return [...ids]
}

function displayFrom(row: BizRow | undefined): JimbotPlaceDisplay {
  if (!row) return {}
  return {
    name: row.name,
    city: row.city,
    address: row.address,
    priceRange: row.price_range,
    photo: row.cover_url,
    lat: row.latitude ?? undefined,
    lng: row.longitude ?? undefined,
  }
}

async function hydrateBot(bot: JimbotBotFields): Promise<JimbotBotFields> {
  const ids = collectIds(bot)
  if (!ids.length) return bot

  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, city, address, price_range, latitude, longitude, cover_url')
    .in('id', ids)
    .eq('live', true)
    .eq('verification_status', 'verified')

  if (error || !data?.length) {
    if (error) console.error('Jimbot place hydrate failed', error)
    return bot
  }

  const byId = new Map((data as BizRow[]).map((row) => [row.id, row]))

  const places: JimbotPlaceRef[] | undefined = bot.places?.map((p) => ({
    ...p,
    ...displayFrom(byId.get(p.businessId)),
  }))

  let itineraryDraft: JimbotItineraryDraft | null | undefined = bot.itineraryDraft
  if (itineraryDraft?.days) {
    itineraryDraft = {
      ...itineraryDraft,
      days: itineraryDraft.days.map((day) => ({
        ...day,
        stops: (day.stops ?? []).map((stop) => ({
          ...stop,
          ...displayFrom(byId.get(stop.businessId)),
        })),
      })),
    }
  }

  let map: JimbotMap | null | undefined = bot.map
  if (map?.businessIds?.length) {
    map = {
      ...map,
      pins: map.businessIds.map((businessId) => ({
        businessId,
        ...displayFrom(byId.get(businessId)),
      })),
    }
  }

  let budget: JimbotBudget | null | undefined = bot.budget
  if (budget?.lines) {
    budget = {
      ...budget,
      lines: budget.lines.map((line) => {
        if (!line.businessId) return line
        const row = byId.get(line.businessId)
        if (!row || line.label?.trim()) return line
        return { ...line, label: row.name }
      }),
    }
  }

  return { ...bot, places, itineraryDraft, map, budget }
}

/** Calls the jimbot Edge Function. Never throws; ok=false means show the offline sentence, not a keyword fallback. */
export async function askJimbot(req: JimbotAiRequest): Promise<JimbotAiResult> {
  const fail: JimbotAiResult = { ok: false, bot: { text: FALLBACK_TEXT }, payload: null }
  try {
    const body = {
      message: req.message,
      locale: req.locale,
      conversationId: req.conversationId ?? null,
      planningContext: req.planningContext ?? null,
      explicitConfirmed: req.explicitConfirmed ?? false,
      history: req.history ?? [],
    }

    let data: unknown
    let traceId: string | undefined
    const requestStarted = performance.now()
    try {
      if (JIMBOT_FUNCTION_URL) {
        const { data: auth } = await supabase.auth.getSession()
        const res = await fetch(JIMBOT_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.session?.access_token ? { Authorization: `Bearer ${auth.session.access_token}` } : {}),
          },
          body: JSON.stringify(body),
        })
        traceId = res.headers.get('X-Jimbot-Trace-Id') ?? undefined
        if (!res.ok) return { ...fail, traceId }
        data = await res.json()
      } else {
        const result = await supabase.functions.invoke('jimbot', { body })
        traceId = result.response?.headers.get('X-Jimbot-Trace-Id') ?? undefined
        if (result.error) return { ...fail, traceId }
        data = result.data
      }
    } finally {
      performance.measure('jimbot:edge', { start: requestStarted, detail: { traceId } })
    }
    if (!data || typeof data !== 'object') {
      return { ...fail, traceId }
    }
    const d = data as Record<string, any>
    const text = String(d.message ?? d.text ?? '').trim()
    // Edge function returns its own generic fallback (with a warning) when the model call fails.
    const warnings = arr<string>(d.warnings)
    const tempIssue = !!warnings?.some((w) => w.startsWith('Temporary issue'))
    if (!text || tempIssue) return { ...fail, traceId }
    const map = d.map && Array.isArray(d.map.businessIds) && d.map.businessIds.length ? d.map : null
    const raw: JimbotBotFields = {
      text,
      quickReplies: arr<string>(d.quickReplies),
      places: arr(d.places),
      itineraryDraft: d.itineraryDraft ?? null,
      budget: d.budget ?? null,
      map,
      actions: arr(d.actions),
      warnings,
      refusal: d.refusal ?? null,
    }
    const hydrationStarted = performance.now()
    const bot = await hydrateBot(raw)
    performance.measure('jimbot:hydrate', { start: hydrationStarted, detail: { traceId } })
    const { text: _t, ...structured } = bot
    const savedItineraryId = typeof d.savedItineraryId === 'string' ? d.savedItineraryId : null
    return { ok: true, bot, payload: structured as Record<string, unknown>, savedItineraryId, traceId }
  } catch (e) {
    console.error('Jimbot AI call failed', e)
    return fail
  }
}
