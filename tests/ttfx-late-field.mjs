import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  let release
  const delayed = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/src/components/HeroPixelField.tsx*', async (route) => {
    await delayed
    await route.continue()
  })
  await page.goto('http://127.0.0.1:3113/?tools=true', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  await page
    .getByLabel('TTFX effect', { exact: true })
    .selectOption('middleout')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.engine ===
      'avillagran-ttfx-wasm',
  )
  release()
  await page.waitForFunction(
    () => document.querySelector('canvas.hero-canvas-in')?.width > 300,
  )
  const active = await page
    .locator('[data-hero-sentinel] canvas.hero-canvas-in')
    .getAttribute('data-ttfx-active')
  assert.equal(
    active,
    'true',
    'A lazily mounted field must recognize an already-active TTFX canvas',
  )
  console.log(
    'PASS: late field mount never restores the static logo over active TTFX',
  )
} finally {
  await browser.close()
}
