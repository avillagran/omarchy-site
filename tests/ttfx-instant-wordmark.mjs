import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
try {
  const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:3113/?tools=true', { waitUntil: 'domcontentloaded' })
  const result = await page.locator('[data-hero-wordmark]').evaluate((node) => ({
    box: node.getBoundingClientRect().toJSON(),
    mask: getComputedStyle(node).maskImage,
    webkitMask: getComputedStyle(node).webkitMaskImage,
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }))
  console.log({ box: result.box, vectorMask: result.mask.startsWith('url("data:image/svg+xml'), resources: result.resources.length })
  assert(result.box.width > 100 && result.box.height > 20, 'SSR wordmark must have immediate geometry')
  assert.match(result.mask + result.webkitMask, /data:image\/svg\+xml/, 'SSR wordmark must embed its vector mask')
  assert(!result.resources.some((url) => url.endsWith('/brand/omarchy-wordmark.svg')), 'Initial wordmark must not wait on a brand asset request')
} finally {
  await browser.close()
}
