import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
assert.equal(new URL(url).hostname, '127.0.0.1', 'Use an isolated local Supabase stack')
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(url, process.env.TEST_SERVICE_KEY)
const base = 'http://localhost:3000'
function unwrap({ data, error }) {
  if (error) throw error
  return data
}
const home = randomUUID()
const listId = randomUUID()
await admin.from('households').insert({ id: home }).then(unwrap)
await admin
  .from('lists')
  .insert({ id: listId, household_id: home, name: 'קניות שבועיות', type: 'supermarket' })
  .then(unwrap)
const browser = await chromium.launch()
try {
  async function member() {
    const email = randomUUID() + '@example.test'
    const password = randomUUID()
    const { user } = unwrap(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    await admin.from('users').insert({ id: user.id, email, household_id: home }).then(unwrap)
    const context = await browser.newContext({
      viewport: { width: 375, height: 750 },
      reducedMotion: 'reduce',
    })
    const cookies = new Map()
    const memberClient = createServerClient(url, anon, {
      cookies: {
        getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
      },
    })
    unwrap(await memberClient.auth.signInWithPassword({ email, password }))
    await context.addCookies(Array.from(cookies, ([name, value]) => ({ name, value, url: base })))
    const page = await context.newPage()
    const subscribed = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Subscribed to items in list'),
    })
    await page.goto(base + '/lists/' + listId)
    await page.getByRole('button', { name: 'הוסף מטקסט' }).waitFor()
    await subscribed
    return { page, memberClient, user }
  }
  const [a, b] = await Promise.all([member(), member()])
  const preview = Array.from({ length: 25 }, (_, i) => ({
    name: i === 0 ? 'מלפפונים' : i === 1 ? 'Oatly Barista 3%' : 'מוצר ' + i,
    qty: i === 0 ? '6 יחידות' : null,
    sectionId: i === 0 ? 'produce' : 'milk',
    selected: i < 2,
    negated: i >= 2,
    repeated: false,
    existing: null,
  }))
  // The live Anthropic corpus has a separate evaluation. All writes and realtime traffic here use Supabase.
  await a.page.route('**/api/items/preview', (route) => route.fulfill({ json: { items: preview } }))
  const open = a.page.getByRole('button', { name: 'הוסף מטקסט' })
  await open.focus()
  await a.page.keyboard.press('Enter')
  const input = a.page.getByRole('textbox')
  assert.equal(await input.evaluate((el) => el === document.activeElement), true)
  await a.page.keyboard.press('Escape')
  assert.equal(await open.evaluate((el) => el === document.activeElement), true)
  await open.click()
  await input.fill(preview.map((i) => i.name).join('\n'))
  await a.page.getByRole('button', { name: 'פענח רשימה' }).click()
  const save = a.page.getByRole('button', { name: 'הוסף 2 פריטים' })
  await save.waitFor()
  await a.page.setViewportSize({ width: 375, height: 470 })
  const dialog = a.page.getByRole('dialog')
  assert.equal(await dialog.evaluate((el) => getComputedStyle(el).direction), 'rtl')
  assert.equal(await dialog.evaluate((el) => getComputedStyle(el).animationName), 'none')
  assert.equal(
    await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  )
  const box = await save.boundingBox()
  assert.ok(box && box.y >= 0 && box.y + box.height <= 471)
  await a.page.screenshot({
    path: join(process.env.RUNNER_TEMP ?? tmpdir(), 'shopping-import-review.png'),
  })
  await b.memberClient
    .from('items')
    .insert({
      list_id: listId,
      created_by_user_id: b.user.id,
      name: 'מלפפונים',
      section_id: 'produce',
    })
    .then(unwrap)
  await save.click()
  await dialog.getByText(/הרשימה עודכנה/).waitFor()
  assert.equal(await dialog.getByRole('checkbox', { name: 'הוסף מלפפונים' }).isChecked(), false)
  const calls = []
  await a.page.route('**/api/items/import', async (route) => {
    calls.push(route.request().postDataJSON().operationId)
    const response = await route.fetch()
    assert.equal(response.status(), 200)
    if (calls.length === 1) await route.abort()
    else await route.fulfill({ response })
  })
  const confirm = dialog.getByRole('button', { name: 'הוסף פריט אחד' })
  await confirm.click()
  await dialog.getByText(/לא הצלחנו לאמת/).waitFor()
  await confirm.click()
  await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual(calls, [calls[0], calls[0]])
  const badge = (page) => page.getByText('נוסף מטקסט', { exact: true })
  await Promise.all([badge(a.page).waitFor(), badge(b.page).waitFor()])
  await a.page.screenshot({
    path: join(process.env.RUNNER_TEMP ?? tmpdir(), 'shopping-import-saved.png'),
  })
  await b.page.getByText('Oatly Barista 3%', { exact: true }).click()
  await badge(a.page).waitFor({ state: 'hidden' })
  await a.page.reload()
  await a.page.getByText('Oatly Barista 3%', { exact: true }).waitFor()
  assert.equal(await badge(a.page).count(), 0)
  await a.page.getByText('Oatly Barista 3%', { exact: true }).click()
  await badge(b.page).waitFor()
  await b.page.reload()
  await badge(b.page).waitFor()
  const saved = unwrap(
    await b.memberClient.from('items').select('entry_source').eq('list_id', listId),
  )
  assert.deepEqual(saved.map((i) => i.entry_source).sort(), ['manual', 'text'])
  console.log(
    'Verified shared import, conflict, lost response, retry, tick, undo and reload at 375px.',
  )
} finally {
  await browser.close()
}
