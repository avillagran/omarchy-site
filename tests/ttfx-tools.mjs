import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const open = async (query) => {
    await page.goto(`http://127.0.0.1:3113/${query}`)
    await page.waitForFunction(
      () =>
        document.querySelector('[data-ttfx-canvas]')?.dataset
          .catalogComplete === 'true',
    )
  }
  for (const query of ['', '?tools=false']) {
    await open(query)
    assert.equal(
      await page.getByLabel('TTFX effect', { exact: true }).count(),
      0,
      `Tools must be absent at ${query || '/'}`,
    )
    await page.mouse.click(20, 600)
    assert.equal(await page.locator('[data-radio-player]').count(), 0)
  }
  await open('?tools=true')
  assert.equal(await page.getByText('fx:', { exact: true }).count(), 1)
  await page.mouse.click(20, 600)
  await page.locator('[data-radio-player]').waitFor()
  await page.evaluate(() => {
    window.effectChanges = 0
    window.addEventListener(
      'omarchy:ttfx-effect-change',
      () => window.effectChanges++,
    )
  })
  await page.getByText('Text settings', { exact: true }).click()
  await page.getByLabel('Vertical position', { exact: true }).click()
  await page.getByText('fx:', { exact: true }).click()
  assert.equal(
    await page.evaluate(() => window.effectChanges),
    0,
    'Tool gestures must not cycle the background',
  )
  const ghost = page.locator('[data-radio-ghost]')
  assert.equal(await ghost.count(), 1)
  assert.equal(
    await ghost.evaluate((el) => el.closest('[data-nav-ghost]') !== null),
    true,
    'Player paint must share the header-letter stacking context',
  )
  assert.equal(await ghost.getAttribute('inert'), '')
  await page.mouse.move(20, 600)
  await page.waitForFunction(
    () => document.querySelector('header [data-nav-blend]') !== null,
  )
  assert.equal(
    await page
      .locator('[data-radio-player]')
      .evaluate((el) => getComputedStyle(el).opacity),
    '0',
    'Solid player must stand aside while the blended header letters paint',
  )
  await page.locator('[data-radio-player] button').first().click()
  assert.equal(
    await page.evaluate(() => window.effectChanges),
    0,
    'Player gestures must not cycle the background',
  )
  console.log(
    'PASS: query-gated tools/player, fx label, isolated gestures, shared header paint layer',
  )
} finally {
  await browser.close()
}
