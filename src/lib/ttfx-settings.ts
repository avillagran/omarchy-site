export const TTFX_SETTINGS_KEY = 'omarchy-ttfx-settings-v1'
export const TTFX_SETTINGS_EVENT = 'omarchy:ttfx-settings-change'
export const DEFAULT_TTFX_SETTINGS = {
  vertical: 50,
  scale: 1,
  backgroundScale: 1,
  cursorScale: 1,
  speed: 1,
  audio: true,
  fixedColor: true,
}
export type TtfxSettings = typeof DEFAULT_TTFX_SETTINGS

export function normalizeSettings(value: unknown): TtfxSettings {
  const raw =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const number = (
    key: 'vertical' | 'scale' | 'backgroundScale' | 'cursorScale' | 'speed',
    min: number,
    max: number,
  ) => {
    const candidate = raw[key]
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, candidate))
      : DEFAULT_TTFX_SETTINGS[key]
  }
  return {
    vertical: number('vertical', 20, 70),
    scale: number('scale', 0.5, 1.2),
    backgroundScale: number('backgroundScale', 0.5, 1.5),
    cursorScale: number('cursorScale', 0.5, 2),
    speed: number('speed', 0.25, 3),
    audio:
      typeof raw.audio === 'boolean' ? raw.audio : DEFAULT_TTFX_SETTINGS.audio,
    fixedColor:
      typeof raw.fixedColor === 'boolean'
        ? raw.fixedColor
        : DEFAULT_TTFX_SETTINGS.fixedColor,
  }
}

// Set the layout before notifying canvas listeners, so every renderer reads
// the same DOM rectangle, including on a page with the tools hidden.
export function applyTtfxLayout(settings: TtfxSettings) {
  const hero = document.querySelector<HTMLElement>('[data-hero-sentinel]')
  hero?.style.setProperty('--ttfx-vertical', `${settings.vertical}%`)
  hero?.style.setProperty('--ttfx-scale', String(settings.scale))
}

export function wordmarkTop(
  height: number,
  textHeight: number,
  settings: TtfxSettings,
) {
  return (height * settings.vertical) / 100 - textHeight / 2
}
