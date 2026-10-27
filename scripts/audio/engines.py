"""TTS engines behind one interface: Engine.grid(variants) -> candidate params, Engine.synthesize(text, params) -> (wav, sr).

Add a new engine (e.g. Fish Audio, a paid API with commercial terms, so not used today) by writing a class
here and registering it in ENGINES; the ranking, scoring, cache and encode stages are shared.
"""
from __future__ import annotations

import itertools, os
from pathlib import Path

import numpy as np

HF_TOKEN = os.environ.get("HF_TOKEN") or None


class MMSEngine:
    name = "mms"
    NS, NSD, RATE = (0.333, 0.5, 0.667), (0.6, 0.8), (0.9, 1.0, 1.1)

    def __init__(self, spec: dict):
        import torch
        from transformers import AutoTokenizer, VitsModel

        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(spec["model"], revision=spec["revision"], token=HF_TOKEN)
        self.model = VitsModel.from_pretrained(spec["model"], revision=spec["revision"], token=HF_TOKEN).eval()
        self.sr = self.model.config.sampling_rate
        self.vocab = set(self.tok.get_vocab())
        self.voice = None

    def default(self, variant: str) -> dict:
        return {"variant": variant, "seed": 555, "noise_scale": 0.667, "noise_scale_duration": 0.8, "speaking_rate": 1.0}

    def grid(self, variants):
        g = [{"variant": v, "noise_scale": a, "noise_scale_duration": b, "speaking_rate": r}
             for v, a, b, r in itertools.product([v for v, _ in variants], self.NS, self.NSD, self.RATE)]
        return g, True  # (grid, needs_seed)

    def synthesize(self, text: str, p: dict):
        from transformers import set_seed

        inputs = self.tok(text, return_tensors="pt")
        if inputs["input_ids"].numel() == 0:
            return None
        m = self.model
        m.noise_scale, m.noise_scale_duration, m.speaking_rate = p["noise_scale"], p["noise_scale_duration"], p["speaking_rate"]
        set_seed(p["seed"])
        with self.torch.no_grad():
            return m(**inputs).waveform[0].numpy().astype("float32"), self.sr


class KokoroEngine:
    name = "kokoro"
    SPEED = (0.9, 1.0, 1.1)
    sr = 24000

    def __init__(self, spec: dict):
        from huggingface_hub import snapshot_download
        from kokoro import KModel, KPipeline

        # Pin the revision: download that exact snapshot and load from disk.
        self.dir = Path(snapshot_download(spec["model"], revision=spec["revision"], token=HF_TOKEN,
                                          allow_patterns=["config.json", "kokoro-v1_0.pth"]
                                          + [f"voices/{v}.pt" for v in spec["voices"]]))
        self.voices = spec["voices"]
        self.pipe = KPipeline(lang_code=spec["lang_code"], repo_id=spec["model"],
                              model=KModel(repo_id=spec["model"], config=str(self.dir / "config.json"),
                                           model=str(self.dir / "kokoro-v1_0.pth")))
        self.vocab = None  # espeak/misaki phonemises any text
        self.voice = None

    def default(self, variant: str) -> dict:
        return {"variant": variant, "voice": self.voices[0], "speed": 1.0}

    def grid(self, variants):
        g = [{"variant": v, "voice": vo, "speed": s}
             for v, vo, s in itertools.product([v for v, _ in variants], self.voices, self.SPEED)]
        return g, False

    def synthesize(self, text: str, p: dict):
        parts = [np.asarray(a, dtype="float32") for _, _, a in
                 self.pipe(text, voice=str(self.dir / "voices" / f"{p['voice']}.pt"), speed=p["speed"])
                 if a is not None]
        return (np.concatenate(parts) if parts else None), self.sr


ENGINES = {"mms": MMSEngine, "kokoro": KokoroEngine}
