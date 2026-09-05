import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import init, { Session } from '../assets/js/ttfx-audio/ttfx_audio.js'
await init({
  module_or_path: readFileSync(
    new URL('../assets/js/ttfx-audio/ttfx_audio_bg.wasm', import.meta.url),
  ),
})
test('WASM preserves explicit input rows instead of bottom-anchoring them', () => {
  for (const row of [5, 15, 25]) {
    const lines = Array(40).fill(' '.repeat(40))
    lines[row] = '  ███'
    const session = new Session(lines.join('\n'), 'beams', 40, 40, 0, 240)
    try {
      let steps = 0
      while (session.step() && ++steps < 100000) {}
      assert.ok(steps < 100000)
      const symbols = new Uint32Array(1600)
      session.fill(
        symbols,
        new Uint32Array(1600),
        new Uint32Array(1600),
        new Uint8Array(1600),
      )
      const positions = Array.from(symbols).flatMap((symbol, index) =>
        symbol === 9608 ? [index] : [],
      )
      assert.deepEqual(positions, [row * 40 + 2, row * 40 + 3, row * 40 + 4])
    } finally {
      session.free()
    }
  }
})
