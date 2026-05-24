import math
from pathlib import Path

import numpy as np
from scipy.io.wavfile import write


SR = 44100
BPM = 108
BEATS_PER_BAR = 4
BAR_SECONDS = (60.0 / BPM) * BEATS_PER_BAR
BARS = 36  # ~80s, looping-friendly for menu/gameplay.
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "sounds" / "bgm_kids_fun.wav"

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


def synth_note(buffer: np.ndarray, start_sec: float, dur_sec: float, note: str, amp: float, voice: str) -> None:
    start = int(start_sec * SR)
    end = min(len(buffer), int((start_sec + dur_sec) * SR))
    if start >= len(buffer) or end <= start:
        return

    t = np.arange(end - start, dtype=np.float32) / SR
    freq = note_to_freq(note)

    if voice == "toy":
        wave = (
            0.62 * np.sin(2 * math.pi * freq * t)
            + 0.28 * np.sin(2 * math.pi * (2 * freq) * t + 0.4)
            + 0.10 * np.sin(2 * math.pi * (3 * freq) * t + 0.9)
        )
        env = adsr(t, dur_sec, a=0.008, d=0.11, s=0.38, r=min(0.24, dur_sec * 0.45))
    elif voice == "bell":
        wave = (
            0.50 * np.sin(2 * math.pi * freq * t)
            + 0.22 * np.sin(2 * math.pi * (2.7 * freq) * t + 0.17)
            + 0.18 * np.sin(2 * math.pi * (4.1 * freq) * t + 0.41)
            + 0.10 * np.sin(2 * math.pi * (5.3 * freq) * t + 0.07)
        )
        env = adsr(t, dur_sec, a=0.002, d=0.18, s=0.20, r=min(0.45, dur_sec * 0.65))
    elif voice == "bass":
        wave = 0.82 * np.sin(2 * math.pi * freq * t) + 0.18 * np.sin(2 * math.pi * (0.5 * freq) * t)
        env = adsr(t, dur_sec, a=0.01, d=0.18, s=0.55, r=min(0.25, dur_sec * 0.35))
    else:  # warm pad
        wave = (
            0.70 * np.sin(2 * math.pi * freq * t)
            + 0.20 * np.sin(2 * math.pi * (2 * freq) * t + 0.3)
            + 0.10 * np.sin(2 * math.pi * (3 * freq) * t + 1.0)
        )
        env = adsr(t, dur_sec, a=0.04, d=0.30, s=0.70, r=min(0.70, dur_sec * 0.45))

    buffer[start:end] += (amp * wave * env).astype(np.float32)


def place_note(
    audio: np.ndarray,
    bar_start: float,
    beat_pos: float,
    beat_dur: float,
    note: str,
    amp: float,
    voice: str,
    beat_seconds: float,
) -> None:
    start_sec = bar_start + beat_pos * beat_seconds
    dur_sec = beat_dur * beat_seconds
    synth_note(audio, start_sec, dur_sec, note, amp=amp, voice=voice)


