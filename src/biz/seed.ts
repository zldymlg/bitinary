import { emptyBusiness, type BusinessProfile } from '@/app/account'
import { img } from '@/lib/format'

/* All names are fictional. Dates are relative to "now" so the demo always looks current. */
const H = 36e5
const D = 864e5
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
export const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()

export const photos = {
  kareKare: img('photo-1537495988501-f9cd94a78f3e', 600),
  adobo: img('photo-1536489885071-87983c3e2859', 600),
  lechon: img('photo-1688084403060-3594a4b8ff8d', 600),
  halo: img('photo-1578366687181-5f90a617ca7a', 600),
  kape: img('photo-1564327367919-cb377ea6a88f', 600),
  silog: img('photo-1613686224427-29b757c04e0d', 600),
  street: img('photo-1552912470-ee2e96439539', 600),
  interior: img('photo-1565004602745-718e1b0d44f8', 600),
}

export type PostType = 'post' | 'reel' | 'blog'
export type Post = {
  id: string
  type: PostType
  title?: string
  text: string
  media: string[]
  video?: string
  status: 'published' | 'scheduled' | 'draft'
  at: string
  views: number
  likes: number
  saves: number
  comments: number
  dealId?: string
  fb?: boolean
}
export type Comment = { id: string; postId: string; nick: string; authorId?: string; text: string; at: string; liked?: boolean; hidden?: boolean; reported?: string; reply?: string; blocked?: boolean; fresh?: boolean }
export type Review = { id: string; nick: string; authorId?: string; stars: number; text: string; photos: string[]; at: string; checkin: { at: string; via: 'QR' | 'code' } | null; reply?: string; caseId?: string; fresh?: boolean; hidden?: boolean }
export type CaseStatus = 'received' | 'review' | 'info' | 'removed' | 'kept' | 'appealed'
export type Case = {
  id: string
  reviewId: string
  reason: string
  explanation: string
  evidence: string[]
  status: CaseStatus
  createdAt: string
  decidedAt?: string
  timeline: { at: string; status: CaseStatus; en: string; tl: string }[]
  messages: { from: 'team' | 'me'; text: string; at: string }[]
}
export type DealKind = 'b1t1' | 'discount' | 'addon'
export type Deal = {
  id: string
  kind: DealKind
  item: string
  percent?: number
  minSpend?: number
  addon?: string
  start: string
  end: string
  from: string
  to: string
  limitPerDay: number
  limitTotal: number
  redemption: 'qr' | 'code'
  code: string
  status: 'active' | 'scheduled' | 'ended' | 'draft'
  redeemed: { qr: number; code: number }
  views: number
}
export type Boost = { id: string; postId: string; budget: number; days: number; target: 'nearby2' | 'nearby5' | 'searching'; status: 'active' | 'ended'; start: string; results: { reach: number; clicks: number; saves: number } }
export type Staff = { id: string; name: string; email: string; role: 'owner' | 'manager' | 'staff'; status: 'active' | 'invited'; branch: string }
export type Branch = { id: string; name: string; area: string }
export type ResRequest = { id: string; nick: string; party: number; at: string; status: 'new' | 'accepted' | 'declined'; note?: string }
export type Notif = { id: string; en: string; tl: string; at: string; to: string; kind: 'review' | 'comment' | 'report' | 'report-week' | 'deal'; read?: boolean }

export const demoBusiness: BusinessProfile = {
  ...emptyBusiness,
  name: 'Business',
  type: 'kainan',
  price: '₱₱',
  address: '1247 M.H. del Pilar St., Ermita',
  city: 'Maynila',
  pin: { lng: 120.9842, lat: 14.5995 },
  contactName: 'Business',
  mobile: '9171234500',
  landline: '(02) 8521 4410',
  menu: [
    { id: 'm1', name: 'Kare-kare', price: '320', category: 'Ulam' },
    { id: 'm2', name: 'Adobong manok', price: '180', category: 'Ulam' },
    { id: 'm3', name: 'Lechon kawali', price: '240', category: 'Ulam' },
    { id: 'm4', name: 'Tapsilog', price: '150', category: 'Ulam' },
    { id: 'm5', name: 'Halo-halo', price: '120', category: 'Panghimagas' },
    { id: 'm6', name: 'Kapeng barako', price: '70', category: 'Inumin' },
  ],
  cover: photos.interior,
  photos: [photos.kareKare, photos.adobo, photos.halo],
  about: 'Lutong-bahay since 1998. Kare-kare na may sariling bagoong, at halo-halo na paborito ng Ermita.',
  specialties: ['Kare-kare', 'Halo-halo'],
  languages: ['Tagalog', 'English'],
  links: { facebook: 'facebook.com/business', instagram: '@business', tiktok: '', website: '' },
  goals: ['customers', 'deals'],
  verification: { method: 'upload', files: ['DTI-registration.pdf'], status: 'pending' },
  status: { basics: 'done', location: 'done', hours: 'done', contact: 'done', menu: 'done', photos: 'done', about: 'done', online: 'done', goals: 'done' },
  live: true,
  liveAt: ago(18 * D),
}

