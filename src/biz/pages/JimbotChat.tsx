import { ArrowUp, Database, Megaphone, PenLine, Rocket, Settings2, Tag } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Lang } from '@/app/i18n'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { useReducedMotion } from '@/lib/useMedia'
import { useBiz, type BizData } from '../store'
import { PageHeader } from '../ui'

type Action = { kind: 'deal' | 'prices' | 'boost' | 'post' | 'reel' | 'review' | 'profile' | 'help'; to: string }
type Msg = { id: number; from: 'me' | 'jimbot'; text: string; actions?: Action[]; data?: [string, string][] }
type Intent = 'greeting' | 'thanks' | 'goodbye' | 'customers' | 'promo' | 'menu' | 'trending' | 'review' | 'post' | 'profile' | 'reservations' | 'support' | 'unknown'
const CONTEXTUAL_INTENTS = new Set<Intent>(['customers', 'promo', 'menu', 'trending', 'review', 'post', 'profile', 'reservations'])

const TL_WORDS = /\b(paano|ano|ang|ng|mga|ko|ako|sa|po|naman|gusto|dadami|gumawa|tulungan|suriin|uso|malapit|sagot|tulong|kailangan|magkano|may|paki|negosyo|presyo|salamat|kumusta|kamusta)\b/i

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detect(text: string, previous?: Intent): Intent {
  const s = normalize(text)
  if (/\b(hi|hello|hey|kumusta|kamusta|musta|magandang umaga|magandang hapon|magandang gabi)\b/.test(s)) return 'greeting'
  if (/\b(thanks|thank you|salamat|maraming salamat|daghang salamat)\b/.test(s)) return 'thanks'
  if (/\b(bye|goodbye|paalam|see you|ingat|amping)\b/.test(s)) return 'goodbye'
  if (/\b(promo|promos|promotion|deal|discount|sale|offer|b1t1|voucher|coupon|buy 1|get 1)\b/.test(s)) return 'promo'
  if (/\b(menu|price|prices|pricing|presyo|presyuhan|item|items|product|products|serbisyo|service|services|listahan)\b/.test(s)) return 'menu'
  if (/\b(review|reviews|feedback|rating|ratings|stars|comment|comments|reklamo|reply|replies|sagot)\b/.test(s)) return 'review'
  if (/\b(trend|trending|uso|popular|popularity|demand|hinahanap|search|nearby|malapit)\b/.test(s)) return 'trending'
  if (/\b(post|posts|content|caption|facebook|instagram|social media|reel|reels|marketing|market)\b/.test(s)) return 'post'
  if (/\b(reservation|reservations|booking|bookings|book|table|tables|appointment|appointments)\b/.test(s)) return 'reservations'
  if (/\b(profile|business info|business details|about my business|business description|online presence|hours|address|location|contact|business name)\b/.test(s)) return 'profile'
  if (/\b(customer|customers|client|clients|visitor|visitors|guest|guests|walk ins|foot traffic|sales|sell|selling|revenue|profit|improve|attract|grow|growth|more people|more visits|dagdag|dadami|dumarami|dumami|kita|benta|marketing tips|strategies)\b/.test(s)) return 'customers'
  if (/\b(support|tulong|help|assist|assistance|what can you do|ano kaya mo)\b/.test(s)) return 'support'
  if (/\b(more|another|others|else|continue|go on|more ideas|more details|tell me more|what next|what about that|and then|explain|elaborate|sige|oo|yes|okay)\b/.test(s) && previous) return previous
  return 'unknown'
}

