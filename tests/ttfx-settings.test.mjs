import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as settings from '../src/lib/ttfx-settings.ts'

test('saved settings reject invalid values and clamp supported ranges', () => {
  assert.equal(typeof settings.normalizeSettings, 'function')
  assert.deepEqual(
    settings.normalizeSettings({
      vertical: -10,
      scale: 99,
      backgroundScale: -10,
      cursorScale: 99,
      speed: 'fast',
      audio: 'yes',
      fixedColor: 'yes',
    }),
    { vertical: 20, scale: 1.2, backgroundScale: 0.5, cursorScale: 2, speed: 1, audio: true, fixedColor: true },
  )
  assert.deepEqual(
    settings.normalizeSettings(null),
    settings.DEFAULT_TTFX_SETTINGS,
  )
})

test('defaults place the wordmark at the exact vertical center', () => {
  assert.equal(typeof settings.wordmarkTop, 'function')
  assert.equal(
    settings.wordmarkTop(900, 100, settings.DEFAULT_TTFX_SETTINGS),
    400,
  )
})
