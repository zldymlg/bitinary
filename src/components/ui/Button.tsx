import { motion, type HTMLMotionProps } from 'motion/react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'brown' | 'glass' | 'darkglass' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-press',
  secondary: 'bg-sunken text-fg hover:brightness-95 dark:bg-elevated',
  ghost: 'bg-transparent text-link hover:bg-sunken',
  brown: 'bg-brown text-cream hover:brightness-110 dark:bg-elevated',
  glass: 'glass text-fg',
  darkglass: 'glass-dark text-white',
  danger: 'bg-danger-bg text-danger',
  outline: 'border border-line bg-surface text-fg',
}
const sizes: Record<Size, string> = {
  sm: 'h-11 min-w-11 px-3.5 text-[14px] rounded-full gap-1.5',
  md: 'h-11 min-w-11 px-5 text-[15px] rounded-full gap-2',
  lg: 'h-14 px-6 text-[17px] rounded-[18px] gap-2.5',
}

export type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  block?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-display font-medium transition-colors disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </motion.button>
  )
})

export function IconButton({
  label,
  children,
  className,
  variant = 'glass',
  size = 44,
  ...rest
}: Omit<HTMLMotionProps<'button'>, 'children'> & {
  label: string
  children: ReactNode
  variant?: 'glass' | 'plain' | 'surface' | 'onOrange' | 'dark'
  size?: number
}) {
  const v = {
    glass: 'glass text-fg',
    plain: 'text-fg hover:bg-sunken',
    surface: 'bg-surface text-fg shadow-card dark:bg-elevated',
    onOrange: 'bg-white/25 text-ink hover:bg-white/35',
    dark: 'glass-dark text-white',
  }[variant]
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      style={{ width: size, height: size }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full transition-colors', v, className)}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
