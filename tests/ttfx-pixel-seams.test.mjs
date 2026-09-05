import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paintFrame } from '../assets/js/wte/paint.js'

class RecordingContext {
  rects = []
  fillStyle = ''
  globalAlpha = 1
  textAlign = ''
  textBaseline = ''
  lineCap = ''
  lineJoin = ''
  fillRect(x, y, width, height) {
    this.rects.push([x, y, width, height])
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  save() {}
  restore() {}
  rect() {}
  clip() {}
  fillText() {}
}

test('pixel glyph rectangles land on whole boundaries without seams', () => {
  const ctx = new RecordingContext()
  paintFrame(
    ctx,
    { cellWidth: 10.4, cellHeight: 8.7, fontSize: 8, cssWidth: 20.8, cssHeight: 8.7 },
    Uint32Array.from([9608, 9608]),
    Uint32Array.from([0x9ece6a, 0x6e9050]),
    new Uint32Array(2),
    new Uint8Array(2),
    2,
    1,
    true,
  )
  const glyphRects = ctx.rects.slice(1)
  assert.equal(glyphRects.length, 2)
  for (const rect of glyphRects) {
    assert(rect.every(Number.isInteger), `fractional pixel glyph rect: ${rect}`)
  }
  assert.equal(glyphRects[0][0] + glyphRects[0][2], glyphRects[1][0])
})
