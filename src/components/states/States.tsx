import type { ReactNode } from 'react'
import { useT } from '@/app/i18n'
import { cn } from '@/lib/cn'
import { Jimbot, type Expression } from '../mascot/Jimbot'
import { Button } from '../ui/Button'

export function StateView({
  expression,
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
  className,
  tone = 'default',
  size = 150,
}: {
  expression: Expression
  title: string
  body?: ReactNode
  action?: string
  onAction?: () => void
  secondary?: string
  onSecondary?: () => void
  className?: string
  tone?: 'default' | 'dark'
  size?: number
}) {
  return (
    <div className={cn('flex flex-col items-center px-8 py-10 text-center', className)}>
      <Jimbot expression={expression} variant="standalone" size={size} />
      <h2 className={cn('mt-4 text-h2', tone === 'dark' ? 'text-cream' : 'text-fg')}>{title}</h2>
      {body && <p className={cn('mt-2 max-w-[320px] text-body', tone === 'dark' ? 'text-[#D7B8A3]' : 'text-fg-2')}>{body}</p>}
      {(action || secondary) && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {action && <Button onClick={onAction}>{action}</Button>}
          {secondary && (
            <Button variant="ghost" onClick={onSecondary} className={tone === 'dark' ? 'text-[#FF9A4D]' : undefined}>
              {secondary}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export const OfflineState = (p: { onRetry?: () => void; tone?: 'default' | 'dark'; body?: string }) => {
  const t = useT()
  return (
    <StateView
      expression="sleeping"
      title={t('Offline ka ngayon', "You're offline")}
      body={p.body ?? t('Natutulog muna si Jimbot habang walang internet. Makikita mo pa rin ang mga naka-save mong itinerary.', 'Jimbot is taking a break while there is no internet. You can still see your saved itineraries.')}
      action={t('Subukan ulit', 'Try again')}
      onAction={p.onRetry ?? (() => location.reload())}
      tone={p.tone}
    />
  )
}

export const ErrorState = (p: { onRetry?: () => void }) => {
  const t = useT()
  return (
    <StateView
      expression="unsure"
      title={t('May nangyaring mali', 'Something went wrong')}
      body={t('Hindi ko ma-load ito ngayon. Hindi ako manghuhula, kaya subukan nating i-refresh.', "I can't load this right now. I don't guess, so let's try refreshing.")}
      action={t('I-refresh', 'Refresh')}
      onAction={p.onRetry ?? (() => location.reload())}
    />
  )
}