export function answer(intent: Intent, L: Lang, d: BizData, enough: boolean, followUp = false): Omit<Msg, 'id' | 'from'> {
  const t = (tl: string, en: string) => (L === 'en' ? en : tl)
  const featuredItem = d.business.specialties[0] || d.business.menu[0]?.name || d.business.type || t('serbisyo mo', 'your service')
  switch (intent) {
    case 'greeting':
      return { text: t(`Kumusta, ${d.profile.nickname || 'kaibigan'}! Ano ang gusto mong ayusin o pagandahin sa negosyo mo?`, `Hi, ${d.profile.nickname || 'there'}! What would you like to improve in your business?`) }
    case 'thanks':
      return { text: t('Walang anuman! Sabihin mo lang kung gusto mo pa ng tulong sa menu, promos, posts, o reviews.', 'You’re welcome! I can also help with your menu, promotions, posts, or reviews.') }
    case 'goodbye':
      return { text: t('Sige, nandito lang ako kapag kailangan mo ulit ng tulong sa negosyo mo.', 'Sounds good. I’ll be here when you need more help with your business.') }
    case 'customers':
      {
        const bestPost = d.posts
          .filter((post) => post.status === 'published')
          .sort((a, b) => b.views - a.views)[0]
        return {
          text: followUp
            ? t(`Isa pang hakbang: gumamit ng malinaw na larawan ng ${featuredItem}, ilagay ang totoong detalye, at sagutin agad ang mga tanong sa comments o messages.`, `Another step: use a clear photo of ${featuredItem}, include accurate details, and respond promptly to questions in comments or messages.`)
            : t(
                `Para makahikayat ng customers, subukan mong gumawa ng malinaw na post tungkol sa ${featuredItem} at ilagay ang presyo, lokasyon, at susunod na hakbang para makapunta o makapag-order. ${bestPost ? `Puwede mo ring gawing panimula ang post na “${bestPost.title || bestPost.text.slice(0, 60)}”.` : 'Wala pa akong nakitang published post na puwedeng gawing batayan.'}`,
                `To attract more customers, try a clear post about ${featuredItem} with the price, location, and how to visit or order. ${bestPost ? `You could also build on “${bestPost.title || bestPost.text.slice(0, 60)}”.` : 'I don’t see a published post to use as a reference yet.'}`,
              ),
          actions: bestPost
            ? [{ kind: 'post', to: '/biz/content/new?type=post' }, { kind: 'boost', to: `/biz/account/boost?post=${bestPost.id}` }]
            : [{ kind: 'post', to: '/biz/content/new?type=post' }, { kind: 'deal', to: '/biz/account/deals?new=b1t1' }],
          data: [
            [t('Negosyo', 'Business'), d.business.name || t('Hindi pa nakapangalan', 'Name not set')],
            [t('Itinatampok', 'Suggested highlight'), featuredItem],
            [t('Published posts', 'Published posts'), String(d.posts.filter((post) => post.status === 'published').length)],
            [t('Performance data', 'Performance data'), enough ? t('Available', 'Available') : t('Hindi pa sapat', 'Not enough yet')],
          ],
        }
      }
    case 'promo':
      return {
        text: followUp
          ? t(`Hindi kailangang malaking diskuwento: puwede ring bundle o dagdag na item para sa ${featuredItem}. Itakda muna ang malinaw na petsa at limit.`, `A promotion doesn’t have to be a large discount: a bundle or add-on for ${featuredItem} can work too. Set clear dates and limits first.`)
          : t(
              `Puwede kang gumawa ng promo para sa ${featuredItem}. Ilagay nang malinaw ang item, diskuwento o dagdag na value, petsa, oras, at limit para madaling maintindihan ng customers.`,
              `You could create a promotion for ${featuredItem}. Make the item, discount or added value, dates, hours, and limits clear so customers know exactly what to expect.`,
            ),
        actions: [{ kind: 'deal', to: '/biz/account/deals?new=b1t1' }, { kind: 'post', to: '/biz/content/new?type=post&deal=1' }],
        data: [[t('Iminungkahing item', 'Suggested item'), featuredItem], [t('Kasalukuyang promos', 'Current promotions'), String(d.deals.filter((deal) => deal.status === 'active' || deal.status === 'scheduled').length)]],
      }
    case 'menu':
      if (!d.business.menu.length) return { text: t('Wala pa akong nakikitang item sa menu mo. Magdagdag muna ng mga produkto o serbisyo para masuri natin ang listahan at presyo.', 'I don’t see any menu items yet. Add your products or services so we can review the list and pricing.'), actions: [{ kind: 'prices', to: '/biz/stats/backgrounds#menu' }] }
      return {
        text: t(`Ito ang ilang item na nakalista ngayon: ${d.business.menu.slice(0, 4).map((item) => `${item.name} (₱${item.price})`).join(', ')}. Alin dito ang gusto mong i-update o itampok?`, `Here are some items currently listed: ${d.business.menu.slice(0, 4).map((item) => `${item.name} (₱${item.price})`).join(', ')}. Which one would you like to update or highlight?`),
        actions: [{ kind: 'prices', to: '/biz/stats/backgrounds#menu' }, { kind: 'post', to: '/biz/content/new?type=post' }],
        data: [[t('Item sa menu', 'Menu items'), String(d.business.menu.length)], [t('Presyo ng item', 'Example item price'), `₱${d.business.menu[0].price}`]],
      }
    case 'trending':
      return { text: t(`Wala pa akong live na local search-trend data para sa ${d.business.city || 'lugar mo'}, kaya ayokong manghula. Maaari mong subukan ang post o reel tungkol sa ${featuredItem} at tingnan kung paano ito tutugon ng customers.`, `I don’t have live local search-trend data for ${d.business.city || 'your area'}, so I don’t want to guess. You could try a post or reel about ${featuredItem} and see how customers respond.`), actions: [{ kind: 'post', to: '/biz/content/new?type=reel' }], data: [[t('Lokal na trend data', 'Local trend data'), t('Hindi available', 'Not available')], [t('Maaaring itampok', 'Possible topic'), featuredItem]] }
    case 'review': {
      const r = d.reviews.find((x) => !x.reply && !x.caseId && x.stars <= 3) ?? d.reviews.find((x) => !x.reply && !x.caseId)
      if (!r) return { text: t('Nasagot mo na lahat ng review. Ang galing!', "You've replied to every review. Nice work!") }
      return {
        text: r.stars <= 3
          ? t(`Heto ang neutral na draft para kay ${r.nick}: “Salamat sa pagbabahagi ng feedback. Pasensya na kung hindi naging maganda ang karanasan mo. Gusto naming mas maintindihan ito, maaari mo ba kaming kontakin nang direkta?”`, `Here’s a neutral draft for ${r.nick}: “Thank you for sharing your feedback. We’re sorry your experience wasn’t a good one. We’d like to understand more, could you contact us directly?”`)
          : t(`Heto ang draft para kay ${r.nick}: “Salamat sa pagbisita at sa pag-iwan ng review. Ikinagagalak naming nagustuhan mo ang karanasan mo. Sana makita ka ulit!”`, `Here’s a draft for ${r.nick}: “Thanks for visiting and leaving a review. We’re glad you enjoyed your experience and hope to see you again!”`),
        actions: [{ kind: 'review', to: `/biz/content/reviews/${r.id}?draft=1` }],
        data: [[t('Review', 'Review'), `${r.stars}★ · ${r.nick}`], [t('Feedback', 'Feedback'), r.text.slice(0, 100)]],
      }
    }
    case 'post':
      return { text: followUp ? t(`Halimbawa ng caption: “Tikman/subukan ang ${featuredItem} sa ${d.business.name || 'amin'}! ${d.business.city ? `Matatagpuan kami sa ${d.business.city}. ` : ''}Tingnan ang detalye at mag-message kung may tanong.” I-edit muna ang anumang detalye para tumugma sa aktuwal mong offer.`, `Caption idea: “Try ${featuredItem} at ${d.business.name || 'our business'}! ${d.business.city ? `Find us in ${d.business.city}. ` : ''}Check the details and message us with questions.” Edit the details so they match your actual offer.`) : t(`Para sa ${d.business.name || 'negosyo mo'}, subukan ang post tungkol sa ${featuredItem}. Isama ang totoong presyo o detalye, lokasyon, at malinaw na paanyaya. Maaari mong i-edit ang draft bago ito i-publish.`, `For ${d.business.name || 'your business'}, try a post about ${featuredItem}. Include accurate pricing or details, your location, and a clear call to action. You can review the draft before publishing.`), actions: [{ kind: 'post', to: '/biz/content/new?type=post' }, { kind: 'reel', to: '/biz/content/new?type=reel' }], data: [[t('Iminungkahing paksa', 'Suggested topic'), featuredItem]] }
    case 'profile':
      return { text: t('Narito ang impormasyong naka-save sa business profile mo.', 'Here’s the information saved in your business profile.'), actions: [{ kind: 'profile', to: '/biz/account/profile' }], data: [[t('Negosyo', 'Business'), d.business.name || t('Hindi pa nakapangalan', 'Name not set')], [t('Uri', 'Type'), d.business.type || t('Hindi pa nakalagay', 'Not set')], [t('Lokasyon', 'Location'), [d.business.address, d.business.city].filter(Boolean).join(', ') || t('Hindi pa nakalagay', 'Not set')], [t('Tungkol sa negosyo', 'About'), d.business.about || t('Wala pang detalye', 'No details yet')]] }
    case 'reservations':
      return { text: d.reservations.enabled ? t(`Naka-enable ang reservation requests. Kaya mong tumanggap ng hanggang ${d.reservations.maxParty} katao bawat request at may ${d.reservations.tables} mesa na naka-configure.`, `Reservation requests are enabled. You can accept up to ${d.reservations.maxParty} people per request and ${d.reservations.tables} tables are configured.`) : t('Hindi naka-enable ang reservation requests sa ngayon. Maaari mong baguhin ito sa business settings.', 'Reservation requests are currently turned off. You can change this in your business settings.'), data: [[t('Reservation', 'Reservations'), d.reservations.enabled ? t('Naka-enable', 'Enabled') : t('Naka-off', 'Off')]] }
    case 'support':
      return { text: t('Puwede kitang ikonekta sa Bitinary team. Sumasagot sila Lunes hanggang Sabado, 8 AM–6 PM.', 'I can connect you with the Bitinary team. They reply Monday to Saturday, 8 AM–6 PM.'), actions: [{ kind: 'help', to: '/biz/account/help' }] }
    default:
      return { text: t('Hindi ko pa nakuha ang tanong mo. Puwede mong ikuwento kung ano ang gusto mong gawin, o pumili ng paksa: customers, promo, menu, post, reservations, profile, o review.', 'I’m not sure I understood. Tell me what you’re trying to do, or ask about customers, promotions, your menu, posts, reservations, your profile, or reviews.'), actions: [{ kind: 'help', to: '/biz/account/help' }] }
  }
}

