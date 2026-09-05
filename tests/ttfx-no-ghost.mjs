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
  await page.waitForTimeout(500)
  await page.getByLabel('TTFX effect', { exact: true }).selectOption('beams')
  await page.waitForFunction(
    () =>
      document.querySelector('canvas[data-ttfx-active]')?.dataset.ttfxActive ===
      'true',
  )
  const slot = await page.locator('[data-hero-wordmark]').boundingBox()
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2)
  await page.waitForTimeout(700)
  const result = await page.evaluate(async () => {
    const { WORDMARK_ROWS, WORDMARK_WIDTH, WORDMARK_HEIGHT } =
      await import('/src/data/wordmark-bitmap.ts')
    const canvas = document.querySelector('canvas[data-ttfx-active]')
    const box = canvas.getBoundingClientRect(),
      slot = document
        .querySelector('[data-hero-wordmark]')
        .getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const colors = new Set()
    let lit = 0,
      sampled = 0
    // Wordmark cells under the pointer must become ordinary responsive field cells.
    for (let r = 5; r < 14; r++)
      for (let c = 34; c < 47; c++) {
        if (WORDMARK_ROWS[r][c] !== '1') continue
        const x = Math.round(
          ((slot.left - box.left + ((c + 0.5) * slot.width) / WORDMARK_WIDTH) *
            canvas.width) /
            box.width,
        )
        const y = Math.round(
          ((slot.top - box.top + ((r + 0.5) * slot.height) / WORDMARK_HEIGHT) *
            canvas.height) /
            box.height,
        )
        const rgb = [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3)
        colors.add(rgb.join(','))
        const bg = getComputedStyle(
          document.querySelector('[data-hero-sentinel]'),
        )
          .backgroundColor.match(/\d+/g)
          .slice(0, 3)
          .map(Number)
        if (rgb.some((v, i) => v !== bg[i])) lit++
        sampled++
      }
    return { lit, sampled, colors: [...colors] }
  })
  console.log(result)
  assert.ok(
    result.lit > 5,
    'The old logo must not leave a dark cutout in the responsive field',
  )
  console.log(
    'PASS: old wordmark cells respond to the field instead of leaving a black silhouette',
  )
} finally {
  await browser.close()
}
