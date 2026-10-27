"""Audio pipeline: Hugging Face MMS-TTS candidates -> ASR + signal scoring -> best clip -> cached m4a.

See docs/audio.md. Everything here runs at build/content time only; the app plays static files.
Meta MMS models are CC-BY-NC 4.0.
"""
from __future__ import annotations

import hashlib, shutil, itertools, json, os, random, re, subprocess, sys, time, unicodedata
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CARDS = ROOT / "src/content/cards.json"
OUT = ROOT / "public/audio"
MANIFEST = OUT / "manifest.json"
MODELS_JSON = HERE / "engines.json"
GENERATOR_VERSION = "4"
MASTERS = ROOT / "audio-masters"  # lossless WAVs, git-ignored; pnpm audio:upload-masters sends them to private storage
TARGET_LUFS = -16.0
PEAK_LIMIT = 0.89  # -1 dBFS
DUR_MIN, DUR_MAX = 0.3, 2.5

ARTICLES = {
    "es": ("el", "la", "los", "las", "un", "una"),
    "en": ("the", "a", "an"),
}


# ---------------------------------------------------------------- text / CER
def strip_marks(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def norm_for_cer(s: str, keep: set[str] | None = None) -> str:
    s = strip_marks(s.lower().replace("’", "'"))
    s = re.sub(r"[^\w' ]", " ", s)
    if keep is not None:  # only characters the ASR can emit
        s = "".join(c for c in s if c in keep or c == " ")
    return re.sub(r"\s+", " ", s).strip()


def lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    if not ref:
        return 0.0
    return lev(ref, hyp) / len(ref)


def text_variants(lang: str, text: str) -> list[tuple[str, str]]:
    t = unicodedata.normalize("NFC", re.sub(r"\s+", " ", text.strip().lower()))
    out = [("as-is", t)]
    arts = ARTICLES.get(lang)
    if arts:
        parts = t.split(" ", 1)
        if len(parts) == 2 and parts[0] in arts:
            out.append(("no-article", parts[1]))
    return out


# ---------------------------------------------------------------- signal
def trim(x: np.ndarray, sr: int, rel: float = 0.015) -> np.ndarray:
    env = np.abs(x)
    idx = np.where(env > rel * max(env.max(), 1e-9))[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(0.04 * sr))
    b = min(len(x), idx[-1] + int(0.08 * sr))
    return x[a:b]


def lufs(x: np.ndarray, sr: int) -> float:
    import pyloudnorm as pyln

    y = x
    while len(y) < int(0.9 * sr):  # BS.1770 needs >= 400 ms; tile short clips for measuring
        y = np.concatenate([y, np.zeros(int(0.05 * sr), dtype=y.dtype), x])
    v = pyln.Meter(sr).integrated_loudness(y.astype("float64"))
    return float(v) if np.isfinite(v) else -70.0


def normalise(x: np.ndarray, sr: int) -> tuple[np.ndarray, dict]:
    raw_clip = float(np.mean(np.abs(x) >= 0.99))
    cur = lufs(x, sr)
    gain = 10 ** ((TARGET_LUFS - cur) / 20)
    peak = float(np.abs(x).max()) or 1e-9
    gain = min(gain, PEAK_LIMIT / peak)
    y = (x * gain).astype("float32")
    return y, {
        "lufs": round(lufs(y, sr), 2),
        "peak": round(float(np.abs(y).max()), 3),
        "rawClip": round(raw_clip, 5),
        "rmsDb": round(20 * np.log10(float(np.sqrt(np.mean(y**2))) + 1e-9), 1),
    }


def signal_score(y: np.ndarray, sr: int, m: dict) -> float:
    dur = len(y) / sr
    s = 1.0
    if m["rmsDb"] < -50:
        return 0.0
    if not (DUR_MIN <= dur <= DUR_MAX):
        s *= 0.4
    err = abs(m["lufs"] - TARGET_LUFS)
    if err > 2:
        s -= min(0.5, (err - 2) * 0.1)
    if m["peak"] >= 0.98 or m["rawClip"] > 0.001:
        s *= 0.4
    return round(max(s, 0.0), 4)


def encode(y: np.ndarray, sr: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2").tobytes()
    fade = max(0.0, len(y) / sr - 0.04)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
         "-af", f"afade=t=out:st={fade:.3f}:d=0.04", "-c:a", "aac", "-b:a", "40k", "-ac", "1",
         "-movflags", "+faststart", str(dest)],
        input=pcm, check=True)


def decode_16k(path: Path) -> np.ndarray:
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ar", "16000",
                        "-ac", "1", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").copy()


