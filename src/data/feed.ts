import { LINKED_PLACE_ID, places, type Category, type Place } from './places'
import { promos } from './promos'
import { reels } from './reels'

export type PostKind = 'photo' | 'video' | 'ad' | 'blog'
export type FeedPost = {
  id: string
  placeId: string
  kind: PostKind
  title?: string
  text: string
  media: string[]
  reelId?: string
  at: string
  likes: number
  comments: number
  ad?: { cta: string; until: string }
}
export type FeedComment = { id: string; postId: string; nick: string; authorId?: string; text: string; at: string; reply?: string; hidden?: boolean }
export type FeedReview = { id: string; placeId: string; nick: string; authorId?: string; stars: number; text: string; photos: string[]; at: string; visited: boolean; reply?: string; fresh?: boolean }

const H = 36e5
const D = 24 * H
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

/* Short sample/demo copy per category. Seeds are deterministic so lists don't reshuffle on reload. */
const postCopy: Record<Category, string[]> = {
  Kainan: ['Bagong luto na ulam ngayong tanghali! Dumaan na habang mainit pa.', 'Salamat sa lahat ng kumain dito ngayong weekend. Kita-kits ulit!'],
  Kapihan: ['Bagong batch ng kapeng barako mula Batangas. Amoy pa lang, gising ka na.', 'Tahimik na sulok para sa trabaho o kuwentuhan. May libreng WiFi.'],
  Pasyalan: ['Ganda ng sunset kahapon! Bukas kami hanggang 6 PM.', 'Paalala: libre ang mga bata 7 pababa tuwing Linggo.'],
  'Street Food': ['Bagong ihaw ngayong gabi. Isaw, betamax at liempo, sakto sa barkada.', 'Bukas na ulit kami pagkatapos ng ulan. Ingat sa biyahe!'],
  'Budget Meals': ['₱99 meal ngayong linggo: kanin, ulam at sabaw. Busog ka na!', 'Unli-rice tuwing tanghalian, Lunes hanggang Biyernes.'],
  Resorts: ['Malinaw ang tubig ngayong linggo, perfect pang-snorkeling.', 'May bakante pa kami sa susunod na weekend. Mag-book na!'],
  Tours: ['Puno ang tour kanina, salamat po! May slot pa bukas ng 4 PM.', 'Bagong ruta: dadaan na tayo sa Plaza San Luis.'],
  Pasalubong: ['Bagong labas ang ube jam at polvoron. Pang-pasalubong na sulit.', 'Libreng tikim tuwing Sabado ng hapon!'],
}

const reviewPool: { stars: number; text: string; visited: boolean; reply?: string }[] = [
  { stars: 5, text: 'Sulit na sulit! Mabait ang staff at mabilis ang serve. Babalik kami ulit.', visited: true, reply: 'Maraming salamat po! Hihintayin namin kayo ulit.' },
  { stars: 4, text: 'Masarap at malinis. Medyo mahaba lang ang pila tuwing tanghalian.', visited: true },
  { stars: 5, text: 'Sobrang ganda ng lugar, sakto pang-picture. Highly recommended sa barkada!', visited: false },
  { stars: 3, text: 'Okay naman. Medyo mainit sa loob pero sulit ang presyo.', visited: true, reply: 'Salamat sa feedback! Nagdagdag na kami ng electric fan.' },
  { stars: 4, text: 'Great value for money. Friendly staff, will come back with family.', visited: false },
  { stars: 2, text: 'Matagal ang order, mga 30 minuto. Sana bilisan pa.', visited: true, reply: 'Pasensya na po. Nagdagdag kami ng tao tuwing peak hours.' },
]

const commentPool = [
  { nick: 'foodtrip_jessa', text: 'Grabe ang sarap tingnan!' },
  { nick: 'kuya.migs', text: 'Bukas po ba kayo sa Linggo?', reply: 'Opo, 8 AM hanggang 8 PM!' },
  { nick: 'tita_luz', text: 'Dito kami noong Sabado, ang bait ng staff.' },
  { nick: 'anna.eats', text: 'May parking po ba malapit?', reply: 'May pay parking po sa tapat.' },
  { nick: 'jp_rides', text: 'Pupunta kami next week!' },
]
const nickPool = ['Carlo M.', 'Bea R.', 'Joy T.', 'Rico V.', 'Kim S.', 'Paolo D.']

const seedFor = (p: Place, n: number) => [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) + n

function buildPosts(p: Place): FeedPost[] {
  const list: FeedPost[] = []
  const gallery = p.gallery ?? [p.image]
  const copy = postCopy[p.category]
  promos
    .filter((x) => x.placeId === p.id)
    .forEach((x, i) => list.push({ id: `${p.id}-ad${i}`, placeId: p.id, kind: 'ad', title: x.title, text: x.subtitle, media: [x.image], at: ago((1 + i) * D), likes: 40 + (seedFor(p, i) % 90), comments: 2, ad: { cta: x.cta, until: x.until } }))
  reels
    .filter((r) => r.placeId === p.id)
    .forEach((r, i) => list.push({ id: `${p.id}-v${i}`, placeId: p.id, kind: 'video', text: r.caption, media: [r.poster], reelId: r.id, at: ago((2 + i * 3) * D), likes: r.likes, comments: 3 }))
  list.push({ id: `${p.id}-ph0`, placeId: p.id, kind: 'photo', text: copy[0], media: gallery.slice(0, 3), at: ago(3 * D + 4 * H), likes: 80 + (seedFor(p, 2) % 200), comments: 3 })
  list.push({ id: `${p.id}-ph1`, placeId: p.id, kind: 'photo', text: copy[1], media: [gallery[gallery.length - 1]], at: ago(9 * D), likes: 30 + (seedFor(p, 3) % 120), comments: 2 })
  return list.sort((a, b) => b.at.localeCompare(a.at))
}

function buildComments(post: FeedPost, p: Place): FeedComment[] {
  return Array.from({ length: post.comments }, (_, i) => {
    const c = commentPool[(seedFor(p, i) + post.id.length) % commentPool.length]
    return { id: `${post.id}-c${i}`, postId: post.id, nick: c.nick, text: c.text, reply: c.reply, at: ago((i + 1) * 5 * H) }
  })
}

function buildReviews(p: Place): FeedReview[] {
  const gallery = p.gallery ?? [p.image]
  return Array.from({ length: 4 }, (_, i) => {
    const r = reviewPool[(seedFor(p, i) * 7) % reviewPool.length]
    return { id: `${p.id}-rv${i}`, placeId: p.id, nick: nickPool[(seedFor(p, i) * 3) % nickPool.length], stars: r.stars, text: r.text, visited: r.visited, reply: r.reply, photos: i === 0 ? [gallery[1 % gallery.length]] : [], at: ago((i * 4 + 1) * D) }
  })
}

const seeded = places.filter((p) => p.id !== LINKED_PLACE_ID)
export const seedFeedPosts: Record<string, FeedPost[]> = Object.fromEntries(seeded.map((p) => [p.id, buildPosts(p)]))
export const seedFeedComments: FeedComment[] = seeded.flatMap((p) => seedFeedPosts[p.id].flatMap((post) => buildComments(post, p)))
export const seedFeedReviews: Record<string, FeedReview[]> = Object.fromEntries(seeded.map((p) => [p.id, buildReviews(p)]))
