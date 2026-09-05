import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(() => document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')?.width > 300)
  await page.waitForTimeout(500)
  await page.mouse.click(20, 600)
  await page.locator('[data-radio-player]').waitFor()
  await page.waitForTimeout(500)
  for (const width of [1000, 850, 768, 640, 639, 390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(250)
    const result = await page.evaluate(() => {
      const player = document.querySelector('[data-radio-player]')
      const rect = player.getBoundingClientRect()
      const ghost = document.querySelector('[data-radio-ghost]').getBoundingClientRect()
      const collisions = [...document.querySelectorAll('header a, header button')].filter(el => !player.contains(el)).filter(el => {
        const r = el.getBoundingClientRect()
        return r.width && r.height && r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top
      }).map(el => el.getAttribute('aria-label') || el.textContent.trim())
      return { width: rect.width, left: rect.left, right: rect.right, ghostDelta: Math.abs(ghost.left - rect.left) + Math.abs(ghost.width - rect.width) + Math.abs(ghost.top - rect.top), collisions, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    console.log(width, result)
    assert.deepEqual(result.collisions, [], `Player overlaps header controls at ${width}px`)
    assert(result.width >= 110 && result.left >= 0 && result.right <= width)
    assert(result.ghostDelta < 1, 'Paint and hit targets must stay aligned')
    assert(!result.overflow)
  }
} finally { await browser.close() }