# ---------------------------------------------------------------- HF
def load_models_cfg() -> dict:
    return json.loads(MODELS_JSON.read_text(encoding="utf-8"))


def resolve_revision(model_id: str, pinned: str | None) -> str:
    """Pinned sha if present; otherwise ask the Hub (HF_TOKEN respected), else the local cache ref."""
    if pinned:
        return pinned
    token = os.environ.get("HF_TOKEN") or None
    try:
        from huggingface_hub import HfApi

        return HfApi(token=token).model_info(model_id).sha
    except Exception:
        from huggingface_hub import constants

        ref = Path(constants.HF_HUB_CACHE) / ("models--" + model_id.replace("/", "--")) / "refs/main"
        if ref.exists():
            return ref.read_text().strip()
        raise


class ASR:
    def __init__(self, model_id: str, revision: str):
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC

        tok_ = os.environ.get("HF_TOKEN") or None
        self.torch = torch
        self.processor = AutoProcessor.from_pretrained(model_id, revision=revision, token=tok_)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_id, revision=revision, token=tok_).eval()
        self.lang = None
        self.vocabs = self.processor.tokenizer.vocab if hasattr(self.processor.tokenizer, "vocab") else {}

    def set_lang(self, code: str) -> bool:
        try:
            self.processor.tokenizer.set_target_lang(code)
            self.model.load_adapter(code)
        except Exception as e:  # adapter missing for this language
            print(f"  ASR adapter '{code}' unavailable: {e}", file=sys.stderr)
            self.lang = None
            return False
        self.lang = code
        v = self.processor.tokenizer.get_vocab()
        self.keep = {c for c in v if len(c) == 1}
        return True

    def transcribe(self, waves: list[np.ndarray]) -> list[str]:
        out = []
        for i in range(0, len(waves), 8):
            chunk = waves[i:i + 8]
            feats = self.processor(chunk, sampling_rate=16000, return_tensors="pt", padding=True)
            with self.torch.no_grad():
                logits = self.model(**feats).logits
            out += self.processor.batch_decode(self.torch.argmax(logits, dim=-1))
        return out


def resample16k(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == 16000:
        return x
    from scipy.signal import resample_poly
    from math import gcd

    g = gcd(sr, 16000)
    return resample_poly(x, 16000 // g, sr // g).astype("float32")


# ---------------------------------------------------------------- delivery
def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def duration_ms(p: Path) -> int:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True, check=True)
    return round(float(r.stdout.strip()) * 1000)


def deliver(tmp: Path, lang: str, cid: str) -> tuple[str, str]:
    """Rename an encoded clip to /audio/{lang}/{id}.{sha8}.m4a (cache-busting) and drop older versions."""
    digest = sha256_file(tmp)
    rel = f"/audio/{lang}/{cid}.{digest[:8]}.m4a"
    dest = ROOT / "public" / rel.lstrip("/")
    shutil.move(str(tmp), dest)
    for old in (OUT / lang).glob(f"{cid}.*m4a"):
        if old != dest:
            old.unlink()
    legacy = OUT / lang / f"{cid}.m4a"
    if legacy.exists():
        legacy.unlink()
    return rel, digest


def apply_clip(c: dict, lang: str, ent: dict) -> bool:
    n = c["names"][lang]
    clip = {"file": ent["file"], "sha256": ent["sha256"], "engine": ent["engine"], "durationMs": ent["durationMs"]}
    for k in ("model", "revision", "voice"):
        if ent.get(k):
            clip[k] = ent[k]
    changed = n.get("audio") != ent["file"] or n.get("clip") != clip or "audioReason" in n
    n["audio"], n["clip"] = ent["file"], clip
    n.pop("audioReason", None)
    return changed


def apply_none(c: dict, lang: str, reason: str) -> bool:
    n = c["names"][lang]
    changed = n.get("audio") is not None or "clip" in n or n.get("audioReason") != reason
    n["audio"], n["audioReason"] = None, reason
    n.pop("clip", None)
    return changed


# ---------------------------------------------------------------- manifest
def clip_key(lang: str, model_id: str, revision: str, text: str) -> str:
    return hashlib.sha256("\x1f".join([lang, model_id, revision, text, GENERATOR_VERSION]).encode()).hexdigest()


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"generatorVersion": GENERATOR_VERSION, "models": {}, "unavailable": {}, "clips": {}, "baseline": {}}


