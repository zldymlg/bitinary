import assert from 'node:assert/strict'
import { buildDailyViews } from '../src/biz/analyticsDates.ts'

const justAfterManilaMidnight = new Date('2026-11-24T00:15:00+08:00')
const rows = [
  { stat_date: '2026-10-24', views: 99 },
  { stat_date: '2026-10-25', views: 1 },
  { stat_date: '2026-11-22', views: 2 },
  { stat_date: '2026-11-23', views: 4 },
]

const week = buildDailyViews(rows, justAfterManilaMidnight, 7)
assert.equal(week.length, 7)
assert.equal(week[0].date, '2026-11-17')
assert.equal(week.at(-1).date, '2026-11-23')
assert.deepEqual(week.slice(-2).map(({ date, views }) => [date, views]), [
  ['2026-11-22', 2],
  ['2026-11-23', 4],
])

const month = buildDailyViews(rows, justAfterManilaMidnight, 30)
assert.equal(month.length, 30)
assert.equal(month[0].date, '2026-10-25')
assert.equal(month.at(-1).date, '2026-11-23')
assert.equal(month[0].views, 1)
assert.equal(month.find(({ date }) => date === '2026-10-24'), undefined)

process.stdout.write('business-analytics: ok\n')
