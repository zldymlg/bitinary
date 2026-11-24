import assert from 'node:assert/strict'
import { quickReply, standaloneSearch, searchTermsMatch } from '../../supabase/functions/jimbot/latency.ts'

assert.match(quickReply(' HELLO!!! ', 'en'), /Hi/)
assert.match(quickReply('salamat', 'tl'), /Walang anuman/)
assert.equal(quickReply('Hi, find me a cafe', 'en'), null)
assert.equal(standaloneSearch({ purpose: 'recommendation', area: 'Cebu City' }, 'Find cafes in Cebu City'), true)
assert.equal(standaloneSearch({ purpose: 'recommendation', area: 'Cebu City' }, 'Add a cafe to my plan'), false)
assert.equal(standaloneSearch({ purpose: 'planning', area: 'Cebu City' }, 'Find cafes'), false)
assert.equal(searchTermsMatch('budget seafood', 'Seafood cafe', 'Budget meals'), true)
assert.equal(searchTermsMatch('budget seafood', 'Seafood cafe'), false)
console.log('jimbot latency paths: ok')
