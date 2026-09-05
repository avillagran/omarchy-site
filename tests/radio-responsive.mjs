import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(
    () => document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')?.width > 300,
  )
  await page.mouse.click(20, 600)
  await page.waitForTimeout(400)
  for (const width of [1440, 1000, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(100)
    const result = await page.evaluate(() => ({
      player: document.querySelector('[data-radio-player]'),
      ghost: document.querySelector('[data-radio-ghost]'),
    }))
    console.log(width, result)
    assert.equal(result.player, null, 'The radio player must not render in the header')
    assert.equal(result.ghost, null, 'The header ghost must not reserve a radio player layer')
  }
} finally {
  await browser.close()
}
