# Evaluation: a small language model in the browser for solo mode

**Date:** 2026-10-26 · **Ask (owner):** "Evaluate embedding a small language model in the browser for solo mode." · **Context:** PRD §0 (pillars), §1 non-goals ("AI-generated Indigenous text"), §3.5 (precache < 10 MB, offline), §3.9 (AI hints and banter deferred); rules.md §1.3 (solo mode against a CPU player).

## Bottom line

**Don't embed a model now.** Every solo-mode job we need can be done better without a model: seeded rules, curated strings and words from `cards.json`. The smallest useful model is about **27 times our whole precache budget**. It is unreliable on iPhone Safari. It also cannot be trusted in Náhuatl, Maya or Quechua; it would invent words there, which the PRD forbids. If we want to try it later, the only candidate is an **opt-in, es/en-only banter experiment** behind a flag (details under "If we experiment later").

## Runtimes and models (≤ 1.5B, plus Phi-3.5-mini as the upper bound)

| Option | Download (4-bit) | GPU memory (WebLLM) | Decode speed on phones | iOS Safari 26 | License | nah / yua / quz |
|---|---|---|---|---|---|---|
| SmolLM2-135M (transformers.js q4f16) | **118 MB** | 360 MB | fast, est. 30–60 tok/s; output weak even in English | runs (WASM/WebGPU) | Apache-2.0 | none (English-only model card) |
| SmolLM2-360M | 273 MB | 376 MB | est. 20–40 tok/s | runs | Apache-2.0 | none |
| Gemma 3 270M (onnx q4f16) | 273 MB | — | est. 20–40 tok/s | runs | Gemma Terms (custom, use policy) | unknown; "140 languages" not itemised, no evaluation |
| Qwen2.5-0.5B (q4f16) | 483 MB | 945 MB | est. 10–25 tok/s | memory-tight | Apache-2.0 | none |
| Qwen3-0.6B (q4f16) | 570 MB | 1.4 GB | est. 8–20 tok/s | memory-tight | Apache-2.0 | **not** in its 119-language list |
| Gemma 3 1B (MediaPipe int4 QAT) | 529 MB (onnx q4f16: 763 MB) | 711 MB | **47–56 tok/s measured on Galaxy S24 Ultra** (flagship); mid-range est. 10–20 | risky | Gemma Terms | unknown, untested |
| Llama 3.2 1B (q4f16) | 695 MB–1.09 GB | 879 MB | est. 8–15 tok/s | risky | Llama 3.2 Community | none (8 official languages, es/en only) |
| SmolLM2-1.7B | ~1 GB | 1.8 GB | est. 4–8 tok/s | likely to crash | Apache-2.0 | none |
| Phi-3.5-mini 3.8B (upper bound) | ~2.2 GB | 2.5–3.7 GB | est. 1–4 tok/s | not viable | MIT | none |
| **Chrome built-in AI (Gemini Nano, Prompt API)** | 0 for us (Chrome downloads it) | browser-managed | n/a | **not available** | Google terms | none; output languages en/ja/es/de/fr only |

**How to read the table.** Download sizes are the file sizes Hugging Face lists for the ONNX/MLC builds (checked 2026-10-26). GPU memory is WebLLM's `vram_required_MB`. Rows marked "est." are my estimates: I found no published benchmark of these models in a browser on a mid-range phone. The only measured mobile figure is the Gemma 3 1B row, which is a flagship running MediaPipe. "Memory-tight" and "risky" describe iOS Safari. Its per-tab memory limits are tight, there are reports of tabs dying under LLM load, and WebLLM had to shrink buffers to 256 MB to run on iOS at all.

**The runtimes.**

- **transformers.js v3** (ONNX Runtime Web, WebGPU with WASM fallback) is the most portable choice and fits Vite well.
- **WebLLM / MLC** is WebGPU-only.
- **wllama** (llama.cpp in WASM) needs COOP/COEP headers for threads, and its Safari "compat" build is "significantly lower performance". A WebGPU backend for llama.cpp (LlamaWeb, May 2026) reports 29–33 % less peak memory than WebLLM and transformers.js, and says it runs on iOS models that crash in those engines. That is promising but new.
- **MediaPipe LLM Inference** has the best published phone numbers, but only for Gemma-format models.
- **Chrome's Prompt API** is desktop-only: "Chrome for Android, iOS … not yet supported". It also needs 22 GB of free disk and a GPU with more than 4 GB of VRAM or 16 GB of RAM. It does not work for a mobile-first app.
- **WebGPU** ships in Safari 26 on iOS/iPadOS (WebKit, 2025-09-15). Phones on iOS ≤ 18 fall back to WASM, which is roughly 5–10 times slower.

**Offline caching.** None of these models can go in the Workbox precache. Our build caps any single file at 3 MB, the whole precache must stay under 10 MB, and the last local build's manifest is about 4.2 MB. A model would have to be a separate on-demand download into Cache Storage or OPFS (transformers.js and WebLLM both do this), with a progress bar, a storage-quota check, and eviction risk on iOS. Cold start costs 1–5 s of shader compilation plus loading weights from cache. The first visit is a 120–600 MB download, which hurts in classrooms and plazas on metered data.

