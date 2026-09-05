/* tslint:disable */
/* eslint-disable */

export class Session {
    free(): void;
    [Symbol.dispose](): void;
    fill(symbols: Uint32Array, foreground: Uint32Array, background: Uint32Array, flags: Uint8Array): void;
    height(): number;
    constructor(input: string, effect_name: string, columns: number, rows: number, seed: number | null | undefined, frame_rate: number);
    /**
     * Restyle the current terminal without advancing animation or its clock.
     * Used while the browser holds a completed frame with live theme/audio.
     */
    refresh(): void;
    set_audio(volume: number, bass: number, beat: boolean): void;
    set_theme(accent: number, foreground: number, red: number, yellow: number, green: number, cyan: number, blue: number, magenta: number): void;
    step(): boolean;
    width(): number;
}

export function effect_catalog(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_session_free: (a: number, b: number) => void;
    readonly effect_catalog: (a: number) => void;
    readonly session_fill: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => void;
    readonly session_height: (a: number) => number;
    readonly session_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly session_refresh: (a: number) => void;
    readonly session_set_audio: (a: number, b: number, c: number, d: number) => void;
    readonly session_set_theme: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly session_step: (a: number) => number;
    readonly session_width: (a: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
