import { useEffect, useRef } from 'react'
import { omarchyRadio } from '@/lib/omarchy-radio'
import {
  WEB_TTFX_EFFECTS,
  WEB_TTFX_EFFECT_EVENT,
  WEB_TTFX_EFFECT_KEY,
  WEB_TTFX_READY_EVENT,
} from '@/lib/ttfx-web'
import {
  DEFAULT_TTFX_SETTINGS,
  applyTtfxLayout,
  normalizeSettings,
  TTFX_SETTINGS_EVENT,
  TTFX_SETTINGS_KEY,
} from '@/lib/ttfx-settings'
import type { TtfxSettings } from '@/lib/ttfx-settings'
import { THEME_EVENT } from '@/lib/theme'
import type { WebTtfxEffect } from '@/lib/ttfx-web'
import {
  WORDMARK_HEIGHT,
  WORDMARK_ROWS,
  WORDMARK_WIDTH,
} from '@/data/wordmark-bitmap'

type Metrics = {
  cellWidth: number
  cellHeight: number
  fontSize: number
  columns: number
  rows: number
  cssWidth: number
  cssHeight: number
}

type SessionLike = {
  step: () => boolean
  refresh: () => void
  set_audio: (volume: number, bass: number, beat: boolean) => void
  set_theme: (
    accent: number,
    foreground: number,
    red: number,
    yellow: number,
    green: number,
    cyan: number,
    blue: number,
    magenta: number,
  ) => void
  fill: (
    symbols: Uint32Array,
    foreground: Uint32Array,
    background: Uint32Array,
    flags: Uint8Array,
  ) => void
  width: () => number
  height: () => number
  free: () => void
}

type TtfxModule = {
  default: (options: { module_or_path: ArrayBuffer }) => Promise<unknown>
  Session: new (
    input: string,
    effect: string,
    columns: number,
    rows: number,
    seed: number | undefined,
    frameRate: number,
  ) => SessionLike
  effect_catalog: () => string
}

type PaintModule = {
  FONT_FAMILY: string
  paintFrame: (
    context: CanvasRenderingContext2D,
    metrics: Metrics,
    symbols: Uint32Array,
    foreground: Uint32Array,
    background: Uint32Array,
    flags: Uint8Array,
    width: number,
    height: number,
    cursorOn: boolean,
    fontFamily: string,
  ) => void
}

type ThemePalette = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

const FRAME_RATE = 60
const FRAME_MS = 1000 / FRAME_RATE
const MAX_CATCH_UP_MS = FRAME_MS * 4
const TTFX_RESOLUTION = 2
const WASM_URL = '/assets/js/ttfx-audio/ttfx_audio_bg.wasm?v=20260905-1810'
const TTFX_MODULE_URL = '/assets/js/ttfx-audio/ttfx_audio.js?v=20260905-1810'
const PAINT_MODULE_URL = '/assets/js/wte/paint.js?v=20260905-1810'
const PADDING_X = 6
const PADDING_Y = 4

const PALETTES: Record<string, ThemePalette> = {
  'tokyo-night': [
    0x9ece6a, 0xc0caf5, 0xf7768e, 0xe0af68, 0x9ece6a, 0x7dcfff, 0x7aa2f7,
    0xbb9af7,
  ],
  white: [
    0x6e6e6e, 0x000000, 0x555555, 0x777777, 0x666666, 0x777777, 0x555555,
    0x888888,
  ],
  catppuccin: [
    0x89b4fa, 0xcdd6f4, 0xf38ba8, 0xf9e2af, 0xa6e3a1, 0x94e2d5, 0x89b4fa,
    0xcba6f7,
  ],
  gruvbox: [
    0x7daea3, 0xd4be98, 0xea6962, 0xd8a657, 0xa9b665, 0x89b482, 0x7daea3,
    0xd3869b,
  ],
  'matte-black': [
    0xe68e0d, 0xeaeaea, 0xe54b4b, 0xe68e0d, 0x8ea604, 0x4aa8a8, 0x6587c4,
    0xb26ac7,
  ],
  'rose-pine': [
    0x56949f, 0x575279, 0xb4637a, 0xea9d34, 0x286983, 0x56949f, 0x907aa9,
    0xd7827e,
  ],
}

function currentTheme(): ThemePalette {
  const name = document.documentElement.dataset.theme ?? 'tokyo-night'
  return PALETTES[name] ?? PALETTES['tokyo-night']
}

