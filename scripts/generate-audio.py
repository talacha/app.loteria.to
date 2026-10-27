#!/usr/bin/env python3
"""Synthesize every card name with Meta MMS-TTS (CC-BY-NC 4.0) into public/audio/{lang}/{id}.m4a
and set names[lang].audio in src/content/cards.json.

Usage: python scripts/generate-audio.py [--langs nah,yua] [--ids jaguar,sol]
Needs: torch transformers scipy numpy; ffmpeg on PATH. CPU is enough.
"""
import argparse, json, subprocess, sys
from pathlib import Path
import numpy as np
import torch
from transformers import AutoTokenizer, VitsModel

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "src/content/cards.json"
OUT = ROOT / "public/audio"
MODELS = {
    "es": "facebook/mms-tts-spa",
    "en": "facebook/mms-tts-eng",
    "nah": "facebook/mms-tts-nhe",
    "yua": "facebook/mms-tts-yua",
    "quz": "facebook/mms-tts-quz",
}
TARGET_RMS = 0.08  # linear, about -22 dBFS
PEAK = 0.9


def prep(text: str) -> str:
    # Spanish/English articles are kept: the voices read them fine.
    return text.strip().lower()


def trim(x: np.ndarray, sr: int, thr: float = 0.02, pad: float = 0.05) -> np.ndarray:
    env = np.abs(x)
    idx = np.where(env > thr * max(env.max(), 1e-9))[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * 2 * sr))
    return x[a:b]


def normalize(x: np.ndarray) -> np.ndarray:
    rms = float(np.sqrt(np.mean(x**2))) or 1e-9
    y = x * (TARGET_RMS / rms)
    p = float(np.abs(y).max())
    if p > PEAK:
        y *= PEAK / p
    return y


def encode(x: np.ndarray, sr: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1",
         "-i", "-", "-af", "afade=t=out:st=%f:d=0.04" % max(0, len(x) / sr - 0.04),
         "-c:a", "aac", "-b:a", "40k", "-ac", "1", "-movflags", "+faststart", str(dest)],
        input=pcm, check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default=",".join(MODELS))
    ap.add_argument("--ids", default="")
    args = ap.parse_args()
    langs = args.langs.split(",")
    only = set(filter(None, args.ids.split(",")))
    cards = json.loads(CARDS.read_text(encoding="utf-8"))
    torch.manual_seed(0)
    unvoiced = []
    for lang in langs:
        tok = AutoTokenizer.from_pretrained(MODELS[lang])
        model = VitsModel.from_pretrained(MODELS[lang]).eval()
        sr = model.config.sampling_rate
        vocab = set(tok.get_vocab())
        for c in cards:
            if only and c["id"] not in only:
                continue
            text = prep(c["names"][lang]["text"])
            missing = sorted({ch for ch in text if ch not in vocab})
            if missing:
                unvoiced.append((lang, c["id"], text, "".join(missing)))
            inputs = tok(text, return_tensors="pt")
            if inputs["input_ids"].numel() == 0:
                unvoiced.append((lang, c["id"], text, "EMPTY"))
                continue
            with torch.no_grad():
                wav = model(**inputs).waveform[0].numpy().astype("float32")
            wav = normalize(trim(wav, sr))
            encode(wav, sr, OUT / lang / f"{c['id']}.m4a")
            c["names"][lang]["audio"] = f"/audio/{lang}/{c['id']}.m4a"
            print(lang, c["id"], repr(text), f"{len(wav)/sr:.2f}s", flush=True)
    if not only:
        CARDS.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        print("note: --ids given, cards.json not rewritten", file=sys.stderr)
    for u in unvoiced:
        print("UNVOICED chars:", u, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
