#!/usr/bin/env python3
"""Merge src/content/drafts/{cjp,bzd}.json into src/content/cards.json names (idempotent).
Missing words stay explicit: text null, status 'missing'. Nothing is invented."""
import json, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "src/content/cards.json"
KEYS = ("kind", "confidence", "gloss", "note", "source", "reviewQuestion")

cards = json.loads(CARDS.read_text(encoding="utf-8"))
for lang in ("cjp", "bzd"):
    d = json.loads((ROOT / f"src/content/drafts/{lang}.json").read_text(encoding="utf-8"))["cards"]
    for c in cards:
        src = d.get(c["id"], {})
        text = src.get("text")
        prev = c["names"].get(lang, {})
        if text:
            n = {"text": unicodedata.normalize("NFC", text), "status": "draft"}
            for k in KEYS:
                if src.get(k):
                    n[k] = src[k]
            n["source"] = n.get("source") or "draft import (no citation recorded)"
            for k in ("audio", "clip", "audioReason"):  # keep pipeline-owned fields
                if k in prev:
                    n[k] = prev[k]
        else:
            n = {"text": None, "status": "missing", "audio": None, "audioReason": "missing-word"}
            for k in ("gloss", "note", "reviewQuestion"):
                if src.get(k):
                    n[k] = src[k]
        c["names"][lang] = n
CARDS.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("imported cjp/bzd")
