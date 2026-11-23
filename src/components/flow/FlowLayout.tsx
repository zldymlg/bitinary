import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/cn'
import { Jimbot, type Expression } from '../mascot/Jimbot'

/**
 * Full-screen flow page. Mobile: single column with a sticky footer.
 * Tablet/desktop: split view with an orange brand panel featuring Jimbot.
 */
export function FlowLayout({
  children,
  footer,
  header,
  pose = 'waving',
  asideTitle = 'Tara, biyahe tayo!',
  asideBody = 'Planuhin ang kainan at pasyalan na pasok sa budget, kasama si Jimbot.',
  className,
}: {
  children: ReactNode
  footer?: ReactNode
  header?: ReactNode
  pose?: Expression
  asideTitle?: string
  asideBody?: string
  className?: string
}) {
  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      <aside className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-primary p-8 md:flex xl:w-1/2 xl:p-12">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden>
          <defs>
            <pattern id="flow-weave" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 17h34M17 0v34" stroke="#2B130A" strokeWidth="2.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#flow-weave)" />
        </svg>
        {/* Pinned to the panel center so a taller/shorter caption cannot shift the mascot. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Jimbot expression={pose} variant="standalone" size={320} className="max-h-[46vh] w-auto" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <Jimbot crop="head" size={44} animate={false} shape="squircle" className="rounded-[12px] ring-2 ring-cream/70" />
          <span className="font-display text-[24px] font-bold text-white">Bitinary</span>
        </div>
        <div className="relative max-w-[420px]">
          <h2 className="font-display text-[30px] font-bold leading-tight text-white">{asideTitle}</h2>
          <p className="mt-2 text-[17px] font-semibold leading-snug text-ink">{asideBody}</p>
        </div>
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {header}
        <main className={cn('mx-auto w-full max-w-[480px] flex-1 px-5 pb-6 md:pt-6', className)}>{children}</main>
        {footer && (
          <div className="sticky bottom-0 z-10 border-t border-line bg-bg/92 backdrop-blur-xl">
            <div className="mx-auto w-full max-w-[480px] space-y-2 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">{footer}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function FlowHeader({
  progress,
  label,
  onBack,
  onSkip,
  skipLabel = 'Laktawan',
  right,
}: {
  progress?: number
  label?: string
  onBack?: (() => void) | 'history'
  onSkip?: () => void
  skipLabel?: string
  right?: ReactNode
}) {
  const navigate = useNavigate()
  const back = onBack === 'history' ? () => navigate(-1) : onBack
  return (
    <header className="sticky top-0 z-20 bg-bg/92 pt-[max(8px,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-[480px] items-center gap-2 px-3">
        {back ? (
          <button onClick={back} aria-label="Bumalik" className="flex h-11 w-11 items-center justify-center rounded-full text-link">
            <ChevronLeft size={26} strokeWidth={2} />
          </button>
        ) : (
          <span className="w-11" />
        )}
        <div className="flex-1 text-center font-display text-[14px] font-medium text-fg-2">{label}</div>
        {right ??
          (onSkip ? (
            <button onClick={onSkip} className="h-11 rounded-full px-3 font-display text-[15px] font-medium text-link">
              {skipLabel}
            </button>
          ) : (
            <span className="w-11" />
          ))}
      </div>
      {progress != null && (
        <div className="mx-auto w-full max-w-[480px] px-5 pb-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken dark:bg-elevated" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={label}>
            <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
          </div>
        </div>
      )}
    </header>
  )
}

/** Jimbot asking a question, chat-bubble style. */
export function JimbotAsks({ title, sub, pose = 'idea' }: { title: string; sub?: string; pose?: Expression }) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <Jimbot expression={pose} variant="standalone" size={72} className="-ml-1 shrink-0" />
      <div className="card mt-1 flex-1 rounded-[22px] rounded-tl-md px-4 py-3">
        <h1 className="text-h2 leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[15px] leading-snug text-fg-2">{sub}</p>}
      </div>
    </div>
  )
}