export const seedPosts: Post[] = [
  { id: 'p1', type: 'reel', text: 'Paano namin niluluto ang kare-kare tuwing umaga', media: [photos.kareKare], status: 'published', at: ago(2 * D), views: 2140, likes: 318, saves: 96, comments: 4 },
  { id: 'p2', type: 'post', text: 'Bagong halo-halo season! Ube, leche flan at pinipig, ₱120 lang.', media: [photos.halo], status: 'published', at: ago(5 * D), views: 1210, likes: 141, saves: 52, comments: 3, fb: true },
  { id: 'p3', type: 'blog', title: '25 taon ng lutong-bahay sa Ermita', text: 'Nagsimula kami bilang maliit na karinderya sa tapat ng simbahan…', media: [photos.interior], status: 'published', at: ago(12 * D), views: 640, likes: 77, saves: 31, comments: 1 },
  { id: 'p4', type: 'post', text: 'Friday Buy 1 Take 1 sa Tapsilog, 5 PM hanggang 8 PM!', media: [photos.silog], status: 'scheduled', at: ahead(2 * D), views: 0, likes: 0, saves: 0, comments: 0, dealId: 'd1' },
  { id: 'p5', type: 'post', text: 'Lechon kawali na sobrang lutong…', media: [photos.lechon], status: 'draft', at: ago(1 * D), views: 0, likes: 0, saves: 0, comments: 0 },
]

export const seedComments: Comment[] = [
  { id: 'c1', postId: 'p1', nick: 'foodtrip_jessa', text: 'Grabe ang sarap tingnan! Bukas ba kayo sa Linggo?', at: ago(3 * H), fresh: true },
  { id: 'c2', postId: 'p1', nick: 'kuya.migs', text: 'Magkano po ang kare-kare good for 2?', at: ago(5 * H), fresh: true },
  { id: 'c3', postId: 'p1', nick: 'promo_bot_88', text: 'CLICK HERE FOR FREE LOAD!!! bit.ly/xxxx', at: ago(6 * H), reported: 'spam', hidden: true },
  { id: 'c4', postId: 'p1', nick: 'tita_luz', text: 'Dito kami kumain noong Sabado, ang bait ng staff', at: ago(1 * D), liked: true, reply: 'Salamat po, Tita Luz! Balik po kayo!' },
  { id: 'c5', postId: 'p2', nick: 'anna.eats', text: 'May vegan option po ba ang halo-halo?', at: ago(8 * H), fresh: true },
  { id: 'c6', postId: 'p2', nick: 'jp_rides', text: 'Sana may parking', at: ago(2 * D) },
  { id: 'c7', postId: 'p2', nick: 'marites.ph', text: 'Mas masarap pa rin sa kabila haha', at: ago(3 * D) },
  { id: 'c8', postId: 'p3', nick: 'ermita.local', text: 'Naaalala ko pa noong maliit pa kayo. Congrats!', at: ago(10 * D), reply: 'Maraming salamat po!' },
]

export const seedReviews: Review[] = [
  { id: 'r1', nick: 'Carlo M.', stars: 5, text: 'Best kare-kare sa Ermita! Malapot ang sauce at sakto ang bagoong. Mabilis din ang serve.', photos: [photos.kareKare], at: ago(10 * H), checkin: { at: ago(12 * H), via: 'QR' }, fresh: true },
  { id: 'r2', nick: 'Bea R.', stars: 2, text: 'Matagal ang order, mga 40 minutes. Masarap naman pero sana bilisan.', photos: [], at: ago(1 * D), checkin: { at: ago(1 * D + 2 * H), via: 'code' }, fresh: true },
  { id: 'r3', nick: 'Anonymous99', stars: 1, text: 'Madumi at may ipis. Huwag kayong kumain dito. Mas maganda sa kabilang kainan.', photos: [], at: ago(2 * D), checkin: null, caseId: 'BTN-2026-0142' },
  { id: 'r4', nick: 'Joy T.', stars: 4, text: 'Sulit ang presyo! Halo-halo is a must. Medyo mainit lang sa loob.', photos: [photos.halo, photos.interior], at: ago(4 * D), checkin: { at: ago(4 * D + H), via: 'QR' }, reply: 'Salamat, Joy! Nagpalagay na kami ng dagdag na electric fan' },
  { id: 'r5', nick: 'Rico V.', stars: 5, text: 'Lutong-bahay talaga. Parang luto ni Lola.', photos: [], at: ago(6 * D), checkin: { at: ago(6 * D + H), via: 'QR' }, reply: 'Maraming salamat, Rico!' },
  { id: 'r6', nick: 'TravelerKim', stars: 3, text: 'Okay lang. Good food, but the place was crowded at lunch.', photos: [], at: ago(9 * D), checkin: { at: ago(9 * D + H), via: 'code' } },
  { id: 'r7', nick: 'Mark L.', stars: 1, text: 'Wrong order and rude staff. Never again.', photos: [], at: ago(20 * D), checkin: null, caseId: 'BTN-2026-0098' },
]

