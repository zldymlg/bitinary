import { Check, Eye, EyeOff, Info } from 'lucide-react'
import { motion } from 'motion/react'
import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useT } from '@/app/i18n'
import { cn } from '@/lib/cn'

export const inputBase =
  'h-14 w-full rounded-[16px] border bg-surface px-4 text-[16px] text-fg transition-colors placeholder:text-fg-2/70 focus:border-primary dark:bg-elevated'

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label: string
  optional?: boolean
  error?: string | null
  hint?: ReactNode
  prefix?: ReactNode
  trailing?: ReactNode
  onInfo?: () => void
  /** left padding in px when a prefix is shown */
  prefixWidth?: number
}

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField({ label, optional, error, hint, prefix, trailing, onInfo, className, id, prefixWidth = 76, ...rest }, ref) {
  const fid = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className={className}>
      <FieldLabel htmlFor={fid} label={label} optional={optional} onInfo={onInfo} />
      <div className={cn('relative flex items-center', error && 'animate-[shake_.3s]')}>
        {prefix && <div className="pointer-events-none absolute left-0 flex h-full items-center pl-4">{prefix}</div>}
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error}
          aria-describedby={error ? `${fid}-err` : undefined}
          style={prefix ? { paddingLeft: prefixWidth } : undefined}
          className={cn(inputBase, error ? 'border-danger' : 'border-line', !!trailing && 'pr-12')}
          {...rest}
        />
        {trailing && <div className="absolute right-1.5">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${fid}-err`} role="alert" className="mt-1.5 text-[14px] font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-caption text-fg-2">{hint}</p>
      )}
    </div>
  )
})

export function FieldLabel({ htmlFor, label, optional, onInfo }: { htmlFor?: string; label: string; optional?: boolean; onInfo?: () => void }) {
  const t = useT()
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="flex items-center gap-2 font-display text-[14px] font-medium text-fg">
        {label}
        {optional && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-fg-2 dark:bg-elevated">{t('Opsyonal', 'Optional')}</span>}
      </label>
      {onInfo && (
        <button type="button" onClick={onInfo} className="inline-flex h-8 items-center gap-1 text-[13px] font-semibold text-link">
          <Info size={14} /> {t('Bakit ito kailangan?', 'Why is this needed?')}
        </button>
      )}
    </div>
  )
}

export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const [show, setShow] = useState(false)
  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'current-password'}
      trailing={
        <button type="button" aria-label={show ? 'Itago ang password' : 'Ipakita ang password'} onClick={() => setShow((s) => !s)} className="flex h-11 w-11 items-center justify-center text-fg-2">
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      }
    />
  )
}

export function passwordScore(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++
  return s
}

export function StrengthMeter({ password }: { password: string }) {
  const s = passwordScore(password)
  const labels = ['Masyadong mahina', 'Mahina', 'Puwede na', 'Malakas', 'Napakalakas']
  const colors = ['var(--c-danger)', 'var(--c-danger)', 'var(--c-caution)', 'var(--c-ok)', 'var(--c-ok)']
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full bg-sunken transition-colors dark:bg-elevated" style={i < s ? { background: colors[s] } : undefined} />
        ))}
      </div>
      <p className="mt-1 text-[13px] font-semibold" style={{ color: password ? colors[s] : 'var(--c-fg-2)' }}>
        {password ? labels[s] : 'Hindi bababa sa 8 character, may numero at malaking titik'}
      </p>
    </div>
  )
}

/** 6-digit code input with auto-advance and paste support. */
export function OtpInput({ value, onChange, error, disabled, autoFocus = true }: { value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])
  const set = (i: number, ch: string) => {
    const arr = value.padEnd(6, ' ').split('')
    arr[i] = ch || ' '
    onChange(arr.join('').replace(/\s+$/, '').slice(0, 6))
  }
  return (
    <motion.div className="flex justify-between gap-2" animate={error ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.35 }} role="group" aria-label="6-digit na code">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={value[i]?.trim() ?? ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '')
            if (d.length > 1) {
              onChange(d.slice(0, 6))
              refs.current[Math.min(5, d.length - 1)]?.focus()
              return
            }
            set(i, d)
            if (d && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i]?.trim() && i > 0) refs.current[i - 1]?.focus()
          }}
          onPaste={(e) => {
            const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (d) {
              e.preventDefault()
              onChange(d)
              refs.current[Math.min(5, d.length - 1)]?.focus()
            }
          }}
          className={cn(
            'h-[60px] w-full min-w-0 rounded-[16px] border-2 bg-surface text-center font-display text-[26px] font-semibold text-fg outline-none transition-colors focus:border-primary disabled:opacity-50 dark:bg-elevated',
            error ? 'border-danger' : value[i]?.trim() ? 'border-primary/60' : 'border-line',
          )}
        />
      ))}
    </motion.div>
  )
}

/** Large selectable card (role picker, setup shortcuts). */
export function SelectCard({ selected, onClick, icon, title, body, className, multi }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; body?: string; className?: string; multi?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(
        'relative flex w-full items-center gap-4 rounded-[22px] border-2 bg-surface p-4 text-left shadow-card transition-colors',
        selected ? 'border-primary' : 'border-transparent dark:border-line',
        className,
      )}
    >
      <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px]', selected ? 'bg-primary text-ink' : 'bg-sunken text-link dark:bg-elevated')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] font-semibold leading-tight">{title}</span>
        {body && <span className="mt-0.5 block text-[14px] leading-snug text-fg-2">{body}</span>}
      </span>
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors', selected ? 'border-primary bg-primary text-ink' : 'border-line')} aria-hidden>
        {selected && <Check size={16} strokeWidth={3} />}
      </span>
    </motion.button>
  )
}

/** Big tappable chip with optional icon and a check when selected. */
export function ChoiceChip({ selected, onClick, icon, children, multi = true }: { selected: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode; multi?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(
        'inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 py-2 text-left font-display text-[15px] font-medium transition-colors',
        selected ? 'border-primary bg-primary text-ink' : 'border-line bg-surface text-fg dark:bg-elevated',
      )}
    >
      {selected ? <Check size={18} strokeWidth={2.6} /> : icon}
      {children}
    </motion.button>
  )
}

/** Full-width single-select row. */
export function ChoiceRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-[18px] border-2 px-4 py-3 text-left font-display text-[16px] font-medium transition-colors', selected ? 'border-primary bg-primary/10 text-fg' : 'border-line bg-surface dark:bg-elevated')}
    >
      {children}
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary bg-primary text-ink' : 'border-line')} aria-hidden>
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
    </motion.button>
  )
}

export function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
