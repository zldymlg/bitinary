import { EyeOff, MessageCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { getForcedState } from '@/lib/forced'
import { updateComment } from '../db/comments'
import { relTime } from '../format'
import type { Comment } from '../seed'
import { useBiz } from '../store'
import { Avatar, Card, PageHeader, Pill, StateBlock } from '../ui'
import { BusinessAssetImage } from '../ui/BusinessAssetImage'
import { ContentTabs } from './Posts'

function CommentRow({ c, focus }: { c: Comment; focus?: boolean }) {
  const { d, setLocal, t, lang, showToast } = useBiz()
  const [replying, setReplying] = useState(focus ?? false)
  const [reply, setReply] = useState(c.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save(patch: { reply: string } | { hidden: boolean }) {
    if (!d.business.id || saving) return
    setSaving(true)
    setFailed(false)
    const { data, error } = await updateComment(d.business.id, c.id, patch)
    if (error || !data) {
      setFailed(true)
      setSaving(false)
      return
    }
    await setLocal((current) => ({
      ...current,
      comments: current.comments.map((item) => item.id === data.id
        ? { ...item, reply: data.reply ?? undefined, hidden: data.hidden }
        : item),
    }))
    setSaving(false)
    if ('reply' in patch) setReplying(false)
    showToast({ text: 'reply' in patch
      ? t('Naipadala ang sagot.', 'Reply sent.')
      : data.hidden ? t('Itinago ang komento.', 'Comment hidden.') : t('Ipinakita ang komento.', 'Comment unhidden.') })
  }

  return (
    <li id={`c-${c.id}`} className={cn('flex gap-3 p-4', focus && 'bg-primary/5')}>
      <Avatar name={c.nick} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-display text-[15px]">{c.nick}</b>
          <span className="text-[13px] text-fg-2">{relTime(c.at, lang)}</span>
          {c.hidden && <Pill>{t('Nakatago', 'Hidden')}</Pill>}
        </div>
        <p className="mt-1 break-words text-[16px]">{c.text}</p>
        {c.reply && <p className="mt-2 break-words rounded-xl bg-sunken p-3 text-sm dark:bg-elevated"><b>{d.business.name}</b> · {c.reply}</p>}
        <div className="-ml-2 flex flex-wrap">
          {!c.hidden && <Button variant="ghost" icon={<MessageCircle size={17} />} disabled={saving} onClick={() => setReplying(!replying)}>
            {c.reply ? t('I-edit ang sagot', 'Edit reply') : t('Sumagot', 'Reply')}
          </Button>}
          <Button variant="ghost" icon={<EyeOff size={17} />} disabled={saving} onClick={() => void save({ hidden: !c.hidden })}>
            {c.hidden ? t('Ipakita', 'Unhide') : t('Itago', 'Hide')}
          </Button>
        </div>
        {replying && !c.hidden && (
          <form className="mt-2 space-y-2" onSubmit={(event) => { event.preventDefault(); if (reply.trim()) void save({ reply: reply.trim() }) }}>
            <label className="block text-sm font-medium">
              {t('Sagot', 'Reply')}
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} disabled={saving} className="mt-1 block w-full rounded-xl border border-line bg-bg p-2" />
            </label>
            <Button type="submit" disabled={saving || !reply.trim()}>{t('Ipadala ang sagot', 'Send reply')}</Button>
          </form>
        )}
        {failed && <p role="alert" className="mt-2 text-sm text-danger">{t('Hindi na-save. Subukan ulit.', 'Could not save. Try again.')}</p>}
      </div>
    </li>
  )
}

export function Comments() {
  const { d, t } = useBiz()
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!focus) return
    const timer = setTimeout(() => document.getElementById(`c-${focus}`)?.scrollIntoView({ block: 'center' }), 200)
    return () => clearTimeout(timer)
  }, [focus])
  const filters = [
    ['all', t('Lahat', 'All')],
    ['new', t('Bago', 'New')],
    ['needs', t('Kailangang sagutin', 'Needs reply')],
    ['hidden', t('Nakatago', 'Hidden')],
  ] as const
  const filter = filters.find(([key]) => key === params.get('f'))?.[0] ?? 'all'
  const all = getForcedState() === 'empty' ? [] : d.comments
  const query = q.trim().toLowerCase()
  const list = all.filter((c) =>
    (!query || (c.text + ' ' + c.nick).toLowerCase().includes(query)) &&
    (filter === 'all' || (filter === 'new' && c.fresh && !c.hidden) ||
      (filter === 'needs' && !c.reply && !c.hidden) || (filter === 'hidden' && c.hidden)),
  )
  const groups = d.posts.filter((p) => list.some((c) => c.postId === p.id))
  return (
    <main>
      <PageHeader title={t('Mga komento', 'Comments')} tabs={<ContentTabs />} />
      <div className="space-y-4 px-4 md:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div role="tablist" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {filters.map(([f, l]) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setParams({ f }, { replace: true })} className={cn('min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 font-display text-[15px] font-medium', filter === f ? 'bg-brown text-cream dark:bg-cream dark:text-brown' : 'bg-sunken text-fg-2 dark:bg-elevated')}>
                {l}
              </button>
            ))}
          </div>
          <label className="relative lg:ml-auto lg:w-72">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Hanapin sa komento', 'Search comments')} aria-label={t('Hanapin sa komento', 'Search comments')} className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[16px] outline-none focus:border-primary" />
          </label>
        </div>
        {groups.length === 0 ? (
          <Card>
            <StateBlock pose="celebrating" title={t('Walang komento dito', 'No comments here')} body={t('Lalabas dito ang mga komentong tumutugma.', 'Matching comments will appear here.')} />
          </Card>
        ) : (
          groups.map((p) => (
            <Card key={p.id} className="p-0 md:p-0">
              <div className="flex items-center gap-3 border-b border-line p-4">
                {p.media[0] && <BusinessAssetImage src={p.media[0]} alt="" className="h-12 w-12 rounded-[12px] object-cover" />}
                <p className="line-clamp-2 flex-1 font-display text-[15px] font-semibold">{p.title ?? p.text}</p>
                <Pill>{list.filter((c) => c.postId === p.id).length}</Pill>
              </div>
              <ul className="divide-y divide-line">
                {list
                  .filter((c) => c.postId === p.id)
                  .map((c) => (
                    <CommentRow key={c.id} c={c} focus={focus === c.id} />
                  ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </main>
  )
}
