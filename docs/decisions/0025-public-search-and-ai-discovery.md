# 0025. Public search and AI discovery

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The five public routes need to explain the game's actual features and language coverage to people and crawlers. Existing material must distinguish 144 Spanish/English cards from the original 54 Indigenous-language entries, whose references remain unverified and have not been confirmed by native speakers. AI-readable files can help systems that choose to consume them, but must not become a substitute for public page content or a claim of search ranking benefit.

## Decision

Keep the public pages, sitemap, route metadata and structured data aligned with visible, verifiable product facts. Publish concise `/llms.txt` and fuller `/llms-full.txt` as optional factual guides with links to all five public routes and credits. Preserve the existing crawler permission policy, while excluding private host, room, UI and API paths in wildcard and named crawler groups. Keep JSON-LD limited to content shown on the corresponding route and link deck entries to their visible card anchors.

Do not add endorsement, licensing or language-review claims without evidence. Treat the AI-readable files as supplemental; do not promise that they improve ranking, indexing, citations or inclusion in AI search features.

## Consequences

SEO copy and machine-readable summaries must be updated when product facts or credits change. The SEO implementation guidance and primary references are recorded in [seo.md](../seo.md). Google documents that its AI search features use foundational SEO practices and require no special AI markup or machine-readable file; its documentation also says meta keywords do not affect Google ranking and structured data does not guarantee a rich result.
