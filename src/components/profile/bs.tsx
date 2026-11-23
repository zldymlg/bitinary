import { useId, useRef, type ReactNode } from 'react'
import Carousel from 'react-bootstrap/Carousel'
import Modal from 'react-bootstrap/Modal'
import Offcanvas from 'react-bootstrap/Offcanvas'
import { cn } from '@/lib/cn'
import { src } from '@/lib/media'
import { useBreakpoint } from '@/lib/useMedia'

/**
 * Bootstrap-powered sheet for the business profile. Phones: Offcanvas from the bottom with the Bitinary
 * bottom-sheet look (handle, rounded top, swipe down to close). Tablet and desktop: centered Modal.
 * Focus trap, Esc, backdrop click and body scroll lock come from Bootstrap.
 */
export function ProfileSheet({ open, onClose, title, footer, children, className }: { open: boolean; onClose: () => void; title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  const wide = useBreakpoint() !== 'mobile'
  const id = useId()
  const drag = useRef<{ y: number; el: HTMLElement | null } | null>(null)

  if (wide) {
    return (
      <Modal show={open} onHide={onClose} centered scrollable aria-labelledby={id} dialogClassName="mx-auto max-w-[480px] px-4" contentClassName={cn('overflow-hidden rounded-[28px] border-0 bg-surface text-fg shadow-float outline-none', className)}>
        <Modal.Header closeButton closeLabel="Isara" className="border-0 px-5 pb-1 pt-4">
          <Modal.Title id={id} as="h2" className="min-w-0 flex-1 pr-3 text-h3">
            {title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-5 pb-5 pt-2">{children}</Modal.Body>
        {footer && <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>}
      </Modal>
    )
  }

  // Swipe down on the handle or title to close (never from the scrolling body).
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, el: e.currentTarget.closest('.offcanvas') }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d?.el) return
    d.el.style.transition = 'none'
    d.el.style.transform = `translateY(${Math.max(0, e.clientY - d.y)}px)`
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.el) return
    d.el.style.transition = ''
    d.el.style.transform = ''
    if (e.clientY - d.y > 80) onClose()
  }

  return (
    <Offcanvas show={open} onHide={onClose} placement="bottom" aria-labelledby={id} className={cn('h-auto max-h-[92dvh] rounded-t-[28px] bg-surface pb-safe text-fg shadow-float', className)}>
      <div className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 active:cursor-grabbing" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="h-[5px] w-10 rounded-full bg-line dark:bg-white/20" aria-hidden />
        <Offcanvas.Header closeButton closeLabel="Isara" className="w-full px-5 pb-1 pt-3">
          <Offcanvas.Title id={id} as="h2" className="min-w-0 flex-1 pr-3 text-h3">
            {title}
          </Offcanvas.Title>
        </Offcanvas.Header>
      </div>
      <Offcanvas.Body className="min-h-0 flex-1 overscroll-contain px-5 pb-5 pt-2">{children}</Offcanvas.Body>
      {footer && <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>}
    </Offcanvas>
  )
}

type Action = { label: string; onClick: () => void; bold?: boolean; destructive?: boolean }

/** iOS-style confirm dialog on a Bootstrap Modal (same look as the app's IOSAlert). */
export function ConfirmModal({ open, title, message, actions, onClose }: { open: boolean; title: string; message?: ReactNode; actions: Action[]; onClose?: () => void }) {
  const id = useId()
  const cancel = onClose ?? actions.find((a) => !a.destructive && !a.bold)?.onClick ?? actions[0]?.onClick ?? (() => {})
  return (
    <Modal show={open} onHide={cancel} centered size="sm" aria-labelledby={id} dialogClassName="mx-auto w-[270px] max-w-[270px]" contentClassName="overflow-hidden rounded-[14px] border-0 bg-[rgba(242,242,247,0.96)] text-center text-black backdrop-blur-2xl dark:bg-[rgba(44,44,46,0.96)] dark:text-white">
      <div role="alertdialog" aria-labelledby={id}>
        <div className="px-4 pb-4 pt-5 [font-family:-apple-system,system-ui,sans-serif]">
          <p id={id} className="text-[17px] font-semibold leading-snug">
            {title}
          </p>
          {message && <div className="mt-1 text-[13px] leading-snug">{message}</div>}
        </div>
        <div className={cn('border-t border-black/15 dark:border-white/15', actions.length > 2 ? 'flex flex-col' : 'grid grid-cols-2')}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={cn('h-11 text-[17px] text-[#007AFF] [font-family:-apple-system,system-ui,sans-serif] active:bg-black/5 dark:text-[#0A84FF]', a.bold && 'font-semibold', a.destructive && 'text-[#FF3B30] dark:text-[#FF453A]', i > 0 && (actions.length > 2 ? 'border-t border-black/15 dark:border-white/15' : 'border-l border-black/15 dark:border-white/15'))}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/** Full-screen photo viewer: Bootstrap Modal + Carousel (swipe, arrows, keyboard, indicators). */
export function PhotoViewer({ photos, index, onClose, onIndex }: { photos: string[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const open = index != null && !!photos[index]
  return (
    <Modal show={open} onHide={onClose} centered size="lg" fullscreen="sm-down" aria-label="Mga larawan" contentClassName="border-0 bg-[#140a05] text-white md:rounded-[28px]">
      <Modal.Header closeButton closeLabel="Isara" closeVariant="white" className="border-0 px-5 pt-4">
        <Modal.Title as="p" className="font-display text-[15px] font-medium text-white/80">
          {open ? `${index! + 1} / ${photos.length}` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="flex items-center px-2 pb-6 md:px-4">
        {open && (
          <Carousel activeIndex={index!} onSelect={(i) => onIndex(i)} interval={null} touch keyboard indicators={photos.length > 1} controls={photos.length > 1} prevLabel="Nakaraan" nextLabel="Susunod" className="w-full">
            {photos.map((p, i) => (
              <Carousel.Item key={p + i}>
                <img src={src(p, 1400)} alt={`Larawan ${i + 1}`} className="mx-auto max-h-[75dvh] w-full rounded-[18px] object-contain" loading={Math.abs(i - index!) <= 1 ? 'eager' : 'lazy'} />
              </Carousel.Item>
            ))}
          </Carousel>
        )}
      </Modal.Body>
    </Modal>
  )
}
