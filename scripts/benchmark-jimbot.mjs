import { scoreSchema, collectIds } from '../tests/jimbot-ai/score.mjs'

const { JIMBOT_BENCH_URL, JIMBOT_BENCH_API_KEY, JIMBOT_BENCH_USER_TOKEN } = process.env
const count = Number(process.env.JIMBOT_BENCH_SAMPLES ?? 30)
const city = process.env.JIMBOT_BENCH_CITY ?? 'Quezon City'
if (!JIMBOT_BENCH_URL || !Number.isInteger(count) || count < 1) {
  throw new Error('Set JIMBOT_BENCH_URL to a staging or local function URL and choose a positive sample count.')
}
const url = new URL(JIMBOT_BENCH_URL)
if (url.hostname === 'rwgwvadacubstdybhmjw.supabase.co') {
  throw new Error('Use a staging or local function. The benchmark sends repeated requests.')
}
const headers = {
  'Content-Type': 'application/json',
  ...(JIMBOT_BENCH_API_KEY ? { apikey: JIMBOT_BENCH_API_KEY } : {}),
  ...(JIMBOT_BENCH_USER_TOKEN ? { Authorization: `Bearer ${JIMBOT_BENCH_USER_TOKEN}` } : {}),
}
const planMessage = `Gumawa ng 1 araw na itinerary sa ${city}, budget 2500 para sa 2 tao`
let requestCount = 0
let windowStart = performance.now()

async function invoke(body) {
  // Stay below the Edge Function's 25 request/minute limit.
  if (requestCount === 20) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 61_000 - (performance.now() - windowStart))))
    requestCount = 0
    windowStart = performance.now()
  }
  requestCount += 1
  const started = performance.now()
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) })
    const payload = await response.json()
    return {
      payload,
      http: response.status,
      ms: Math.round(performance.now() - started),
      traceId: response.headers.get('x-jimbot-trace-id'),
      serverTiming: response.headers.get('server-timing'),
    }
  } catch {
    return { payload: null, http: 0, ms: Math.round(performance.now() - started), traceId: null, serverTiming: null }
  }
}

const setup = await invoke({ message: planMessage, locale: 'tl' })
if (!setup.payload?.itineraryDraft?.days?.length) {
  throw new Error('Seed verified businesses in the benchmark city and verify the staging function can produce an itinerary.')
}
const { itineraryDraft, places, budget, map } = setup.payload
const cases = [
  ['greeting-en', { message: 'Hello!', locale: 'en' }, (r) => !r.places.length && !r.itineraryDraft],
  ['greeting-tl', { message: 'Kumusta!', locale: 'tl' }, (r) => !r.places.length && !r.itineraryDraft],
  ['search-match', { message: `Find verified cafes in ${city}`, locale: 'en' }, (r) => r.places.length > 0 && !r.itineraryDraft],
  ['search-empty', { message: 'Maghanap ng cafe sa Testville', locale: 'tl' }, (r) => !r.places.length && !r.itineraryDraft],
  ['itinerary', { message: planMessage, locale: 'tl' }, (r) => !!r.itineraryDraft && r.actions.some((a) => a.type === 'confirm_save')],
  ['revision', {
    message: 'Puwede bang mas mura ang itinerary?',
    locale: 'tl',
    planningContext: { itineraryDraft, places, budget, map },
    history: [{ role: 'user', content: planMessage }, { role: 'assistant', content: setup.payload.message }],
  }, (r) => !!r.itineraryDraft],
]

const percentile = (values, p) => values[Math.ceil(values.length * p) - 1]
for (const [category, body, expected] of cases) {
  await invoke(body)
  const samples = []
  for (let i = 0; i < count; i += 1) {
    const { payload, ...sample } = await invoke(body)
    const ok = sample.http === 200 && !scoreSchema(payload).some((f) => f.detail !== 'bad action type open_help') &&
      !payload.refusal && !payload.warnings.some((warning) => warning.startsWith('Temporary issue')) && expected(payload)
    samples.push({
      ...sample,
      ok,
      modelCalls: sample.serverTiming ? (sample.serverTiming.match(/\bmodel_\d+;dur=/g) ?? []).length : null,
      businessIds: ok ? [...new Set(collectIds(payload))].filter(Boolean) : [],
    })
  }
  const times = samples.map((sample) => sample.ms).sort((a, b) => a - b)
  console.log(JSON.stringify({
    category, medianMs: percentile(times, 0.5), p95Ms: percentile(times, 0.95),
    failures: samples.filter((sample) => !sample.ok).length, samples,
  }))
}
