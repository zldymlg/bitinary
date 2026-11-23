import { Globe, History, LogIn } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAccount } from '@/app/account'
import { useLang, type Lang } from '@/app/i18n'
import { SelectCard } from '@/components/flow/Fields'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { authenticatedContinuationPath } from '@/lib/authFlow'
import { getForcedState } from '@/lib/forced'

function Weave({ id }: { id: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden>
      <defs>
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 17h34M17 0v34" stroke="#2B130A" strokeWidth="2.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export function nextAfterSplash(a: ReturnType<typeof useAccount>, langChosen: boolean) {
  if (!langChosen) return '/language'
  if (a.session?.kind === 'user') return authenticatedContinuationPath(a.role, a.setupDone, a.resume?.path)
  if (a.session?.kind === 'guest') return '/'
  return '/welcome'
}

export function Splash() {
  const navigate = useNavigate()
  const account = useAccount()
  const { chosen, t } = useLang()
  const hold = getForcedState() === 'hold'
  useEffect(() => {
    if (hold) return
    const tm = setTimeout(() => navigate(nextAfterSplash(account, chosen), { replace: true }), 1800)
    return () => clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-primary">
      <Weave id="sp-weave" />
      <motion.div initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }} className="relative">
        <div className="absolute inset-[4%] rounded-full bg-white/18" />
        <Jimbot expression="waving" variant="standalone" size={250} className="relative" />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative mt-4 font-display text-[44px] font-bold tracking-tight text-white">
        Bitinary
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="relative mt-4 px-6 text-center font-display text-[17px] font-semibold leading-relaxed text-ink">
        {t('Your Travel, Your Stories, Your Local Business Partner.', 'Your Travel, Your Stories, Your Local Business Partner.')}
      </motion.p>
      <div className="absolute bottom-[max(48px,env(safe-area-inset-bottom))] flex gap-2" role="status" aria-label={t('Naglo-load', 'Loading')}>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-2.5 w-2.5 rounded-full bg-cream" animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </main>
  )
}

/** First launch: pick Tagalog or English. */
export function LanguagePick() {
  const { lang, setLang } = useLang()
  const [pick, setPick] = useState<Lang>(lang)
  const navigate = useNavigate()
  const en = pick === 'en'
  return (
    <main className="relative flex min-h-dvh flex-col bg-primary md:flex-row">
      <Weave id="lang-weave" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pt-[max(24px,env(safe-area-inset-top))]">
        <div className="absolute left-5 top-[max(16px,env(safe-area-inset-top))] font-display text-[22px] font-bold text-white">Bitinary</div>
        <Jimbot expression="waving" variant="standalone" size={230} className="max-h-[34vh] w-auto md:max-h-[50vh]" />
        <p className="mt-2 rounded-full bg-ink/85 px-4 py-1.5 font-display text-[14px] font-semibold text-cream">{en ? 'Hello!' : 'Kumusta!'}</p>
      </div>
      <section className="relative rounded-t-[32px] bg-surface px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-fg md:my-auto md:mr-10 md:w-[420px] md:rounded-[32px] md:shadow-float xl:mr-24 xl:w-[460px]">
        <div className="flex items-center gap-2 text-link">
          <Globe size={20} />
          <span className="font-display text-[14px] font-semibold">{en ? 'Language' : 'Wika'}</span>
        </div>
        <h1 className="mt-1 text-title">{en ? 'Choose your language' : 'Pumili ng wika'}</h1>
        <p className="mt-1 text-body text-fg-2">{en ? 'You can change this anytime in Account.' : 'Puwede mo itong palitan anumang oras sa Account.'}</p>
        <div className="mt-5 space-y-3" role="radiogroup" aria-label={en ? 'Language' : 'Wika'}>
          <SelectCard selected={pick === 'tl'} onClick={() => setPick('tl')} icon={<span className="font-display text-[18px] font-bold">TL</span>} title="Tagalog" body="Gamitin ang Bitinary sa Tagalog" />
          <SelectCard selected={pick === 'en'} onClick={() => setPick('en')} icon={<span className="font-display text-[18px] font-bold">EN</span>} title="English" body="Use Bitinary in English" />
        </div>
        <Button
          block
          size="lg"
          className="mt-5"
          onClick={() => {
            setLang(pick)
            navigate('/welcome', { replace: true })
          }}
        >
          {en ? 'Continue' : 'Magpatuloy'}
        </Button>
      </section>
    </main>
  )
}

