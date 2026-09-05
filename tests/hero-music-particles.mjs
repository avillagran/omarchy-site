import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true')
  await page.waitForFunction(() => document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')?.width > 300)
  await page.waitForTimeout(500)
  const field = page.locator('[data-hero-sentinel] canvas.hero-canvas-in')

  await page.mouse.move(180, 540)
  await page.waitForTimeout(80)
  await page.mouse.move(240, 570)
  await page.waitForTimeout(100)
  const beforeMusic = await field.evaluate((node) => ({
    cursorCloudScale: Number(node.dataset.cursorCloudScale),
    bottomFieldParticles: Number(node.dataset.bottomFieldParticles),
    bottomEdgeParticles: Number(node.dataset.bottomEdgeParticles),
    bottomCenterParticles: Number(node.dataset.bottomCenterParticles),
    highFrequencyParticles: Number(node.dataset.highFrequencyParticles),
    highFrequencyEnergy: Number(node.dataset.highFrequencyEnergy),
  }))
  assert(beforeMusic.cursorCloudScale > 0)
  assert(beforeMusic.bottomFieldParticles > 0, 'Existing particles must retain the lower contour')
  assert(beforeMusic.bottomEdgeParticles > beforeMusic.bottomCenterParticles, 'The contour must remain edge-heavy')
  assert(beforeMusic.highFrequencyParticles > 0, 'High-frequency sparkle must use existing visible particles')

  await page.mouse.click(24, 610)
  await page.waitForFunction(
    () => Number(document.querySelector('[data-hero-sentinel] canvas.hero-canvas-in')?.dataset.volume) > 0.01,
    undefined,
    { timeout: 20_000 },
  )
  await page.waitForTimeout(250)
  const withMusic = await field.evaluate((node) => ({
    highFrequencyEnergy: Number(node.dataset.highFrequencyEnergy),
    musicVolume: Number(node.dataset.volume),
  }))
  console.log({ beforeMusic, withMusic })
  assert(withMusic.musicVolume > 0.01)
  assert(withMusic.highFrequencyEnergy > beforeMusic.highFrequencyEnergy + 0.01, 'High sounds must brighten selected existing particles')
} finally {
  await browser.close()
}
