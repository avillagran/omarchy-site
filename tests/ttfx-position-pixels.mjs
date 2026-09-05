import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({
    viewport: {
      width: Number(process.env.WIDTH ?? 1440),
      height: Number(process.env.HEIGHT ?? 900),
    },
  })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  // Settle the real WASM effect deterministically, without replacing its output.
  await page.evaluate(async () => {
    const moduleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => /\/ttfx_audio\.js(?:\?|$)/.test(url))
    if (!moduleUrl) throw new Error('The live WASM module was not loaded')
    const { Session } = await import(moduleUrl)
    const fill = Session.prototype.fill
    Session.prototype.fill = function (symbols, fg, bg, flags) {
      fill.call(this, symbols, fg, bg, flags)
      const width = this.width()
      const blocks = Array.from(symbols).flatMap((s, i) =>
        s === 9608 ? [Math.floor(i / width)] : [],
      )
      window.lastFrame = {
        width,
        height: this.height(),
        blocks: [Math.min(...blocks), Math.max(...blocks)],
        count: blocks.length,
        background: Array.from(new Set(bg)).slice(0, 10),
      }
    }
    const step = Session.prototype.step
    const settled = new WeakSet()
    Session.prototype.step = function () {
      if (!settled.has(this)) {
        let done = false
        for (let i = 0; i < 100000; i++) {
          if (!step.call(this)) {
            done = true
            break
          }
        }
        if (!done) throw new Error('Effect did not settle')
        settled.add(this)
      }
      // Let the tight alignment probe finish; hold the full canvas's final frame.
      return this.height() > 27
    }
  })
  await page.getByLabel('TTFX effect', { exact: true }).selectOption('beams')
  await page.getByText('Text settings', { exact: true }).click()
  const results = []
  for (const vertical of [35, 50, 65]) {
    await page
      .getByLabel('Vertical position', { exact: true })
      .fill(String(vertical))
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    )
    const result = await page
      .locator('[data-ttfx-canvas]')
      .evaluate((canvas) => {
        const { data, width, height } = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
        let min = height,
          max = -1
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            if (
              data[i + 3] > 0 &&
              Math.max(data[i], data[i + 1], data[i + 2]) > 10
            ) {
              min = Math.min(min, y)
              max = Math.max(max, y)
              break
            }
          }
        }
        const box = canvas.getBoundingClientRect(),
          host = canvas.parentElement.getBoundingClientRect()
        return {
          frame: window.lastFrame,
          corner: Array.from(data.slice(0, 4)),
          min,
          max,
          actualCenter:
            box.top - host.top + (((min + max + 1) / 2) * box.height) / height,
          hostHeight: host.height,
        }
      })
    results.push({ vertical, ...result })
  }
  console.log(JSON.stringify(results, null, 2))
  for (const r of results) {
    assert.ok(r.max >= r.min, 'The WASM canvas must contain visible pixels')
    assert.ok(
      Math.abs(r.actualCenter - (r.hostHeight * r.vertical) / 100) <= 2,
      `Rendered center does not follow ${r.vertical}%: ${JSON.stringify(r)}`,
    )
  }
  console.log('PASS: actual WASM-painted pixels follow vertical position')
} finally {
  await browser.close()
}