def save_manifest(m: dict) -> None:
    m["generatorVersion"] = GENERATOR_VERSION
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def candidate_grid(key: str, k: int, variants, eng) -> list[dict]:
    """K deterministic candidates: engine defaults first, then a key-seeded sample of the engine grid."""
    rng = random.Random(key)
    first = eng.default(variants[0][0])
    grid, needs_seed = eng.grid(variants)
    grid = [g for g in grid if not all(first.get(f) == g.get(f) for f in g)]
    rng.shuffle(grid)
    cands = [first]
    for g in grid[: max(0, k - 1)]:
        g = dict(g)
        if needs_seed:
            g["seed"] = rng.randrange(1, 10_000)
        cands.append(g)
    return cands


# ---------------------------------------------------------------- main
def run(args) -> int:
    from engines import ENGINES

    t0 = time.time()
    cfg = load_models_cfg()
    langs_cfg = cfg["languages"]
    cards = json.loads(CARDS.read_text(encoding="utf-8"))
    manifest = load_manifest()
    only_ids = set(filter(None, (args.cards or "").split(",")))
    langs = args.only.split(",") if args.only else list(langs_cfg)
    use_asr = args.score == "asr"
    asr = None
    changed_cards = False
    lock_dirty = False
    report: list[str] = []
    for lang in langs:
        spec = langs_cfg.get(lang)
        if spec is None:
            report.append(f"{lang}: not in engines.json, skipped")
            continue
        with_names = [c for c in cards if lang in c["names"] and (not only_ids or c["id"] in only_ids)]
        if not with_names:
            report.append(f"{lang}: no names in cards.json, skipped")
            continue
        if spec["engine"] == "needs-recording":
            manifest["unavailable"][lang] = spec["reason"]
        if spec["engine"] != "needs-recording" and not spec["revision"]:
            spec["revision"] = resolve_revision(spec["model"], None)
            lock_dirty = True
        rev = spec.get("revision") or "none"
        if spec["engine"] != "needs-recording":
            manifest["models"][lang] = {"engine": spec["engine"], "id": spec["model"], "revision": rev,
                                        "voices": spec.get("voices"),
                                        "license": "Apache-2.0" if spec["engine"] == "kokoro" else "CC-BY-NC-4.0"}

        todo = []
        for c in with_names:
            text = c["names"][lang].get("text")
            rec = OUT / "recordings" / lang / f"{c['id']}.m4a"
            if rec.exists():  # native recording wins and is never overwritten
                digest = sha256_file(rec)
                rel = f"/audio/{lang}/{c['id']}.{digest[:8]}.m4a"
                dest = ROOT / "public" / rel.lstrip("/")
                if not dest.exists():
                    shutil.copy(rec, dest)
                ent = {"lang": lang, "id": c["id"], "file": rel, "source": "recording", "engine": "recording",
                       "text": text, "sha256": digest, "durationMs": duration_ms(rec)}
                manifest["clips"][f"recording:{lang}:{c['id']}"] = ent
                changed_cards |= apply_clip(c, lang, ent)
                continue
            if not text:
                changed_cards |= apply_none(c, lang, "missing-word")
                report.append(f"{lang}/{c['id']}: missing-word (no text)")
                continue
            if spec["engine"] == "needs-recording":
                changed_cards |= apply_none(c, lang, "needs-recording")
                continue
            key = clip_key(lang, spec["model"], rev, re.sub(r"\s+", " ", text.strip().lower()))
            ent = manifest["clips"].get(key)
            fresh = (ent and (ROOT / "public" / ent["file"].lstrip("/")).exists() and not args.force
                     and "sha256" in ent and not (use_asr and ent.get("scoring") != "asr"))
            if fresh:
                changed_cards |= apply_clip(c, lang, ent)
                continue
            todo.append((c, text, key))
        n_missing = sum(1 for c in with_names if not c["names"][lang].get("text") and not (OUT / "recordings" / lang / f"{c['id']}.m4a").exists())
        if spec["engine"] == "needs-recording":
            report.append(f"{lang}: needs-recording for {len(with_names) - n_missing} words ({n_missing} words missing)")
        if spec["engine"] == "needs-recording":
            continue
        print(f"[{lang}] {spec['engine']} {spec['model']}@{rev[:8]}: {len(with_names)} cards, {len(todo)} to generate", flush=True)
        if not todo:
            continue

        lang_asr = False
        if use_asr:
            if asr is None:
                asr_cfg = cfg["asr"]
                if not asr_cfg["revision"]:
                    asr_cfg["revision"] = resolve_revision(asr_cfg["id"], None)
                    lock_dirty = True
                asr = ASR(asr_cfg["id"], asr_cfg["revision"])
                manifest["asrModel"] = {"id": asr_cfg["id"], "revision": asr_cfg["revision"], "license": "CC-BY-NC-4.0"}
            lang_asr = bool(spec.get("asr")) and asr.set_lang(spec["asr"])

        if lang_asr:  # baseline: ASR CER of the clips currently on disk
            base = manifest.setdefault("baseline", {}).setdefault(lang, {})
            for c, text, key in todo:
                f = OUT / lang / f"{c['id']}.m4a"
                if c["id"] not in base and f.exists():
                    hyp = asr.transcribe([decode_16k(f)])[0]
                    base[c["id"]] = {"cer": round(cer(norm_for_cer(text, asr.keep), norm_for_cer(hyp, asr.keep)), 4), "hyp": hyp}

        eng = ENGINES[spec["engine"]](spec)
        for c, text, key in todo:
            variants = text_variants(lang, text)
            vtext = dict(variants)
            if eng.vocab is not None:
                missing = sorted({ch for ch in variants[0][1] if ch not in eng.vocab})
                if missing:
                    report.append(f"{lang}/{c['id']}: chars not in TTS vocab (dropped): {''.join(missing)!r}")
            cands = []
            for p in candidate_grid(key, args.k, variants, eng):
                r = eng.synthesize(vtext[p["variant"]], p)
                if r is None or r[0] is None or len(r[0]) == 0:
                    continue
                wav, sr = r
                y, m = normalise(trim(wav, sr), sr)
                cands.append({"params": p, "y": y, "sr": sr, "m": m, "sig": signal_score(y, sr, m)})
            if not cands:
                report.append(f"{lang}/{c['id']}: no candidate (empty after tokenizing), kept old clip")
                continue
            if lang_asr:
                hyps = asr.transcribe([resample16k(x["y"], x["sr"]) for x in cands])
                for x, h in zip(cands, hyps):
                    ref = norm_for_cer(vtext[x["params"]["variant"]], asr.keep)
                    x["cer"] = round(cer(ref, norm_for_cer(h, asr.keep)), 4)
                    x["hyp"] = h
                    x["score"] = round(0.7 * (1 - min(x["cer"], 1.0)) + 0.3 * x["sig"], 4)
            else:
                for x in cands:
                    x["cer"], x["hyp"], x["score"] = None, None, x["sig"]
            best = max(enumerate(cands), key=lambda t: (t[1]["score"], -t[0]))[1]
            tmp = OUT / lang / f"{c['id']}.tmp.m4a"
            encode(best["y"], best["sr"], tmp)
            rel, digest = deliver(tmp, lang, c["id"])
            import soundfile as sf

            for old in (MASTERS / lang).glob(f"{c['id']}.*.wav"):
                old.unlink()
            (MASTERS / lang).mkdir(parents=True, exist_ok=True)
            master = f"{lang}/{c['id']}.{digest[:8]}.wav"
            sf.write(MASTERS / master, best["y"], best["sr"], subtype="PCM_24")
            for k_ in [k_ for k_, v in manifest["clips"].items() if v.get("lang") == lang and v.get("id") == c["id"]]:
                del manifest["clips"][k_]
            manifest["clips"][key] = {
                "lang": lang, "id": c["id"], "text": text, "file": rel, "sha256": digest, "master": master,
                "source": spec["engine"],
                "engine": spec["engine"], "model": spec["model"], "revision": rev,
                "voice": best["params"].get("voice"),
                "params": best["params"], "score": best["score"], "cer": best["cer"], "hyp": best["hyp"],
                "signal": best["sig"], "loudness": best["m"], "durationMs": round(len(best["y"]) / best["sr"] * 1000),
                "scoring": "asr" if lang_asr else "signal", "candidates": len(cands),
                "candidateScores": [x["score"] for x in cands],
            }
            changed_cards |= apply_clip(c, lang, manifest["clips"][key])
            print(f"  {lang}/{c['id']:<14} score={best['score']:.3f} cer={best['cer']} {len(best['y'])/best['sr']:.2f}s {best['params']}", flush=True)
        del eng
        save_manifest(manifest)

    if lock_dirty:
        MODELS_JSON.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    save_manifest(manifest)
    if changed_cards:
        CARDS.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for r in report:
        print(r)
    clips = [v for v in manifest["clips"].values() if v.get("source") != "recording"]
    if clips:
        sizes = sum(p.stat().st_size for p in OUT.rglob("*.m4a")) / 1e6
        cers = [v["cer"] for v in clips if v.get("cer") is not None]
        print(f"clips={len(clips)} total={sizes:.2f} MB meanScore={np.mean([v['score'] for v in clips]):.3f}"
              + (f" meanCER={np.mean(cers):.3f}" if cers else "") + f" elapsed={time.time()-t0:.0f}s")
    return 0