def main() -> None:
    total_seconds = BARS * BAR_SECONDS
    sample_count = int(total_seconds * SR)
    audio = np.zeros(sample_count, dtype=np.float32)
    beat_seconds = 60.0 / BPM

    chords = [
        ["C3", "G3", "C4", "E4"],
        ["F3", "A3", "C4", "F4"],
        ["G2", "D3", "G3", "B3"],
        ["C3", "G3", "C4", "E4"],
        ["A2", "E3", "A3", "C4"],
        ["F3", "A3", "C4", "F4"],
        ["G2", "D3", "G3", "B3"],
        ["C3", "G3", "C4", "E4"],
    ]

    bass_roots = ["C2", "F2", "G1", "C2", "A1", "F2", "G1", "C2"]

    biribu_call = [
        (0.00, 0.32, "G5"),
        (0.42, 0.24, "E5"),
        (0.86, 0.38, "D5"),
        (2.00, 0.32, "A5"),
        (2.38, 0.24, "G5"),
        (2.82, 0.40, "E5"),
    ]

    # Per-harmony melodic endings improve phrase resolution and avoid awkward cadences.
    harmony_endings = {
        "I": {"call": "E5", "run": "C5", "ti": "G4", "bum": "C4", "bum_bass": "C2"},
        "IV": {"call": "F5", "run": "A4", "ti": "C5", "bum": "F4", "bum_bass": "F2"},
        "V": {"call": "D5", "run": "B4", "ti": "D5", "bum": "G4", "bum_bass": "G1"},
        "vi": {"call": "E5", "run": "C5", "ti": "E5", "bum": "A4", "bum_bass": "A1"},
    }

    parara_base = ["E5", "F5", "G5", "A5", "G5", "F5", "E5", "D5"]
    harmony_cycle = ["I", "IV", "V", "I", "vi", "IV", "V", "I"]

    for bar in range(BARS):
        bar_start = bar * BAR_SECONDS
        chord = chords[bar % len(chords)]
        bass = bass_roots[bar % len(bass_roots)]

        harmony = harmony_cycle[bar % len(harmony_cycle)]
        endings = harmony_endings[harmony]

        # Alternate sustained and pulsing chord beds for subtle rhythmic movement.
        if bar % 4 in (0, 2):
            for note in chord:
                synth_note(audio, bar_start, BAR_SECONDS * 0.97, note, amp=0.036, voice="pad")
        else:
            pad_pattern = [(0.0, 1.3), (1.5, 0.9), (2.6, 1.2)]
            for beat_pos, beat_dur in pad_pattern:
                for note in chord:
                    place_note(audio, bar_start, beat_pos, beat_dur, note, 0.030, "pad", beat_seconds)

        bell_patterns = [
            [0.0, 1.5, 2.0, 3.5],
            [0.0, 1.0, 2.5, 3.25],
            [0.0, 1.75, 2.25, 3.5],
            [0.0, 1.25, 2.0, 3.0, 3.5],
        ]
        bell_hits = bell_patterns[bar % len(bell_patterns)]
        for i, hit in enumerate(bell_hits):
            place_note(audio, bar_start, hit, 0.28, chord[i % len(chord)], 0.050, "bell", beat_seconds)

        place_note(audio, bar_start, 0.0, 0.75, bass, 0.085, "bass", beat_seconds)
        place_note(audio, bar_start, 2.0, 0.72, bass, 0.080, "bass", beat_seconds)

        if bar % 2 == 0:
            for beat_pos, beat_dur, note in biribu_call:
                place_note(audio, bar_start, beat_pos, beat_dur, note, 0.118, "toy", beat_seconds)

            # Land on a chord tone to make each phrase ending feel consonant.
            place_note(audio, bar_start, 3.30, 0.62, endings["call"], 0.132, "toy", beat_seconds)
        else:
            run_step = 0.30 if bar % 8 in (1, 5) else 0.28
            for i, note in enumerate(parara_base):
                place_note(audio, bar_start, 0.0 + i * run_step, 0.24, note, 0.10, "toy", beat_seconds)

            place_note(audio, bar_start, 2.45, 0.42, endings["run"], 0.12, "toy", beat_seconds)

            # "ti-bum" final hit of the phrase.
            place_note(audio, bar_start, 3.00, 0.34, endings["ti"], 0.11, "toy", beat_seconds)
            place_note(audio, bar_start, 3.34, 0.62, endings["bum"], 0.13, "toy", beat_seconds)
            place_note(audio, bar_start, 3.34, 0.66, endings["bum_bass"], 0.10, "bass", beat_seconds)

    delay_seconds = 0.22
    feedback = 0.18
    shift = int(delay_seconds * SR)
    if shift < len(audio):
        delayed = np.zeros_like(audio)
        delayed[shift:] = audio[:-shift] * feedback
        audio += delayed

    fade_in = int(SR * 1.2)
    fade_out = int(SR * 2.0)
    audio[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    audio[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)

    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        audio = audio / peak * 0.92

    pcm16 = (audio * 32767).astype(np.int16)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    write(OUTPUT_PATH, SR, pcm16)
    print(f"Generated {OUTPUT_PATH} ({len(pcm16) / SR:.2f}s)")


if __name__ == "__main__":
    main()