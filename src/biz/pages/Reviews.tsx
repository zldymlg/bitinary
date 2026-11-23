import { ArrowLeft, ChevronRight, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { Stars } from '../charts'
import { updateReviewReply } from '../db/reviews'
import { longDate } from '../format'
import type { Review } from '../seed'
import { useBiz } from '../store'
import { Card, PageHeader, Pill, StateBlock } from '../ui'
import { BusinessAssetImage } from '../ui/BusinessAssetImage'
import { ContentTabs } from './Posts'

function ReviewHeader({ review }: { review: Review }) {
  const { t, lang } = useBiz()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Stars value={review.stars} />
      <b className="font-display text-[15px]">{review.nick}</b>
      <span className="text-[13px] text-fg-2">{longDate(review.at, lang)}</span>
      {review.checkin && <Pill>{t('Iniulat na pagbisita', 'Reported visit')}</Pill>}
    </div>
  )
}

export function Reviews() {
  const { d, t } = useBiz()
  const [params, setParams] = useSearchParams()
  const filters = [
    ['all', t('Lahat', 'All'), () => true],
    ['new', t('Bago', 'New'), (review: Review) => review.fresh],
    ['needs', t('Kailangang sagutin', 'Needs reply'), (review: Review) => !review.reply],
    ['low', t('Mababang rating', 'Low rating'), (review: Review) => review.stars <= 2],
    ['photos', t('May larawan', 'With photos'), (review: Review) => review.photos.length > 0],
  ] as const
  const [active, , matches] = filters.find(([key]) => key === params.get('f')) ?? filters[0]
  const reviews = getForcedState() === 'empty' ? [] : d.reviews.filter((review) => !review.hidden && matches(review))

  return (
    <main>
      <PageHeader title={t('Mga review', 'Reviews')} tabs={<ContentTabs />} />
      <div className="space-y-4 px-4 md:px-8">
        <div aria-label={t('Salain ang mga review', 'Filter reviews')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {filters.map(([key, label]) => (
            <button type="button" key={key} aria-pressed={active === key} onClick={() => setParams({ f: key }, { replace: true })} className={cn(
              'min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 font-display text-[15px] font-medium',
              active === key ? 'bg-brown text-cream dark:bg-cream dark:text-brown' : 'bg-sunken text-fg-2 dark:bg-elevated',
            )}>
              {label}
            </button>
          ))}
        </div>
        {reviews.length === 0 ? (
          <Card><StateBlock pose="idea" title={t('Walang review dito', 'No reviews here')} body={t('Lalabas dito ang mga review na tumutugma.', 'Matching reviews will appear here.')} /></Card>
        ) : (
          <Card className="p-0 md:p-0">
            <ul className="divide-y divide-line">
              {reviews.map((review) => (
                <li key={review.id}>
                  <Link to={`/biz/content/reviews/${review.id}`} className="flex items-start gap-3 p-4 text-left hover:bg-sunken/50">
                    <div className="min-w-0 flex-1">
                      <ReviewHeader review={review} />
                      <p className="mt-2 line-clamp-2 break-words">{review.text}</p>
                      <span className="mt-2 block text-sm font-medium text-fg-2">{review.reply ? t('Nasagot', 'Replied') : t('Kailangang sagutin', 'Needs reply')}</span>
                    </div>
                    <ChevronRight aria-hidden size={18} className="mt-1 shrink-0 text-fg-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </main>
  )
}

function ReviewReply({ review }: { review: Review }) {
  const { d, setLocal, t, showToast } = useBiz()
  const [reply, setReply] = useState(review.reply ?? '')
  const [editing, setEditing] = useState(!review.reply)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save() {
    const text = reply.trim()
    if (!d.business.id || saving || text.length < 5) return
    setSaving(true)
    setFailed(false)
    const { data, error } = await updateReviewReply(d.business.id, review.id, text)
    if (error || !data) {
      setFailed(true)
      setSaving(false)
      return
    }
    await setLocal((current) => ({
      ...current,
      reviews: current.reviews.map((item) => item.id === review.id ? { ...item, reply: data.reply ?? undefined } : item),
    }))
    setEditing(false)
    setSaving(false)
    showToast({ text: t('Nai-publish ang sagot.', 'Reply published.') })
  }

  return (
    <Card title={t('Ang sagot mo', 'Your reply')}>
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); void save() }} className="space-y-3">
          <label className="block text-sm font-medium">
            {t('Sagot', 'Reply')}
            <textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} disabled={saving} className="mt-1 block w-full rounded-xl border border-line bg-bg p-3" />
          </label>
          {failed && <p role="alert" className="text-sm text-danger">{t('Hindi na-save ang sagot. Subukan ulit.', 'Could not save the reply. Try again.')}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {review.reply && <Button variant="ghost" disabled={saving} onClick={() => { setReply(review.reply ?? ''); setEditing(false) }}>{t('Kanselahin', 'Cancel')}</Button>}
            <Button type="submit" icon={<Send size={17} />} disabled={saving || reply.trim().length < 5}>{t('I-publish ang sagot', 'Publish reply')}</Button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-sunken p-3 dark:bg-elevated">{review.reply}</p>
          <Button variant="ghost" className="mt-2" onClick={() => setEditing(true)}>{t('I-edit ang sagot', 'Edit reply')}</Button>
        </>
      )}
    </Card>
  )
}

export function ReviewDetail() {
  const { id } = useParams()
  const { d, t } = useBiz()
  const review = d.reviews.find((item) => item.id === id && !item.hidden)

  return (
    <main>
      <Link to="/biz/content/reviews" className="mx-4 mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-link md:mx-8">
        <ArrowLeft aria-hidden size={18} /> {t('Bumalik sa mga review', 'Back to reviews')}
      </Link>
      <PageHeader title={t('Review', 'Review')} />
      <div className="max-w-[860px] space-y-4 px-4 md:px-8">
        {review ? (
          <>
            <Card>
              <ReviewHeader review={review} />
              <p className="mt-2 whitespace-pre-wrap break-words">{review.text}</p>
              {!!review.photos.length && <div className="mt-3 flex flex-wrap gap-2">
                {review.photos.map((photo) => <BusinessAssetImage key={photo} src={photo} alt={t('Larawan mula sa review', 'Review photo')} className="h-24 w-24 rounded-xl object-cover" />)}
              </div>}
            </Card>
            <ReviewReply key={review.id} review={review} />
          </>
        ) : <Card><StateBlock pose="unsure" title={t('Hindi nahanap ang review', 'Review not found')} /></Card>}
      </div>
    </main>
  )
}
