// Start Vite with VITE_SUPABASE_URL=http://127.0.0.1:54321 and a fixture anon key.
// Run with node tests/business-playwright-smoke.mjs. No live database is used.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.BITINARY_URL ?? 'http://127.0.0.1:8444'
const owner = '10000000-0000-4000-8000-000000000001'
const id = '20000000-0000-4000-8000-000000000001'
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'owner@example.test', app_metadata: { provider: 'email' }, user_metadata: { role: 'business' } }
const session = { access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: 4102444800, token_type: 'bearer', user }
const business = {
  id, owner_id: owner, name: 'Fixture Bakery', live: true, verification_status: 'verified',
  address: '1 Test Street', city: 'Manila', specialties: [], languages: [],
  business_type: 'kainan', contact_name: '', mobile: '', landline: '', about: '',
}
const now = new Date().toISOString()
const post = {
  id: '40000000-0000-4000-8000-000000000001',
  business_id: id, post_type: 'post', body: 'Bakery news', status: 'published', media_urls: [],
  created_at: now, published_at: now, likes: 0, views: 0, saves: 0, comments_count: 1,
}
const comment = {
  id: '50000000-0000-4000-8000-000000000001',
  post_id: post.id, body: 'Do you have sourdough?', hidden: false, reply: null, created_at: now,
}
const review = {
  id: '60000000-0000-4000-8000-000000000001',
  business_id: id, body: 'Excellent bread', stars: 5, photo_urls: [], hidden: false, reply: null, created_at: now,
}
const browser = await chromium.launch()
let quickUpdate = null
let failWrite = false
let failRead = false
let failStats = false
let verification = null
let documentUploads = 0
const notification = {
  id: '30000000-0000-4000-8000-000000000001',
  kind: 'verification', title: 'Documents reviewed', body: 'Open your profile.',
  target: '/biz/stats/backgrounds#verify', read_at: null, created_at: new Date().toISOString(),
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(12_000)
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(base).origin) return route.continue()
    if (url.origin !== 'http://127.0.0.1:54321') return route.abort()
    const method = route.request().method()
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    const resource = url.pathname.split('/').at(-1)
    const object = route.request().headers().accept?.includes('vnd.pgrst.object')
    const one = (row) => route.fulfill({ json: object ? row : row ? [row] : [] })
    if (resource === 'businesses') return one(business)
    if (resource === 'profiles') return one({ id: owner, name: 'Fixture Owner', role: 'business' })
    if (resource === 'business_verifications') return one(verification ? { verification_data: verification } : null)
    if (url.pathname.startsWith('/storage/v1/object/business-verification/')) {
      documentUploads++
      return route.fulfill({ json: {} })
    }
    if (resource === 'submit_business_verification') {
      const submitted = route.request().postDataJSON()
      assert.equal(submitted.p_files.length, 2)
      assert.equal(submitted.p_verification.registrationType, 'sec')
      assert.equal(submitted.p_verification.dtiValidUntil, undefined)
      verification = { ...submitted.p_verification, status: 'pending', files: submitted.p_files }
      business.verification_status = 'pending'
      return route.fulfill({ json: verification })
    }
    if (resource === 'posts') return one(post)
    if (resource === 'comments' || resource === 'reviews') {
      const row = resource === 'comments' ? comment : review
      if (method === 'PATCH') Object.assign(row, route.request().postDataJSON())
      return one(row)
    }
    if (resource === 'get_business_review_summary') return one({ review_count: 2, average_rating: 4.5 })
    if (resource === 'notifications') {
      if (method === 'PATCH') notification.read_at = route.request().postDataJSON().read_at
      return one(notification)
    }
    if (resource === 'business_daily_stats') {
      if (failStats) return route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      return route.fulfill({ json: [{ stat_date: new Date().toISOString().slice(0, 10), views: 9 }] })
    }
    if (resource === 'business_quick_updates') {
      if ((failWrite && method === 'POST') || (failRead && method === 'GET')) return route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      if (method === 'POST') {
        quickUpdate = { ...route.request().postDataJSON(), expires_at: new Date(Date.now() + 86_400_000).toISOString() }
      }
      if (method === 'DELETE') {
        const deleted = quickUpdate
        quickUpdate = null
        return one(deleted ? { business_id: id } : null)
      }
      return one(quickUpdate)
    }
    return route.fulfill({ json: object ? null : [] })
  })
  await page.addInitScript(({ session }) => {
    if (window.self !== window.top) return
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
    localStorage.setItem('bitinary:biz-lang', JSON.stringify('en'))
    localStorage.setItem('bitinary:session', JSON.stringify({ kind: 'guest', role: 'traveler' }))
  }, { session })

  await page.goto(base + '/biz/stats?state=draft&embed=1')
  await page.getByRole('heading', { name: 'Overview' }).waitFor()
  await page.getByText('4.5', { exact: true }).waitFor()
  const launch = page.getByRole('button', { name: 'Post an update' })
  await launch.click()
  const dialog = page.getByRole('dialog', { name: 'Quick Update' })
  const publish = dialog.getByRole('button', { name: 'Publish update' })
  await dialog.getByRole('radio', { name: 'Closed' }).check()
  await dialog.getByRole('textbox').fill('Fresh bread')
  await publish.focus()
  await page.keyboard.press('Tab')
  await page.waitForFunction(() => document.querySelector('[role=dialog]')?.contains(document.activeElement))
  failWrite = true
  await publish.click()
  await dialog.getByRole('alert').waitFor()
  assert.equal(await dialog.getByRole('textbox').inputValue(), 'Fresh bread')
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), true)
  failWrite = false
  await publish.click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await launch.evaluate((el) => el === document.activeElement), true)
  assert.equal(quickUpdate.special, 'Fresh bread')

  await page.reload()
  await launch.click()
  await dialog.getByRole('button', { name: 'Clear update' }).waitFor()
  assert.equal(await dialog.getByRole('radio', { name: 'Closed' }).isChecked(), true)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await page.goto(base + '/shop/' + id + '?embed=1')
  await page.getByText('Fresh bread', { exact: false }).waitFor()
  failRead = true
  await page.reload()
  await page.getByRole('heading', { name: 'Fixture Bakery', exact: true }).waitFor()
  assert.equal(await page.getByText('Fresh bread', { exact: false }).count(), 0)
  failRead = false

  await page.goto(base + '/biz/account/boost')
  await page.waitForURL('**/biz/account')
  assert.equal(await page.getByText('Boosts', { exact: true }).count(), 0)
  await page.goto(base + '/biz/stats')
  await launch.click()
  await dialog.getByRole('button', { name: 'Clear update' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(quickUpdate, null)
  failStats = true
  await page.getByRole('link', { name: 'Analytics', exact: true }).click()
  await page.getByRole('heading', { name: 'Analytics', exact: true }).waitFor()
  const retry = page.getByRole('button', { name: 'Retry' })
  await retry.waitFor()
  failStats = false
  await retry.click()
  await page.getByText('4.5', { exact: true }).first().waitFor()
  await page.getByRole('tab', { name: '30 days' }).click()
  await page.getByText('View daily data', { exact: true }).click()
  await page.getByRole('table').waitFor()

  await page.getByRole('button', { name: 'Notifications' }).click()
  await page.getByRole('button', { name: /Documents reviewed/ }).click()
  await page.waitForURL('**/biz/stats/backgrounds#verify')
  assert.ok(notification.read_at, 'the read status was saved before navigating')

  await page.goto(base + '/biz/content/comments')
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await page.getByRole('textbox', { name: 'Reply' }).fill('Yes, it is baked daily.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await page.getByText('Yes, it is baked daily.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Hide', exact: true }).click()
  await page.getByRole('button', { name: 'Unhide' }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: 'Unhide' }).click()
  await page.getByRole('button', { name: 'Hide', exact: true }).waitFor()
  assert.equal(comment.reply, 'Yes, it is baked daily.')
  assert.equal(comment.hidden, false)

  await page.goto(base + '/biz/content/reviews/' + review.id)
  await page.getByRole('textbox', { name: 'Reply' }).fill('Thanks for the review!')
  await page.getByRole('button', { name: 'Publish reply' }).click()
  await page.getByRole('button', { name: 'Edit reply' }).waitFor()
  await page.reload()
  await page.getByText('Thanks for the review!', { exact: true }).first().waitFor()
  assert.equal(review.reply, 'Thanks for the review!')

  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(base + '/biz/stats?theme=dark&lang=tl')
    await page.getByRole('heading', { name: 'Pangkalahatan', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  }
  business.verification_status = 'none'
  await page.goto(base + '/biz/stats/backgrounds#verify')
  const documents = page.locator('#verify')
  await documents.getByLabel('Registration type').selectOption('sec')
  await documents.getByLabel('SEC registration number').fill('SEC-001')
  await documents.getByLabel('Registration date', { exact: true }).fill('2020-01-01')
  await documents.getByLabel('Permit number').fill('PERMIT-001')
  try {
    await documents.getByLabel('Issuing city or town').fill('Manila')
  } catch (error) {
    console.error(await page.locator('body').textContent())
    throw error
  }
  await documents.getByLabel('Issue date', { exact: true }).fill('2020-01-01')
  await documents.getByLabel('Permit valid until').fill('2099-01-01')
  const uploads = documents.locator('input[type=file]')
  await uploads.nth(0).setInputFiles({ name: 'registration.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-Fixture') })
  await uploads.nth(1).setInputFiles({ name: 'permit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-Fixture') })
  await documents.getByRole('button', { name: 'Submit for verification' }).click()
  await documents.getByText('In review', { exact: true }).waitFor()
  assert.equal(documentUploads, 2)

  const signedOut = await browser.newPage()
  await signedOut.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue()
    : route.abort())
  await signedOut.goto(base + '/biz/stats?embed=1&state=verified')
  await signedOut.waitForURL(/\/biz\/(language|welcome)$/)
  assert.equal(await signedOut.getByRole('button', { name: 'Post an update' }).count(), 0)
  console.log('Business browser smoke passed')
} finally {
  await browser.close()
}
