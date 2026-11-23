import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { MomentFrame } from '@/data/moments'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/format'

export const frameStyles: Record<MomentFrame, { bg: string; ink: string; label: string }> = {
  classic: { bg: '#FFFFFF', ink: '#3A1A0E', label: 'Classic white' },
  cream: { bg: '#FFF1E3', ink: '#3A1A0E', label: 'Cream' },
  orange: { bg: '#FF6A00', ink: '#2B130A', label: 'Orange' },
  brown: { bg: '#3A1A0E', ink: '#FFF1E3', label: 'Brown' },
  film: { bg: '#141414', ink: '#F5F5F5', label: 'Film-strip' },
}

export function Polaroid({
  src,
  caption,
  date,
  place,
  dateLocale,
  frame = 'classic',
  tilt = 0,
  width = 160,
  className,
  onClick,
  developing,
  actions,
}: {
  src: string
  caption?: string
  date?: string
  place?: string
  dateLocale?: string
  frame?: MomentFrame
  tilt?: number
  width?: number | string
  className?: string
  onClick?: () => void
  developing?: boolean
  actions?: ReactNode
}) {
  const f = frameStyles[frame]
  const isFilm = frame === 'film'
  const parsedDate = date ? new Date(date) : null
  const displayDate = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? dateLocale
      ? new Intl.DateTimeFormat(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsedDate)
      : shortDate(parsedDate)
    : undefined
  return (
    <motion.figure
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{ rotate: tilt, width, background: f.bg }}
      className={cn(
        'relative shrink-0 rounded-[20px] border border-black/[0.06] p-[5%] pb-0 [container-type:inline-size] shadow-[0_12px_30px_-10px_rgba(23,30,44,0.24),0_2px_6px_rgba(23,30,44,0.08)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {isFilm && (
        <>
          <div className="absolute inset-x-[6%] top-[1.5%] flex justify-between" aria-hidden>
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="h-[3px] w-[8%] rounded-[1px] bg-white/70" />
            ))}
          </div>
        </>
      )}
      {actions && (
        <div
          className="absolute right-[7%] top-[7%] z-10 flex items-center gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      )}
      <div className="relative aspect-square overflow-hidden rounded-[12px] bg-[#2a2a2a]">
        <motion.img
          src={src}
          alt={caption ?? 'Moment'}
          className="h-full w-full object-cover"
          initial={developing ? { opacity: 0.15, filter: 'sepia(1) blur(6px) brightness(1.6) contrast(0.6)' } : false}
          animate={{ opacity: 1, filter: 'sepia(0) blur(0px) brightness(1) contrast(1)' }}
          transition={{ duration: developing ? 2 : 0, ease: 'easeOut' }}
          draggable={false}
        />
      </div>
      <figcaption className="flex min-h-[24%] flex-col justify-center gap-0.5 px-[2%] py-[5%]" style={{ color: f.ink }}>
        {caption && <span className="line-clamp-1 font-display text-[clamp(13px,9cqw,21px)] font-semibold leading-tight">{caption}</span>}
        {(displayDate || place) && (
          <span className="line-clamp-1 font-display text-[clamp(10px,6.5cqw,14px)] leading-tight opacity-65">
            {[displayDate, place].filter(Boolean).join(' · ')}
          </span>
        )}
      </figcaption>
    </motion.figure>
  )
}

export function PolaroidSkeleton({ width = 150, tilt = 0 }: { width?: number | string; tilt?: number }) {
  return (
    <div style={{ width, rotate: `${tilt}deg` }} className="shrink-0 bg-surface p-[6%] pb-[22%] shadow-card dark:bg-elevated">
      <div className="skeleton aspect-square rounded-none" />
    </div>
  )
}
