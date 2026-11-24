import assert from 'node:assert/strict'
import { restoreJimbotConversation } from '../src/lib/jimbotConversation.ts'

const welcome = { id: 'welcome', role: 'bot', expression: 'waving', text: 'Hi' }
const rows = [
  { id: 'u1', role: 'user', content: 'Plan a day in Cebu', intent: 'user', payload: null },
  { id: 'b1', role: 'bot', content: 'Here is a plan', intent: 'plan', payload: {
    itineraryDraft: { title: 'Cebu day', area: 'Cebu City', days: [] },
    places: [{ businessId: 'biz-1', reason: 'Nearby' }],
    budget: { currency: 'PHP', total: 1000 },
    map: { businessIds: ['biz-1'] },
  } },
  { id: 'u2', role: 'user', content: 'Make it cheaper', intent: 'user', payload: null },
  { id: 'b2', role: 'bot', content: 'Try again later', intent: 'offline', payload: null },
  { id: 'f1', role: 'user', content: 'Feedback', intent: 'feedback_down', payload: null },
]
const restored = restoreJimbotConversation(rows, welcome, 'Try again later')

assert.equal(restored.messages[0], welcome)
assert.deepEqual(restored.planningContext, {
  itineraryDraft: { title: 'Cebu day', area: 'Cebu City', days: [] },
  places: [{ businessId: 'biz-1', reason: 'Nearby' }],
  budget: { currency: 'PHP', total: 1000 },
  map: { businessIds: ['biz-1'] },
})
assert.equal(restored.messages.at(-1).retryText, 'Make it cheaper')
assert.equal(restored.messages.some((message) => message.id === 'f1'), false)
const unanswered = restoreJimbotConversation(rows.slice(0, 1), welcome, 'Try again later')
assert.equal(unanswered.messages.at(-1).text, 'Try again later')
assert.equal(unanswered.messages.at(-1).retryText, 'Plan a day in Cebu')
console.log('Jimbot conversation restoration checks passed')
