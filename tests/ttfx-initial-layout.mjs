import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const viewport = {
    width: Number(process.env.WIDTH ?? 1440),
    height: Number(process.env.HEIGHT ?? 900),
  }
  for (const settings of [
    { vertical: 50, scale: 1 },
    { vertical: 35, scale: 0.7 },
  ]) {
    const page = await browser.newPage({ viewport })
    await page.addInitScript(
      (settings) =>
        localStorage.setItem(
          'omarchy-ttfx-settings-v1',
          JSON.stringify({ ...settings, speed: 1, audio: true }),
        ),
      settings,
    )
    await page.goto('http://127.0.0.1:3113/?tools=true')
    await page.waitForFunction(
      () =>
        document.querySelector('[data-ttfx-canvas]')?.dataset
          .catalogComplete === 'true',
    )
    const initial = await page
      .locator('[data-hero-wordmark]')
      .evaluate((slot) => {
        const rect = slot.getBoundingClientRect(),
          host = document
            .querySelector('[data-ttfx-canvas]')
            .parentElement.getBoundingClientRect()
        return {
          top: rect.top - host.top,
          left: rect.left - host.left,
          height: rect.height,
          width: rect.width,
          hostHeight: host.height,
        }
      })
    assert.ok(
      Math.abs(
        initial.top +
          initial.height / 2 -
          (initial.hostHeight * settings.vertical) / 100,
      ) < 1,
      `Initial logo must use saved vertical position: ${JSON.stringify(initial)}`,
    )
    assert.ok(
      Math.abs(
        initial.width -
          Math.min((viewport.width - 48) * 0.88, 896) * settings.scale,
      ) < 1,
      'Initial logo must use saved size',
    )
    await page.getByLabel('TTFX effect', { exact: true }).selectOption('beams')
    const animated = await page
      .locator('[data-ttfx-canvas]')
      .evaluate((canvas) => ({
        top: Number(canvas.dataset.wordmarkTop),
        height: Number(canvas.dataset.wordmarkHeight),
        width: Number(canvas.dataset.cellWidth) * 81,
      }))
    assert.ok(
      Math.abs(initial.top - animated.top) < 1,
      'No vertical jump at handoff',
    )
    assert.ok(
      Math.abs(initial.height - animated.height) < 1,
      'No height jump at handoff',
    )
    assert.ok(
      Math.abs(initial.width - animated.width) < 1,
      'No width jump at handoff',
    )
    console.log({ settings, initial, animated })
    await page.close()
  }
  console.log(
    'PASS: initial wordmark and animated wordmark share saved position and size',
  )
} finally {
  await browser.close()
}
