import {
  ArrowRight, BadgeCheck, CalendarCheck, ChartColumn, ChevronRight, Eye, Heart, Headphones, LifeBuoy, Lock, MessageCircle, Phone, Plus, Rocket, ScanLine, Sparkles, Tag, TriangleAlert,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Facebook } from '@/components/icons/Brand'
import { DAYS, useAccount, type BizThemeId } from '@/app/account'
import { useLang } from '@/app/i18n'
import { useStore } from '@/app/store'
import { Jimbot } from '@/components/mascot/Jimbot'
import { GoLivePreviewCard, todayHours } from '@/components/onboarding/BizWidgets'
import { HubLayout } from '@/components/onboarding/HubLayout'
import { BigBack, CompletenessRing, JimbotSays, OptTag, ReqTag, StatusChip, ThemeCard } from '@/components/onboarding/Kit'
import { SuccessScreen } from '@/components/onboarding/Templates'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { REQUIRED_BIZ, bizThemes, getBizThemesForType, getOfferingConfig, menuCategories } from '@/data/themes'
import { cn } from '@/lib/cn'
import { useBreakpoint } from '@/lib/useMedia'
import { BizThemeForm } from './BizThemes'
import { bizStatus, healthScore, optionalIds, requiredDone, useBizView } from './sample'

/* ------------------------------ Assisted setup sheet ------------------------------ */

