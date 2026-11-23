import { Clapperboard, FileText, Heart, MessageCircle, MoreHorizontal, PenLine, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IOSAlert } from '@/components/flow/IOSAlert'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { getForcedState, isBizPreview } from '@/lib/forced'
import { longDate, time12 } from '../format'
import type { Post } from '../seed'
import { useBiz } from '../store'
import { Card, PageHeader, Pill, StateBlock, SubTabs } from '../ui'
import { BusinessAssetImage } from '../ui/BusinessAssetImage'
import { deletePost } from '../db/posts'

export function ContentTabs() {
  const { t, d } = useBiz()
  return (
    <SubTabs
      label={t('Nilalaman at Social', 'Blog and Social')}
      items={[
        { to: '/biz/content', label: 'Posts' },
        { to: '/biz/content/comments', label: t('Mga Komento', 'Comments'), badge: d.comments.filter((c) => c.fresh && !c.reply && !c.hidden).length },
        { to: '/biz/content/reviews', label: t('Mga Review', 'Reviews'), badge: d.reviews.filter((r) => !r.hidden && !r.reply && !r.caseId).length },
      ]}
    />
  )
}

export function TypePill({ type }: { type: Post['type'] }) {
  return <Pill tone={type === 'reel' ? 'orange' : 'default'}>{type === 'reel' ? 'Reel' : type === 'blog' ? 'Blog' : 'Post'}</Pill>
}

function PostRow({ p, onDelete }: { p: Post; onDelete: () => void }) {
  const { t, lang } = useBiz()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  return (
    <li className="relative flex gap-3 p-3 md:gap-4 md:p-4">
      <button onClick={() => navigate(`/biz/content/edit/${p.id}`)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[14px] bg-sunken md:h-28 md:w-24" aria-label={t('I-edit', 'Edit')}>
        {p.media[0] && <BusinessAssetImage src={p.media[0]} alt="" className="h-full w-full object-cover" />}
        {p.type === 'reel' && <Clapperboard size={18} className="absolute bottom-1.5 left-1.5 text-white drop-shadow" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypePill type={p.type} />
          {p.status !== 'published' && <Pill>{t('Hindi pa nailalathala', 'Unpublished')}</Pill>}
        </div>
        <p className="mt-1 line-clamp-2 text-[16px] font-semibold leading-snug">{p.title ?? p.text}</p>
        {p.status === 'published' && (
          <>
            <p className="mt-0.5 text-[14px] text-fg-2">{longDate(p.at, lang)} · {time12(p.at)}</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-fg-2">
              <li className="flex items-center gap-1"><Heart size={15} /> {p.likes}</li>
              <li className="flex items-center gap-1"><MessageCircle size={15} /> {p.comments}</li>
            </ul>
          </>
        )}
      </div>
      <div className="relative">
        <button onClick={() => setMenu((m) => !m)} aria-label={t('Iba pa', 'More')} aria-expanded={menu} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-sunken">
          <MoreHorizontal size={20} />
        </button>
        {menu && (
          <div className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-[16px] bg-elevated shadow-float ring-1 ring-line">
            <button onClick={() => navigate(`/biz/content/edit/${p.id}`)} className="flex h-12 w-full items-center gap-2 px-4 text-left text-[15px] hover:bg-sunken">
              <PenLine size={17} /> {t('I-edit', 'Edit')}
            </button>
            <button onClick={() => (setMenu(false), onDelete())} className="flex h-12 w-full items-center gap-2 px-4 text-left text-[15px] text-danger hover:bg-danger-bg">
              <Trash2 size={17} /> {t('Burahin', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

type View = 'published' | 'unpublished'

export function Posts() {
  const { d, setLocal, t, showToast } = useBiz()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requestedView = params.get('v')
  const view: View = requestedView === 'unpublished' || requestedView === 'draft' || requestedView === 'scheduled'
    ? 'unpublished'
    : 'published'
  const [del, setDel] = useState<Post | null>(null)
  const [deleting, setDeleting] = useState(false)
  const posts = getForcedState() === 'empty' ? [] : d.posts
  const list = posts.filter((p) => view === 'published' ? p.status === 'published' : p.status !== 'published').sort((a, b) => +new Date(b.at) - +new Date(a.at))
  const views: [View, string, number][] = [
    ['published', t('Na-publish', 'Published'), posts.filter((p) => p.status === 'published').length],
    ['unpublished', t('Hindi pa nailalathala', 'Unpublished'), posts.filter((p) => p.status !== 'published').length],
  ]
  const deleteSelected = async () => {
    if (!del || deleting) return
    const post = del
    setDeleting(true)
    try {
      if (!isBizPreview()) {
        if (!d.business.id) throw new Error('Save the business profile before deleting posts.')
        const result = await deletePost(d.business.id, post.id)
        if (result.error) throw new Error(result.error)
      }
      await setLocal((x) => ({ ...x, posts: x.posts.filter((item) => item.id !== post.id) }))
      setDel(null)
      showToast({ text: t('Nabura ang post', 'Post deleted'), expression: 'pointing' })
    } catch (error) {
      showToast({
        text: error instanceof Error ? error.message : t('Hindi nabura ang post.', 'The post could not be deleted.'),
        expression: 'unsure',
      })
    } finally {
      setDeleting(false)
    }
  }
  return (
    <main>
      <PageHeader
        title={t('Nilalaman at Social', 'Blog and Social')}
        tabs={<ContentTabs />}
        actions={
          <>
            <Button icon={<Plus size={18} />} onClick={() => navigate('/biz/content/new?type=post')}>
              {t('Bagong post', 'New post')}
            </Button>
            <Button variant="secondary" icon={<Clapperboard size={18} />} onClick={() => navigate('/biz/content/new?type=reel')}>
              {t('Gumawa ng Reel', 'Create a Reel')}
            </Button>
            <Button variant="secondary" icon={<FileText size={18} />} onClick={() => navigate('/biz/content/new?type=blog')}>
              Blog
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 md:px-8">
        <div role="tablist" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {views.map(([v, l, n]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setParams({ v }, { replace: true })} className={cn('flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-display text-[15px] font-medium', view === v ? 'bg-brown text-cream dark:bg-cream dark:text-brown' : 'bg-sunken text-fg-2 dark:bg-elevated')}>
              {l}
              {n != null && <span className="text-[13px] opacity-75">{n}</span>}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <Card>
            <StateBlock pose="camera" placeholder title={t('Wala pang post dito', 'No posts here yet')} body={t('Ang unang post ay mas madali kaysa inaakala mo. Tutulungan ka ni Jimbot.', 'Your first post is easier than you think. Jimbot will help you write it.')} action={t('Gumawa ng post', 'Create a post')} onAction={() => navigate('/biz/content/new?type=post')} />
          </Card>
        ) : (
          <Card className="p-0 md:p-0">
            <ul className="divide-y divide-line">
              {list.map((p) => (
                <PostRow key={p.id} p={p} onDelete={() => setDel(p)} />
              ))}
            </ul>
          </Card>
        )}
      </div>
      <IOSAlert
        open={!!del}
        title={t('Burahin ang post?', 'Delete this post?')}
        message={t('Mawawala ito sa profile ng negosyo mo.', 'It will be removed from your business profile.')}
        actions={[
          { label: t('Kanselahin', 'Cancel'), onClick: () => setDel(null) },
          {
            label: t('Burahin', 'Delete'),
            destructive: true,
            bold: true,
            onClick: () => void deleteSelected(),
          },
        ]}
      />
    </main>
  )
}
