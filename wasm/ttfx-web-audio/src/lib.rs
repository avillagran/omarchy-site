use std::collections::HashSet;
use std::rc::Rc;

use clap::Parser;
use ttfx::engine::ctx::{Clock, EngineCtx};
use ttfx::engine::effect::Effect;
use ttfx::engine::terminal::TerminalConfig;
use ttfx::utils::ansi;
use ttfx::utils::graphics::{Color, Gradient};
use ttfx::utils::rng::Rng;
use wasm_bindgen::prelude::*;

const EFFECTS: [&str; 37] = [
    "beams",
    "binarypath",
    "blackhole",
    "bouncyballs",
    "bubbles",
    "burn",
    "colorshift",
    "crumble",
    "decrypt",
    "errorcorrect",
    "expand",
    "fireworks",
    "highlight",
    "laseretch",
    "matrix",
    "middleout",
    "orbittingvolley",
    "overflow",
    "pour",
    "print",
    "rain",
    "randomsequence",
    "rings",
    "scattered",
    "slice",
    "slide",
    "smoke",
    "spotlights",
    "spray",
    "swarm",
    "sweep",
    "synthgrid",
    "thunderstorm",
    "unstable",
    "vhstape",
    "waves",
    "wipe",
];

type Rgb = (u8, u8, u8);

#[wasm_bindgen]
pub struct Session {
    effect_name: String,
    effect: Box<dyn Effect>,
    ctx: EngineCtx,
    width: usize,
    height: usize,
    symbols: Vec<u32>,
    foreground: Vec<u32>,
    background: Vec<u32>,
    flags: Vec<u8>,
    volume: f32,
    bass: f32,
    beat: bool,
    theme: Option<[Rgb; 8]>,
}

#[wasm_bindgen]
impl Session {
    #[wasm_bindgen(constructor)]
    pub fn new(
        input: &str,
        effect_name: &str,
        columns: usize,
        rows: usize,
        seed: Option<u32>,
        frame_rate: i32,
    ) -> Result<Session, JsValue> {
        let cli = ttfx::cli::Cli::try_parse_from(["ttfx", effect_name])
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let command = cli
            .effect
            .ok_or_else(|| JsValue::from_str("missing ttfx effect"))?;
        let mut effect = command.build_effect();
        let mut config = TerminalConfig::default();
        config.canvas_width = columns.max(1) as i64;
        config.canvas_height = rows.max(1) as i64;
        // Keep explicit top-left coordinates, including leading blank rows.
        // Compass anchors align visible text and discard this positioning.
        config.preserve_input_layout = true;
        let frame_rate = i64::from(frame_rate.max(1));
        config.frame_rate = frame_rate;
        config.ignore_terminal_dimensions = true;
        let mut ctx = EngineCtx::new(
            input,
            config,
            Rng::seeded(seed.unwrap_or(0x9ece6a) as u64),
            Clock::virtual_with_frame_rate(frame_rate.max(1)),
        )
        .map_err(|error| JsValue::from_str(&format!("{error:?}")))?;
        effect
            .build(&mut ctx)
            .map_err(|error| JsValue::from_str(&format!("{error:?}")))?;
        let count = columns.max(1) * rows.max(1);
        Ok(Session {
            effect_name: effect_name.to_string(),
            effect,
            ctx,
            width: columns.max(1),
            height: rows.max(1),
            symbols: vec![32; count],
            foreground: vec![0; count],
            background: vec![0; count],
            flags: vec![0; count],
            volume: 0.0,
            bass: 0.0,
            beat: false,
            theme: None,
        })
    }

    pub fn set_audio(&mut self, volume: f32, bass: f32, beat: bool) {
        self.volume = volume.clamp(0.0, 1.0);
        self.bass = bass.clamp(0.0, 1.0);
        self.beat = beat;
    }

    #[allow(clippy::too_many_arguments)]
    pub fn set_theme(
        &mut self,
        accent: u32,
        foreground: u32,
        red: u32,
        yellow: u32,
        green: u32,
        cyan: u32,
        blue: u32,
        magenta: u32,
    ) {
        self.theme = Some([
            unpack(accent),
            unpack(foreground),
            unpack(red),
            unpack(yellow),
            unpack(green),
            unpack(cyan),
            unpack(blue),
            unpack(magenta),
        ]);
    }

