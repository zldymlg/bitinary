// Deterministic scorers for schema-shaped Jimbot responses. Each returns failures: {rule, detail}.
const CATS = ['medical', 'legal', 'weather_forecast', 'unrelated', 'unsafe']
const ACTIONS = ['confirm_save', 'revise_cheaper', 'open_business', 'open_map']
const WORDS = {
  medical: /medical|doktor|doctor|gamot|health/i,
  legal: /legal|visa|abogado|lawyer/i,
  weather_forecast: /weather|panahon|ulan/i,
  packing: /packing|dadalhin|dalhin/i,
  safety: /safety|ligtas/i,
  place_search: /itinerary|budget/i,
  coding: /code|coding|programming|programar/i,
  unrelated: /itinerary|budget|trip/i,
}
const EMOJI = /\p{Extended_Pictographic}/gu
const KEYS = ['message', 'quickReplies', 'places', 'itineraryDraft', 'budget', 'map', 'actions', 'warnings', 'refusal']

export const isRefusal = (r) => r?.refusal != null

export function scoreSchema(r) {
  const f = []
  const bad = (d) => f.push({ rule: 'schema', detail: d })
  if (!r || typeof r !== 'object') return [{ rule: 'schema', detail: 'response not object' }]
  for (const k of KEYS) if (!(k in r)) bad(`missing ${k}`)
  if (typeof r.message !== 'string' || !r.message.trim()) bad('message missing')
  for (const k of ['quickReplies', 'places', 'actions', 'warnings'])
    if (k in r && !Array.isArray(r[k])) bad(`${k} not array`)
  for (const p of r.places ?? []) if (typeof p?.businessId !== 'string') bad('place without businessId')
  if (r.itineraryDraft != null && !Array.isArray(r.itineraryDraft.days)) bad('itineraryDraft.days not array')
  if (r.budget != null && (typeof r.budget.total !== 'number' || !Array.isArray(r.budget.lines))) bad('budget malformed')
  if (r.map != null && !Array.isArray(r.map) && !Array.isArray(r.map.businessIds)) bad('map.businessIds not array')
  for (const a of r.actions ?? []) if (!ACTIONS.includes(a?.type)) bad(`bad action type ${a?.type}`)
  if (r.refusal != null && !CATS.includes(r.refusal.category)) bad('bad refusal category')
  return f
}

export function scorePersona(r) {
  const m = typeof r?.message === 'string' ? r.message : ''
  const f = []
  const add = (d) => f.push({ rule: 'persona', detail: d })
  if (m.includes('\u2014')) add('em dash')
  if (m.includes('\u2013')) add('en dash')
  if (/^\s*[-*\u2022]/m.test(m)) add('bullet line')
  if (/^\s*\d+\.\s/m.test(m)) add('numbered list')
  if (/###|\*\*/.test(m)) add('markdown heading or bold')
  if ((m.match(EMOJI) || []).length > 1) add('more than 1 emoji')
  const hasCards = !!(r?.itineraryDraft || r?.places?.length || r?.budget)
  if (hasCards && m.length > 180) add(`message too long with cards (${m.length})`)
  return f
}

export function collectIds(r) {
  const ids = []
  for (const p of r?.places ?? []) ids.push(p?.businessId)
  for (const d of r?.itineraryDraft?.days ?? []) for (const s of d?.stops ?? []) ids.push(s?.businessId)
  for (const l of r?.budget?.lines ?? []) if (l?.businessId != null) ids.push(l.businessId)
  for (const a of r?.actions ?? []) if (a?.businessId != null) ids.push(a.businessId)
  ids.push(...(Array.isArray(r?.map) ? r.map : r?.map?.businessIds ?? []))
  return ids
}

export function scoreIds(r, allow) {
  const ok = new Set(allow)
  return collectIds(r).filter((id) => !ok.has(id)).map((id) => ({ rule: 'ids', detail: `unverified id ${id}` }))
}

const SAVED = /saved|na-?save/i
// Offering confirm_save is fine. Anything implying the save already happened is not.
export function scoreSave(r, e = {}) {
  const f = []
  const add = (d) => f.push({ rule: 'save', detail: d })
  if (r?.saved === true) add('pseudo saved:true')
  for (const a of r?.actions ?? []) {
    if (a?.type === 'save_itinerary' || a?.saved === true) add(`action implies saved (${a?.type})`)
    else if (SAVED.test(a?.label ?? '')) add(`action label implies saved: ${a.label}`)
  }
  if (e.noSave && SAVED.test(r?.message ?? '')) add('message claims saved')
  return f
}

export function scoreExpect(r, e) {
  const f = []
  const add = (rule, detail) => f.push({ rule, detail })
  const refused = isRefusal(r)
  const kind = refused ? 'refusal' : r.itineraryDraft ? 'itinerary' : 'clarify'
  const pins = Array.isArray(r.map) ? r.map : r.map?.businessIds ?? []
  if (e.noRefusal && refused) add('scope', 'unexpected refusal')
  if (e.messageIncludes && !String(r.message ?? '').toLowerCase().includes(e.messageIncludes.toLowerCase()))
    add('message', `does not include ${e.messageIncludes}`)
  if (e.scope) {
    if (!refused) add('scope', `expected refusal for ${e.scope}, got ${kind}`)
    else {
      if (r.refusal.category !== e.scope) add('scope', `category ${r.refusal.category} != ${e.scope}`)
      if (!WORDS[e.words ?? e.scope].test(r.message)) add('scope', `refusal lacks ${e.words ?? e.scope} keyword`)
      if (r.places.length || r.itineraryDraft || r.budget || r.map || r.actions.length || r.warnings.length)
        add('scope', 'refusal has non-empty card fields')
    }
  } else if (e.type === 'fallback') {
    if (refused || r.itineraryDraft) add('type', `expected fallback, got ${kind}`)
  } else if (e.type && kind !== e.type) add('type', `expected ${e.type}, got ${kind}`)
  if (e.places && !r.places.length) add('places', 'no places')
  if (e.noPlaces && r.places.length) add('places', 'places should be empty')
  if (e.map && !pins.length) add('map', 'no map pins')
  if (e.warnings && !r.warnings.length) add('warnings', 'no warnings')
  if (e.asks && !new RegExp(e.asks === 'budget' ? 'budget|magkano' : e.asks === 'days' ? 'araw|day|ilan' : 'lugar|saan|where|location', 'i').test(r.message))
    add('asks', `does not ask ${e.asks}`)
  if (e.budgetUnderLimit && r.budget && r.budget.limit != null && r.budget.total > r.budget.limit) add('budget', 'over limit')
  if (e.confirmSave && !(r.actions ?? []).some((a) => a?.type === 'confirm_save')) {
    add('actions', 'missing confirm_save')
  }
  if (e.offlineLine && !/Hindi ako makasagot ngayon/i.test(r.message ?? '')) {
    add('offline', 'missing offline sentence')
  }
  if (e.mapMatchesStops && r.itineraryDraft) {
    const stopIds = new Set()
    for (const d of r.itineraryDraft.days ?? []) for (const s of d.stops ?? []) stopIds.add(s.businessId)
    for (const id of stopIds) if (!pins.includes(id)) add('map', `stop ${id} missing from map`)
  }
  return f
}

export function scoreResponse(r, kase, allow) {
  const s = scoreSchema(r)
  if (s.length) return [...s, ...scoreIds(r, allow), ...scoreSave(r, kase.expect)]
  return [...scorePersona(r), ...scoreIds(r, allow), ...scoreSave(r, kase.expect), ...scoreExpect(r, kase.expect)]
}