function rgbFromCss(value: string, fallback: number) {
  const hex = value.trim().match(/^#([\da-f]{6})$/i)
  if (hex) return Number.parseInt(hex[1], 16)
  const rgb = value.match(/\d+(?:\.\d+)?/g)
  if (!rgb || rgb.length < 3) return fallback
  return (
    (Math.round(Number(rgb[0])) << 16) |
    (Math.round(Number(rgb[1])) << 8) |
    Math.round(Number(rgb[2]))
  )
}

/** Preserve the source frame's brightness while restricting its hue to the
 * active theme highlight. Dark source shades become darker highlight shades,
 * so an effect retains depth without introducing a foreign colour. */
function highlightedShade(source: number, highlight: number) {
  const sourceLuma =
    ((source >> 16) & 255) * 0.2126 +
    ((source >> 8) & 255) * 0.7152 +
    (source & 255) * 0.0722
  const strength = 0.18 + (sourceLuma / 255) * 0.82
  const red = Math.round(((highlight >> 16) & 255) * strength)
  const green = Math.round(((highlight >> 8) & 255) * strength)
  const blue = Math.round((highlight & 255) * strength)
  return (red << 16) | (green << 8) | blue
}

function themeHighlight() {
  const fallback = currentTheme()[0]
  return rgbFromCss(
    getComputedStyle(document.documentElement).getPropertyValue('--t-field-lit'),
    fallback,
  )
}

function fullCanvasInput(
  columns: number,
  rows: number,
  wordmarkColumn: number,
  wordmarkRow: number,
) {
  const output = Array.from({ length: rows }, () => Array(columns).fill(' '))
  for (let row = 0; row < WORDMARK_HEIGHT; row++) {
    for (let column = 0; column < WORDMARK_WIDTH; column++) {
      if (WORDMARK_ROWS[row][column] !== '1') continue
      const y = wordmarkRow + row
      const x = wordmarkColumn + column
      if (y >= 0 && y < rows && x >= 0 && x < columns) output[y][x] = '█'
    }
  }
  return output.map((row) => row.join('')).join('\n')
}

function sizeCanvas(canvas: HTMLCanvasElement, metrics: Metrics) {
  const dpr = Math.max(1, (window.devicePixelRatio || 1) / TTFX_RESOLUTION)
  canvas.width = Math.max(1, Math.floor(metrics.cssWidth * dpr))
  canvas.height = Math.max(1, Math.floor(metrics.cssHeight * dpr))
  canvas.style.width = `${metrics.cssWidth}px`
  canvas.style.height = `${metrics.cssHeight}px`
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2d canvas is unavailable')
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  return context
}

export function TtfxWordmarkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let settings = { ...DEFAULT_TTFX_SETTINGS }
    try {
      settings = normalizeSettings(
        JSON.parse(localStorage.getItem(TTFX_SETTINGS_KEY) ?? '{}'),
      )
    } catch {}
    let disposed = false
    let session: SessionLike | null = null
    let metrics: Metrics | null = null
    let input = ''
    let context: CanvasRenderingContext2D | null = null
    let ttfx: TtfxModule | null = null
    let paint: PaintModule | null = null
    let currentEffect = (sessionStorage.getItem(WEB_TTFX_EFFECT_KEY) ??
      WEB_TTFX_EFFECTS[0]) as WebTtfxEffect
    let symbols = new Uint32Array()
    let foreground = new Uint32Array()
    let fixedForeground = new Uint32Array()
    let background = new Uint32Array()
    let flags = new Uint8Array()
    let frameWidth = 0
    let frameHeight = 0
    let holdUntil = 0
    let accumulator = 0
    let lastTime = 0
    let animationFrame = 0
    let readySent = false
    let activated = false

    const stopSession = () => {
      session?.free()
      session = null
    }

    const applyTheme = (target: SessionLike | null) => {
      if (!target) return
      target.set_theme(...currentTheme())
      canvas.dataset.theme =
        document.documentElement.dataset.theme ?? 'tokyo-night'
    }

    const applyAudio = (target: SessionLike | null) => {
      if (!target) return false
      const analysis = omarchyRadio.analysis
      const bass = Math.min(1, analysis.bands[0] + analysis.bands[1] * 0.5)
      target.set_audio(
        settings.audio ? analysis.volume : 0,
        settings.audio ? bass : 0,
        settings.audio && Boolean(analysis.beat),
      )
      canvas.dataset.audioVolume = analysis.volume.toFixed(3)
      canvas.dataset.audioBeat = analysis.beat ? '1' : '0'
    }

    const stepSession = (target: SessionLike | null) => {
      applyAudio(target)
      return target?.step() ?? false
    }

    const layout = () => {
      const slot = document.querySelector<HTMLElement>('[data-hero-wordmark]')
      if (!slot) return false
      const slotBox = slot.getBoundingClientRect()
      const hostBox = host.getBoundingClientRect()
      if (slotBox.width < 1 || slotBox.height < 1 || hostBox.width < 1)
        return false
      const cellWidth = slotBox.width / WORDMARK_WIDTH
      const cellHeight = slotBox.height / WORDMARK_HEIGHT
      const slotX = slotBox.left - hostBox.left
      const slotY = slotBox.top - hostBox.top
      canvas.dataset.wordmarkCenter = String(settings.vertical)
      canvas.dataset.wordmarkTop = String(slotY)
      canvas.dataset.wordmarkHeight = String(slotBox.height)
      const wordmarkColumn = Math.ceil(slotX / cellWidth) + PADDING_X
      const wordmarkRow = Math.ceil(slotY / cellHeight) + PADDING_Y
      const left = slotX - wordmarkColumn * cellWidth
      const top = slotY - wordmarkRow * cellHeight
      const columns = Math.ceil((hostBox.width - left) / cellWidth) + PADDING_X
      const rows = Math.ceil((hostBox.height - top) / cellHeight) + PADDING_Y
      metrics = {
        cellWidth,
        cellHeight,
        fontSize: Math.max(1, Math.round(cellHeight / 1.2)),
        columns,
        rows,
        cssWidth: columns * cellWidth,
        cssHeight: rows * cellHeight,
      }
      input = fullCanvasInput(columns, rows, wordmarkColumn, wordmarkRow)
      canvas.style.left = `${left}px`
      canvas.style.top = `${top}px`
      canvas.dataset.cellWidth = cellWidth.toFixed(4)
      canvas.dataset.cellHeight = cellHeight.toFixed(4)
      canvas.dataset.grid = `${columns}x${rows}`
      context = sizeCanvas(canvas, metrics)
      return true
    }

    const capture = () => {
      if (!session) return
      frameWidth = session.width()
      frameHeight = session.height()
      const count = frameWidth * frameHeight
      if (symbols.length < count) {
        symbols = new Uint32Array(count)
        foreground = new Uint32Array(count)
        fixedForeground = new Uint32Array(count)
        background = new Uint32Array(count)
        flags = new Uint8Array(count)
      }
      session.fill(symbols, foreground, background, flags)
    }

    const paintCurrentFrame = (now: number) => {
      if (!context || !metrics || !paint) return
      let paintForeground = foreground
      if (settings.fixedColor) {
        const highlight = themeHighlight()
        const count = frameWidth * frameHeight
        fixedForeground.set(foreground.subarray(0, count))
        for (let index = 0; index < count; index++) {
          // Frame whitespace and backgrounds stay untouched. Every visible
          // wordmark/effect glyph keeps its original luminance but takes the
          // current theme's highlighted hue.
          if (symbols[index] !== 32 && foreground[index] !== 0) {
            fixedForeground[index] = highlightedShade(foreground[index], highlight)
          }
        }
        paintForeground = fixedForeground
        canvas.dataset.fixedColorHighlight = `#${highlight.toString(16).padStart(6, '0')}`
      }
      canvas.dataset.fixedColor = String(settings.fixedColor)
      paint.paintFrame(
        context,
        metrics,
        symbols,
        paintForeground,
        background,
        flags,
        frameWidth,
        frameHeight,
        Math.floor(now / 400) % 2 === 0,
        paint.FONT_FAMILY,
      )
      if (!readySent) {
        readySent = true
        canvas.dataset.engine = 'avillagran-ttfx-wasm'
        window.dispatchEvent(new CustomEvent(WEB_TTFX_READY_EVENT))
      }
    }

    const startEffect = (effect: WebTtfxEffect) => {
      if (!ttfx || !paint) return
      stopSession()
      holdUntil = 0
      canvas.dataset.phase = 'playing'
      currentEffect = effect
      canvas.dataset.effect = effect
      // WASM preserves explicit input coordinates; no calibration playback.
      if (!layout() || !metrics) return
      session = new ttfx.Session(
        input,
        effect,
        metrics.columns,
        metrics.rows,
        undefined,
        effect === 'laseretch' ? 400 : FRAME_RATE,
      )
      applyTheme(session)
      stepSession(session)
      capture()
      paintCurrentFrame(performance.now())
    }

    const tick = (now: number) => {
      if (disposed) return
      const elapsed = Math.max(0, now - lastTime)
      lastTime = now
      if (holdUntil > 0) {
        if (now >= holdUntil) {
          startEffect(currentEffect)
        } else {
          applyAudio(session)
          session?.refresh()
          capture()
          paintCurrentFrame(now)
        }
        accumulator = 0
        animationFrame = requestAnimationFrame(tick)
        return
      }
      const analysis = omarchyRadio.analysis
      const speed =
        settings.speed *
        (settings.audio
          ? Math.min(
              3,
              1 + analysis.volume * TTFX_RESOLUTION + (analysis.beat ? 0.5 : 0),
            )
          : 1)
      accumulator = Math.min(MAX_CATCH_UP_MS, accumulator + elapsed * speed)
      let changed = false
      while (accumulator >= FRAME_MS) {
        accumulator -= FRAME_MS
        if (!stepSession(session)) {
          if (currentEffect === 'middleout' || currentEffect === 'slide') {
            holdUntil = now + 3000
            canvas.dataset.phase = 'hold'
            changed = true
          } else {
            startEffect(currentEffect)
          }
          break
        }
        changed = true
      }
      if (changed) {
        capture()
        paintCurrentFrame(now)
      }
      animationFrame = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame)
      accumulator = 0
      lastTime = performance.now()
      animationFrame = requestAnimationFrame(tick)
    }

    const onEffect = (event: Event) => {
      const effect = (event as CustomEvent<{ effect?: WebTtfxEffect }>).detail
        .effect
      if (!effect || !WEB_TTFX_EFFECTS.includes(effect)) return
      currentEffect = effect
      activated = true
      if (!ttfx || !paint) return
      startEffect(effect)
      startLoop()
    }
    const onSettings = (event: Event) => {
      settings = normalizeSettings((event as CustomEvent<TtfxSettings>).detail)
      applyTtfxLayout(settings)
      activated = true
      if (!ttfx || !paint) return
      startEffect(currentEffect)
      startLoop()
    }
    window.addEventListener(TTFX_SETTINGS_EVENT, onSettings)
    const onTheme = () => applyTheme(session)
    window.addEventListener(WEB_TTFX_EFFECT_EVENT, onEffect)
    window.addEventListener(THEME_EVENT, onTheme)

    const resize = new ResizeObserver(() => {
      if (activated && ttfx && paint) startEffect(currentEffect)
    })
    resize.observe(host)
    const slot = document.querySelector<HTMLElement>('[data-hero-wordmark]')
    if (slot) resize.observe(slot)

    void Promise.all([
      import(/* @vite-ignore */ TTFX_MODULE_URL) as Promise<TtfxModule>,
      import(/* @vite-ignore */ PAINT_MODULE_URL) as Promise<PaintModule>,
      fetch(WASM_URL).then((response) => {
        if (!response.ok) throw new Error(`ttfx audio wasm ${response.status}`)
        return response.arrayBuffer()
      }),
    ])
      .then(async ([ttfxModule, paintModule, bytes]) => {
        await ttfxModule.default({ module_or_path: bytes })
        if (disposed) return
        ttfx = ttfxModule
        paint = paintModule
        const catalog = JSON.parse(ttfx.effect_catalog()) as { name: string }[]
        const catalogNames = new Set(catalog.map(({ name }) => name))
        canvas.dataset.catalogCount = String(catalog.length)
        canvas.dataset.resolution = String(TTFX_RESOLUTION)
        canvas.dataset.catalogComplete = String(
          WEB_TTFX_EFFECTS.every((effect) => catalogNames.has(effect)),
        )
        if (activated) {
          startEffect(currentEffect)
          startLoop()
        }
      })
      .catch((error: unknown) => {
        canvas.dataset.engine = 'fallback'
        canvas.dataset.error = String(error)
      })

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      resize.disconnect()
      window.removeEventListener(WEB_TTFX_EFFECT_EVENT, onEffect)
      window.removeEventListener(THEME_EVENT, onTheme)
      window.removeEventListener(TTFX_SETTINGS_EVENT, onSettings)
      stopSession()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      data-ttfx-canvas
      aria-hidden="true"
      className="pointer-events-none absolute select-none"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
