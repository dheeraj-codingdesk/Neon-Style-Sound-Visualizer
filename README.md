# Neon Sound Visualizer

A neon‑style audio visualizer built with React, TypeScript, Canvas, and the WebAudio API. It renders glowing frequency bars, a cyan waveform, and particle bursts on beats. Supports both microphone input and (browser‑dependent) system/tab audio capture.

## Features
- Real‑time frequency analysis (bass/mid/treble)
- Neon gradient bars with glow
- Glowing waveform line
- Particle bursts on beat detection
- Microphone and system/tab audio capture modes

## Requirements
- Node.js 18+
- Modern browser; Chrome recommended for tab/system audio on macOS

## Quick Start
- Install dependencies: `npm install`
- Start dev server: `npm run dev` and open `http://localhost:5173/`
- Build production: `npm run build`

## Usage
- Click `Use Microphone` to visualize mic input.
- Click `Use System Audio` to capture audio while sharing:
  - In Chrome, select a browser tab and enable “Share tab audio”. Window/screen selections may not provide audio.
  - If you see `NotSupportedError`, try Chrome, share a tab, and enable audio.

## Troubleshooting
- `Error accessing system audio: NotSupportedError`: Browser or selection doesn’t support system audio.
  - Use Chrome on macOS, choose a browser tab, and enable “Share tab audio”.
- Visuals too jittery or too calm: tune smoothing constants below.
- No movement: ensure permissions were granted and an audio source is playing.

## Tuning & Configuration
You can adjust responsiveness and beat detection in `src/components/NeonSoundVisualizer.tsx`.
- Analyser smoothing: `smoothingTimeConstant` at `src/components/NeonSoundVisualizer.tsx:49` and `src/components/NeonSoundVisualizer.tsx:89`.
- Bar smoothing/clamping: `drawBars` at `src/components/NeonSoundVisualizer.tsx:150-166`.
- Waveform smoothing/clamping: `drawWaveform` at `src/components/NeonSoundVisualizer.tsx:176-201`.
- Beat detection EMA/threshold/cooldown: `analyzeAudio` at `src/components/NeonSoundVisualizer.tsx:229-244`.
- Particle burst intensity: `animate` at `src/components/NeonSoundVisualizer.tsx:262-271` and velocity in `createParticle` at `src/components/NeonSoundVisualizer.tsx:129-136`.

## Scripts
- `npm run dev` – start Vite dev server
- `npm run build` – production build

## Project Structure
- `src/App.tsx` – mounts the visualizer
- `src/components/NeonSoundVisualizer.tsx` – main visualizer (canvas + audio)
- `index.html` – app entry

## Notes on Styling
The component uses utility class names designed for Tailwind. If Tailwind CSS is not configured, the canvas visualization still works but UI styles may be minimal. Tailwind setup is optional.

## Permissions
- Microphone: required for mic mode
- Screen/Tab sharing: required for system/tab audio mode (audio must be explicitly enabled in the picker)

