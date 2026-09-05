import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

const required = [
  'dist/client/assets/js/ttfx-audio/ttfx_audio.js',
  'dist/client/assets/js/ttfx-audio/ttfx_audio_bg.wasm',
  'dist/client/assets/js/wte/paint.js',
]

test('production build ships all TTFX runtime assets', () => {
  for (const file of required) {
    assert(existsSync(file), `Missing runtime asset: ${file}`)
  }
})
