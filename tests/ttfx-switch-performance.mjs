import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  const results = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((s) => /\/ttfx_audio\.js(?:\?|$)/.test(s))
    const { Session } = await import(url)
    const step = Session.prototype.step
    let steps = 0
    Session.prototype.step = function () {
      steps++
      return step.call(this)
    }
    const countAssets = () =>
      performance
        .getEntriesByType('resource')
        .filter((e) => e.name.includes('/ttfx-audio/')).length
    const assetsBefore = countAssets()
    const timings = []
    for (const effect of [
      'middleout',
      'slide',
      'laseretch',
      'thunderstorm',
      'middleout',
    ]) {
      steps = 0
      const start = performance.now()
      window.dispatchEvent(
        new CustomEvent('omarchy:ttfx-effect-change', { detail: { effect } }),
      )
      timings.push({ effect, steps, milliseconds: performance.now() - start })
    }
    return { timings, assetsBefore, assetsAfter: countAssets() }
  })
  console.log(JSON.stringify(results, null, 2))
  assert.equal(
    results.assetsAfter,
    results.assetsBefore,
    'Switching must reuse the loaded engine',
  )
  for (const result of results.timings)
    assert.ok(
      result.steps <= 1,
      `${result.effect}: must not play an entire calibration animation synchronously (${result.steps} steps)`,
    )
  console.log(
    'PASS: switches reuse loaded WASM and never run a calibration animation',
  )
} finally {
  await browser.close()
}
