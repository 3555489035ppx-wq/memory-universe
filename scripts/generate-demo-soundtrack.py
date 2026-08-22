from __future__ import annotations

import math
import random
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "public" / "music" / "high-school" / "memento-ambience.wav"
SAMPLE_RATE = 22_050
DURATION_SECONDS = 180


def envelope(time: float, start: float, length: float) -> float:
    progress = (time - start) / max(0.001, length)
    if progress <= 0 or progress >= 1:
        return 0.0
    attack = min(1.0, progress / 0.08)
    release = min(1.0, (1.0 - progress) / 0.18)
    return attack * release


def create_track() -> None:
    random.seed(20260821)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    total_frames = SAMPLE_RATE * DURATION_SECONDS
    chords = (
        (261.63, 329.63, 392.00),
        (220.00, 277.18, 329.63),
        (246.94, 311.13, 369.99),
        (196.00, 246.94, 293.66),
    )
    with wave.open(str(OUTPUT), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        block = bytearray()
        for frame in range(total_frames):
            time = frame / SAMPLE_RATE
            chord_index = int(time // 12) % len(chords)
            chord_start = (time // 12) * 12
            value = 0.0
            for note_index, frequency in enumerate(chords[chord_index]):
                phase = time * frequency * math.tau
                value += math.sin(phase + note_index * 0.7) * (0.085 - note_index * 0.012)
                value += math.sin(phase * 2.0) * 0.018
            pulse = math.exp(-((time % 3.0) / 0.11) ** 2) * 0.055
            shimmer = math.sin(time * math.tau * 5.5) * 0.012 * (0.5 + 0.5 * math.sin(time * 0.22))
            noise = (random.random() * 2.0 - 1.0) * 0.006
            value += pulse + shimmer + noise
            value *= 0.76 + 0.24 * envelope(time, chord_start, 12)
            if time < 1.4:
                value *= time / 1.4
            if time > DURATION_SECONDS - 3.0:
                value *= max(0.0, (DURATION_SECONDS - time) / 3.0)
            sample = max(-1.0, min(1.0, value))
            block.extend(int(sample * 32_000).to_bytes(2, "little", signed=True))
            if len(block) >= SAMPLE_RATE * 2:
                audio.writeframes(block)
                block.clear()
        if block:
            audio.writeframes(block)


if __name__ == "__main__":
    create_track()
    print(f"Generated {OUTPUT} ({DURATION_SECONDS}s, {SAMPLE_RATE}Hz mono).")