export const seedCases: Case[] = [
  {
    id: 'BTN-2026-0142',
    reviewId: 'r3',
    reason: 'competitor',
    explanation: 'Walang check-in sa amin ang account na ito at nagre-recommend ng ibang kainan. Malinis ang aming kusina at may sanitary permit kami.',
    evidence: ['sanitary-permit-2026.jpg'],
    status: 'review',
    createdAt: ago(1 * D),
    timeline: [
      { at: ago(1 * D), status: 'received', en: 'Report received', tl: 'Natanggap ang report' },
      { at: ago(20 * H), status: 'review', en: 'A moderator is reviewing your case', tl: 'Sinusuri na ng moderator ang kaso mo' },
    ],
    messages: [{ from: 'team', text: 'Salamat sa report. Titingnan namin ang check-in records at ang account. Karaniwang 2–3 araw ito.', at: ago(20 * H) }],
  },
  {
    id: 'BTN-2026-0098',
    reviewId: 'r7',
    reason: 'novisit',
    explanation: 'There is no check-in or receipt for this date and we do not serve the dish mentioned.',
    evidence: [],
    status: 'kept',
    createdAt: ago(18 * D),
    decidedAt: ago(3 * D),
    timeline: [
      { at: ago(18 * D), status: 'received', en: 'Report received', tl: 'Natanggap ang report' },
      { at: ago(17 * D), status: 'review', en: 'A moderator is reviewing your case', tl: 'Sinusuri na ng moderator ang kaso mo' },
      { at: ago(3 * D), status: 'kept', en: 'Kept: the review describes a personal experience and follows the guidelines', tl: 'Pinanatili: personal na karanasan ang review at sumusunod sa guidelines' },
    ],
    messages: [
      { from: 'team', text: 'We kept this review. It describes a personal experience, and negative reviews are not removed just because they are negative. You can reply publicly or appeal within 7 days.', at: ago(3 * D) },
    ],
  },
]

export const seedDeals: Deal[] = [
  { id: 'd1', kind: 'b1t1', item: 'Tapsilog', start: ahead(2 * D).slice(0, 10), end: ahead(30 * D).slice(0, 10), from: '17:00', to: '20:00', limitPerDay: 30, limitTotal: 300, redemption: 'qr', code: 'BIZ-B1T1', status: 'scheduled', redeemed: { qr: 0, code: 0 }, views: 0 },
  { id: 'd0', kind: 'discount', item: 'Kare-kare', percent: 10, minSpend: 500, start: ago(30 * D).slice(0, 10), end: ago(2 * D).slice(0, 10), from: '10:00', to: '21:00', limitPerDay: 20, limitTotal: 200, redemption: 'code', code: 'KARE10', status: 'ended', redeemed: { qr: 38, code: 46 }, views: 1820 },
]

export const seedBoosts: Boost[] = [{ id: 'b1', postId: 'p1', budget: 500, days: 3, target: 'nearby2', status: 'ended', start: ago(9 * D), results: { reach: 6420, clicks: 412, saves: 88 } }]