    pub fn step(&mut self) -> bool {
        self.apply_transforms();
        self.effect
            .on_audio(&mut self.ctx, self.volume, self.bass, self.beat);
        let Some(frame) = self.effect.next_frame(&mut self.ctx) else {
            return false;
        };
        parse_frame(
            &frame,
            self.width,
            self.height,
            &mut self.symbols,
            &mut self.foreground,
            &mut self.background,
            &mut self.flags,
        );
        true
    }

    /// Restyle the current terminal without advancing animation or its clock.
    /// Used while the browser holds a completed frame with live theme/audio.
    pub fn refresh(&mut self) {
        self.apply_transforms();
        let frame = self.ctx.terminal.get_formatted_output_string();
        parse_frame(
            &frame,
            self.width,
            self.height,
            &mut self.symbols,
            &mut self.foreground,
            &mut self.background,
            &mut self.flags,
        );
    }

    pub fn fill(
        &self,
        symbols: &mut [u32],
        foreground: &mut [u32],
        background: &mut [u32],
        flags: &mut [u8],
    ) -> Result<(), JsValue> {
        let count = self.width * self.height;
        if symbols.len() < count
            || foreground.len() < count
            || background.len() < count
            || flags.len() < count
        {
            return Err(JsValue::from_str("frame arrays are too small"));
        }
        symbols[..count].copy_from_slice(&self.symbols);
        foreground[..count].copy_from_slice(&self.foreground);
        background[..count].copy_from_slice(&self.background);
        flags[..count].copy_from_slice(&self.flags);
        Ok(())
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    fn apply_transforms(&self) {
        let volume = self.volume;
        let active = volume > 0.02 || self.bass > 0.05;
        if active {
            let brightness = 1.0 + volume * 0.45;
            let hue = if self.effect_name == "burn" {
                0.0
            } else {
                self.bass * 45.0 + volume * 18.0 + if self.beat { 10.0 } else { 0.0 }
            };
            ansi::set_audio_color(true, brightness, hue_matrix(hue));
        } else {
            ansi::set_audio_color(false, 1.0, identity_matrix());
        }
        ansi::set_color_transform(
            self.theme
                .map(|theme| theme_transform(&self.effect_name, theme)),
        );
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        ansi::set_audio_color(false, 1.0, identity_matrix());
        ansi::set_color_transform(None);
    }
}

#[wasm_bindgen]
pub fn effect_catalog() -> String {
    let body = EFFECTS
        .iter()
        .map(|name| format!(r#"{{"name":"{name}","about":""}}"#))
        .collect::<Vec<_>>()
        .join(",");
    format!("[{body}]")
}

fn identity_matrix() -> [f32; 9] {
    [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
}

fn hue_matrix(degrees: f32) -> [f32; 9] {
    let radians = degrees.to_radians();
    let (cosine, sine) = (radians.cos(), radians.sin());
    let t = 1.0 - cosine;
    let w = 0.57735026;
    [
        cosine + t / 3.0,
        t / 3.0 - w * sine,
        t / 3.0 + w * sine,
        t / 3.0 + w * sine,
        cosine + t / 3.0,
        t / 3.0 - w * sine,
        t / 3.0 - w * sine,
        t / 3.0 + w * sine,
        cosine + t / 3.0,
    ]
}

fn unpack(value: u32) -> Rgb {
    (
        ((value >> 16) & 255) as u8,
        ((value >> 8) & 255) as u8,
        (value & 255) as u8,
    )
}

fn gradient_set(stops: &[&str], steps: i64) -> HashSet<Rgb> {
    let colors = stops
        .iter()
        .map(|hex| Color::from_hex(hex).expect("valid color"))
        .collect::<Vec<_>>();
    Gradient::with_steps(&colors, steps, false)
        .expect("valid gradient")
        .spectrum
        .iter()
        .filter_map(|color| parse_rgb(&color.rgb_color.to_string()))
        .collect()
}

fn parse_rgb(value: &str) -> Option<Rgb> {
    let value = value.trim().trim_start_matches('#');
    if value.len() != 6 {
        return None;
    }
    Some((
        u8::from_str_radix(&value[0..2], 16).ok()?,
        u8::from_str_radix(&value[2..4], 16).ok()?,
        u8::from_str_radix(&value[4..6], 16).ok()?,
    ))
}

fn final_accents(effect: &str) -> HashSet<Rgb> {
    let (stops, steps): (&[&str], i64) = match effect {
        "binarypath" => (&["00d500", "007500"], 12),
        "blackhole" => (&["8A008A", "00D1FF", "ffffff"], 9),
        "bubbles" => (&["d33aff", "02ff7f"], 12),
        "crumble" => (&["5CE1FF", "FF8C00"], 12),
        "decrypt" => (&["eda000"], 12),
        "errorcorrect" | "fireworks" | "smoke" | "thunderstorm" | "unstable" => {
            (&["8A008A", "00D1FF", "FFFFFF"], 12)
        }
        "laseretch" | "sweep" => (&["8A008A", "00D1FF", "ffffff"], 8),
        "swarm" => (&["31b900", "f0ff65"], 12),
        "synthgrid" => (&["8a008a", "00d1ff", "ffffff"], 12),
        "vhstape" => (&["ab48ff", "e7b2b2", "fffebd"], 12),
        _ => return HashSet::new(),
    };
    gradient_set(stops, steps)
}

fn palette_map((r, g, b): Rgb, theme: [Rgb; 8]) -> Rgb {
    if (r, g, b) == (0, 0, 0) {
        return (0, 0, 0);
    }
    let rf = r as f32 / 255.0;
    let gf = g as f32 / 255.0;
    let bf = b as f32 / 255.0;
    let max = rf.max(gf).max(bf);
    let min = rf.min(gf).min(bf);
    let delta = max - min;
    let target = if delta / max.max(0.001) < 0.12 {
        theme[1]
    } else {
        let wheel = [
            theme[2], theme[3], theme[4], theme[5], theme[6], theme[7], theme[2],
        ];
        let hue = if max == rf {
            ((gf - bf) / delta).rem_euclid(6.0)
        } else if max == gf {
            (bf - rf) / delta + 2.0
        } else {
            (rf - gf) / delta + 4.0
        };
        let index = hue.floor() as usize;
        let fraction = hue - index as f32;
        let a = wheel[index];
        let z = wheel[index + 1];
        (
            (a.0 as f32 + (z.0 as f32 - a.0 as f32) * fraction).round() as u8,
            (a.1 as f32 + (z.1 as f32 - a.1 as f32) * fraction).round() as u8,
            (a.2 as f32 + (z.2 as f32 - a.2 as f32) * fraction).round() as u8,
        )
    };
    (
        (target.0 as f32 * max).round() as u8,
        (target.1 as f32 * max).round() as u8,
        (target.2 as f32 * max).round() as u8,
    )
}

fn theme_transform(effect: &str, theme: [Rgb; 8]) -> ansi::ColorTransform {
    let effect_name = effect.to_string();
    let accents = final_accents(effect);
    let fire = if effect == "burn" {
        gradient_set(&["ffffff", "fff75d", "fe650d", "8A003C", "510100"], 10)
    } else {
        HashSet::new()
    };
    Rc::new(move |r, g, b| {
        let source = (r, g, b);
        match effect_name.as_str() {
            "colorshift" | "waves" => source,
            "burn" if fire.contains(&source) => source,
            "burn" => palette_map(source, theme),
            // Beam/cooling and storm fade/glow colors are interpolated beyond
            // the final gradient. Map every shade, preserving its intensity.
            "laseretch" | "thunderstorm" => palette_map(source, theme),
            "binarypath" | "blackhole" | "bubbles" | "crumble" | "decrypt" | "errorcorrect"
            | "fireworks" | "smoke" | "swarm" | "sweep" | "synthgrid" | "unstable" | "vhstape" => {
                if accents.contains(&source) {
                    palette_map(source, theme)
                } else {
                    source
                }
            }
            _ => palette_map(source, theme),
        }
    })
}

#[derive(Default, Clone, Copy)]
struct Sgr {
    fg: u32,
    bg: u32,
    flags: u8,
    reverse: bool,
}

fn parse_frame(
    frame: &str,
    width: usize,
    height: usize,
    symbols: &mut [u32],
    foreground: &mut [u32],
    background: &mut [u32],
    flags: &mut [u8],
) {
    let count = width * height;
    symbols[..count].fill(32);
    foreground[..count].fill(0);
    background[..count].fill(0);
    flags[..count].fill(0);
    let mut style = Sgr::default();
    let mut row = 0usize;
    let mut column = 0usize;
    let mut chars = frame.chars().peekable();
    while let Some(character) = chars.next() {
        if character == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            let mut sequence = String::new();
            while let Some(next) = chars.next() {
                if next == 'm' {
                    apply_sgr(&sequence, &mut style);
                    break;
                }
                if next.is_ascii_alphabetic() {
                    break;
                }
                sequence.push(next);
            }
            continue;
        }
        if character == '\n' {
            row += 1;
            column = 0;
            if row >= height {
                break;
            }
            continue;
        }
        if character == '\r' {
            column = 0;
            continue;
        }
        if row < height && column < width {
            let index = row * width + column;
            symbols[index] = character as u32;
            if style.reverse {
                foreground[index] = style.bg;
                background[index] = style.fg;
            } else {
                foreground[index] = style.fg;
                background[index] = style.bg;
            }
            flags[index] = style.flags;
        }
        column += 1;
    }
}

fn apply_sgr(sequence: &str, style: &mut Sgr) {
    let values = if sequence.is_empty() {
        vec![0]
    } else {
        sequence
            .split(';')
            .map(|value| value.parse::<u16>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let mut index = 0usize;
    while index < values.len() {
        match values[index] {
            0 => *style = Sgr::default(),
            1 => style.flags |= 1,
            3 => style.flags |= 2,
            4 => style.flags |= 4,
            5 => style.flags |= 16,
            7 => style.reverse = true,
            8 => style.flags |= 32,
            9 => style.flags |= 64,
            22 => style.flags &= !1,
            23 => style.flags &= !2,
            24 => style.flags &= !4,
            25 => style.flags &= !16,
            27 => style.reverse = false,
            28 => style.flags &= !32,
            29 => style.flags &= !64,
            30..=37 => style.fg = ansi16(values[index] as u8 - 30, false),
            90..=97 => style.fg = ansi16(values[index] as u8 - 90, true),
            40..=47 => style.bg = ansi16(values[index] as u8 - 40, false),
            100..=107 => style.bg = ansi16(values[index] as u8 - 100, true),
            39 => style.fg = 0,
            49 => style.bg = 0,
            38 | 48 => {
                let foreground = values[index] == 38;
                if values.get(index + 1) == Some(&2) && index + 4 < values.len() {
                    let color = ((values[index + 2] as u32) << 16)
                        | ((values[index + 3] as u32) << 8)
                        | values[index + 4] as u32;
                    if foreground {
                        style.fg = color
                    } else {
                        style.bg = color
                    }
                    index += 4;
                } else if values.get(index + 1) == Some(&5) && index + 2 < values.len() {
                    let color = xterm(values[index + 2] as u8);
                    if foreground {
                        style.fg = color
                    } else {
                        style.bg = color
                    }
                    index += 2;
                }
            }
            _ => {}
        }
        index += 1;
    }
}

fn ansi16(index: u8, bright: bool) -> u32 {
    const NORMAL: [u32; 8] = [
        0x000000, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080, 0xc0c0c0,
    ];
    const BRIGHT: [u32; 8] = [
        0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff,
    ];
    if bright {
        BRIGHT[index as usize]
    } else {
        NORMAL[index as usize]
    }
}

fn xterm(index: u8) -> u32 {
    if index < 8 {
        return ansi16(index, false);
    }
    if index < 16 {
        return ansi16(index - 8, true);
    }
    if index < 232 {
        let value = index - 16;
        let component = |part: u8| if part == 0 { 0 } else { 55 + part as u32 * 40 };
        let red = component(value / 36);
        let green = component((value % 36) / 6);
        let blue = component(value % 6);
        return (red << 16) | (green << 8) | blue;
    }
    let gray = 8 + (index as u32 - 232) * 10;
    (gray << 16) | (gray << 8) | gray
}
