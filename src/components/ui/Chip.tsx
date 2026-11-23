import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Chip({
  children,
  active,
  onClick,
  icon,
  className,
  tone = 'default',
  trailing,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  icon?: ReactNode
  className?: string
  tone?: 'default' | 'glass'
  trailing?: ReactNode
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-display text-[14px] font-medium transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : tone === 'glass'
            ? 'glass text-fg shadow-float'
            : 'border border-line bg-surface text-fg dark:border-transparent dark:bg-elevated',
        className,
      )}
    >
      {icon}
      {children}
      {trailing}
    </motion.button>
  )
}
