export type OmarchyRadioTrack = {
  title: string
  artist: string
  file: string
  explicit?: boolean
}

type Playlist = { tracks: OmarchyRadioTrack[] }

export type OmarchyRadioState = {
  started: boolean
  playing: boolean
  loading: boolean
  index: number
  track: OmarchyRadioTrack
  error: boolean
}

const RADIO_ORIGIN = 'https://radio.omarchy.org'
const PLAYLIST_URL = `${RADIO_ORIGIN}/tracks/playlist.json`
const FIRST_TRACK: OmarchyRadioTrack = {
  title: 'Omarchy Oligarchy (Synthwave Mix)',
  artist: 'YZL81',
  file: 'YZL81 - Omarchy Oligarchy (Synthwave Mix).mp3',
}
const BAND_COUNT = 24
const WINDOW_SIZE = 1024
const MIN_HZ = 60
const MAX_HZ = 10_000

function trackUrl(track: OmarchyRadioTrack) {
  return `${RADIO_ORIGIN}/tracks/${encodeURIComponent(track.file)}`
}

function goertzel(samples: Float32Array, rate: number, frequency: number) {
  const n = samples.length
  const k = Math.min(n - 1, Math.max(1, Math.round((n * frequency) / rate)))
  const w = (2 * Math.PI * k) / n
  const coefficient = 2 * Math.cos(w)
  let previous = 0
  let previous2 = 0
  for (let i = 0; i < n; i++) {
    const value = samples[i] + coefficient * previous - previous2
    previous2 = previous
    previous = value
  }
  return (
    previous2 * previous2 +
    previous * previous -
    coefficient * previous * previous2
  )
}

class OmarchyRadio {
  readonly analysis = {
    bands: new Float32Array(BAND_COUNT),
    volume: 0,
    beat: 0,
  }

  private tracks: OmarchyRadioTrack[] = [FIRST_TRACK]
  private audio: HTMLAudioElement | null = null
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples = new Float32Array(WINDOW_SIZE)
  private magnitudes = new Float32Array(BAND_COUNT)
  private peak = 1e-6
  private previousRms = 0
  private beatHold = 0
  private lastAnalysis = -Infinity
  private listeners = new Set<() => void>()
  private state: OmarchyRadioState = {
    started: false,
    playing: false,
    loading: false,
    index: 0,
    track: FIRST_TRACK,
    error: false,
  }

  getSnapshot = () => this.state
  getServerSnapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private publish(patch: Partial<OmarchyRadioState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private async loadPlaylist() {
    try {
      const response = await fetch(PLAYLIST_URL)
      if (!response.ok) return
      const playlist = (await response.json()) as Playlist
      if (playlist.tracks.length) this.tracks = playlist.tracks
    } catch {
      // The first supplied track remains playable when the manifest is offline.
    }
  }

  private ensureAudio() {
    if (this.audio) return this.audio
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'none'
    audio.volume = 0.8
    audio.src = trackUrl(this.state.track)
    audio.addEventListener('playing', () =>
      this.publish({ playing: true, loading: false, error: false }),
    )
    audio.addEventListener('pause', () => this.publish({ playing: false }))
    audio.addEventListener('waiting', () => this.publish({ loading: true }))
    audio.addEventListener('error', () =>
      this.publish({ playing: false, loading: false, error: true }),
    )
    audio.addEventListener('ended', () => void this.next())

    this.context = new AudioContext({ sampleRate: 24_000 })
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = WINDOW_SIZE
    this.analyser.smoothingTimeConstant = 0
    const source = this.context.createMediaElementSource(audio)
    source.connect(this.analyser)
    this.analyser.connect(this.context.destination)
    this.audio = audio
    void this.loadPlaylist()
    return audio
  }

  start = async () => {
    const audio = this.ensureAudio()
    this.publish({ started: true, loading: true })
    await this.context?.resume()
    try {
      await audio.play()
    } catch {
      this.publish({ loading: false, error: true })
    }
  }

  toggle = async () => {
    const audio = this.ensureAudio()
    if (!this.state.started || audio.paused) await this.start()
    else audio.pause()
  }

  private playIndex = async (index: number) => {
    const audio = this.ensureAudio()
    const length = this.tracks.length
    const normalized = ((index % length) + length) % length
    const track = this.tracks[normalized]
    this.publish({ started: true, loading: true, index: normalized, track })
    audio.src = trackUrl(track)
    audio.load()
    await this.context?.resume()
    try {
      await audio.play()
    } catch {
      this.publish({ loading: false, error: true })
    }
  }

  previous = () => this.playIndex(this.state.index - 1)
  next = () => this.playIndex(this.state.index + 1)

  analyze(time: number) {
    const analyser = this.analyser
    const context = this.context
    if (!analyser || !context || time - this.lastAnalysis < 40) return
    this.lastAnalysis = time
    analyser.getFloatTimeDomainData(this.samples)

    let squares = 0
    for (let i = 0; i < WINDOW_SIZE; i++) squares += this.samples[i] ** 2
    const rms = Math.sqrt(squares / WINDOW_SIZE)
    let frameMax = 0
    for (let band = 0; band < BAND_COUNT; band++) {
      const frequency = MIN_HZ * (MAX_HZ / MIN_HZ) ** (band / (BAND_COUNT - 1))
      const magnitude = goertzel(this.samples, context.sampleRate, frequency)
      this.magnitudes[band] = magnitude
      if (magnitude > frameMax) frameMax = magnitude
    }

    this.peak = Math.max(this.peak * 0.995, frameMax, 1e-6)
    for (let band = 0; band < BAND_COUNT; band++) {
      this.analysis.bands[band] = Math.min(
        1,
        Math.sqrt(this.magnitudes[band] / this.peak),
      )
    }
    this.analysis.volume = Math.min(1, rms * 4)
    if (rms > this.previousRms * 1.35 && rms > 0.02) {
      this.beatHold = 3
      this.analysis.beat = 1
    } else if (this.beatHold > 0) {
      this.beatHold--
      this.analysis.beat = 1
    } else {
      this.analysis.beat = 0
    }
    this.previousRms = rms
  }
}

export const omarchyRadio = new OmarchyRadio()
