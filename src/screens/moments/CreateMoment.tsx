import { Check, Share2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLang } from '@/app/i18n'
import { useStore } from '@/app/store'
import { frameStyles, Polaroid } from '@/components/cards/Polaroid'
import { Jimbot } from '@/components/mascot/Jimbot'
import { Button } from '@/components/ui/Button'
import { PhaseTag } from '@/components/ui/PhaseTag'
import { Toggle } from '@/components/ui/Toggle'
import type { MomentFrame } from '@/data/moments'
import { cn } from '@/lib/cn'

const frames = Object.keys(frameStyles) as MomentFrame[]

export function CreateMoment() {
  const { t } = useLang()
  const { myMoments, addMoment } = useStore()
  const navigate = useNavigate()
  const pool = myMoments
  const [picked, setPicked] = useState<string[]>(pool.slice(0, 2).map((m) => m.id))
  const [frame, setFrame] = useState<MomentFrame>('classic')
  const [caption, setCaption] = useState(t('Unang Moment ko', 'My first Moment'))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [place, setPlace] = useState('')
  const [tilt, setTilt] = useState(3)
  const [shareOn, setShareOn] = useState(false)
  const [done, setDone] = useState(false)
  const chosen = pool.filter((m) => picked.includes(m.id))

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]))

  const save = async () => {
    chosen.forEach((m, i) =>
      addMoment({ ...m, id: `cm-${Date.now()}-${i}`, caption, date, place, frame, tilt: i % 2 ? -tilt : tilt, mine: true, onMap: true }),
    )
    setDone(true)
    if (shareOn && navigator.share) navigator.share({ title: caption, text: t(`Moment ko sa ${place} · Bitinary`, `My Moment at ${place} · Bitinary`) }).catch(() => {})
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[760px] pb-10">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-2 pt-safe backdrop-blur-xl md:px-4">
        <button onClick={() => navigate(-1)} className="flex h-11 items-center gap-1 px-2 font-display text-[16px] text-link">
          <X size={20} /> {t('Kanselahin', 'Cancel')}
        </button>
        <h1 className="flex items-center gap-1.5 font-display text-[17px] font-semibold">
          {t('Gumawa ng Moment', 'Create Moment')} <PhaseTag phase="P3" />
        </h1>
        <button disabled={!chosen.length} onClick={save} className="h-11 px-3 font-display text-[16px] font-semibold text-link disabled:opacity-40">
          {t('I-save', 'Save')}
        </button>
      </header>

      {/* preview: tilted stack */}
      <section aria-label={t('Preview', 'Preview')} className="relative flex h-[330px] items-center justify-center overflow-hidden bg-sunken dark:bg-surface">
        <div className="relative h-[250px] w-[210px]">
          {chosen.length ? (
            chosen.slice(0, 4).map((m, i) => (
              <motion.div
                key={m.id}
                className="absolute left-0 top-0"
                animate={{ rotate: (i - (chosen.length - 1) / 2) * tilt * 1.6, x: (i - (chosen.length - 1) / 2) * 12, y: i * -4 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ zIndex: i }}
              >
                <Polaroid src={m.src} caption={i === chosen.length - 1 ? caption : undefined} date={i === chosen.length - 1 ? date : undefined} place={i === chosen.length - 1 ? place : undefined} frame={frame} width={210} />
              </motion.div>
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-fg-2">
              <Jimbot expression="camera" variant="standalone" size={100} />
              <p className="mt-2">{t('Pumili ng larawan sa ibaba', 'Pick a photo below')}</p>
            </div>
          )}
        </div>
      </section>

      <div className="space-y-6 px-4 pt-5">
        <section>
          <h2 className="mb-2 flex items-baseline justify-between text-h3">
            {t('Pumili ng larawan', 'Choose photos')} <span className="text-caption font-normal text-fg-2">{picked.length}/4</span>
          </h2>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {pool.map((m) => {
              const on = picked.includes(m.id)
              return (
                <button key={m.id} onClick={() => toggle(m.id)} aria-pressed={on} aria-label={m.caption} className={cn('relative aspect-square overflow-hidden rounded-[14px] ring-offset-2 ring-offset-bg', on && 'ring-[3px] ring-primary')}>
                  <img src={m.src.replace('w=600&h=600', 'w=200&h=200')} alt="" className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-ink">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-h3">{t('Frame', 'Frame')}</h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {frames.map((f) => (
              <button key={f} onClick={() => setFrame(f)} aria-pressed={frame === f} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5">
                <span className={cn('flex h-[88px] w-[72px] items-start justify-center rounded-[6px] p-1.5 pb-5 shadow-card ring-offset-2 ring-offset-bg', frame === f && 'ring-[3px] ring-primary')} style={{ background: frameStyles[f].bg }}>
                  <span className="block aspect-square w-full rounded-[2px] bg-gradient-to-br from-[#FFB400] to-[#C84A00]" />
                </span>
                <span className="text-center text-[12px] leading-tight text-fg-2">{frameStyles[f].label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="block">
            <span className="text-caption text-fg-2">{t('Caption', 'Caption')}</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-4 font-hand text-[24px] outline-none focus:border-primary dark:bg-elevated" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-caption text-fg-2">{t('Petsa', 'Date')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
            </label>
            <label className="block">
              <span className="text-caption text-fg-2">{t('Lugar', 'Place')}</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-3 text-body outline-none focus:border-primary dark:bg-elevated" />
            </label>
          </div>
          <label className="block">
            <span className="flex justify-between text-caption text-fg-2">
              {t('Tilt ng stack', 'Stack tilt')} <span>{tilt}°</span>
            </span>
            <input type="range" min={0} max={8} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="mt-2 w-full accent-[var(--c-primary)]" aria-label={t('Tilt', 'Tilt')} />
          </label>
        </section>

        <section className="flex items-center justify-between gap-3 rounded-[20px] bg-surface p-4 shadow-card">
          <span>
            <span className="flex items-center gap-1.5 text-body font-semibold">
              <Share2 size={17} /> {t('I-share pagkatapos i-save', 'Share after saving')}
            </span>
            <span className="block text-caption text-fg-2">{shareOn ? t('Isha-share sa mapa at gallery.', 'Shared to the map and gallery.') : t('Naka-off bilang default. Pribado ang Moments mo.', 'Off by default. Your Moments stay private.')}</span>
          </span>
          <Toggle label={t('I-share', 'Share')} checked={shareOn} onChange={setShareOn} />
        </section>

        <Button block size="lg" disabled={!chosen.length} onClick={save}>
          {t('I-save ang Moment', 'Save Moment')}
        </Button>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-6 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-[360px] rounded-[28px] bg-surface p-6 text-center shadow-float">
              <Jimbot expression="celebrating" variant="standalone" size={140} className="mx-auto" />
              <h2 className="mt-3 text-h2">{t('Ang ganda ng Moment mo!', 'Your Moment looks great!')}</h2>
              <p className="mt-1 text-body text-fg-2">{t('Na-save sa mapa at sa gallery mo.', 'Saved to your map and gallery.')} {shareOn ? t('Handa na ring i-share.', 'Ready to share.') : t('Pribado ito.', 'It is private.')}</p>
              <Button block className="mt-5" onClick={() => navigate('/moments/map?gallery=half&f=mine')}>
                {t('Tingnan sa mapa', 'View on map')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
