import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 700 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((s) => /\/ttfx_audio\.js(?:\?|$)/.test(s))
    const { Session } = await import(url)
    const step = Session.prototype.step
    const done = new WeakSet()
    window.sessionStarts = 0
    Session.prototype.step = function () {
      if (done.has(this)) return false
      if (this.height() > 27) window.sessionStarts++
      for (let i = 0; i < 100000; i++) {
        if (!step.call(this)) {
          done.add(this)
          return false
        }
      }
      throw new Error('Effect did not complete')
    }
  })
  for (const effect of ['middleout', 'slide']) {
    await page.getByLabel('TTFX effect', { exact: true }).selectOption(effect)
    await page.waitForTimeout(100)
    const before = await page.evaluate(() => ({
      starts: window.sessionStarts,
      at: performance.now(),
    }))
    await page.waitForTimeout(2400)
    assert.equal(
      await page.evaluate(() => window.sessionStarts),
      before.starts,
      `${effect} must hold its completed frame instead of restarting immediately`,
    )
    await page.waitForFunction(
      (starts) => window.sessionStarts > starts,
      before.starts,
      { timeout: 2000 },
    )
    const elapsed = await page.evaluate(
      (at) => performance.now() - at,
      before.at,
    )
    assert.ok(
      elapsed >= 2800 && elapsed < 4500,
      `${effect}: dwell was ${elapsed}ms`,
    )
    console.log(
      `${effect}: completed frame held; next cycle after ${Math.round(elapsed)}ms`,
    )
  }
} finally {
  await browser.close()
}
