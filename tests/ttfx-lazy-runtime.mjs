import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('ttfx_audio')))
  assert.deepEqual(before, [], 'TTFX runtime must not compete with initial page load')

  await page.waitForFunction(() => document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')?.width > 300)
  await page.mouse.click(20, 600)
  await page.waitForFunction(() => document.querySelector('[data-ttfx-canvas]')?.dataset.engine === 'avillagran-ttfx-wasm', undefined, { timeout: 30_000 })
  const after = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.includes('ttfx_audio')))
  console.log({ before: before.length, after: after.length })
  assert(after.length >= 2)
} finally {
  await browser.close()
}
