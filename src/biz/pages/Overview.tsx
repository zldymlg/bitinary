import { ChevronRight, Eye, MessageCircle, Star, Zap } from 'lucide-react'
import { Link, useOutletContext } from 'react-router'
import { Button } from '@/components/ui/Button'
import { isBizPreview } from '@/lib/forced'
import type { BizShellContext } from '../Shell'
import { useBizStats } from '../statsService'
import { useBiz } from '../store'
import { BizStatusChip, Card, PageHeader, SubTabs } from '../ui'

export function StatsTabs() {
  const { t } = useBiz()
  return (
    <SubTabs label={t('Negosyo', 'Business workspace')} items={[
      { to: '/biz/stats', label: t('Pangkalahatan', 'Overview'), exact: true },
      { to: '/biz/stats/analytics', label: t('Analitika', 'Analytics') },
      { to: '/biz/stats/backgrounds', label: t('Profile ng negosyo', 'Business Profile') },
    ]} />
  )
}

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function Overview() {
  const { d, t, status } = useBiz()
  const { openQuickUpdate } = useOutletContext<BizShellContext>()
  const available = status === 'verified' && !!d.business.id && !isBizPreview()
  const stats = useBizStats({ businessId: d.business.id, live: available })
  const reviewReplies = d.reviews.filter((review) => !review.hidden && !review.reply).length
  const commentReplies = d.comments.filter((comment) => !comment.hidden && !comment.reply).length
  const profile = '/biz/stats/backgrounds'
  const setup = {
    draft: {
      title: t('Kumpletuhin ang setup', 'Finish business setup'),
      detail: t('Idagdag ang pangunahing impormasyon, lokasyon, oras, at contact.', 'Add your business details, location, hours, and contact information.'),
      action: t('Ituloy ang setup', 'Continue setup'),
    },
    live: {
      title: t('Ipa-verify ang negosyo', 'Verify your business'),
      detail: t('Mag-submit ng mga dokumento para mailathala ang profile sa mga biyahero.', 'Submit your documents to make your profile visible to travelers.'),
      action: t('Simulan ang verification', 'Start verification'),
    },
    pending: {
      title: t('Sinusuri ang verification', 'Verification pending'),
      detail: t('Nasa pagsusuri ang mga dokumento mo.', 'Your documents are under review.'),
      action: t('Tingnan ang status', 'View status'),
    },
    'needs-docs': {
      title: t('Kailangan ng dagdag na dokumento', 'More documents needed'),
      detail: t('Tingnan ang desisyon at i-update ang mga dokumento.', 'Review the decision and update your documents.'),
      action: t('Tingnan ang mga dokumento', 'View documents'),
    },
    verified: null,
  }[status]
  const views = sum(stats.dailyViews?.slice(-7).map((point) => point.views) ?? [])
  const metrics = [
    { key: 'views', label: t('Views ng profile', 'Profile views'), value: views.toLocaleString(), detail: t('Huling 7 araw · UTC', 'Last 7 days · UTC') },
    { key: 'rating', label: t('Average na rating', 'Average rating'), value: stats.ratingAll == null ? '—' : stats.ratingAll.toFixed(1), detail: t('Mga nakikitang review', 'Visible reviews') },
    { key: 'reviews', label: t('Mga review', 'Reviews'), value: stats.reviewCount.toLocaleString(), detail: t('Lahat ng nakikitang review', 'All visible reviews') },
  ]

  return (
    <main className="mx-auto max-w-[1180px]">
      <PageHeader title={t('Pangkalahatan', 'Overview')} sub={d.business.name || t('Negosyo mo', 'Your business')} actions={<BizStatusChip status={status} />} tabs={<StatsTabs />} />
      <div className="space-y-4 px-4 pb-5 md:px-8">
        {setup && (
          <Card title={setup.title} sub={setup.detail}>
            <Link to={status === 'draft' ? '/biz/setup' : profile + '#verify'} className="inline-flex min-h-11 items-center gap-1 font-semibold text-link">
              {setup.action}<ChevronRight size={17} aria-hidden />
            </Link>
          </Card>
        )}
        {available && (
          <Card title={t('Mabilis na Update', 'Quick Update')} icon={<Zap size={20} />} sub={t(
            'Ibahagi ang pansamantalang status o espesyal ngayong araw.',
            'Share a temporary status or today’s special on your public profile.',
          )}>
            <Button icon={<Zap size={17} />} onClick={openQuickUpdate}>{t('Mag-post ng update', 'Post an update')}</Button>
          </Card>
        )}
        {(reviewReplies > 0 || commentReplies > 0) && (
          <Card title={t('Kailangang sagutin', 'Needs a reply')}>
            <ul className="divide-y divide-line">
              {reviewReplies > 0 && <AttentionLink to="/biz/content/reviews?f=needs" label={t('Mga review', 'Reviews')} count={reviewReplies} icon={<Star size={18} aria-hidden />} />}
              {commentReplies > 0 && <AttentionLink to="/biz/content/comments?f=needs" label={t('Mga komento', 'Comments')} count={commentReplies} icon={<MessageCircle size={18} aria-hidden />} />}
            </ul>
          </Card>
        )}
        <Card title={t('Aktibidad ng profile', 'Profile activity')} icon={<Eye size={20} />}
          action={available ? <Link className="inline-flex min-h-11 items-center font-semibold text-link" to="/biz/stats/analytics">{t('Tingnan ang analitika', 'View analytics')}</Link> : undefined}>
          {!available ? (
            <p className="text-fg-2">{t('Lalabas ang analytics kapag live at verified na ang profile.', 'Analytics is available when your profile is live and verified.')}</p>
          ) : stats.loading ? (
            <p role="status" className="text-fg-2">{t('Nilo-load ang aktibidad…', 'Loading activity…')}</p>
          ) : stats.error ? (
            <div role="alert" className="space-y-2 text-danger">
              <p>{t('Hindi ma-load ang aktibidad.', 'Could not load activity.')}</p>
              <Button variant="secondary" onClick={stats.refresh}>{t('Subukan ulit', 'Retry')}</Button>
            </div>
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                {metrics.map(({ key, label, value, detail }) => (
                  <div key={key} className="rounded-xl bg-sunken p-3 dark:bg-elevated">
                    <dt className="text-sm text-fg-2">{label}</dt>
                    <dd className="font-display text-[27px] font-semibold tabular-nums">{value}</dd>
                    <dd className="text-xs text-fg-2">{detail}</dd>
                  </div>
                ))}
              </dl>
              {views === 0 && stats.reviewCount === 0 && <p className="mt-3 text-sm text-fg-2">{t('Wala pang naitalang aktibidad.', 'No recorded activity yet.')}</p>}
            </>
          )}
        </Card>
      </div>
    </main>
  )
}

function AttentionLink({ to, label, count, icon }: { to: string; label: string; count: number; icon: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex min-h-12 items-center gap-2 px-1 font-medium hover:text-link">
        {icon}<span className="flex-1">{label}</span><span className="tabular-nums">{count}</span><ChevronRight size={17} aria-hidden />
      </Link>
    </li>
  )
}
