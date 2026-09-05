import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  await page.getByLabel('TTFX effect', { exact: true }).selectOption('beams')
  await page
    .getByText('Text settings', { exact: true })
    .click({ timeout: 10000 })
  const position = page.getByLabel('Vertical position', { exact: true })
  assert.equal(await position.inputValue(), '50')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.wordmarkCenter ===
      '50',
  )
  await position.fill('35')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.wordmarkCenter ===
      '35',
  )
  const field = page.locator('[data-hero-sentinel] canvas.hero-canvas-in')
  await field.waitFor()
  const backgroundBeforeText = await field.getAttribute('data-background-cell-width')
  await page.getByLabel('Text size', { exact: true }).fill('0.7')
  await page.waitForTimeout(100)
  assert.equal(
    await field.getAttribute('data-background-cell-width'),
    backgroundBeforeText,
    'Text size must not resize the particle field',
  )
  const backgroundBefore = await field.getAttribute('data-background-cell-width')
  const backgroundSize = page.getByLabel('Background size', { exact: true })
  assert.equal(await backgroundSize.inputValue(), '1')
  await backgroundSize.fill('0.7')
  await page.waitForFunction(
    (before) =>
      document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')
        ?.dataset.backgroundCellWidth !== before,
    backgroundBefore,
  )
  const cursorSize = page.getByLabel('Cursor particle size', { exact: true })
  assert.equal(await cursorSize.inputValue(), '1')
  const cursorBefore = await field.getAttribute('data-cursor-cloud-scale')
  await cursorSize.fill('1.5')
  await page.waitForFunction(
    (before) =>
      document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')
        ?.dataset.cursorCloudScale !== before,
    cursorBefore,
  )
  await page.getByLabel('Animation speed', { exact: true }).fill('1.5')
  await page.getByLabel('React to audio', { exact: true }).uncheck()
  const fixedColor = page.getByLabel('Fix Color', { exact: true })
  assert.equal(await fixedColor.isChecked(), true)
  await fixedColor.uncheck()
  await page.waitForFunction(
    () => document.querySelector('[data-ttfx-canvas]')?.dataset.fixedColor === 'false',
  )
  await page.reload()
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.catalogComplete ===
      'true',
  )
  await page.getByText('Text settings', { exact: true }).click()
  assert.equal(await position.inputValue(), '35')
  assert.equal(
    await page.getByLabel('Text size', { exact: true }).inputValue(),
    '0.7',
  )
  assert.equal(
    await page.getByLabel('Animation speed', { exact: true }).inputValue(),
    '1.5',
  )
  assert.equal(
    await page.getByLabel('React to audio', { exact: true }).isChecked(),
    false,
  )
  assert.equal(await fixedColor.isChecked(), false)
  await page.getByRole('button', { name: 'Reset text settings' }).click()
  assert.equal(await fixedColor.isChecked(), true)
  assert.equal(await position.inputValue(), '50')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-ttfx-canvas]')?.dataset.wordmarkCenter ===
      '50',
  )
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(300)
    const geometry = await page
      .locator('[data-ttfx-canvas]')
      .evaluate((canvas) => {
        const host = canvas.parentElement.getBoundingClientRect()
        return {
          center:
            Number(canvas.dataset.wordmarkTop) +
            Number(canvas.dataset.wordmarkHeight) / 2,
          expected: host.height / 2,
          engine: canvas.dataset.engine,
        }
      })
    assert.ok(
      Math.abs(geometry.center - geometry.expected) < 0.01,
      JSON.stringify(geometry),
    )
    assert.equal(geometry.engine, 'avillagran-ttfx-wasm')
  }
  console.log(
    'PASS: live WASM controls, exact desktop/mobile center, updates, persistence, reset',
  )
} finally {
  await browser.close()
}
