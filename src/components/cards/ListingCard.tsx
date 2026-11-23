import { Heart, MapPin, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { useAccount } from '@/app/account'
import { useStore } from '@/app/store'
import type { Place } from '@/data/places'
import { cn } from '@/lib/cn'
import { img } from '@/lib/format'
import { isDatabaseBusinessId, persistSavedPlace } from '@/lib/savedPlaces'
import { useOpen } from '@/lib/useOpen'
import { ClosingPill, QueuePill, VerifiedPill } from '../ui/Pill'

export function HeartButton({ id, className, tone = 'glass' }: { id: string; className?: string; tone?: 'glass' | 'plain' }) {
  const { saved, toggleSaved, showToast } = useStore()
  const { requireAccount, session } = useAccount()
  const on = saved.includes(id)
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      aria-label={on ? 'Alisin sa naka-save' : 'I-save'}
      aria-pressed={on}
      onClick={async (e) => {
        e.stopPropagation()
        if (!on && !requireAccount('Para ma-save ang lugar na ito.')) return
        try {
          if (isDatabaseBusinessId(id)) {
            if (session?.kind !== 'user' || !session.accountId) {
              showToast({ text: 'Hindi ma-verify ang iyong account. Mag-sign in ulit at subukan muli.' })
              return
            }
            await persistSavedPlace(session.accountId, id, !on)
          }
          toggleSaved(id)
          if (!on) showToast({ text: 'Na-save sa iyong listahan!', expression: 'celebrating' })
        } catch (error: unknown) {
          showToast({ text: error instanceof Error ? error.message : 'Could not update saved places.' })
        }
      }}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full',
        tone === 'glass' ? 'glass shadow-sm' : 'text-fg',
        className,
      )}
    >
      <Heart size={20} strokeWidth={1.75} className={on ? 'text-danger' : 'text-fg'} fill={on ? 'currentColor' : 'none'} />
    </motion.button>
  )
}

export function ListingCard({ place, layout = 'tile', className }: { place: Place; layout?: 'tile' | 'row'; className?: string }) {
  const open = useOpen()
  if (layout === 'row') {
    return (
      <motion.article
        whileTap={{ scale: 0.98 }}
        onClick={() => open.place(place.id)}
        className={cn('card flex cursor-pointer gap-3 p-2.5 dark:bg-surface', className)}
      >
        <img src={img(place.image, 240, 240)} alt="" className="h-[92px] w-[92px] shrink-0 rounded-[14px] object-cover" loading="lazy" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-h3">{place.name}</h3>
          </div>
          <p className="text-caption text-fg-2">
            {place.category} · {place.priceRange} {place.priceText} · {place.distance}
          </p>
          <div className="flex flex-wrap gap-1">
            <VerifiedPill days={place.verifiedDays} size="sm" />
            {place.status === 'closingSoon' && <ClosingPill size="sm" />}
          </div>
        </div>
        <HeartButton id={place.id} tone="plain" className="self-center" />
      </motion.article>
    )
  }
  return (
    <motion.article
      whileTap={{ scale: 0.97 }}
      onClick={() => open.place(place.id)}
      className={cn('card group shrink-0 cursor-pointer snap-start overflow-hidden', className)}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={img(place.image, 640, 400)}
          alt={place.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <HeartButton id={place.id} className="absolute right-2 top-2" />
        {place.queue === 'mahaba' && (
          <div className="absolute bottom-2 left-2">
            <QueuePill queue="mahaba" />
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-h3">{place.name}</h3>
          <span className="inline-flex shrink-0 items-center gap-0.5 font-display text-[13px] font-semibold">
            <Star size={14} className="text-amber" fill="currentColor" strokeWidth={0} />
            {place.rating}
          </span>
        </div>
        <p className="flex items-center gap-1 text-caption text-fg-2">
          <span className="font-semibold text-fg">{place.priceRange}</span> {place.priceText}
          <span aria-hidden>·</span>
          <MapPin size={13} strokeWidth={1.75} /> {place.distance}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <VerifiedPill days={place.verifiedDays} />
          {place.status === 'closingSoon' && <ClosingPill at={place.closesAt} />}
        </div>
      </div>
    </motion.article>
  )
}

export function ListingSkeleton() {
  return (
    <div className="card w-[272px] shrink-0 overflow-hidden md:w-auto">
      <div className="skeleton aspect-[16/10]" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-5 w-3/4 rounded-lg" />
        <div className="skeleton h-4 w-1/2 rounded-lg" />
        <div className="skeleton h-6 w-32 rounded-full" />
      </div>
    </div>
  )
}