export function Welcome() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useLang()
  const { resume, session, setupDone, role, continueAsGuest } = useAccount()
  const forced = getForcedState()
  const canResume = forced === 'resume' || (!!resume && !(session?.kind === 'user' && setupDone))
  const businessSession = session?.kind === 'user' && role === 'business'
  const businessContinuation = authenticatedContinuationPath(
    'business',
    setupDone,
    resume?.path,
  )

  useEffect(() => {
    if (businessSession) navigate(businessContinuation, { replace: true })
  }, [businessContinuation, businessSession, navigate])

  return (
    <main className="relative flex min-h-dvh flex-col bg-primary md:flex-row">
      <Weave id="wc-weave" />
      <div className="relative flex flex-1 flex-col pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-5">
          <span className="font-display text-[22px] font-bold text-white">Bitinary</span>
          <button onClick={() => setLang(lang === 'tl' ? 'en' : 'tl')} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/25 px-4 font-display text-[14px] font-medium text-ink" aria-label={t('Palitan ang wika', 'Change language')}>
            <Globe size={16} /> {lang === 'tl' ? 'Tagalog' : 'English'}
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }} className="relative">
            <div className="absolute inset-[4%] rounded-full bg-white/18" />
            <Jimbot expression="waving" variant="standalone" size={260} className="relative max-h-[36vh] w-auto md:max-h-[52vh]" />
          </motion.div>
          <span className="mt-3 rounded-full bg-ink/85 px-3.5 py-1.5 font-display text-[13px] font-semibold text-cream">{t('Ako si Jimbot, ang gabay mo!', "I'm Jimbot, your guide!")}</span>
        </div>
      </div>
      <section className="relative rounded-t-[32px] bg-surface px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-fg md:my-auto md:mr-10 md:w-[420px] md:rounded-[32px] md:shadow-float xl:mr-24 xl:w-[460px]">
        <h1 className="text-title">{t('Your Travel, Your Stories, Your Local Business Partner.', 'Your Travel, Your Stories, Your Local Business Partner.')}</h1>
        <p className="mt-2 text-body text-fg-2">{t('Planuhin ang kainan at pasyalan na pasok sa budget mo, kasama si Jimbot.', 'Plan food trips and getaways that fit your budget, with Jimbot.')}</p>
        {canResume && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(resume?.path ?? '/signup/role')}
            className="mt-4 flex w-full items-center gap-3 rounded-[18px] border-2 border-primary bg-primary/10 p-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
              <History size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-semibold leading-tight">{t('Ituloy kung saan ka huminto', 'Continue where you left off')}</span>
              <span className="text-[13px] text-fg-2">{t('Naka-save ang sign-up mo', 'Your sign-up was saved')}</span>
            </span>
          </motion.button>
        )}
        <Button block size="lg" className="mt-5" onClick={() => navigate('/signup/role')}>
          {t('Magsimula', 'Get started')}
        </Button>
        <Button block variant="ghost" className="mt-1 !h-12" icon={<LogIn size={18} />} onClick={() => navigate('/auth?mode=login')}>
          {t('May account na ako', 'I already have an account')}
        </Button>
        <button
          onClick={() => {
            continueAsGuest()
            navigate('/')
          }}
          className="mt-1 h-11 w-full font-display text-[14px] font-medium text-fg-2"
        >
          {t('Mag-explore muna bilang guest', 'Explore first as a guest')}
        </button>
      </section>
    </main>
  )
}
