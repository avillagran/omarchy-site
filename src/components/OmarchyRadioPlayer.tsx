import { useSyncExternalStore } from 'react'
import { useToolsEnabled } from '@/lib/use-tools-enabled'
import { omarchyRadio } from '@/lib/omarchy-radio'

export function OmarchyRadioPlayer({ ghost = false }: { ghost?: boolean }) {
  const toolsEnabled = useToolsEnabled()
  const state = useSyncExternalStore(
    omarchyRadio.subscribe,
    omarchyRadio.getSnapshot,
    omarchyRadio.getServerSnapshot,
  )

  if (!toolsEnabled || !state.started) return null

  return (
    <div
      data-radio-player={ghost ? undefined : true}
      data-radio-ghost={ghost ? true : undefined}
      data-tools-region
      inert={ghost}
      aria-hidden={ghost ? true : undefined}
      data-playing={state.playing ? 'true' : 'false'}
      className="radio-player relative mx-auto flex h-9 min-w-28 max-w-[19rem] flex-1 items-center gap-1 border border-border-subtle bg-bg/90 px-1.5 text-text shadow-sm backdrop-blur-md"
      aria-label="Omarchy Radio"
    >
      <button
        type="button"
        onClick={() => void omarchyRadio.previous()}
        className="grid size-7 shrink-0 place-items-center text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Previous track"
      >
        «
      </button>
      <button
        type="button"
        onClick={() => void omarchyRadio.toggle()}
        className="grid size-7 shrink-0 place-items-center text-xs text-brand transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={state.playing ? 'Pause' : 'Play'}
      >
        {state.loading ? '…' : state.playing ? 'Ⅱ' : '▶'}
      </button>
      <button
        type="button"
        onClick={() => void omarchyRadio.next()}
        className="grid size-7 shrink-0 place-items-center text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Next track"
      >
        »
      </button>
      <span className="min-w-0 flex-1 border-l border-border-subtle pl-2 leading-tight">
        <span className="radio-marquee block overflow-hidden text-[11px] font-medium whitespace-nowrap">
          <span className="radio-marquee__track">
            <span>{state.track.title}</span>
            <span aria-hidden="true">{state.track.title}</span>
          </span>
        </span>
        <span className="block truncate text-[9px] text-text-secondary">
          {state.track.artist}
        </span>
      </span>
    </div>
  )
}
