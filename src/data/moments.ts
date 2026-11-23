export type MomentFrame = 'classic' | 'cream' | 'orange' | 'brown' | 'film'
export type MomentPhoto = {
  id: string
  src: string
  authorId: string
  storagePath: string
}
export type Moment = {
  id: string
  src: string
  caption: string
  date: string
  place: string
  area: string
  map: { x: number; y: number }
  kind: 'Pagkain' | 'Pasyalan'
  mine: boolean
  trip?: string
  frame: MomentFrame
  tilt: number
  onMap: boolean
  authorId?: string | null
  collaborator?: boolean
  photos?: MomentPhoto[]
}

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&h=600&q=70`

export const sampleMoments: Moment[] = [
  { id: 'm1', src: u('photo-1736122094944-da4deea774ab'), caption: 'Unang lakad sa pader!', date: '2025-11-02', place: 'Fort Santiago', area: 'Manila', map: { x: 505, y: 385 }, kind: 'Pasyalan', mine: true, trip: '1 araw sa ₱1,500', frame: 'classic', tilt: -3, onMap: true },
  { id: 'm2', src: u('photo-1537495988501-f9cd94a78f3e'), caption: 'Kare-kare 10/10', date: '2025-11-02', place: 'Kainan ni Aling Nena', area: 'Manila', map: { x: 560, y: 522 }, kind: 'Pagkain', mine: true, trip: '1 araw sa ₱1,500', frame: 'cream', tilt: 2, onMap: true },
  { id: 'm3', src: u('photo-1653196941420-f83464498bd6'), caption: 'Kalesa feels', date: '2025-11-02', place: 'Kalesa Tours', area: 'Manila', map: { x: 545, y: 605 }, kind: 'Pasyalan', mine: true, trip: '1 araw sa ₱1,500', frame: 'classic', tilt: 3, onMap: true },
  { id: 'm4', src: u('photo-1564327367919-cb377ea6a88f'), caption: 'Barako + ulan', date: '2025-10-18', place: 'Kapihan sa Kalye Real', area: 'Manila', map: { x: 640, y: 600 }, kind: 'Pagkain', mine: false, frame: 'orange', tilt: -2, onMap: true },
  { id: 'm5', src: u('photo-1613686224427-29b757c04e0d'), caption: 'San Agustin, ang ganda', date: '2025-10-18', place: 'San Agustin', area: 'Manila', map: { x: 622, y: 682 }, kind: 'Pasyalan', mine: false, frame: 'classic', tilt: 4, onMap: true },
  { id: 'm6', src: u('photo-1688084403060-3594a4b8ff8d'), caption: 'Lechon break', date: '2025-10-05', place: 'Lechon ni Kuya Ben', area: 'Manila', map: { x: 612, y: 452 }, kind: 'Pagkain', mine: false, frame: 'brown', tilt: -4, onMap: true },
  { id: 'm7', src: u('photo-1613892214268-9754501a3542'), caption: 'Golden hour sa Calle Real', date: '2025-09-28', place: 'Calle Real', area: 'Manila', map: { x: 590, y: 560 }, kind: 'Pasyalan', mine: true, frame: 'film', tilt: 2, onMap: true },
  { id: 'm8', src: u('photo-1565004602745-718e1b0d44f8'), caption: 'Halo-halo para sa init', date: '2025-09-28', place: 'Halo-Halo ni Lola', area: 'Manila', map: { x: 470, y: 562 }, kind: 'Pagkain', mine: false, frame: 'cream', tilt: -3, onMap: true },
  { id: 'm9', src: u('photo-1552912470-ee2e96439539'), caption: 'Isaw time!', date: '2025-09-14', place: 'Mang Tonyo', area: 'Binondo', map: { x: 762, y: 302 }, kind: 'Pagkain', mine: true, trip: 'Street food crawl', frame: 'classic', tilt: 3, onMap: true },
  { id: 'm10', src: u('photo-1742578754019-d9c352bae2d0'), caption: 'Jeep papuntang Binondo', date: '2025-09-14', place: 'Ongpin', area: 'Binondo', map: { x: 820, y: 250 }, kind: 'Pasyalan', mine: false, frame: 'orange', tilt: -2, onMap: true },
  { id: 'm11', src: u('photo-1721535627752-87bcd7fd1dc6'), caption: 'Manila City Hall clock', date: '2025-08-30', place: 'City Hall', area: 'Ermita', map: { x: 820, y: 640 }, kind: 'Pasyalan', mine: false, frame: 'classic', tilt: 2, onMap: true },
  { id: 'm12', src: u('photo-1536489885071-87983c3e2859'), caption: '₱80 na tanghalian', date: '2025-08-30', place: 'Bahay Kubo', area: 'Ermita', map: { x: 700, y: 822 }, kind: 'Pagkain', mine: true, frame: 'cream', tilt: -3, onMap: true },
]

/** Default areas used by the legacy illustrated map preview. */
export const mapAreas = [
  { name: 'Manila', x: 580, y: 540, total: 24 },
  { name: 'Binondo', x: 800, y: 270, total: 9 },
  { name: 'Ermita', x: 760, y: 760, total: 11 },
]
