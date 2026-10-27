#!/usr/bin/env python3
"""Build static voice clips for every card name. See docs/audio.md.

  python3 scripts/generate-audio.py [--only es,nah] [--cards jaguar,sol] [--k 6]
                                    [--score asr|signal] [--force]

Needs: torch transformers huggingface_hub kokoro soundfile scipy pyloudnorm numpy; ffmpeg + espeak-ng on PATH (Python 3.10-3.12).
Env: HF_HOME (model cache), HF_TOKEN (gated repos), HF_HUB_OFFLINE=1 (cache only).
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "audio"))
import pipeline  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--only", default="", help="comma list of languages")
ap.add_argument("--cards", default="", help="comma list of card ids")
ap.add_argument("--k", type=int, default=6, help="candidates per clip")
ap.add_argument("--score", choices=["asr", "signal"], default="asr")
ap.add_argument("--force", action="store_true", help="regenerate even when the cache key is unchanged")
sys.exit(pipeline.run(ap.parse_args()))
