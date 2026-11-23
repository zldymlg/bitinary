import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/cn'
import { useLang } from '@/app/i18n'
import { tabs } from './nav'

export function GlassTabBar({ tone = 'default' }: { tone?: 'default' | 'dark' }) {
  const { pathname } = useLocation()
  const { t } = useLang()
  const label = (to: string) => {
    const labels: Record<string, [string, string]> = {
      '/': ['Tahanan', 'Home'],
      '/jimbot': ['Jimbot', 'Jimbot'],
      '/search': ['Hanap', 'Search'],
      '/moments': ['Moments', 'Moments'],
      '/account': ['Aking Account', 'Account'],
    }
    return t(...labels[to])
  }
  return (
    <nav
      aria-label={t('Pangunahing nabigasyon', 'Main navigation')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul
        className={cn(
          'pointer-events-auto mx-auto flex h-[66px] max-w-[440px] items-center justify-between rounded-[30px] px-1.5 shadow-float',
          tone === 'dark' ? 'glass-dark' : 'glass',
        )}
      >
        {tabs.map((t) => {
          const active = t.match(pathname)
          const Icon = t.icon
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative mx-auto flex h-[54px] w-full max-w-[74px] flex-col items-center justify-center gap-0.5 rounded-[24px]',
                  active ? 'text-ink' : tone === 'dark' ? 'text-white/75' : 'text-muted dark:text-[#C9A893]',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-capsule"
                    className="absolute inset-0 rounded-[24px] bg-primary"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <motion.span whileTap={{ scale: 0.88 }} className="relative">
                  <Icon active={active} />
                </motion.span>
                <span className="relative whitespace-nowrap font-display text-[10px] font-medium leading-none">{label(t.to)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
