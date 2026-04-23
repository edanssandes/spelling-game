import math
from pathlib import Path

import numpy as np
from scipy.io.wavfile import write


SR = 44100
BPM = 70
BEATS_PER_BAR = 4
BAR_SECONDS = (60.0 / BPM) * BEATS_PER_BAR
BARS = 28  # ~96s, within requested 1-2 minutes.
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "sounds" / "bgm_calm.wav"

A4 = 440.0
NOTE_MAP = {
    "C": -9,
    "C#": -8,
    "Db": -8,
    "D": -7,
    "D#": -6,
    "Eb": -6,
    "E": -5,
    "F": -4,
    "F#": -3,
    "Gb": -3,
    "G": -2,
    "G#": -1,
    "Ab": -1,
    "A": 0,
    "A#": 1,
    "Bb": 1,
    "B": 2,
}


def note_to_freq(note: str) -> float:
    name = note[:-1]
    octave = int(note[-1])
    semitone = NOTE_MAP[name] + (octave - 4) * 12
    return A4 * (2.0 ** (semitone / 12.0))


def adsr(t: np.ndarray, dur: float, a: float, d: float, s: float, r: float) -> np.ndarray:
    env = np.zeros_like(t)
    attack = np.minimum(1.0, t / max(a, 1e-6))
    decay_t = np.clip((t - a) / max(d, 1e-6), 0.0, 1.0)
    decay = 1.0 - (1.0 - s) * decay_t
    sustain = np.full_like(t, s)
    rel_start = max(0.0, dur - r)
    release = np.clip((dur - t) / max(r, 1e-6), 0.0, 1.0)

    env = np.where(t < a, attack, env)
    env = np.where((t >= a) & (t < a + d), decay, env)
    env = np.where((t >= a + d) & (t < rel_start), sustain, env)
    env = np.where(t >= rel_start, sustain * release, env)
    return env


def synth_note(buffer: np.ndarray, start_sec: float, dur_sec: float, note: str, amp: float, piano: bool) -> None:
    start = int(start_sec * SR)
    end = min(len(buffer), int((start_sec + dur_sec) * SR))
    if start >= len(buffer) or end <= start:
        return

    t = np.arange(end - start, dtype=np.float32) / SR
    freq = note_to_freq(note)

    if piano:
        # Simple piano-like timbre using stacked partials.
        wave = (
            0.72 * np.sin(2 * math.pi * freq * t)
            + 0.20 * np.sin(2 * math.pi * (2 * freq) * t + 0.18)
            + 0.08 * np.sin(2 * math.pi * (3 * freq) * t + 0.47)
        )
        env = adsr(t, dur_sec, a=0.01, d=0.22, s=0.42, r=min(0.60, dur_sec * 0.45))
    else:
        wave = 0.85 * np.sin(2 * math.pi * freq * t) + 0.15 * np.sin(2 * math.pi * (2 * freq) * t)
        env = adsr(t, dur_sec, a=0.03, d=0.35, s=0.62, r=min(0.90, dur_sec * 0.55))

    buffer[start:end] += (amp * wave * env).astype(np.float32)


def main() -> None:
    total_seconds = BARS * BAR_SECONDS
    sample_count = int(total_seconds * SR)
    audio = np.zeros(sample_count, dtype=np.float32)

    progression = [
        ["C3", "G3", "C4", "E4"],
        ["A2", "E3", "A3", "C4"],
        ["F2", "C3", "F3", "A3"],
        ["G2", "D3", "G3", "B3"],
        ["C3", "G3", "C4", "E4"],
        ["E2", "B2", "E3", "G3"],
        ["A2", "E3", "A3", "C4"],
        ["G2", "D3", "G3", "B3"],
    ]

    melody = {
        0: ["E5", "G5"],
        2: ["D5", "C5"],
        4: ["E5", "G5"],
        6: ["A4", "B4"],
        8: ["G5", "E5"],
        10: ["D5", "B4"],
        12: ["C5", "E5"],
        14: ["D5", "G5"],
        16: ["E5", "A5"],
        18: ["G5", "E5"],
        20: ["D5", "C5"],
        22: ["B4", "G4"],
        24: ["E5", "G5"],
        26: ["D5", "C5"],
    }

    for bar in range(BARS):
        bar_start = bar * BAR_SECONDS
        chord = progression[bar % len(progression)]

        for note in chord:
            synth_note(audio, bar_start, BAR_SECONDS * 0.98, note, amp=0.05, piano=False)

        arp_pattern = [0, 1, 2, 1, 2, 3, 2, 1]
        beat_seconds = 60.0 / BPM
        for i, idx in enumerate(arp_pattern):
            step_start = bar_start + i * (beat_seconds / 2)
            synth_note(audio, step_start, beat_seconds * 0.45, chord[idx], amp=0.085, piano=True)

        if bar in melody:
            synth_note(audio, bar_start + beat_seconds * 1.0, beat_seconds * 0.9, melody[bar][0], amp=0.10, piano=True)
            synth_note(audio, bar_start + beat_seconds * 3.0, beat_seconds * 0.9, melody[bar][1], amp=0.10, piano=True)

    # Lightweight delay/reverb tail.
    delay_seconds = 0.28
    feedback = 0.22
    shift = int(delay_seconds * SR)
    if shift < len(audio):
        delayed = np.zeros_like(audio)
        delayed[shift:] = audio[:-shift] * feedback
        audio += delayed

    fade_in = int(SR * 1.8)
    fade_out = int(SR * 2.4)
    audio[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    audio[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)

    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        audio = audio / peak * 0.9

    pcm16 = (audio * 32767).astype(np.int16)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write(OUTPUT_PATH, SR, pcm16)
    print(f"Generated {OUTPUT_PATH} ({len(pcm16) / SR:.2f}s)")


if __name__ == "__main__":
    main()
