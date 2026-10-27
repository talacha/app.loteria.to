# Public search and AI discovery

This document records the implementation and content rules for the five public routes: `/`, `/deck`, `/solo`, `/print` and `/creditos`. The routes should return useful prerendered HTML with clear titles and descriptions, canonical URLs, Open Graph and Twitter cards, and JSON-LD only when it describes visible page content. The sitemap lists the same public routes. Private host, room and UI routes are noindex and are excluded from crawling.

## Public facts to preserve

- The catalog contains 144 cards. Spanish and English names and calls cover all 144; Nahuatl, Yucatec Maya and Cusco-Collao Quechua cover the original 54.
- Indigenous-language names are legacy entries with references that remain unverified and have not been confirmed by native-speaker review. Do not describe them as verified, native-approved or community-endorsed.
- Online rooms support 2–20 people. Solo mode is offline against 1–3 computer players. Print mode creates PDF boards and follows the selected language's 144-card or original-54 coverage.
- Credit claims must match `/creditos`. Spanish and English audio use Kokoro-82M (Apache-2.0); Nahuatl, Yucatec Maya and Quechua audio use Meta MMS-TTS (CC BY-NC 4.0, non-commercial use with attribution). Do not imply that these audio licences apply to every project asset.
- Do not add endorsements, community approvals, language-validation claims or licences without evidence in the credits and content sources.

## Route coverage

| Route | Useful page-specific information | Structured data |
| --- | --- | --- |
| `/` | Game, audience, 144/54 language coverage, free access and room size | WebSite, WebPage, WebApplication, ImageObject, BreadcrumbList and visible FAQ |
| `/deck` | 144-card browseable deck and language coverage | CollectionPage and ItemList with 144 visible card anchors, plus shared site/app/image/breadcrumb entities |
| `/solo` | Offline solo play against 1–3 computer players | WebPage plus shared site/app/image/breadcrumb entities |
| `/print` | PDF boards, paper play and language-specific pool size | WebPage plus shared site/app/image/breadcrumb entities |
| `/creditos` | Content provenance, voice models and licences | AboutPage plus shared site/app/image/breadcrumb entities |

The deck's visible card rows use stable `id="card-{id}"` fragments. Any structured list of cards should use the matching fragment URL and only include cards displayed on the page. Filtered client-side states do not change the canonical URL or claim that hidden rows are a separate page.

## Crawl access

`public/robots.txt` allows crawling of public pages and static assets, while excluding `/host`, `/r/`, `/ui` and `/api/` for the wildcard rule and each named AI crawler group. The named groups retain their existing `Allow: /` policy, including GPTBot; this file does not change the site's training-crawler policy. Route-level noindex metadata and response headers also protect private routes. Robots rules guide compliant crawlers and are not access control.

## AI-readable summaries

`/llms.txt` is a short directory with links to each public route. `/llms-full.txt` gives a fuller, factual product and content description, including language coverage, how play works, route-specific facts and credits. Keep both files supplemental to the public pages; they do not replace crawlable HTML, internal links, the sitemap or accurate visible copy. Update them whenever product coverage or licence details change.

Google's current guidance says the same foundational SEO practices apply to its AI features; it describes no special AI markup or required machine-readable file, and says inclusion is not guaranteed. It also says `meta name="keywords"` has no effect on Google indexing or ranking, so this project does not use keyword stuffing or treat a keywords tag as a ranking signal. JSON-LD must reflect visible content; valid structured data can make a page eligible for a search feature but does not guarantee that feature will appear.

Primary references:

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: Meta tags and attributes it supports](https://developers.google.com/search/docs/crawling-indexing/special-tags)
- [Google: General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

These files describe discoverability implementation, not a promise of rankings, indexing, citations or traffic. Review crawl access, rendered HTML, canonical URLs, sitemap entries and structured-data accuracy after material content or deployment changes.

## Share images and icons

Each public route has its own 1200 × 630 PNG under `public/og/`; room invitations have a separate preview while remaining noindex. `pnpm og:render` rebuilds these from the current logo, paper texture and card art. Social images are excluded from offline installation. The single vector favicon source also generates 48px search/browser, Apple touch and maskable PWA icons with `pnpm icons:render`. The version query on head assets refreshes existing browser/social caches.
