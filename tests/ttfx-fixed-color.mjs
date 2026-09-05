import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(() => document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete === 'true')
  await page.getByLabel('TTFX effect', { exact: true }).selectOption('laseretch')
  await page.waitForTimeout(450)
  const result = await page.locator('[data-ttfx-canvas]').evaluate((canvas) => {
    const hex = canvas.dataset.fixedColorHighlight.slice(1)
    const highlight = [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    const ratios = []
    for (let i = 0; i < pixels.length; i += 4) {
      const color = [pixels[i], pixels[i + 1], pixels[i + 2]]
      if (pixels[i + 3] < 220 || color.reduce((sum, value) => sum + value, 0) < 150) continue
      const scale = color[1] / highlight[1]
      if (scale < 0.2 || scale > 1.05) continue
      ratios.push(Math.max(...color.map((value, index) => Math.abs(value - highlight[index] * scale))))
    }
    return { fixed: canvas.dataset.fixedColor, highlight, samples: ratios.length, maximumHueError: Math.max(...ratios) }
  })
  console.log(result)
  assert.equal(result.fixed, 'true')
  assert(result.samples > 50, 'Expected visible letter pixels')
  assert(result.maximumHueError < 4, 'Fixed colors must remain shades of the theme highlight')
} finally {
  await browser.close()
}
