"""Transcribe Gujarati audio from a WAV file using OpenAI Whisper.

Outputs BOTH the Gujarati transcript and its English translation.

Usage:
    python transcribe_gujarati.py path/to/audio.wav
    python transcribe_gujarati.py path/to/audio.wav --model large-v3

Setup (one time):
    pip install faster-whisper

Notes:
    - Models download automatically on first run (small ~460MB, medium ~1.5GB, large-v3 ~3GB).
    - Bigger models = better Gujarati accuracy. "medium" is a good balance;
      use "large-v3" for best results if you have the RAM/GPU.
    - Works with .wav, .mp3, .m4a, etc.
"""

import argparse
import os
import site
import sys
from pathlib import Path


def add_cuda_dlls() -> None:
    """Make pip-installed CUDA libs (nvidia-cublas-cu12, nvidia-cudnn-cu12)
    visible to ctranslate2 on Windows."""
    if os.name != "nt":
        return
    for sp in site.getsitepackages():
        for sub in ("cublas", "cudnn"):
            bin_dir = Path(sp) / "nvidia" / sub / "bin"
            if bin_dir.is_dir():
                os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ["PATH"]


add_cuda_dlls()


def to_gujarati_script(text: str) -> str:
    """Whisper sometimes writes Gujarati speech in Devanagari (Hindi) script.
    The two scripts map 1:1 phonetically, so convert if Devanagari is detected."""
    if not any("ऀ" <= c <= "ॿ" for c in text):
        return text
    try:
        from indic_transliteration import sanscript
    except ImportError:
        print("(Tip: pip install indic-transliteration to auto-convert Devanagari -> Gujarati script)")
        return text
    return sanscript.transliterate(text, sanscript.DEVANAGARI, sanscript.GUJARATI)


def transcribe(audio_path: Path, model_size: str) -> None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed. Run:  pip install faster-whisper")

    def load_model(device: str):
        print(f"Loading Whisper model '{model_size}' on {device} (downloads on first run)...")
        return WhisperModel(model_size, device=device, compute_type="auto")

    def run(model, task: str):
        label = "Gujarati transcript" if task == "transcribe" else "English translation"
        print(f"\n--- {label} ---")
        segments, info = model.transcribe(
            str(audio_path),
            language="gu",          # force Gujarati so short clips aren't misdetected
            task=task,
            vad_filter=True,        # skip silence for cleaner output
            beam_size=5,
        )
        lines = []
        # segments is a generator, so GPU errors can surface here mid-iteration
        for seg in segments:
            timestamp = f"[{seg.start:7.2f}s -> {seg.end:7.2f}s]"
            print(f"{timestamp} {seg.text.strip()}")
            lines.append(seg.text.strip())
        return " ".join(lines), info

    try:
        model = load_model("auto")
        gujarati_text, info = run(model, "transcribe")
    except RuntimeError as e:
        # GPU detected but CUDA runtime libs (cuBLAS/cuDNN) missing — retry on CPU
        if "cublas" in str(e).lower() or "cudnn" in str(e).lower() or "cuda" in str(e).lower():
            print(f"\nGPU unavailable ({e}); falling back to CPU...")
            model = load_model("cpu")
            gujarati_text, info = run(model, "transcribe")
        else:
            raise

    english_text, _ = run(model, "translate")

    gujarati_text = to_gujarati_script(gujarati_text)

    gu_path = audio_path.with_suffix(".gu.txt")
    en_path = audio_path.with_suffix(".en.txt")
    gu_path.write_text(gujarati_text, encoding="utf-8")
    en_path.write_text(english_text, encoding="utf-8")

    print(f"\nDuration: {info.duration:.1f}s")
    print(f"Gujarati transcript saved to: {gu_path}")
    print(f"English translation saved to: {en_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe Gujarati audio (WAV/MP3/etc.)")
    parser.add_argument("audio", help="Path to the audio file (e.g. speech.wav)")
    parser.add_argument(
        "--model",
        default="medium",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="Whisper model size (default: medium; large-v3 = best accuracy)",
    )
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        sys.exit(f"File not found: {audio_path}")

    transcribe(audio_path, args.model)


if __name__ == "__main__":
    main()
