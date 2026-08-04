---
name: web-audio-ambient
description: Design and implement Web Audio API ambient music, radio/tuner FX, and generative soft pads for immersive fan sites without heavy asset downloads. Use when editing Snow/I-MISS-YOU audio, 调频台, or procedural music.
---

# Web Audio Ambient (Snow)

## When to use
- Flying Edelweiss music synthesizer, forum tuner (调频台), ambient beds, soft SFX.

## Principles
- Prefer **procedural Web Audio** (oscillators, noise buffers, filters, LFOs) over large MP3s when the aesthetic is ethereal/night-radio.
- Always respect autoplay policy: unlock AudioContext on first user gesture.
- Provide mute / volume; never start loud.
- Honor prefers-reduced-motion and offer a silent mode for accessibility.
- Keep DSP graph documented in comments (nodes + routing).

## Patterns for this project
- Night radio: band-pass noise + sparse sine tones + gentle delay; map frequency digits to filter cutoff / detune.
- Crossfade between states (standby ↔ tuned) with gain ramps (0.3–1.2s), no clicks.
- Do not block main thread: pre-generate short noise buffers; avoid per-frame createOscillator spam.

## Anti-patterns
- Autoplay on page load without gesture.
- Unbounded oscillator creation per keypress without stop/dispose.
