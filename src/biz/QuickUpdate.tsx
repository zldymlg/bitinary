import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { useOnline } from '@/lib/useOnline'
import { clearQuickUpdate, loadQuickUpdate, saveQuickUpdate } from './db/quickUpdates'
import { emptyQuickUpdate, type QuickUpdateFields } from './quickUpdateState'
import { useBiz } from './store'

export function QuickUpdatePanel({ onDone, onCancel, onDirtyChange }: {
  onDone: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { d, t, showToast } = useBiz()
  const businessId = d.business.id
  const online = useOnline()
  const [draft, setDraft] = useState<QuickUpdateFields>(emptyQuickUpdate)
  const [saved, setSaved] = useState<QuickUpdateFields>(emptyQuickUpdate)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!businessId) return
    let active = true
    setLoading(true)
    setLoadError(false)
    void loadQuickUpdate(businessId).then(({ data, error }) => {
      if (!active) return
      setDraft(data ?? emptyQuickUpdate)
      setSaved(data ?? emptyQuickUpdate)
      setHasUpdate(!!data)
      setLoadError(!!error)
      setLoading(false)
    })
    return () => { active = false }
  }, [businessId, retry])

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  async function save(clear: boolean) {
    if (!businessId || saving) return
    setSaving(true)
    setSaveError(false)
    const { error } = await (clear ? clearQuickUpdate(businessId) : saveQuickUpdate(businessId, draft))
    setSaving(false)
    if (error) {
      setSaveError(true)
      return
    }
    showToast({ text: clear ? t('Inalis ang update.', 'Update cleared.') : t('Nai-publish ang update.', 'Update published.') })
    onDone()
  }

  if (!businessId || loading) return <p role="status">{t('Kinukuha ang update…', 'Loading update…')}</p>
  if (loadError) return (
    <div role="alert" className="space-y-3">
      <p>{t('Hindi nakuha ang update.', 'Could not load the update.')}</p>
      <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>{t('Subukan ulit', 'Retry')}</Button>
    </div>
  )

  const options = [
    { value: 'regular', label: t('Regular na oras', 'Regular hours') },
    { value: 'open', label: t('Bukas', 'Open') },
    { value: 'closed', label: t('Sarado', 'Closed') },
  ] as const
  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(false) }} className="space-y-4">
      <p className="text-sm text-fg-2">{t(
        'Makikita ito sa pampublikong profile hanggang hatinggabi sa Pilipinas.',
        'This appears on your public profile until midnight in the Philippines.',
      )}</p>
      <fieldset disabled={saving || !online} className="space-y-3">
        <legend className="mb-2 font-semibold">{t('Katayuan ngayon', 'Current status')}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map(({ value, label }) => (
            <label key={value} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm">
              <input type="radio" name="quick-status" checked={draft.status === value} onChange={() => setDraft({ ...draft, status: value })} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-sunken px-3 py-2">
          <span>{t('Ubos na', 'Sold out')}</span>
          <Toggle label={t('Ubos na', 'Sold out')} checked={draft.sold_out} onChange={(sold_out) => setDraft({ ...draft, sold_out })} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-sunken px-3 py-2">
          <span>{t('Mahaba ang pila', 'Long queue')}</span>
          <Toggle label={t('Mahaba ang pila', 'Long queue')} checked={draft.long_queue} onChange={(long_queue) => setDraft({ ...draft, long_queue })} />
        </div>
        <label className="block text-sm font-semibold">
          {t('Espesyal ngayong araw', 'Today’s special')}
          <input value={draft.special} maxLength={160} onChange={(event) => setDraft({ ...draft, special: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-bg px-3 font-normal" />
        </label>
      </fieldset>
      {saveError && <p role="alert" className="text-sm text-danger">{t('Hindi na-save ang update. Subukan ulit.', 'Could not save the update. Try again.')}</p>}
      {!online && <p role="status" className="text-sm text-fg-2">{t('Kumonekta para makapag-save.', 'Connect to save your update.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t('Kanselahin', 'Cancel')}</Button>
        {hasUpdate && <Button type="button" variant="secondary" disabled={saving || !online} onClick={() => void save(true)}>{t('Alisin ang update', 'Clear update')}</Button>}
        <Button type="submit" disabled={saving || !online || (draft.status === 'regular' && !draft.sold_out && !draft.long_queue && !draft.special.trim())}>
          {saving ? t('Sine-save…', 'Saving…') : t('I-publish ang update', 'Publish update')}
        </Button>
      </div>
    </form>
  )
}
