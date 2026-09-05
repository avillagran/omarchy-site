import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import init, { Session } from '../assets/js/ttfx-audio/ttfx_audio.js'

await init({
  module_or_path: readFileSync(
    new URL('../assets/js/ttfx-audio/ttfx_audio_bg.wasm', import.meta.url),
  ),
})
const palettes = [
  [
    0xe08040, 0xd8c8b8, 0xc04020, 0xd0a030, 0x709030, 0x409080, 0x405090,
    0x906080,
  ],
  [
    0x6090c0, 0xa0c0e0, 0x804060, 0x809060, 0x408060, 0x4080c0, 0x6060c0,
    0xa060c0,
  ],
]
const count = 40 * 16
const input = '\n\n\n\n        OMARCHY\n        LETTERS\n        REACTFX'
function makeSession(effect) {
  return new Session(input, effect, 40, 16, 12345, 60)
}
function frame(session) {
  const symbols = new Uint32Array(count),
    fg = new Uint32Array(count)
  session.fill(symbols, fg, new Uint32Array(count), new Uint8Array(count))
  return { symbols, fg }
}
function compareThemes(effect, frames, select) {
  const a = makeSession(effect),
    b = makeSession(effect)
  let compared = 0,
    unchanged = 0
  try {
    a.set_theme(...palettes[0])
    b.set_theme(...palettes[1])
    for (let step = 0; step < frames; step++) {
      const alive = a.step()
      assert.equal(b.step(), alive)
      if (!alive) break
      const x = frame(a),
        y = frame(b)
      assert.deepEqual(
        x.symbols,
        y.symbols,
        'theme must not alter seeded choreography',
      )
      for (let i = 0; i < count; i++) {
        if (select(x.symbols[i]) && x.fg[i] && y.fg[i]) {
          compared++
          if (x.fg[i] === y.fg[i]) unchanged++
        }
      }
    }
  } finally {
    a.free()
    b.free()
  }
  assert.ok(compared > 20, 'must inspect visible effect glyphs')
  assert.equal(
    unchanged,
    0,
    `${effect}: ${unchanged}/${compared} visible glyph colors ignored the theme`,
  )
}
const letter = (symbol) => symbol >= 65 && symbol <= 90

test('laseretch beam and cooling letters both follow theme on seeded frames', () => {
  compareThemes('laseretch', 40, (symbol) => symbol === 47)
  compareThemes('laseretch', 40, letter)
})

test('thunderstorm letters follow theme through fade, storm glow and recovery', () => {
  compareThemes('thunderstorm', 1200, letter)
})

// Audio already has an emission-time transform: these are characterization
// checks against real WASM, not a second implementation of its color math.
for (const effect of ['laseretch', 'thunderstorm']) {
  for (const [name, audio] of [
    ['volume', [0.8, 0, false]],
    ['bass', [0, 0.8, false]],
    ['music beat', [0.8, 0.8, true]],
  ]) {
    test(`${effect} ${name} changes LETTER colors with and without a theme`, () => {
      for (const palette of [null, ...palettes]) {
        const a = makeSession(effect),
          b = makeSession(effect)
        let changedLetters = 0,
          changedBeam = 0
        try {
          if (palette) {
            a.set_theme(...palette)
            b.set_theme(...palette)
          }
          // Identical seeds and frame indices; compare matching letters only,
          // since thunderstorm's volume/beat hook also changes strike timing.
          b.set_audio(...audio)
          for (
            let step = 0;
            step < (effect === 'laseretch' ? 40 : 160);
            step++
          ) {
            assert.ok(a.step())
            assert.ok(b.step())
            const x = frame(a),
              y = frame(b)
            if (name === 'bass')
              assert.deepEqual(
                x.symbols,
                y.symbols,
                'bass color comparison keeps identical choreography',
              )
            for (let i = 0; i < count; i++) {
              if (
                x.symbols[i] === y.symbols[i] &&
                x.fg[i] &&
                y.fg[i] &&
                x.fg[i] !== y.fg[i]
              ) {
                if (letter(x.symbols[i])) changedLetters++
                if (x.symbols[i] === 47) changedBeam++
              }
            }
          }
        } finally {
          a.free()
          b.free()
        }
        assert.ok(
          changedLetters > 20,
          `${effect} ${name}: letter colors must react, not just particles`,
        )
        if (effect === 'laseretch')
          assert.ok(changedBeam > 20, 'laser beam colors must react')
      }
    })
  }
}

// Refresh holds the engine state, but not its render-time theme/audio styling.
for (const effect of ['middleout', 'slide']) {
  test(`${effect} completed letters remain reactive during a 180-refresh hold`, () => {
    const session = makeSession(effect)
    try {
      let steps = 0
      while (session.step() && ++steps < 10000) {}
      assert.ok(steps < 10000, 'effect must complete')
      const original = frame(session)
      assert.equal(Array.from(original.symbols).filter(letter).length, 21)
      assert.equal(
        typeof session.refresh,
        'function',
        'WASM must expose a non-advancing refresh',
      )
      session.set_theme(...palettes[0])
      session.refresh()
      const themed = frame(session)
      assert.deepEqual(themed.symbols, original.symbols)
      assert.notDeepEqual(
        themed.fg,
        original.fg,
        'completed letters must accept a new theme',
      )
      for (let i = 0; i < 180; i++) {
        session.set_theme(...palettes[i % 2])
        session.set_audio(0.7, 0.6, i % 2 === 0)
        session.refresh()
        const held = frame(session)
        assert.deepEqual(
          held.symbols,
          original.symbols,
          'hold cannot move or lose completed letters',
        )
        assert.notDeepEqual(
          held.fg,
          themed.fg,
          'held letters must respond to music',
        )
      }
      session.set_audio(0, 0, false)
      session.set_theme(...palettes[0])
      session.refresh()
      assert.deepEqual(
        frame(session),
        themed,
        'quiet refresh must restore colors without accumulated transforms',
      )
      assert.equal(
        session.step(),
        false,
        'refresh must not restart the completed effect',
      )
    } finally {
      session.free()
    }
  })
}

// Recorded from the rebuilt wrapper BEFORE the fix. No theme/no audio must
// remain byte-for-byte identical, including glyphs, colors, flags and duration.
for (const [effect, expectedFrames, expectedHash] of [
  [
    'laseretch',
    180,
    'ef93dc8b46e811d62d45ce6dae95ec9ffd60e3617f958710510f263e30a6ad07',
  ],
  [
    'thunderstorm',
    911,
    '3cd5a224c3def3da887b99243cafb6ada2248f091dc75b463846a707ef76b5ea',
  ],
]) {
  test(`${effect} retains its original default identity`, () => {
    const session = makeSession(effect),
      hash = createHash('sha256')
    let frames = 0
    try {
      while (frames < 1200 && session.step()) {
        const symbols = new Uint32Array(count),
          fg = new Uint32Array(count)
        const bg = new Uint32Array(count),
          flags = new Uint8Array(count)
        session.fill(symbols, fg, bg, flags)
        for (const values of [symbols, fg, bg, flags]) hash.update(values)
        frames++
      }
    } finally {
      session.free()
    }
    assert.equal(frames, expectedFrames)
    assert.equal(hash.digest('hex'), expectedHash)
  })
}
