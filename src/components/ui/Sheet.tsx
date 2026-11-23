import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/** Modal bottom sheet (iOS style): backdrop, slide-up, drag-to-dismiss. Becomes a centered card on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  dark,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  dark?: boolean
  footer?: ReactNode
}) {
  const controls = useDragControls()
  const ref = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const panel = ref.current
    if (!panel) return
    panel.dataset.activeSheet = 'true'
    returnFocus.current = document.activeElement
    panel.focus()
    const topSheet = () => Array.from(document.querySelectorAll('[data-active-sheet]')).at(-1) === panel
    const onKey = (e: KeyboardEvent) => {
      if (!topSheet()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
      if (e.key !== 'Tab') return
      const targets = Array.from(panel.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, summary, [tabindex]',
      )).filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') &&
        el.getClientRects().length > 0 && (!(el instanceof HTMLInputElement) ||
          el.type !== 'radio' || el.checked || !panel.querySelector('input[name="' + CSS.escape(el.name) + '"]:checked')))
      const edge = e.shiftKey ? targets[0] : targets.at(-1)
      if (!targets.length || document.activeElement === panel || document.activeElement === edge) {
        e.preventDefault()
        ;(e.shiftKey ? targets.at(-1) : targets[0] ?? panel)?.focus()
      }
    }
    const containFocus = (e: FocusEvent) => {
      if (topSheet() && e.target instanceof Node && !panel.contains(e.target)) panel.focus()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', containFocus)
    return () => {
      delete panel.dataset.activeSheet
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', containFocus)
      ;(returnFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [open])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 z-[80] flex items-end justify-center md:items-center', dark && 'dark-sheet')}>
          <motion.div
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-surface pb-safe text-fg shadow-float outline-none md:mb-0 md:max-w-[480px] md:rounded-[28px]',
              className,
            )}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-[5px] w-10 rounded-full bg-line dark:bg-white/20" />
              {title && <div className="w-full px-5 pb-1 pt-3 text-h3">{title}</div>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
