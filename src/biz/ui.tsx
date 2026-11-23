import { ArrowDownRight, ArrowUpRight, ChevronRight, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Jimbot, type Expression } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { cn } from '@/lib/cn'
import { isBizPreview } from '@/lib/forced'
import { Sparkline } from './charts'
import { compactNum, pct } from './format'
import { useBiz, type BizStatus } from './store'
import type { CaseStatus } from './seed'

export type Phase = 'MVP' | 'P2' | 'P3'

export function PageHeader({ title, sub, phase, actions, tabs, className }: { title: string; sub?: ReactNode; phase?: Phase; actions?: ReactNode; tabs?: ReactNode; className?: string }) {
  return (
    <header className={cn('px-4 pb-3 pt-4 md:px-8 md:pt-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-title md:text-[34px]">
            {title}
            {phase && isBizPreview() && <PhaseTag phase={phase} />}
          </h1>
          {sub && <p className="mt-1 text-body text-fg-2">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-4">{tabs}</div>}
    </header>
  )
}

/** Route-based segmented control (iOS style). Labels wrap-safe for longer Tagalog strings. */
export function SubTabs({ items, label }: { items: { to: string; label: string; exact?: boolean; badge?: number }[]; label: string }) {
  const { pathname } = useLocation()
  const active = items.findIndex((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to)))
  const cur = active < 0 ? 0 : [...items].map((i, n) => ({ n, l: i.to.length, m: i.exact ? pathname === i.to : pathname.startsWith(i.to) })).filter((x) => x.m).sort((a, b) => b.l - a.l)[0]?.n ?? 0
  return (
    <nav aria-label={label} className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <div className="inline-flex min-h-11 items-center gap-1 rounded-full bg-sunken p-1 dark:bg-elevated">
        {items.map((it, i) => (
          <Link key={it.to} to={it.to} aria-current={i === cur ? 'page' : undefined} className={cn('relative flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-4 font-display text-[14px] font-medium', i === cur ? 'text-on-primary' : 'text-fg-2')}>
            {i === cur && <motion.span layoutId={`sub-${label}`} className="absolute inset-0 -z-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{it.label}</span>
            {!!it.badge && <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">{it.badge}</span>}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function Card({ title, icon, action, children, className, phase, sub, id }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; phase?: Phase; sub?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cn('min-w-0 rounded-[20px] bg-surface p-4 shadow-card md:p-5 dark:bg-surface', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start gap-2">
          {icon && <span className="mt-0.5 text-link">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-h3">
              {title}
              {phase && isBizPreview() && <PhaseTag phase={phase} />}
            </h2>
            {sub && <p className="mt-0.5 text-[14px] text-fg-2">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-display text-[12px] font-semibold', up ? 'bg-ok-bg text-ok' : 'bg-danger-bg text-danger', className)}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {pct(value)}
    </span>
  )
}

export function KpiCard({ label, value, delta, series, icon, to, sub }: { label: string; value: string | number; delta?: number; series?: number[]; icon: ReactNode; to?: string; sub?: string }) {
  const { t } = useBiz()
  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-sunken text-link dark:bg-elevated">{icon}</span>
        <span className="min-w-0 flex-1 font-display text-[14px] font-medium leading-tight text-fg-2">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-display text-[30px] font-bold leading-none">{typeof value === 'number' ? compactNum(value) : value}</span>
        {delta != null && <Delta value={delta} />}
      </div>
      {series && <Sparkline data={series} className="mt-3" />}
      <p className="mt-1 text-[12px] text-fg-2">{sub ?? t('kumpara sa nakaraang linggo', 'vs. last week')}</p>
    </>
  )
  const cls = 'block min-w-0 rounded-[20px] bg-surface p-4 shadow-card transition-transform hover:-translate-y-0.5'
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function BizStatusChip({ status, className }: { status: BizStatus; className?: string }) {
  const { t } = useBiz()
  const m: Record<BizStatus, [string, string, string]> = {
    draft: ['bg-sunken text-fg-2 dark:bg-elevated', 'bg-muted', t('Draft', 'Draft')],
    live: ['bg-caution-bg text-caution', 'bg-caution', t('Live, hindi pa na-verify', 'Live, not yet verified')],
    pending: ['bg-caution-bg text-caution', 'bg-caution', t('Live, sinusuri ang permit', 'Live, verification pending')],
    'needs-docs': ['bg-danger-bg text-danger', 'bg-danger', t('Live, kulang ang dokumento', 'Live, more documents needed')],
    verified: ['bg-ok-bg text-ok', 'bg-ok', t('Na-verify', 'Verified')],
  }
  const [cls, dot, label] = m[status]
  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-display text-[13px] font-semibold', cls, className)}>
      <span className={cn('h-2 w-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

export function CaseChip({ status }: { status: CaseStatus }) {
  const { t } = useBiz()
  const m: Record<CaseStatus, [string, string]> = {
    received: ['bg-sunken text-fg-2 dark:bg-elevated', t('Natanggap', 'Received')],
    review: ['bg-caution-bg text-caution', t('Sinusuri', 'Under review')],
    info: ['bg-danger-bg text-danger', t('Kailangan ng dagdag na impormasyon', 'More information needed')],
    removed: ['bg-ok-bg text-ok', t('Tinanggal, may dahilan', 'Removed with reason')],
    kept: ['bg-[#E9E1FF] text-[#5B3CC4] dark:bg-[#2A2147] dark:text-[#C9B8FF]', t('Pinanatili, may dahilan', 'Kept with reason')],
    appealed: ['bg-caution-bg text-caution', t('Nag-apela', 'Appealed')],
  }
  return <span className={cn('inline-flex min-h-7 items-center rounded-full px-2.5 py-0.5 font-display text-[12px] font-semibold', m[status][0])}>{m[status][1]}</span>
}

export function Group({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-2 px-4 font-display text-[13px] font-semibold uppercase tracking-wide text-fg-2">{title}</h2>}
      <ul className="overflow-hidden rounded-[20px] bg-surface shadow-card">{children}</ul>
    </section>
  )
}

export function GroupRow({ icon, color = '#FF6A00', label, sub, value, to, onClick, trailing, danger }: { icon?: ReactNode; color?: string; label: string; sub?: string; value?: ReactNode; to?: string; onClick?: () => void; trailing?: ReactNode; danger?: boolean }) {
  const navigate = useNavigate()
  const inner = (
    <>
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white" style={{ background: color }}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-body', danger && 'text-danger')}>{label}</span>
        {sub && <span className="block text-[13px] leading-snug text-fg-2">{sub}</span>}
      </span>
      {value && <span className="shrink-0 text-[15px] text-fg-2">{value}</span>}
      {trailing ?? ((to || onClick) && <ChevronRight size={18} className="shrink-0 text-muted" />)}
    </>
  )
  return (
    <li className="border-b border-line last:border-0">
      {to || onClick ? (
        <button onClick={onClick ?? (() => navigate(to!))} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken/60">
          {inner}
        </button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{inner}</div>
      )}
    </li>
  )
}

export function StateBlock({ pose, title, body, action, onAction, className, placeholder }: { pose: Expression; title: string; body?: ReactNode; action?: string; onAction?: () => void; className?: string; placeholder?: boolean }) {
  const { t } = useBiz()
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="relative">
        <Jimbot expression={pose} variant="standalone" size={140} />
        {placeholder && <span className="absolute -right-3 top-0 rotate-6 rounded-md border border-dashed border-caution bg-caution-bg px-1.5 font-display text-[10px] font-bold uppercase text-caution">{t('Pansamantala', 'Placeholder')}</span>}
      </div>
      <h2 className="mt-3 text-h2">{title}</h2>
      {body && <p className="mt-1.5 max-w-[380px] text-body text-fg-2">{body}</p>}
      {action && (
        <Button className="mt-5" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  )
}

/** Shown in place of deals, boosts and reservations until verification is approved. */
export function LockedFeature({ title }: { title: string }) {
  const { t, status } = useBiz()
  const navigate = useNavigate()
  return (
    <Card className="flex flex-col items-center py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-sunken text-link dark:bg-elevated">
        <Lock size={30} />
      </span>
      <h2 className="mt-4 text-h2">{t(`Naka-lock ang ${title}`, `${title} is locked`)}</h2>
      <p className="mt-1.5 max-w-[420px] text-body text-fg-2">
        {status === 'draft'
          ? t('Mag-live at mag-verify muna para magamit ito.', 'Go live and get verified to use this.')
          : status === 'pending'
            ? t('Sinusuri pa ang verification mo. Bubukas ito pagka-approve.', 'Your verification is still in review. This unlocks once approved.')
            : t('Bubukas ang deals, boosts, reservations at Verified badge pagka-verify.', 'Deals, boosts, reservations and the Verified badge unlock after verification.')}
      </p>
      <Button className="mt-5" onClick={() => navigate('/biz/stats/backgrounds#verify')}>
        {status === 'pending' ? t('Tingnan ang status', 'View status') : t('Mag-verify ngayon', 'Verify now')}
      </Button>
    </Card>
  )
}

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const colors = ['#C84A00', '#6B3A22', '#1B8A3A', '#0B7F96', '#B26A00', '#5B3CC4']
  const c = colors[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % colors.length]
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white', className)} style={{ width: size, height: size, background: c, fontSize: size * 0.4 }} aria-hidden>
      {name.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

export function Pill({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'ok' | 'caution' | 'danger' | 'orange'; className?: string }) {
  const m = { default: 'bg-sunken text-fg-2 dark:bg-elevated', ok: 'bg-ok-bg text-ok', caution: 'bg-caution-bg text-caution', danger: 'bg-danger-bg text-danger', orange: 'bg-primary/15 text-link' }
  return <span className={cn('inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-[12px] font-semibold', m[tone], className)}>{children}</span>
}
