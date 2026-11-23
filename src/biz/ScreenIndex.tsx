import { Monitor, Smartphone, Sparkles, Tablet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PhaseTag, setNotes, useNotes } from '@/components/ui/PhaseTag'
import { Segmented } from '@/components/ui/Segmented'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'

type Phase = 'MVP' | 'P2' | 'P3'
type Device = 'mobile' | 'tablet' | 'desktop'
type Entry = { name: string; path: string; phase: Phase; devices?: Device[] }
const ALL: Device[] = ['desktop', 'tablet', 'mobile']
const DM: Device[] = ['desktop', 'mobile']

const groups: { title: string; items: Entry[] }[] = [
  {
    title: 'Sign-up and go live',
    items: [
      { name: 'Language picker', path: '/biz/language', phase: 'MVP', devices: DM },
      { name: 'Welcome (Hello fox)', path: '/biz/welcome', phase: 'MVP', devices: DM },
      { name: 'Method (Google, +63, email)', path: '/biz/auth?mode=signup', phase: 'MVP', devices: DM },
      { name: 'Verify code', path: '/biz/auth/verify?via=mobile&to=9171234500', phase: 'MVP', devices: DM },
      { name: 'Verify · wrong code', path: '/biz/auth/verify?via=mobile&to=9171234500&state=wrong', phase: 'MVP', devices: DM },
      { name: 'Verify · too many attempts', path: '/biz/auth/verify?via=mobile&to=9171234500&state=locked', phase: 'MVP', devices: DM },
      { name: 'Name and nickname', path: '/biz/signup/name', phase: 'MVP', devices: DM },
      { name: 'Account ready', path: '/biz/signup/ready', phase: 'MVP', devices: DM },
      { name: 'Business hub (new)', path: '/biz/setup?state=fresh', phase: 'MVP', devices: ALL },
      { name: 'Business hub · ready to go live', path: '/biz/setup?state=setup-ready', phase: 'MVP', devices: ALL },
      { name: 'Required · Basics', path: '/biz/setup/basics?state=fresh', phase: 'MVP', devices: DM },
      { name: 'Required · Location', path: '/biz/setup/location?state=fresh', phase: 'MVP', devices: DM },
      { name: 'Required · Opening hours', path: '/biz/setup/hours?state=fresh', phase: 'MVP', devices: DM },
      { name: 'Required · Contact', path: '/biz/setup/contact?state=fresh', phase: 'MVP', devices: DM },
      { name: 'Required field error', path: '/biz/setup/basics?state=error', phase: 'MVP', devices: DM },
      { name: 'Summary checklist', path: '/biz/setup/summary?state=setup-ready', phase: 'MVP', devices: DM },
      { name: 'Go live (Celebrate)', path: '/biz/live', phase: 'MVP', devices: DM },
    ],
  },
  {
    title: 'Statistics',
    items: [
      { name: 'Overview · pending verification', path: '/biz/stats', phase: 'MVP', devices: ALL },
      { name: 'Overview · not yet verified', path: '/biz/stats?state=unverified', phase: 'MVP', devices: ALL },
      { name: 'Overview · more documents needed', path: '/biz/stats?state=needs-docs', phase: 'MVP', devices: DM },
      { name: 'Overview · verified', path: '/biz/stats?state=verified', phase: 'MVP', devices: DM },
      { name: 'Overview · draft', path: '/biz/stats?state=draft', phase: 'MVP', devices: DM },
      { name: 'Analytics', path: '/biz/stats/analytics?state=verified', phase: 'P2', devices: ALL },
      { name: 'Analytics · loading', path: '/biz/stats/analytics?state=loading', phase: 'P2', devices: DM },
      { name: 'Analytics · error', path: '/biz/stats/analytics?state=error', phase: 'P2', devices: DM },
      { name: 'Analytics · not enough data', path: '/biz/stats/analytics?state=nodata', phase: 'P2', devices: DM },
      { name: 'Backgrounds', path: '/biz/stats/backgrounds', phase: 'MVP', devices: DM },
      { name: 'Backgrounds · verification', path: '/biz/stats/backgrounds?state=needs-docs#verify', phase: 'MVP', devices: DM },
    ],
  },
  {
    title: 'Content',
    items: [
      { name: 'Posts · list', path: '/biz/content', phase: 'P3', devices: DM },
      { name: 'Posts · calendar', path: '/biz/content?v=calendar', phase: 'P3', devices: DM },
      { name: 'Posts · empty', path: '/biz/content?state=empty', phase: 'P3', devices: DM },
      { name: 'Composer · post', path: '/biz/content/new?type=post', phase: 'P3', devices: DM },
      { name: 'Composer · reel', path: '/biz/content/new?type=reel', phase: 'P3', devices: DM },
      { name: 'Composer · reel camera permission', path: '/biz/content/new?type=reel&state=permission', phase: 'P3', devices: DM },
      { name: 'Composer · blog', path: '/biz/content/new?type=blog', phase: 'P3', devices: DM },
      { name: 'Comments', path: '/biz/content/comments', phase: 'P3', devices: DM },
      { name: 'Reviews · list', path: '/biz/content/reviews', phase: 'P3', devices: ALL },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'Account', path: '/biz/account', phase: 'MVP', devices: DM },
      { name: 'Profile', path: '/biz/account/profile', phase: 'MVP', devices: DM },
      { name: 'Preferences', path: '/biz/account/preferences', phase: 'MVP', devices: DM },
      { name: 'Help and support', path: '/biz/account/help', phase: 'MVP', devices: DM },
    ],
  },
]

