import { Sparkles, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAccount } from '@/app/account'
import { useLang } from '@/app/i18n'
import { foodOpts, interestOpts, label } from '@/data/themes'
import { peso } from '@/lib/format'
import { Jimbot } from '../mascot/Jimbot'
import { Button } from '../ui/Button'
import { SectionHeader } from '../ui/Section'

export function personalReason(food: string | undefined, mealBudget: number, lang: 'tl' | 'en') {
  if (lang === 'en') return food ? `For you because you like ${food.toLowerCase()} on a ${peso(mealBudget)} budget` : `For you, within ${peso(mealBudget)} per meal`
  return food ? `Para sa iyo dahil gusto mo ng ${food.toLowerCase()} sa budget na ${peso(mealBudget)}` : `Para sa iyo, pasok sa ${peso(mealBudget)} bawat kain`
}

export function ForYou() {
  const { prefs, consent, session, requireAccount } = useAccount()
  const { lang, t } = useLang()
  const navigate = useNavigate()
  const st = prefs.status
  const personalized = consent.personalization && session?.kind === 'user' && (st.food === 'done' || st.budget === 'done' || st.interests === 'done')

  if (!personalized) {
    return (
      <section className="mx-4 flex items-center gap-3 rounded-[22px] bg-brown p-4 text-cream md:mx-0 dark:bg-elevated">
        <Jimbot expression="idea" crop="head" size={52} animate={false} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-semibold">{t('I-personalize ang Home mo', 'Personalize your Home')}</p>
          <p className="text-[14px] text-[#E8CDB9]">{t('Sagutin ang Budget at Pagkain, 2 minuto lang.', 'Answer Budget and Food, just 2 minutes.')}</p>
        </div>
        <Button size="sm" icon={<Sparkles size={15} />} onClick={() => (session?.kind === 'user' ? navigate('/personalize') : requireAccount(t('Kailangan ng account para ma-save ang mga preference mo.', 'You need an account to save your preferences.')))}>
          {t('Simulan', 'Start')}
        </Button>
      </section>
    )
  }

  const food = st.food === 'done' ? label(foodOpts, prefs.foods[0], lang) : st.interests === 'done' ? label(interestOpts, prefs.interests[0], lang) : undefined

  return (
    <section className="space-y-3">
      <SectionHeader title={t('Para sa iyo', 'For you')} action={t('Baguhin', 'Edit')} onAction={() => navigate('/account/preferences')} />
      <p className="flex items-start gap-2 px-4 text-[15px] text-fg-2 md:px-0">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-link" />
        <span>{personalReason(food, prefs.mealBudget, lang)}</span>
      </p>
      <div className="mx-4 rounded-[22px] bg-surface p-6 text-center shadow-card md:mx-0 dark:bg-elevated">
        <Jimbot expression="idea" variant="standalone" size={88} className="mx-auto" />
        <p className="mt-2 text-body text-fg-2">{t('Wala pang lugar sa database na tugma sa iyo.', 'There are no database places matching you yet.')}</p>
      </div>
    </section>
  )
}

export function GuestBanner() {
  const { session } = useAccount()
  const { t } = useLang()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(false)
  if (session?.kind !== 'guest' || hidden) return null
  return (
    <div className="card mx-4 flex items-center gap-3 p-3 md:mx-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
        <UserPlus size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold leading-tight">{t('Nag-e-explore ka bilang guest', "You're exploring as a guest")}</p>
        <p className="text-[13px] text-fg-2">{t('Mag-sign up para ma-save ang trips at lugar.', 'Sign up to save trips and places.')}</p>
      </div>
      <Button size="sm" onClick={() => navigate('/signup/role')}>
        {t('Mag-sign up', 'Sign up')}
      </Button>
      <button aria-label={t('Isara', 'Close')} onClick={() => setHidden(true)} className="-mr-1 flex h-11 w-8 items-center justify-center text-muted">
        <X size={18} />
      </button>
    </div>
  )
}