function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang()
  const { showToast } = useStore()
  const rows: [ReactNode, string, string][] = [
    [<Phone size={20} />, t('Tawagan kami', 'Call us'), t('Lun–Sab, 8AM–6PM · (02) 8888 2468', 'Mon–Sat, 8AM–6PM · (02) 8888 2468')],
    [<MessageCircle size={20} />, t('Mag-chat sa team', 'Chat with the team'), t('Sasagot sa loob ng 1 oras', 'Replies within 1 hour')],
    [<CalendarCheck size={20} />, t('Mag-iskedyul ng tulong', 'Schedule a setup call'), t('Ise-setup namin kasama ka', "We'll set it up together")],
  ]
  return (
    <Sheet open={open} onClose={onClose} title={t('Tulungan kami ng Bitinary team', 'Get help from the Bitinary team')}>
      <p className="mb-4 text-body text-fg-2">{t('Libre ang assisted setup para sa maliliit na negosyo.', 'Assisted setup is free for small businesses.')}</p>
      <ul className="space-y-2">
        {rows.map(([icon, title, sub]) => (
          <li key={title}>
            <button onClick={() => (onClose(), showToast({ text: t('Salamat! Makikipag-ugnayan ang team sa iyo.', "Thanks! The team will reach out to you."), expression: 'celebrating' }))} className="flex w-full items-center gap-3 rounded-[18px] bg-sunken p-3 text-left dark:bg-elevated">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-ink">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold">{title}</span>
                <span className="text-[13px] text-fg-2">{sub}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

/* ------------------------------ Business hub ------------------------------ */

export function BusinessHub() {
  const { id } = useParams<{ id?: BizThemeId }>()
  const { business } = useAccount()
  const b = useBizView(business)
  const { lang, t } = useLang()
  const navigate = useNavigate()
  const desktop = useBreakpoint() === 'desktop'
  const [help, setHelp] = useState(false)
  const req = requiredDone(b)
  const ready = req === REQUIRED_BIZ.length
  const dynamicThemes = useMemo(() => getBizThemesForType(b.type), [b.type])
  const open = (tid: BizThemeId) => navigate(`/business/setup/${tid}`)
  const onDone = () => navigate('/business/setup', { replace: true })

  if (id && !desktop) return <BizThemeForm key={id} id={id} onDone={onDone} onBack={() => navigate('/business/setup')} />

  const nextReq = REQUIRED_BIZ.find((r) => b.status[r] !== 'done')
  const list = (
    <>
      <section className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <StatusChip status={bizStatus(b)} />
          <h1 className="mt-2 text-title">{b.name || t('I-setup ang negosyo mo', 'Set up your business')}</h1>
          <p className="mt-1 text-body text-fg-2">{ready ? t('Handa ka nang mag-live! Opsyonal ang iba.', 'You can go live now! The rest is optional.') : t(`${REQUIRED_BIZ.length - req} na lang bago ka makapag-live.`, `${REQUIRED_BIZ.length - req} more before you can go live.`)}</p>
        </div>
        <CompletenessRing value={healthScore(b) / 100} size={92} caption={t('kumpleto', 'complete')} />
      </section>

      <AnimatePresence initial={false}>
        {ready && !b.live && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 overflow-hidden rounded-[24px] bg-primary p-4">
            <div className="flex items-center gap-3">
              <Jimbot expression="celebrating" variant="standalone" size={76} className="-my-2 shrink-0" />
              <div>
                <p className="font-display text-[19px] font-bold leading-tight text-white">{t('Simulan na ang negosyo!', 'Start running the business!')}</p>
                <p className="text-[14px] font-semibold text-ink">{t('Tingnan muna ang preview bago mag-live.', 'Check the preview before going live.')}</p>
              </div>
            </div>
            <Button block size="lg" variant="brown" className="mt-3" icon={<Rocket size={19} />} onClick={() => navigate('/business/preview')}>
              {t('Simulan na!', 'Go live')}
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-h3">{t('Kailangan para makapag-live', 'Needed to go live')}</h2>
        <ReqTag />
        <span className="ml-auto font-display text-[14px] font-semibold text-fg-2">{req}/4</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-1 xl:gap-2.5">
        {dynamicThemes
          .filter((x) => x.required)
          .map((x) => (
            <ThemeCard key={x.id} layout={desktop ? 'row' : 'tile'} icon={x.icon} title={x[lang]} minutes={x.minutes} status={b.status[x.id]} active={id === x.id || (!id && !desktop && x.id === nextReq)} onClick={() => open(x.id)} />
          ))}
      </div>

      <div className="mt-7 flex items-center gap-2">
        <h2 className="text-h3">{t('Opsyonal', 'Optional')}</h2>
        <OptTag />
        <span className="ml-auto text-[13px] text-fg-2">{t('Puwedeng tapusin mamaya', 'Finish anytime later')}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-1 xl:gap-2.5">
        {dynamicThemes
          .filter((x) => !x.required)
          .map((x) => (
            <ThemeCard key={x.id} layout={desktop ? 'row' : 'tile'} icon={x.icon} title={x[lang]} minutes={x.minutes} status={b.status[x.id]} active={id === x.id} onClick={() => open(x.id)} />
          ))}
      </div>

      <button onClick={() => setHelp(true)} className="mt-6 flex w-full items-center gap-3 rounded-[20px] border border-line bg-surface p-4 text-left dark:bg-elevated/50">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-link dark:bg-elevated">
          <LifeBuoy size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-semibold text-link">{t('Tulungan kami ng Bitinary team', 'Get help from the Bitinary team')}</span>
          <span className="text-[13px] text-fg-2">{t('Libreng assisted setup', 'Free assisted setup')}</span>
        </span>
        <ChevronRight size={18} className="text-muted" />
      </button>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </>
  )

  const footer = (
    <Button block variant="secondary" size="lg" onClick={() => navigate('/business')}>
      {b.live ? t('Pumunta sa dashboard', 'Go to dashboard') : t('I-save bilang draft at lumabas', 'Save as draft and exit')}
    </Button>
  )

  const pane = id ? (
    <BizThemeForm key={id} id={id} embedded onDone={onDone} onBack={() => navigate('/business/setup')} />
  ) : (
    <section className="flex h-full flex-col items-center justify-center rounded-[28px] bg-surface p-10 text-center shadow-card dark:bg-elevated/40">
      {ready ? (
        <>
          <GoLivePreviewCard b={b} className="w-full max-w-[380px] text-left" />
          <Button size="lg" className="mt-6" icon={<Rocket size={19} />} onClick={() => navigate('/business/preview')}>
            {t('Simulan na!', 'Go live')}
          </Button>
        </>
      ) : (
        <>
          <Jimbot expression="idea" variant="standalone" size={200} />
          <h2 className="mt-4 text-h2">{t('Apat na tema lang ang kailangan', 'Only four themes are required')}</h2>
          <p className="mt-2 max-w-[380px] text-body text-fg-2">{t('Pagkatapos ng Negosyo, Lokasyon, Oras at Contact, puwede ka nang mag-live. Opsyonal ang iba.', 'After Basics, Location, Hours and Contact you can go live. Everything else is optional.')}</p>
          <Button className="mt-6" iconRight={<ArrowRight size={18} />} onClick={() => open(nextReq ?? 'menu')}>
            {t('Simulan ang susunod', 'Start the next one')}
          </Button>
        </>
      )}
    </section>
  )

  return <HubLayout onBack={() => navigate('/business')} list={list} footer={footer} pane={pane} />
}

/* ------------------------------ Preview ------------------------------ */

export function BusinessPreview() {
  const { business, setBusiness } = useAccount()
  const b = useBizView(business)
  const { lang, t } = useLang()
  const navigate = useNavigate()
  const missing = REQUIRED_BIZ.filter((r) => b.status[r] !== 'done')
  const goLive = () => {
    setBusiness((x) => ({ ...x, live: true, liveAt: new Date().toISOString() }))
    navigate('/business/live', { replace: true })
  }
  const info = (
    <div>
      <h1 className="text-title">{t('Ganito ka makikita ng mga biyahero', 'This is how travelers will see you')}</h1>
      <p className="mt-2 text-body text-fg-2">{t('Puwede mo itong baguhin anumang oras. Live agad pero may "Hindi pa verified" na tag hanggang ma-approve.', 'You can edit this anytime. You go live right away with a "Not yet verified" tag until approved.')}</p>
      <ul className="mt-5 space-y-2">
        {bizThemes
          .filter((x) => x.required)
          .map((x) => {
            const ok = b.status[x.id] === 'done'
            return (
              <li key={x.id} className="flex items-center gap-3 rounded-[16px] bg-surface p-3 shadow-card dark:bg-elevated/50">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', ok ? 'bg-ok-bg text-ok' : 'bg-danger-bg text-danger')}>{ok ? <BadgeCheck size={18} /> : <TriangleAlert size={16} />}</span>
                <span className="flex-1 font-display text-[15px] font-medium">{x[lang]}</span>
                {!ok && (
                  <button onClick={() => navigate(`/business/setup/${x.id}`)} className="font-display text-[14px] font-medium text-link">
                    {t('Tapusin', 'Finish')}
                  </button>
                )}
              </li>
            )
          })}
      </ul>
      <div className="mt-4 rounded-[18px] bg-caution-bg p-4 text-[14px] text-caution">
        <p className="font-display font-semibold">{t('Habang hindi pa verified:', 'While not yet verified:')}</p>
        <p className="mt-1">{t('Makikita ka, may Quick Update, bisita at basic stats. Naka-lock ang Verified badge, deals, boosts at reservations.', 'You are visible with Quick Update, visits and basic stats. The Verified badge, deals, boosts and reservations stay locked.')}</p>
      </div>
      <Button block size="lg" className="mt-5 !h-16 !text-[19px]" icon={<Rocket size={22} />} disabled={missing.length > 0} onClick={goLive}>
        {t('Simulan na!', 'Go live')}
      </Button>
      {missing.length > 0 && <p className="mt-2 text-center text-[14px] font-semibold text-danger">{t(`Tapusin muna ang ${missing.length} na kailangan.`, `Finish ${missing.length} required theme(s) first.`)}</p>}
    </div>
  )
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 bg-bg/92 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center px-5">
          <BigBack onClick={() => navigate('/business/setup')} />
        </div>
      </header>
      <main className="mx-auto grid max-w-[560px] gap-6 px-5 pb-10 xl:max-w-[1100px] xl:grid-cols-[1fr_1fr] xl:items-start xl:gap-12">
        <div className="xl:order-2">
          <p className="mb-2 flex items-center gap-1.5 font-display text-[13px] font-semibold uppercase tracking-wide text-fg-2">
            <Eye size={15} /> {t('Preview', 'Preview')}
          </p>
          <div className="rounded-[32px] bg-sunken p-4 dark:bg-elevated/40">
            <GoLivePreviewCard b={b} />
          </div>
        </div>
        <div className="xl:order-1 xl:pt-8">{info}</div>
      </main>
    </div>
  )
}

/* ------------------------------ Go live success ------------------------------ */

export function BusinessLive() {
  const { business } = useAccount()
  const b = useBizView(business)
  const { t } = useLang()
  const navigate = useNavigate()
  return (
    <SuccessScreen
      title={t('Live na ang negosyo mo!', 'Your business is live!')}
      chip={<StatusChip status="live" className="bg-white text-caution" />}
      body={t(`Makikita na ng mga biyahero ang ${b.name || 'negosyo mo'}. Mag-verify para makuha ang badge at mas maraming tools.`, `Travelers can now find ${b.name || 'your business'}. Verify to unlock the badge and more tools.`)}
      aside={<GoLivePreviewCard b={b} />}
      actions={
        <>
          <Button block size="lg" onClick={() => navigate('/business', { replace: true })}>
            {t('Pumunta sa dashboard', 'Go to dashboard')}
          </Button>
          <Button block variant="ghost" className="!h-12" icon={<BadgeCheck size={18} />} onClick={() => navigate('/business/setup/verify')}>
            {t('Mag-verify ngayon', 'Verify now')}
          </Button>
        </>
      }
    />
  )
}

/* ------------------------------ Dashboard first-run ------------------------------ */

type Tip = { id: BizThemeId; tl: string; en: string; cta: [string, string] }
const tips: Tip[] = [
  { id: 'photos', tl: 'Ang may larawan ay 3x na mas maraming bisita. Magdagdag ng cover photo!', en: 'Listings with photos get 3x more visits. Add a cover photo!', cta: ['Magdagdag ng larawan', 'Add photos'] },
  { id: 'menu', tl: 'Hinahanap ng biyahero ang presyo. Ilista ang 3 best-seller mo.', en: 'Travelers look for prices. List your 3 best-sellers.', cta: ['Ilista ang menu', 'Add menu'] },
  { id: 'verify', tl: 'Mag-verify para makuha ang badge, deals at reservations.', en: 'Verify to unlock the badge, deals and reservations.', cta: ['Mag-verify', 'Verify'] },
  { id: 'about', tl: 'Ikuwento ang negosyo mo sa 150 letra para mas makilala ka.', en: 'Tell your story in 150 characters so people get to know you.', cta: ['Isulat ang kuwento', 'Write your story'] },
  { id: 'online', tl: 'I-link ang Facebook o Instagram mo para mas madaling ma-contact.', en: 'Link your Facebook or Instagram so people can reach you.', cta: ['I-link', 'Add links'] },
  { id: 'goals', tl: 'Sabihin ang layunin mo para maiangkop ko ang mga mungkahi.', en: 'Tell me your goals so I can tailor my tips.', cta: ['Pumili ng layunin', 'Choose goals'] },
]

function Card({ title, icon, children, className, right }: { title: string; icon?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-[24px] bg-surface p-4 shadow-card dark:bg-elevated/50', className)}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-link">{icon}</span>}
        <h2 className="text-h3">{title}</h2>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </section>
  )
}

export function BusinessDashboard() {
  const { business, setBusiness, profile } = useAccount()
  const b = useBizView(business)
  const { lang, t } = useLang()
  const { showToast } = useStore()
  const navigate = useNavigate()
  const [tipIdx, setTipIdx] = useState(0)
  const [quick, setQuick] = useState({ name: '', price: '' })
  const [sheet, setSheet] = useState<'fb' | 'scan' | null>(null)
  const status = bizStatus(b)
  const verified = status === 'verified'
  const openTips = tips.filter((x) => b.status[x.id] !== 'done' && !(x.id === 'verify' && b.verification.status !== 'none'))
  const tip = openTips.length ? openTips[tipIdx % openTips.length] : null
  const score = healthScore(b)
  const today = DAYS[(new Date().getDay() + 6) % 7]
  const closedToday = b.hours[today].closed
  const offering = getOfferingConfig(b.type)

  const addQuick = () => {
    if (!quick.name.trim()) return
    setBusiness((x) => ({ ...x, menu: [...x.menu, { id: `q${Date.now()}`, name: quick.name.trim(), price: quick.price, category: offering.categories[0] }], status: { ...x.status, menu: 'done' } }))
    setQuick({ name: '', price: '' })
    showToast({ text: t('Naidagdag!', 'Added successfully!'), expression: 'celebrating' })
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="bg-primary pb-6 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-5">
          <Jimbot crop="head" size={44} animate={false} className="ring-2 ring-cream" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[13px] font-semibold text-ink">{t(`Kumusta, ${profile.nickname || b.contactName.split(' ')[0] || 'Ka-negosyo'}!`, `Hi, ${profile.nickname || b.contactName.split(' ')[0] || 'partner'}!`)}</p>
            <h1 className="truncate font-display text-[24px] font-bold leading-tight text-white">{b.name || t('Negosyo mo', 'Your business')}</h1>
          </div>
          <span className="hidden sm:block">
            <Button size="sm" variant="glass" icon={<Eye size={16} />} onClick={() => navigate('/business/preview')}>
              {t('Tingnan bilang biyahero', 'View as traveler')}
            </Button>
          </span>
        </div>
        <div className="mx-auto mt-3 flex max-w-[1100px] flex-wrap items-center gap-2 px-5">
          <StatusChip status={status} className="bg-white" />
          <span className="inline-flex h-7 items-center rounded-full bg-ink/80 px-3 font-display text-[12px] font-semibold text-cream">Sample data</span>
          {b.live && !verified && <span className="inline-flex h-7 items-center rounded-full bg-ink/80 px-3 font-display text-[12px] font-semibold text-cream">{t('Hindi pa verified', 'Not yet verified')}</span>}
        </div>
      </header>

      <main className="mx-auto -mt-3 max-w-[1100px] space-y-4 px-4 pb-16 md:px-5">
        {!b.live && (
          <section role="status" className="flex flex-wrap items-center gap-3 rounded-[24px] border-2 border-caution/40 bg-caution-bg p-4 text-caution">
            <TriangleAlert size={24} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16px] font-semibold">{t('Draft pa ang negosyo mo', 'Your business is still a draft')}</p>
              <p className="text-[14px]">{t(`Hindi ka pa nakikita ng biyahero. ${requiredDone(b)} sa 4 na kailangan ang tapos.`, `Travelers can't see you yet. ${requiredDone(b)} of 4 required themes done.`)}</p>
            </div>
            <Button onClick={() => navigate('/business/setup')}>{t('Ituloy ang setup', 'Continue setup')}</Button>
          </section>
        )}
        {b.live && !verified && (
          <button onClick={() => navigate('/business/setup/verify')} className="flex w-full items-center gap-3 rounded-[24px] bg-brown p-4 text-left text-cream dark:bg-elevated">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
              <BadgeCheck size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[16px] font-semibold">{status === 'pending' ? t('Sinusuri ang verification mo', 'Your verification is in review') : t('Mag-verify para makuha ang badge at mas maraming tools', 'Verify to unlock the badge and more tools')}</span>
              <span className="text-[13px] text-[#E8CDB9]">{status === 'pending' ? t('Karaniwang 1–2 araw', 'Usually 1–2 days') : t('Beripikasyon · 2 minuto', 'Verification · 2 minutes')}</span>
            </span>
            <ChevronRight size={20} />
          </button>
        )}
        {status === 'pending' && (
          <button onClick={() => setBusiness((x) => ({ ...x, verification: { ...x.verification, status: 'verified' } }))} className="text-[13px] font-semibold text-link underline underline-offset-2">
            {t('Demo: aprubahan ang verification', 'Demo: approve verification')}
          </button>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card title="Quick Update" icon={<Sparkles size={20} />} className="md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-sunken p-3 dark:bg-elevated">
              <span>
                <span className="block font-display text-[15px] font-semibold">{closedToday ? t('Sarado ngayon', 'Closed today') : t('Bukas ngayon', 'Open today')}</span>
                <span className="text-[13px] text-fg-2">{todayHours(b, lang)}</span>
              </span>
              <Toggle label={t('Bukas ngayon', 'Open today')} checked={!closedToday} onChange={(v) => setBusiness((x) => ({ ...x, hours: { ...x.hours, [today]: { ...x.hours[today], closed: !v } } }))} />
            </div>
            <p className="mb-2 mt-4 font-display text-[14px] font-medium">{offering.quickUpdateTitle[lang]}</p>
            <div className="flex gap-2">
              <input value={quick.name} onChange={(e) => setQuick((q) => ({ ...q, name: e.target.value }))} placeholder={offering.itemPlaceholder[lang].split(',')[0]} aria-label={offering.itemPlaceholder[lang].split(',')[0]} className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-bg px-3 text-[15px] outline-none focus:border-primary" />
              <input value={quick.price} inputMode="decimal" onChange={(e) => setQuick((q) => ({ ...q, price: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="₱" aria-label={offering.priceLabel[lang]} className="h-11 w-20 rounded-[12px] border border-line bg-bg px-3 text-[15px] outline-none focus:border-primary" />
              <Button aria-label={t('Idagdag', 'Add')} onClick={addQuick} disabled={!quick.name.trim()} className="!px-3">
                <Plus size={20} />
              </Button>
            </div>
            <p className="mt-2 text-[13px] text-fg-2">{offering.quickUpdateCountLabel(b.menu.length, lang)}</p>
          </Card>

          <Card title={t('Profile Health Score', 'Profile Health Score')} icon={<Heart size={20} />}>
            <div className="flex items-center gap-4">
              <CompletenessRing value={score / 100} size={104} stroke={11} />
              <div className="min-w-0 flex-1 text-[14px] text-fg-2">
                <p>
                  <b className="text-fg">{t('Base:', 'Base:')}</b> {t(`${requiredDone(b)}/4 na kailangan`, `${requiredDone(b)}/4 required`)}
                </p>
                <p className="mt-1">
                  <b className="text-fg">{t('Dagdag:', 'Boost:')}</b> {t(`${optionalIds.filter((x) => b.status[x] === 'done').length}/6 opsyonal`, `${optionalIds.filter((x) => b.status[x] === 'done').length}/6 optional`)}
                </p>
                <button onClick={() => navigate('/business/setup')} className="mt-2 font-display text-[14px] font-medium text-link">
                  {t('Pagandahin ang profile →', 'Improve profile →')}
                </button>
              </div>
            </div>
          </Card>

          <Card title={t('Susunod na hakbang', 'Next step')} icon={<Sparkles size={20} />}>
            {tip ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tip.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                  <JimbotSays pose="idea" size={60}>
                    {tip[lang]}
                  </JimbotSays>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={() => navigate(`/business/setup/${tip.id}`)}>
                      {tip.cta[lang === 'en' ? 1 : 0]}
                    </Button>
                    {openTips.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => setTipIdx((i) => i + 1)}>
                        {t('Iba pang mungkahi', 'Another tip')}
                      </Button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <JimbotSays pose="celebrating" size={60}>
                {t('Kumpleto na ang profile mo. Ang galing!', 'Your profile is complete. Great job!')}
              </JimbotSays>
            )}
          </Card>

          <Card title={t('Basic stats', 'Basic stats')} icon={<ChartColumn size={20} />} right={<span className="text-[12px] text-fg-2">{t('Ngayong linggo', 'This week')}</span>}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [b.live ? 12 : 0, t('Views', 'Views')],
                [b.live ? 3 : 0, t('Bisita', 'Visits')],
                [b.live ? 1 : 0, t('Naka-save', 'Saves')],
              ].map(([n, l]) => (
                <div key={l} className="rounded-[16px] bg-sunken py-3 dark:bg-elevated">
                  <p className="font-display text-[24px] font-bold">{n}</p>
                  <p className="text-[12px] text-fg-2">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-fg-2">{b.live ? t('Unang linggo mo! Ibahagi ang link para dumami ang bisita.', 'Your first week! Share your link to get more visits.') : t('Magsisimula ang stats pagka-live mo.', 'Stats start once you go live.')}</p>
          </Card>

          <Card title={t('Mga tool', 'Tools')} icon={<Tag size={20} />}>
            <ul className="grid grid-cols-2 gap-2">
              {[
                [<BadgeCheck size={18} />, t('Verified badge', 'Verified badge')],
                [<Tag size={18} />, t('Deals', 'Deals')],
                [<Rocket size={18} />, t('Boosts', 'Boosts')],
                [<CalendarCheck size={18} />, t('Reservations', 'Reservations')],
              ].map(([icon, l], i) => (
                <li key={i} className={cn('flex items-center gap-2 rounded-[14px] p-2.5 text-[14px] font-semibold', verified ? 'bg-ok-bg text-ok' : 'bg-sunken text-fg-2 dark:bg-elevated')}>
                  {verified ? icon : <Lock size={16} />} {l}
                </li>
              ))}
            </ul>
            {!verified && <p className="mt-2 text-[13px] text-fg-2">{t('Mabubuksan pagka-verify.', 'Unlocks after verification.')}</p>}
          </Card>

          <Card title={t('Mga shortcut', 'Shortcuts')} icon={<Headphones size={20} />}>
            <p className="mb-2 text-[13px] text-fg-2">{t('Pandagdag ng datos mamaya. Hindi kailangan sa registration.', 'For adding data later. Not part of registration.')}</p>
            <div className="space-y-2">
              <button onClick={() => setSheet('fb')} className="flex w-full items-center gap-3 rounded-[16px] bg-sunken p-3 text-left dark:bg-elevated">
                <Facebook size={20} className="text-[#1877F2]" />
                <span className="flex-1 font-display text-[15px] font-medium">{t('I-import mula sa Facebook', 'Import from Facebook')}</span>
                <ChevronRight size={18} className="text-muted" />
              </button>
              <button onClick={() => setSheet('scan')} className="flex w-full items-center gap-3 rounded-[16px] bg-sunken p-3 text-left dark:bg-elevated">
                <ScanLine size={20} className="text-link" />
                <span className="flex-1 font-display text-[15px] font-medium">{t('I-scan ang menu', 'Scan your menu')}</span>
                <ChevronRight size={18} className="text-muted" />
              </button>
            </div>
          </Card>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="secondary" onClick={() => navigate('/business/setup')}>
            {t('I-edit ang profile', 'Edit profile')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('Buksan ang app bilang biyahero', 'Open the traveler app')}
          </Button>
        </div>
      </main>

      <Sheet open={sheet === 'fb'} onClose={() => setSheet(null)} title={t('I-import mula sa Facebook', 'Import from Facebook')}>
        <p className="text-body text-fg-2">{t('Kukunin namin ang oras, contact at about mula sa Facebook Page mo. Ikaw pa rin ang magre-review bago i-save.', "We'll pull hours, contact and about from your Facebook Page. You review everything before it's saved.")}</p>
        <Button block size="lg" className="mt-5" icon={<Facebook size={18} />} onClick={() => (setSheet(null), showToast({ text: t('Ikokonekta namin ito sa susunod na bersyon.', "We'll connect this in a future version."), expression: 'idea' }))}>
          {t('Ikonekta ang Facebook Page', 'Connect Facebook Page')}
        </Button>
      </Sheet>
      <Sheet open={sheet === 'scan'} onClose={() => setSheet(null)} title={t('I-scan ang menu', 'Scan your menu')}>
        <div className="flex flex-col items-center text-center">
          <Jimbot expression="camera" variant="standalone" size={130} />
          <p className="mt-2 text-body text-fg-2">{t('Kunan ng litrato ang menu board. Babasahin ni Jimbot ang mga item at presyo para ma-review mo.', 'Take a photo of your menu board. Jimbot reads the items and prices for you to review.')}</p>
          <Button
            block
            size="lg"
            className="mt-5"
            icon={<ScanLine size={18} />}
            onClick={() => {
              setSheet(null)
              setBusiness((x) => ({ ...x, menu: [...x.menu, { id: `s1${Date.now()}`, name: 'Tapsilog', price: '120', category: 'Ulam' }, { id: `s2${Date.now()}`, name: 'Halo-halo', price: '95', category: 'Panghimagas' }] }))
              showToast({ text: t('2 item ang nabasa. I-review sa Menu.', '2 items read. Review them in Menu.'), expression: 'celebrating', action: { label: t('Review', 'Review'), to: '/business/setup/menu' } })
            }}
          >
            {t('Kunan ang menu', 'Capture menu')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