export const seedBranches: Branch[] = [
  { id: 'br1', name: 'Ermita (main)', area: 'Maynila' },
  { id: 'br2', name: 'Maginhawa', area: 'Quezon City' },
]
export const seedStaff: Staff[] = [
  { id: 's1', name: 'Business', email: 'business@example.com', role: 'owner', status: 'active', branch: 'br1' },
  { id: 's2', name: 'Liza Ramos', email: 'liza.r@gmail.com', role: 'manager', status: 'active', branch: 'br1' },
  { id: 's3', name: 'Jun Santos', email: 'jun.santos@gmail.com', role: 'staff', status: 'active', branch: 'br2' },
  { id: 's4', name: 'Mae Cruz', email: 'mae.cruz@yahoo.com', role: 'staff', status: 'invited', branch: 'br2' },
]
export const seedRequests: ResRequest[] = [
  { id: 'q1', nick: 'Grace P.', party: 6, at: ahead(1 * D + 3 * H), status: 'new', note: 'Birthday ni Lola' },
  { id: 'q2', nick: 'Dennis A.', party: 2, at: ahead(5 * H), status: 'new' },
  { id: 'q3', nick: 'Officemates', party: 12, at: ahead(3 * D), status: 'accepted' },
]
export const seedNotifs: Notif[] = [
  { id: 'n1', kind: 'review', en: 'Carlo M. left a 5-star review', tl: 'Nag-iwan si Carlo M. ng 5-star na review', at: ago(10 * H), to: '/biz/content/reviews/r1' },
  { id: 'n2', kind: 'comment', en: '3 new comments on your reel', tl: '3 bagong komento sa reel mo', at: ago(3 * H), to: '/biz/content/comments' },
  { id: 'n3', kind: 'report', en: 'Case BTN-2026-0142 is under review', tl: 'Sinusuri na ang kasong BTN-2026-0142', at: ago(20 * H), to: '/biz/content/reviews/cases/BTN-2026-0142' },
  { id: 'n4', kind: 'report-week', en: 'Your weekly Jimbot report is ready', tl: 'Handa na ang lingguhang report ni Jimbot', at: ago(2 * D), to: '/biz/stats', read: true },
]

/* ------------------------------ Stats ------------------------------ */

/** Deterministic pseudo-random so charts look the same on every load. */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}
function series(n: number, base: number, amp: number, seed: number, trend = 0) {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => {
    const day = (new Date(Date.now() - (n - 1 - i) * D).getDay() + 6) % 7
    const weekend = day >= 4 ? 1.35 : 1
    return Math.max(0, Math.round((base + trend * i + (r() - 0.5) * amp) * weekend))
  })
}
export const stats = {
  views: series(60, 150, 70, 7, 0.9),
  saves: series(60, 22, 14, 11, 0.15),
  trips: series(60, 16, 8, 13, 0.08),
  checkins: series(60, 9, 6, 17, 0.05),
  rating: [4.1, 4.2, 4.2, 4.3, 4.2, 4.3, 4.4, 4.3],
  /** all-time review summary (the inbox shows only recent reviews) */
  ratingAll: 4.3,
  reviewCount: 128,
  comments: series(60, 3, 4, 19),
  dealCustomers: series(60, 5, 6, 23),
  /** 7 days (Mon..Sun) x 24 hours */
  heat: Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const meal = Math.exp(-((h - 12) ** 2) / 4) * 0.9 + Math.exp(-((h - 19) ** 2) / 3) * (d >= 4 ? 1.25 : 0.85) + Math.exp(-((h - 8) ** 2) / 3) * 0.35
      return h < 6 || h > 22 ? 0 : Math.min(1, meal)
    }),
  ),
  sources: { search: 46, jimbot: 27, posts: 17, reels: 10 },
  topSearches: [
    { q: 'kare-kare near me', n: 312, d: 18, me: true },
    { q: 'halo-halo Ermita', n: 204, d: 31, me: true },
    { q: 'budget lunch Manila', n: 188, d: 6, me: false },
    { q: 'silog 24 hours', n: 141, d: -4, me: false },
    { q: 'lechon kawali', n: 97, d: 12, me: true },
  ],
  topics: [
    { k: 'taste', pos: 86, n: 54 },
    { k: 'price', pos: 72, n: 31 },
    { k: 'service', pos: 58, n: 27 },
    { k: 'cleanliness', pos: 64, n: 12 },
  ],
}

