import { useEffect, useState } from 'react'
import { useToolsEnabled } from '@/lib/use-tools-enabled'
import {
  WEB_TTFX_EFFECTS,
  WEB_TTFX_EFFECT_EVENT,
  WEB_TTFX_EFFECT_KEY,
} from '@/lib/ttfx-web'
import type { WebTtfxEffect } from '@/lib/ttfx-web'
import {
  DEFAULT_TTFX_SETTINGS,
  applyTtfxLayout,
  normalizeSettings,
  TTFX_SETTINGS_EVENT,
  TTFX_SETTINGS_KEY,
} from '@/lib/ttfx-settings'
import type { TtfxSettings } from '@/lib/ttfx-settings'

export function TtfxEffectSelector() {
  const toolsEnabled = useToolsEnabled()
  const [settings, setSettings] = useState(DEFAULT_TTFX_SETTINGS)

  const updateSettings = (next: TtfxSettings) => {
    applyTtfxLayout(next)
    setSettings(next)
    try {
      localStorage.setItem(TTFX_SETTINGS_KEY, JSON.stringify(next))
    } catch {}
    window.dispatchEvent(new CustomEvent(TTFX_SETTINGS_EVENT, { detail: next }))
  }

  const [effect, setEffect] = useState<WebTtfxEffect>(WEB_TTFX_EFFECTS[0])

  useEffect(() => {
    try {
      const savedSettings = JSON.parse(
        localStorage.getItem(TTFX_SETTINGS_KEY) ?? 'null',
      )
      const initialSettings = normalizeSettings(savedSettings)
      applyTtfxLayout(initialSettings)
      setSettings(initialSettings)
    } catch {}
    const saved = sessionStorage.getItem(WEB_TTFX_EFFECT_KEY) as WebTtfxEffect
    if (WEB_TTFX_EFFECTS.includes(saved)) setEffect(saved)
    const onEffect = (event: Event) => {
      const next = (event as CustomEvent<{ effect?: WebTtfxEffect }>).detail
        .effect
      if (next && WEB_TTFX_EFFECTS.includes(next)) setEffect(next)
    }
    window.addEventListener(WEB_TTFX_EFFECT_EVENT, onEffect)
    return () => window.removeEventListener(WEB_TTFX_EFFECT_EVENT, onEffect)
  }, [])

  const select = (next: WebTtfxEffect) => {
    setEffect(next)
    sessionStorage.setItem(WEB_TTFX_EFFECT_KEY, next)
    window.dispatchEvent(
      new CustomEvent(WEB_TTFX_EFFECT_EVENT, { detail: { effect: next } }),
    )
  }

  if (!toolsEnabled) return null

  return (
    <div
      data-tools-region
      className="absolute top-[calc(var(--nav-h)+1rem)] left-4 z-10 flex flex-wrap items-start gap-2 text-[11px] text-text-secondary sm:left-6"
    >
      <label className="flex h-8 items-center border border-border-subtle bg-bg/80 px-2 backdrop-blur-sm">
        <span className="mr-1.5 text-text-muted">fx:</span>
        <select
          value={effect}
          onChange={(event) => select(event.target.value as WebTtfxEffect)}
          aria-label="TTFX effect"
          className="cursor-pointer appearance-none bg-transparent pr-4 font-medium text-text outline-none"
        >
          {WEB_TTFX_EFFECTS.map((name) => (
            <option key={name} value={name} className="bg-bg text-text">
              {name}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none -ml-3 text-text-muted"
        >
          ▾
        </span>
      </label>
      <details className="border border-border-subtle bg-bg/95 px-3 backdrop-blur-sm">
        <summary className="flex h-8 cursor-pointer items-center">
          Text settings
        </summary>
        <div className="flex w-52 flex-col gap-3 py-3">
          <label>
            Vertical position <output>{settings.vertical}%</output>
            <input
              className="block w-full"
              aria-label="Vertical position"
              type="range"
              min="20"
              max="70"
              step="1"
              value={settings.vertical}
              onChange={(e) =>
                updateSettings({
                  ...settings,
                  vertical: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            type="button"
            onClick={() => updateSettings({ ...settings, vertical: 50 })}
          >
            Center vertically (50%)
          </button>
          <label>
            Text size <output>{Math.round(settings.scale * 100)}%</output>
            <input
              className="block w-full"
              aria-label="Text size"
              type="range"
              min="0.5"
              max="1.2"
              step="0.05"
              value={settings.scale}
              onChange={(e) =>
                updateSettings({ ...settings, scale: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Background size{' '}
            <output>{Math.round(settings.backgroundScale * 100)}%</output>
            <input
              className="block w-full"
              aria-label="Background size"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.backgroundScale}
              onChange={(e) =>
                updateSettings({
                  ...settings,
                  backgroundScale: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Cursor particle size{' '}
            <output>{Math.round(settings.cursorScale * 100)}%</output>
            <input
              className="block w-full"
              aria-label="Cursor particle size"
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={settings.cursorScale}
              onChange={(e) =>
                updateSettings({
                  ...settings,
                  cursorScale: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Animation speed <output>{settings.speed}×</output>
            <input
              className="block w-full"
              aria-label="Animation speed"
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={settings.speed}
              onChange={(e) =>
                updateSettings({ ...settings, speed: Number(e.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.audio}
              onChange={(e) =>
                updateSettings({ ...settings, audio: e.target.checked })
              }
            />
            React to audio
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixedColor}
              onChange={(e) =>
                updateSettings({ ...settings, fixedColor: e.target.checked })
              }
            />
            Fix Color
          </label>
          <button
            type="button"
            onClick={() => updateSettings({ ...DEFAULT_TTFX_SETTINGS })}
          >
            Reset text settings
          </button>
        </div>
      </details>
    </div>
  )
}