**Indigenous-language quality: effectively zero, and dangerous.** No model above lists Náhuatl, Maya yucateco or Quechua. Qwen3's 119 languages exclude all three; SmolLM2 says it "primarily understand[s] … English"; Llama 3.2 supports 8 languages. Even purpose-built, fine-tuned translation systems in AmericasNLP 2025 (NLLB-600M, XGLM-1.7B, Llama-3.1-8B) reach only chrF++ ≈ 31 for es→Quechua and "struggled" with Nahuatl. One 2026 report found that NLLB-600M has no vocabulary for Maya Yucateco and silently outputs English. A ≤ 1B general model will produce fluent-looking, invented words. That breaks PRD §1 goal 5 and the non-goal on AI-generated Indigenous text.

## Uses in solo mode

| Use | Needs a model? | Recommendation |
|---|---|---|
| (a) CPU opponent decisions | **No** | Keep `soloCpuPick({accuracy, rng})` in `src/engine/scoring.ts`, seeded from the round seed. It is deterministic, testable, fair and costs 0 bytes. A model would be slower and not reproducible. |
| (b) CPU personality banter in es/en | Optional | Start with **handwritten es/en lines** in the i18n catalogs: about 30 lines × a few moods, with ICU slots such as `{cardWord}`, `{points}` and `{streak}`. Tone stays copy-linted ("beans", no win/prize/bet). This is the only place a model could add anything. |
| (c) Hints and explanations of words | **No, and must not** | The words, `verso` and `riddle` come only from curated `cards.json` and catalogs. Keep `HintProvider` as the offline matcher (PRD §3.9). A model would hallucinate glosses and Indigenous forms. |
| (d) Adaptive difficulty | **No** | Use a rule: move the CPU's `accuracy` and call speed toward the player's rolling hit rate (e.g. aim for ~45 % CPU wins). Spaced repetition can drive the "para repasar" list. |
| (e) Pronunciation / speech | Out of scope | We use pre-recorded MMS audio; no synthetic speech or scoring of Indigenous speech (PRD §1 non-goals). |

## Recommendation

1. **Now:** embed nothing. Ship solo mode with the seeded CPU rule, rule-based adaptive difficulty and template banter. Precache impact is about 0 bytes, plus a few KB of strings.
2. **No model inside the < 10 MB precache, ever.** If a model is ever added, it is an extra download the player starts and can delete, and it never blocks play.
3. **Guardrails, binding on any future generator:**
   - It writes **only es or en**, and only for banter.
   - It never writes, translates, glosses or "corrects" Náhuatl, Maya or Quechua.
   - An Indigenous word appears only when the app inserts it into a slot, verbatim from `cards.json`.
   - Before display, output is rejected if it has a token that is not in an es/en wordlist and not a `cards.json` word, if it trips the copy lint, or if it exceeds 25 words. On any rejection, show the template line instead.
   - No network calls, no logging of the player's text.

## If we experiment later

Only an opt-in, es/en-only banter experiment is worth trying:

- **Flag:** `VITE_SLM_BANTER` (off by default, never in production builds) plus a settings toggle "Compañero con IA (descarga ~120–270 MB)".
- **Model:** transformers.js v3 with SmolLM2-360M-Instruct q4f16 (273 MB, Apache-2.0), or Gemma 3 270M if Gemma Terms are acceptable. Measure on a real mid-range Android phone and an iPhone with iOS 26 before going further.
- **Budget:** at most 300 MB on-demand, outside the precache, and the time to first line under 2 s once warm. Otherwise fall back to the templates.
- **Guardrails:** everything in the list above.

## Sources (accessed 2026-10-26)

- WebLLM model list with `vram_required_MB`: github.com/mlc-ai/web-llm `src/config.ts` (main, 2026).
- Hugging Face file listings: HuggingFaceTB/SmolLM2-135M/360M-Instruct, onnx-community/Qwen2.5-0.5B-Instruct, Qwen3-0.6B-ONNX, gemma-3-270m-it-ONNX, gemma-3-1b-it-ONNX, Llama-3.2-1B-Instruct-ONNX.
- SmolLM2-360M-Instruct model card (English-only, Apache-2.0): huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct.
- Gemma 3 1B LiteRT/MediaPipe benchmarks (S24 Ultra) and sizes: huggingface.co/litert-community/Gemma3-1B-IT.
- Gemma Terms of Use (modified 2026-04-01): ai.google.dev/gemma/terms. Gemma 3 Technical Report, arXiv 2503.19786 (2025-03).
- Qwen3 blog, 119-language list and Apache-2.0: qwenlm.github.io/blog/qwen3 (2025-04).
- Chrome Prompt API (desktop-only, hardware requirements, en/ja/es/de/fr): developer.chrome.com/docs/ai/prompt-api (updated 2026-10-21).
- WebKit, "WebKit features in Safari 26.0" (WebGPU on iOS): webkit.org/blog/17333 (2025-09-15).
- WebKit bug 275958 (iOS buffer limit; WebLLM reduced buffers to 256 MB, 2024); WebKit bug 302711 (Safari memory crash under LLM load, late 2025).
- Levine et al., "Llamas on the Web" (LlamaWeb), arXiv 2605.20706 (2026-05-20).
- wllama README (COOP/COEP threading, Safari compat build): github.com/ngxson/wllama, npm @wllama/wllama 3.x.
- MediaPipe LLM Inference for Web: developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js.
- AmericasNLP 2025: "Leveraging LLMs for Spanish–Indigenous MT" (Yahan & Islam), aclanthology 2025.americasnlp-1.15; Rangel & Kobayashi (Yucatec Maya / Chol), 2025.americasnlp-1.16.
