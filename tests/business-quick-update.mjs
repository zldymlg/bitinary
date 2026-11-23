import assert from 'node:assert/strict'
import { activeQuickUpdate, normalizeQuickUpdate } from '../src/biz/quickUpdateState.ts'

const update = {
  status: 'closed',
  sold_out: false,
  long_queue: false,
  special: '  Soup  ',
  expires_at: '2026-11-24T16:00:00.000Z',
}

assert.equal(activeQuickUpdate(update, Date.parse('2026-11-24T15:59:59Z')), update)
assert.equal(activeQuickUpdate(update, Date.parse('2026-11-24T16:00:00Z')), null)
assert.equal(activeQuickUpdate(null, Date.parse('2026-11-24T15:59:59Z')), null)
assert.deepEqual(normalizeQuickUpdate(update), {
  status: 'closed', sold_out: false, long_queue: false, special: 'Soup',
})
assert.throws(() => normalizeQuickUpdate({ ...update, special: 'x'.repeat(161) }))
console.log('Business Quick Update checks passed')