export function JimbotChat() {
  const { d, set, t, lang, status } = useBiz()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const enough = status !== 'draft' && getForcedState() !== 'nodata'
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 0, from: 'jimbot', text: t(`Kumusta, ${d.profile.nickname || 'Business'}! Ako si Jimbot. Ginagamit ko lang ang sarili mong stats para tumulong. Ano ang gusto mong gawin?`, `Hi ${d.profile.nickname || 'Business'}! I'm Jimbot. I only use your own stats to help. What would you like to do?`) }])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [settings, setSettings] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const lastIntent = useRef<Intent | undefined>(undefined)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
  }, [msgs, typing, reduce])
  // Show the sample suggestion on first open of the frame (once, even under StrictMode).
  const sampled = useRef(false)
  useEffect(() => {
    if (getForcedState() === 'sample' && !sampled.current && (sampled.current = true)) send(t('Paano dadami ang customers?', 'How do I get more customers?'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chips: [string, string][] = [
    ['Paano dadami ang customers?', 'How do I get more customers?'],
    ['Gumawa ng promo', 'Create a promo'],
    ['Suriin ang menu ko', 'Review my menu'],
    ['Ano ang uso malapit sa akin?', "What's trending nearby?"],
    ['Tulungan akong sumagot sa review', 'Help me reply to a review'],
    ['Tulong', 'Support'],
  ]
  const actionLabel: Record<Action['kind'], [string, string, ReactNode]> = {
    deal: ['Gumawa ng deal', 'Create deal', <Tag size={18} key="d" />],
    prices: ['I-update ang presyo', 'Update prices', <PenLine size={18} key="p" />],
    boost: ['I-boost ang post', 'Boost a post', <Rocket size={18} key="b" />],
    post: ['Sumulat ng post', 'Write a post', <Megaphone size={18} key="w" />],
    reel: ['Gumawa ng reel', 'Create a reel', <Megaphone size={18} key="v" />],
    review: ['Buksan ang review', 'Open review', <PenLine size={18} key="r" />],
    profile: ['Buksan ang profile', 'Open profile', <Settings2 size={18} key="profile" />],
    help: ['Kausapin ang team', 'Talk to the team', <Megaphone size={18} key="h" />],
  }

  function send(text: string) {
    const q = text.trim()
    if (!q) return
    const replyLang: Lang = d.prefs.jimbotMatch ? (TL_WORDS.test(q) ? 'tl' : 'en') : lang
    const previousIntent = lastIntent.current
    const directIntent = detect(q)
    const intent = detect(q, previousIntent)
    const isFollowUp = directIntent === 'unknown' && intent !== 'unknown' && !!previousIntent
    if (CONTEXTUAL_INTENTS.has(intent)) lastIntent.current = intent
    setMsgs((m) => [...m, { id: Date.now(), from: 'me', text: q }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { id: Date.now() + 1, from: 'jimbot', ...answer(intent, replyLang, d, enough, isFollowUp) }])
    }, reduce ? 200 : 900)
  }
  const lastData = [...msgs].reverse().find((m) => m.data)?.data

  return (
    <main className="flex h-[calc(100dvh-64px)] flex-col pb-24 md:pb-0">
      <PageHeader
        title="Jimbot"
        phase="P2"
        sub={t('Ang business assistant mo. Sarili mong stats lang ang ginagamit.', 'Your business assistant. Uses only your own stats.')}
        actions={
          <button onClick={() => setSettings(true)} className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-display text-[14px] font-medium shadow-card" aria-label={t('Settings ni Jimbot', 'Jimbot settings')}>
            <Settings2 size={18} /> {d.prefs.jimbotMatch ? t('Sundin ang tina-type ko', 'Match what I type') : lang === 'en' ? 'English' : 'Tagalog'}
          </button>
        }
      />
      <div className="flex min-h-0 flex-1 gap-5 px-4 md:px-8 md:pb-6">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-surface shadow-card">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5" aria-live="polite">
            {msgs.map((m) =>
              m.from === 'me' ? (
                <motion.div key={m.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                  <p className="max-w-[78%] rounded-[22px] rounded-br-md bg-deep px-4 py-2.5 text-[16px] leading-snug text-white">{m.text}</p>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
                  <Jimbot crop="head" size={36} expression={m.actions?.some((a) => a.kind === 'deal') ? 'idea' : 'waving'} animate={false} />
                  <div className="max-w-[82%] space-y-2">
                    <p className="rounded-[22px] rounded-bl-md bg-sunken px-4 py-3 text-[16px] leading-snug dark:bg-elevated">{m.text}</p>
                    {m.actions && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {m.actions.map((a) => (
                          <button key={a.kind} onClick={() => navigate(a.to)} className="flex min-h-14 items-center gap-3 rounded-[18px] border-2 border-primary/40 bg-bg px-3 text-left hover:border-primary">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-ink">{actionLabel[a.kind][2]}</span>
                            <span className="font-display text-[15px] font-semibold">{actionLabel[a.kind][lang === 'en' ? 1 : 0]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {m.data && (
                      <details className="text-[14px] text-fg-2 xl:hidden">
                        <summary className="cursor-pointer font-display font-medium text-link">{t('Data na ginamit ko', 'Data I used')}</summary>
                        <ul className="mt-1 space-y-0.5">
                          {m.data.map(([k, v]) => (
                            <li key={k}>
                              {k}: <b className="text-fg">{v}</b>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </motion.div>
              ),
            )}
            <AnimatePresence>
              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-end gap-2" role="status" aria-label={t('Nag-iisip si Jimbot', 'Jimbot is thinking')}>
                  <Jimbot crop="head" size={36} expression="thinking" animate={false} />
                  <span className="flex gap-1 rounded-[22px] rounded-bl-md bg-sunken px-4 py-3.5 dark:bg-elevated">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="h-2 w-2 rounded-full bg-muted" animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
                    ))}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={end} />
          </div>
          <div className="border-t border-line p-3">
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
              {chips.map(([tl, en]) => (
                <button key={en} onClick={() => send(lang === 'en' ? en : tl)} className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-line bg-bg px-4 font-display text-[14px] font-medium hover:border-primary">
                  {lang === 'en' ? en : tl}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-center gap-2"
            >
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('Magtanong kay Jimbot…', 'Ask Jimbot…')} aria-label={t('Mensahe', 'Message')} className="h-12 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[16px] outline-none focus:border-primary" />
              <button type="submit" disabled={!input.trim()} aria-label={t('Ipadala', 'Send')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-ink disabled:opacity-40">
                <ArrowUp size={22} />
              </button>
            </form>
          </div>
        </section>

        <aside className="hidden w-[320px] shrink-0 flex-col gap-4 xl:flex" aria-label={t('Data na ginamit ni Jimbot', 'Data Jimbot used')}>
          <div className="rounded-[24px] bg-surface p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-h3">
              <Database size={20} className="text-link" /> {t('Data na ginamit ko', 'Data I used')}
            </h2>
            {lastData ? (
              <ul className="mt-3 divide-y divide-line">
                {lastData.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3 py-2.5 text-[15px]">
                    <span className="text-fg-2">{k}</span>
                    <b className="text-right font-display">{v}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[15px] text-fg-2">{t('Lalabas dito ang stats na pinagbatayan ng bawat sagot.', 'The stats behind each answer appear here.')}</p>
            )}
            <p className="mt-3 rounded-[14px] bg-sunken p-3 text-[14px] text-fg-2 dark:bg-elevated">{t('Sarili mong stats lang ang ginagamit ko. Hindi ko nakikita ang data ng ibang negosyo.', 'I only use your own stats. I never see other businesses’ data.')}</p>
          </div>
          <div className="flex items-end gap-2 rounded-[24px] bg-primary p-4">
            <Jimbot expression="idea" variant="standalone" size={80} className="-mb-2" />
            <p className="pb-2 font-display text-[15px] font-semibold text-ink">{t('Tip: itanong kung ano ang uso malapit sa iyo tuwing Lunes.', 'Tip: ask what’s trending nearby every Monday.')}</p>
          </div>
        </aside>
      </div>

      <Sheet open={settings} onClose={() => setSettings(false)} title={t('Wika ni Jimbot', 'Jimbot language')}>
        <div className="flex items-center gap-3 rounded-[16px] bg-sunken p-4 dark:bg-elevated">
          <div className="flex-1">
            <p className="font-display text-[16px] font-semibold">{t('Sundin ang tina-type ko', 'Match what I type')}</p>
            <p className="text-[15px] text-fg-2">{t('Naiintindihan ang Taglish. Kapag naka-off, sasagot sa wika ng app.', 'Understands Taglish. When off, Jimbot replies in the app language.')}</p>
          </div>
          <Toggle label={t('Sundin ang tina-type ko', 'Match what I type')} checked={d.prefs.jimbotMatch} onChange={(v) => set((x) => ({ ...x, prefs: { ...x.prefs, jimbotMatch: v } }))} />
        </div>
      </Sheet>
    </main>
  )
}