export type Program = { id: string; en: string; tl: string; org: string; when: string; area: string; kind: 'training' | 'grant' | 'event' | 'festival'; bodyEn: string; bodyTl: string }
export const programs: Program[] = [
  { id: 'pr1', en: 'Kain Na! Manila Food Fest 2026', tl: 'Kain Na! Manila Food Fest 2026', org: 'Manila City Tourism Office', when: ahead(24 * D), area: 'Maynila', kind: 'festival', bodyEn: 'Join 120 local food stalls in Intramuros. Booth fee waived for verified small businesses.', bodyTl: 'Sumali sa 120 lokal na food stall sa Intramuros. Libre ang booth fee para sa verified na maliliit na negosyo.' },
  { id: 'pr2', en: 'DOT Tourism-Ready MSME Training', tl: 'DOT Tourism-Ready MSME Training', org: 'Department of Tourism NCR', when: ahead(10 * D), area: 'NCR', kind: 'training', bodyEn: 'Free 2-day course on customer service, food safety and digital marketing.', bodyTl: 'Libreng 2-araw na kurso sa customer service, food safety at digital marketing.' },
  { id: 'pr3', en: 'Negosyo Center Starter Grant', tl: 'Negosyo Center Starter Grant', org: 'DTI Negosyo Center', when: ahead(40 * D), area: 'Nationwide', kind: 'grant', bodyEn: 'Up to ₱15,000 for equipment for registered micro businesses.', bodyTl: 'Hanggang ₱15,000 para sa kagamitan ng rehistradong micro na negosyo.' },
  { id: 'pr4', en: 'Ermita Heritage Night Market', tl: 'Ermita Heritage Night Market', org: 'Barangay 669, Ermita', when: ahead(5 * D), area: 'Maynila', kind: 'event', bodyEn: 'Every Friday 5 PM to 11 PM along Mabini St.', bodyTl: 'Tuwing Biyernes, 5 PM hanggang 11 PM sa Mabini St.' },
]

export type Directory = { id: string; name: string; type: string; area: string; price: string; verified: boolean; since: string }
export const directory: Directory[] = [
  { id: 'x1', name: 'Kapihan sa Kalye Real', type: 'kapihan', area: 'Intramuros', price: '₱', verified: true, since: '2024' },
  { id: 'x2', name: 'Lugawan ni Aling Rosing', type: 'kainan', area: 'Malate', price: '₱', verified: true, since: '2023' },
  { id: 'x3', name: 'Paco Pasalubong Center', type: 'pasalubong', area: 'Paco', price: '₱₱', verified: false, since: '2025' },
  { id: 'x4', name: 'Kalesa Heritage Tours', type: 'tour', area: 'Intramuros', price: '₱₱', verified: true, since: '2022' },
  { id: 'x5', name: 'Bahay Kubo Resort Batangas', type: 'resort', area: 'Batangas', price: '₱₱₱', verified: false, since: '2025' },
  { id: 'x6', name: 'Sisig Republic Ermita', type: 'kainan', area: 'Ermita', price: '₱₱', verified: true, since: '2021' },
]

export type Help = { id: string; en: string; tl: string; bodyEn: string; bodyTl: string; topic: 'verify' | 'reviews' | 'deals' | 'qr' | 'account' }
export const helps: Help[] = [
  { id: 'h1', topic: 'verify', en: 'How verification works', tl: 'Paano gumagana ang verification', bodyEn: 'Upload your DTI or SEC registration and mayor’s permit, or schedule a free on-site check. Most reviews finish in 1–2 business days.', bodyTl: 'I-upload ang DTI o SEC registration at mayor’s permit, o mag-iskedyul ng libreng on-site check. Karaniwang 1–2 araw ng trabaho ito.' },
  { id: 'h2', topic: 'reviews', en: 'When are reviews removed?', tl: 'Kailan tinatanggal ang review?', bodyEn: 'Reviews are removed only if they break the guidelines: wrong business, no visit on record with false claims, personal information, or fake accounts. Negative reviews are not removed just because they are negative.', bodyTl: 'Tinatanggal lang ang review kung lumalabag sa guidelines: maling negosyo, walang record ng pagbisita at may maling sinasabi, personal na impormasyon, o pekeng account. Hindi tinatanggal ang negatibong review dahil lang negatibo ito.' },
  { id: 'h3', topic: 'deals', en: 'Creating your first deal', tl: 'Paggawa ng unang deal', bodyEn: 'Pick a template, set the dates and limits, and choose QR or code redemption. Deals unlock after verification.', bodyTl: 'Pumili ng template, itakda ang petsa at limit, at piliin kung QR o code. Bubukas ang deals pagka-verify.' },
  { id: 'h4', topic: 'qr', en: 'Printing your QR check-in kit', tl: 'Pag-print ng QR check-in kit', bodyEn: 'Print the table tent on A5 card stock and the sticker at 8 cm. Regenerate the QR if a copy is misused.', bodyTl: 'I-print ang table tent sa A5 na card stock at ang sticker sa 8 cm. Mag-regenerate ng QR kung may nag-abuso ng kopya.' },
  { id: 'h5', topic: 'account', en: 'Adding staff and roles', tl: 'Pagdagdag ng staff at roles', bodyEn: 'Owners manage billing and permits. Managers edit info, posts and replies. Staff can use Quick Update only.', bodyTl: 'Ang owner ang humahawak ng billing at permit. Ang manager ay nag-e-edit ng info, posts at sagot. Ang staff ay Quick Update lang.' },
]
