# Audio pipeline

Every card name is voiced in each language from **static clips**. Nothing is synthesised at build time or at runtime: clips are generated once with `pnpm audio:generate`, committed under `public/audio/`, served by the CDN and precached by the service worker (`vite.config.ts` globs `m4a`). `pnpm audio:check` (no models, under a second, part of `pnpm build`) fails if any card x language lacks a clip listed in the manifest.

## How it works

1. **Router** (`scripts/audio/engines.json`, `engines.py`): one engine per language.
   - es, en: Kokoro-82M (`hexgrad/Kokoro-82M`, Apache-2.0) via the `kokoro` package. Voices evaluated per clip: es `ef_dora`, `em_alex`, `em_santa`; en `af_heart`, `am_michael`, `af_bella`.
   - nah (`mms-tts-nhe`), yua, quz, cjp, gym: Meta MMS-TTS via Transformers (CC-BY-NC 4.0). Cabécar (`cjp`) and Ngäbere (`gym`) are configured for content preparation, not enabled as playable languages. See the [expansion readiness report](language-expansion-cjp-gym.md).
   - bzd (Bribri): `needs-recording`. No Bribri checkpoint appears in Meta's MMS-TTS catalog; this pipeline requires native recordings.
   - Model revisions are pinned commit shas in `engines.json` and recorded in the manifest. `HF_HOME` is respected (local cache), `HF_TOKEN` is used for gated repos, `HF_HUB_OFFLINE=1` works once models are cached.
2. **Candidates**: K (default 6) per card x language. The first uses engine defaults; the rest are a deterministic sample of the grid. MMS varies seed, `noise_scale` (0.333/0.5/0.667), `noise_scale_duration` (0.6/0.8), `speaking_rate` (0.9/1.0/1.1). Kokoro varies voice and speed. For es/en, text variants: as-is and without the leading article (recorded in `params.variant`).
3. **Scoring**: `--score asr` (default) transcribes each candidate with `facebook/mms-1b-all` (language adapter) and computes CER against the spoken text (lowercase, diacritics and punctuation stripped, characters the ASR cannot emit removed). Signal score: -16 LUFS +-2 (BS.1770), peak <= -1 dBFS and no clipping, duration 0.3-2.5 s, not silent, silence trimmed. Composite = 0.7 x (1 - CER) + 0.3 x signal. `--score signal` skips ASR (no 4 GB download). The best candidate wins; ties go to the default parameters. Only the winner is kept.
4. **Encode**: trimmed, normalised to -16 LUFS, mono AAC `.m4a` at 40 kbps.
5. **Cache**: `public/audio/manifest.json`, keyed by `sha256(lang, model, revision, text, generatorVersion)`. Each entry holds file, engine, model, revision, voice, params, score, cer, hyp (what the ASR heard), durationMs, loudness, and the scores of all candidates. Unchanged keys are skipped.

CER is a proxy. The ASR for low-resource languages (nah, yua, quz) is itself weak, so a poor CER can mean the ASR failed, not the voice. Native speakers have the final say; their recordings replace the clip.

## Run

```
python3.12 -m venv .venv-audio && . .venv-audio/bin/activate
pip install torch transformers huggingface_hub kokoro soundfile scipy librosa pyloudnorm numpy
pip install en_core_web_sm@https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl  # English G2P
brew install espeak-ng ffmpeg          # Kokoro needs espeak-ng for Spanish
AUDIO_PYTHON=.venv-audio/bin/python pnpm audio:generate
pnpm audio:generate -- --only es,nah --cards jaguar,sol --k 8 --force
pnpm audio:check
```

Flags: `--only lang[,lang]`, `--cards id[,id]`, `--k N`, `--score asr|signal`, `--force`. Python 3.10-3.12 (spaCy, pulled in by Kokoro, has no 3.14 wheels yet). Commit `public/audio/**`, `manifest.json` and `src/content/cards.json` (the `audio` paths).

## Reproduce the 144-card production run

Use the tested Python dependencies without changing the default system Python:

```sh
uv venv --python python3.11 ~/.cache/loteria-audio-venv
uv pip install --python ~/.cache/loteria-audio-venv/bin/python -r scripts/audio/requirements.txt
HF_HUB_OFFLINE=1 OMP_NUM_THREADS=4 ~/.cache/loteria-audio-venv/bin/python scripts/generate-audio.py --only es,en --k 6 --score asr
pnpm audio:check
```

The offline flag requires the exact pinned Kokoro and MMS-ASR snapshots in the Hugging Face cache. Omit it only when fetching those models initially. Cache hits preserve existing clips; use `--cards` to restrict a run to selected IDs. The generator writes the complete card catalog at the end, so reserve exclusive access to `cards.json` during production. It also writes hashed public clips, manifest metadata and local lossless masters. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed only for the separate masters upload, never for local generation.

The full game (including all referenced languages' clips) remains in the PWA install cache. Retained historical clips stay on the CDN but are excluded from installation when no current name references them. The aggregate precache must stay below 10 MiB and card art must stay at or below 6,000,000 bytes; `scripts/precache-budget.ts` makes a build exceeding either fail. Print-only workers/builders and the Noto Sans PDF font use a separate runtime cache: printing requires a connected first use before those files can work offline.

## Add a language

1. Add the name to `cards.json` for every card.
2. Add the language to `engines.json`: engine, model, `revision: null` (it is pinned on first run), and `asr` adapter code if `mms-1b-all` has one. If there is no TTS, use `engine: needs-recording`.
3. If the language is new to the app, extend `LANGS` in `src/content/schema.ts`.
4. `pnpm audio:generate --only <lang>`, then `pnpm audio:check`.

To add another engine (for example Fish Audio, a paid API with commercial terms, not used today), write a class in `engines.py` with `grid(variants)` and `synthesize(text, params) -> (wav, sr)`, and register it in `ENGINES`. Scoring, cache and encoding are shared.

## Native recordings

Drop `public/audio/recordings/{lang}/{id}.m4a` (mono AAC, normalised to about -16 LUFS, no leading silence). The next `pnpm audio:generate` points `names[lang].audio` at it, lists it in the manifest with `source: "recording"`, and never overwrites it. This is the only route for Bribri (bzd).

## Licences

- Kokoro-82M: Apache-2.0. Voice packs ship with the model repo under the same licence.
- Meta MMS-TTS and MMS ASR: CC-BY-NC 4.0 (non-commercial, attribution required). Credited in `src/content/credits.json` and the in-app credits. The output audio inherits that restriction for nah, yua, quz, cjp; replace with native recordings before any commercial use.
- Scripts here: project licence.
