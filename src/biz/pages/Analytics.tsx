import { Star, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { getForcedState } from '@/lib/forced'
import { Card, StateBlock } from '../ui'
import { PageHeader } from '../ui'
import { useBizStats } from '../statsService'
import { useBiz } from '../store'
import { LineChart, Stars } from '../charts'
import { num } from '../format'
import { StatsTabs, sum } from './Overview'

type RangeDays = '7' | '30'

function Skeleton({ h = 220 }: { h?: number }) {
  return <div className="skeleton rounded-[20px]" style={{ height: h }} />
}

function utcShortDay(date: string, lang: 'en' | 'tl') {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(lang === 'tl' ? 'fil-PH' : 'en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function Analytics() {
  const { t, lang, status, verified, d } = useBiz()
  const available = d.business.live && verified
  const dbStats = useBizStats({ businessId: d.business.id, live: available })
  const [rangeDays, setRangeDays] = useState<RangeDays>('7')
  const forced = getForcedState()
  const days = Number(rangeDays) as 7 | 30
  const windowData = dbStats.dailyViews.slice(-days)
  const values = windowData.map((point) => point.views)
  const labels = windowData.map((point) => utcShortDay(point.date, lang))
  const rangeText = `${labels[0] ?? ''} – ${labels[labels.length - 1] ?? ''} UTC`
  const totalViews = sum(values)
  const hasData = dbStats.dailyViews.some((point) => point.views > 0) || dbStats.reviewCount > 0

  const header = <PageHeader title={t('Analitika', 'Analytics')} phase="P2" tabs={<StatsTabs />} />

  if (status === 'draft' || !available || forced === 'nodata')
    return (
      <main>
        {header}
        <div className="px-4 md:px-8">
          <Card>
            <StateBlock
              pose="idea"
              title={t('Kulang pa ang data', 'Not enough data yet')}
              body={t('Lalabas dito ang profile views at review summary kapag live at verified na ang negosyo mo.', 'Profile views and review summaries appear here once your business is live and verified.')}
            />
          </Card>
        </div>
      </main>
    )

  if (forced === 'error' || dbStats.error)
    return (
      <main>
        {header}
        <div className="px-4 md:px-8">
          <Card>
            <StateBlock
              pose="unsure"
              title={t('Hindi ma-load ang analitika', "Couldn't load analytics")}
              body={t('Subukan ulit. Naka-save pa rin ang lahat ng data mo.', 'Please try again. Your saved data is safe.')}
              action={t('Subukan ulit', 'Retry')}
              onAction={dbStats.refresh}
            />
          </Card>
        </div>
      </main>
    )

  return (
    <main>
      {header}
      <div className="space-y-4 px-4 md:px-8">
        {forced === 'loading' || dbStats.loading ? (
          <div className="grid gap-4 xl:grid-cols-3" aria-busy="true" aria-label={t('Nilo-load ang analytics', 'Loading analytics')}>
            <div className="xl:col-span-2"><Skeleton h={320} /></div>
            <Skeleton h={320} />
          </div>
        ) : !hasData ? (
          <Card>
            <StateBlock
              pose="idea"
              title={t('Wala pang analytics data', 'No analytics data yet')}
              body={t('Wala pang profile views sa huling 30 araw o nakikitang review.', 'There are no profile views in the last 30 days or visible reviews yet.')}
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented<RangeDays>
                label={t('Saklaw', 'Range')}
                value={rangeDays}
                onChange={setRangeDays}
                options={[
                  { value: '7', label: t('7 araw', '7 days') },
                  { value: '30', label: t('30 araw', '30 days') },
                ]}
              />
              <span className="rounded-full bg-surface px-4 py-2 font-display text-[14px] font-medium shadow-card">{rangeText}</span>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card
                className="xl:col-span-2"
                title={t('Profile views', 'Profile views')}
                icon={<TrendingUp size={20} />}
                sub={t('Natatanging traveler account bawat UTC day', 'Unique traveler accounts per UTC day')}
              >
                <strong className="mb-3 block font-display text-[30px]">{num(totalViews)}</strong>
                <LineChart
                  data={values}
                  labels={labels}
                  format={num}
                  ariaLabel={`${t('Profile views per UTC day', 'Profile views per UTC day')}, ${days} ${t('araw', 'days')}`}
                />
                <details className="mt-4 rounded-[14px] border border-line p-3">
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t('Tingnan ang daily data', 'View daily data')}</summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[14px]">
                      <caption className="sr-only">{t('Profile views bawat UTC day', 'Profile views by UTC day')}</caption>
                      <thead>
                        <tr className="border-b border-line text-fg-2">
                          <th scope="col" className="py-2 font-medium">{t('Petsa (UTC)', 'Date (UTC)')}</th>
                          <th scope="col" className="py-2 text-right font-medium">{t('Profile views', 'Profile views')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {windowData.map((point) => (
                          <tr key={point.date} className="border-b border-line last:border-0">
                            <th scope="row" className="py-2 font-medium">{point.date}</th>
                            <td className="py-2 text-right tabular-nums">{num(point.views)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Card>

              <Card title={t('Review summary', 'Review summary')} icon={<Star size={20} />}>
                {dbStats.reviewCount ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-[34px] font-bold">{dbStats.ratingAll?.toFixed(1) ?? '—'}</span>
                      {dbStats.ratingAll != null && <Stars value={dbStats.ratingAll} />}
                    </div>
                    <p className="mt-2 text-[14px] text-fg-2">
                      {num(dbStats.reviewCount)} {t('nakikitang review', 'visible reviews')}
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] text-fg-2">{t('Wala pang nakikitang review.', 'No visible reviews yet.')}</p>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