const dims = { mobile: { w: 390, h: 844, frame: 270 }, tablet: { w: 768, h: 1024, frame: 400 }, desktop: { w: 1280, h: 800, frame: 640 } }

function Frame({ p, theme, device, lang }: { p: string; theme: 'light' | 'dark'; device: Device; lang: 'en' | 'tl' }) {
  const d = dims[device]
  const scale = d.frame / d.w
  const [base, hash] = p.split('#')
  const src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${base}${base.includes('?') ? '&' : '?'}embed=1&theme=${theme}&lang=${lang}${hash ? `#${hash}` : ''}`
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-black shadow-card" style={{ width: d.frame, height: d.h * scale }}>
      <iframe title={`${p} ${theme} ${lang}`} src={src} loading="lazy" tabIndex={-1} style={{ pointerEvents: 'none', width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }} />
    </div>
  )
}

export function BizScreenIndex() {
  const notes = useNotes()
  const [g, setG] = useState(0)
  const [device, setDevice] = useState<Device>('desktop')
  const [lang, setLang] = useState<'en' | 'tl'>('en')
  return (
    <main className="min-h-dvh bg-bg px-4 py-6 text-fg md:px-8">
      <header className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Jimbot crop="head" shape="squircle" size={52} />
            <div>
              <h1 className="text-title">Bitinary Business · Screen Index</h1>
              <p className="text-body text-fg-2">Business-only app. Light and Dark, English and Tagalog, 1280 / 768 / 390.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full bg-surface pl-4 pr-1 shadow-card">
              <span className="font-display text-[14px] font-medium">Design notes</span>
              <Toggle label="Design notes" checked={notes} onChange={setNotes} />
            </label>
            <Link to="/screens/mascot">
              <Button variant="secondary" icon={<Sparkles size={17} />}>
                Jimbot icon set
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {groups.map((x, i) => (
              <Chip key={x.title} active={i === g} onClick={() => setG(i)}>
                {x.title}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'tl', label: 'Tagalog' }]} />
            <div className="flex gap-1 rounded-full bg-sunken p-1 dark:bg-elevated">
              {([['desktop', Monitor, '1280'], ['tablet', Tablet, '768'], ['mobile', Smartphone, '390']] as const).map(([dv, I, l]) => (
                <button key={dv} onClick={() => setDevice(dv)} aria-pressed={device === dv} className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-medium', device === dv ? 'bg-primary text-ink' : 'text-fg-2')}>
                  <I size={16} /> {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <section className="mx-auto mt-6 max-w-[1400px] space-y-10">
        {groups[g].items.map((e) => {
          const dv = e.devices?.includes(device) ? device : (e.devices?.[e.devices.length - 1] ?? device)
          return (
            <article key={e.path}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-h3">{e.name}</h2>
                <PhaseTag phase={e.phase} force />
                <span className="text-caption text-fg-2">{(e.devices ?? ALL).join(' · ')}</span>
                {dv !== device && <span className="text-caption text-caution">showing {dv}</span>}
              </div>
              <div className="no-scrollbar flex gap-5 overflow-x-auto pb-2">
                {(['light', 'dark'] as const).map((th) => (
                  <div key={th} className="shrink-0">
                    <p className="mb-1.5 font-display text-[12px] font-semibold uppercase tracking-wide text-fg-2">{th}</p>
                    <Frame p={e.path} theme={th} device={dv} lang={lang} />
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
