# Google gen_204 Telemetry Inspector

A Chrome extension that intercepts, decodes, and reverse-engineers Google's hidden SERP telemetry, turning raw network pings into SEO intelligence about click quality, attention patterns, NavBoost inputs, AIO behaviour, and query satisfaction.

Every time you search, scroll, hover, click, or press back on Google, your browser quietly fires tracking pings to `/gen_204`, `/client_204`, and `/log`. This extension captures all three, decodes their parameters in plain English, and synthesises them into per-query session analysis complete with per-element attention maps.

> Built on public reverse-engineering research. All credit for the underlying analysis belongs to the original authors listed in [Credits and research](#credits-and-research).

---

![Google gen_204 Telemetry Inspector capturing live SERP signals during a Google search](Screenshot.png)

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
- [Signal reference](#signal-reference)
- [Why this matters](#why-this-matters)
- [Credits and research](#credits-and-research)
- [Disclaimer](#disclaimer)

## Features

**Signals tab**
- Live capture of every `/gen_204`, `/client_204`, and `/log` ping as it fires
- Transport method badge: `sendBeacon` / `fetch` / `xhr` / `image` for every signal
- CAS classification: every signal tagged as C (Click), A (Attention), or S (Session Outcome)
- Click quality labels: Pogo, Satisfied, Browsed, derived from the `me=` engagement terminus
- DOM click context: distinguishes organic result clicks from AIO citation clicks, AIO Show More controls, chip filters, and SERP UI interactions
- Signal categories: organic click, pogo, attention, viewport, heartbeat, AI Overview, AIO fan-out, AI Mode, SERP feature, JS action trace, JS beacon log, ads timing, network, keyboard navigation, gesture, UI interaction, performance
- 80+ decoded parameters with three-tier confidence: decoded / inferred / observed
- `me=` Element Attention Map: parses the full behavioral payload to show per-element hover dwell, gesture count, and composite attention score ranked across up to 38 rendered SERP elements
- Engagement terminus badge: `back` (red), `click` (green), `hover-end` (amber)
- Nav chain depth badge: how many prior SERP page views Google encoded in this click
- Timing breakdowns for `rt` and `jsi` fields (top 7 shown, expandable)
- `vt=` post-click tracking decoder: shows which result you clicked and how long until attention shifted
- Auth token warning when a signed-in Google session appears in telemetry

**Sessions tab**
- Groups signals by `aqid` (Google's per-search identity) so each distinct search is its own card, even when re-running the same query text
- Per-click dwell chain: `Satisfied 4.5s -> Pogo 0.4s -> Browsed 11.3s` timeline inline
- Session attention rollup: aggregates `me=` stream hover data across all signals in a session, ranked by per-element composite score
- NavBoost framing: bad clicks, good clicks, last longest click (signals named in leaked NavBoost documentation)
- Insight bullets: CTR pattern flags, impression quality, AIO cache status (fresh vs cached), search depth
- 5-minute inactivity gap separates re-searches on the same query into distinct sessions

**AI Overviews tab**
- Cited source URLs captured from rendered AIO DOM and response bodies
- Cache indicator: `fresh` (computed on demand) vs `cached` (bfcache or pre-computed answer)
- Data freshness age from `sv` config: e.g. "sources: ~8d old"
- Render performance: `wsrt`, `aft`, `prt`, `lcp`, `fcp`
- Structure data: module count, navigation mechanism, fill time
- Fan-out sub-queries: TTFB, async render time, module count per background sub-query

**POST body capture**
- Intercepts the JSON body of `/log` POST requests (not just URL params)
- Depth-limited walk extracts any recognisable fields: `attentionRollup`, `hoverInCount`, `hoverDwellMs`, `vetToken`, `clickRank`, etc.
- Stored in export as `logBodies[]` for external schema analysis

**Controls**
- Start / Stop: explicit session control, resets automatically when the browser closes
- Export to JSON: signals, AIO overviews, sessions with attention rollups, and raw log bodies
- Clear: wipes all stored data

## How it works

Two-world interception. A page-world injector bridges the gap between the page's network calls and the isolated content script:

```
+----------------------- google.com tab -----------------------+
|                                                              |
|   PAGE WORLD                       ISOLATED WORLD            |
|  +--------------+   __serp_ping__  +--------------+          |
|  | injector.js  | ---CustomEvent-> |  content.js  |          |
|  |              |   __serp_body__  |              |          |
|  | wraps:       |                  | classify()   |          |
|  | - fetch      |                  | sessionKey() |          |
|  | - XHR.open   |                  | me= parsing  |          |
|  | - XHR.send   |                  | AIO scrape   |          |
|  | - sendBeacon |                  +------+-------+          |
|  | - img.src    |                         |                  |
|  +--------------+                         v                  |
|                                 chrome.storage.local         |
+-------------------------------------------+------------------+
                                            | polled every 800ms
                                            v
                                  +-------------------+
                                  | side panel (popup)|
                                  | decode.js (shared)|
                                  +-------------------+
```

1. **`injector.js`** (page world) wraps `fetch`, `XHR.open/send`, `sendBeacon`, and `img.src`. For every target URL it fires `__serp_ping__` with parsed URL params and the transport method. For POST bodies it fires `__serp_body__` with the string-converted request body (supports string, URLSearchParams, FormData, Blob, and ArrayBuffer inputs).

2. **`content.js`** (isolated world) classifies each signal using CAS model and DOM click context (by listening to `pointerdown`/`click` events to know whether the preceding interaction was on an organic result, AIO citation, AIO control, or SERP UI element). Stores raw params to `chrome.storage.local` using a serialised write queue to prevent concurrent-write data loss.

3. **`decode.js`** (shared) is loaded in both the content script and the side panel. Decoding happens at render time in the panel so label improvements apply retroactively to already-stored events. Contains `parseMeAttentionMap()` which parses the full `me=` behavioral stream to extract per-element hover dwell, geometry, and gesture counts.

4. **AIO capture**: when `aio=1` fires, the content script scrapes citation links from the DOM and monitors for DOM mutations (to catch dynamically loaded sources). Response bodies of async SERP requests are scanned for external URLs when an AIO was recently observed.

5. **Side panel** polls storage every 800ms. Skips re-rendering when data has not changed (preserving text selection and scroll position).

## Installation

Works in Chrome, Edge, and Brave (Manifest V3, Chrome 102+). Supports `google.com` and `google.co.in`.

1. Download or clone this folder.
2. Go to `chrome://extensions/`.
3. Enable Developer Mode (top-right toggle).
4. Click **Load unpacked** and select the `gen204-inspector` folder.
5. The signal icon appears in your toolbar. Click it to open the side panel.

## Usage

1. Click the toolbar icon to open the side panel.
2. Click **Start Capturing**.
3. In another tab, search on google.com. Click results, press back, scroll, interact with AI Overviews.
4. **Signals tab**: watch the raw telemetry stream. Expand any signal to see decoded parameters and the Element Attention Map for click events.
5. **Sessions tab**: per-query analysis with click chain, attention rollup, and NavBoost insights.
6. **AI Overviews tab**: cited sources, cache status, data freshness, and render timing.
7. Click **Export** to save the full log as JSON, including `logBodies[]` from POST captures.
8. Click **Stop** or close the browser to end the session.

## Signal reference

| Category | What fires it | Meaning |
|---|---|---|
| Organic Click | `ct=slh` with me= payload | User clicked a search result |
| Pogo | `ct=backbutton`, `tt=popstate`, or `terminus=B` | User returned to SERP |
| Attention | `pv`, `t=atr`, `ct=fa` | Visibility/dwell measurement |
| Viewport | `ct=psnt` | Page entered viewport |
| Heartbeat | `ct=srpf` | SERP foreground keepalive |
| AI Overview | `aio=1`, `fid=18` | AIO rendered or interacted with |
| AIO Fan-out | `astyp=folsrch` | Background sub-query for AIO |
| AI Mode | `s=aim`, `fid=268` | AI Mode surface |
| SERP Feature | `vet` + `s=web` | Element-level visual telemetry |
| JS Action Trace | `s=jsa` | Internal JS interaction trace |
| JS Beacon Log | `/log` endpoint | Batched client-side log |
| Ads Timing | `s=magiads` | Ad render pipeline CSI |
| Network | `ct=nrr` | Cross-origin cookie rotation |
| Performance | `t=ph`, `inp`, `lcp` | Core Web Vitals |

## Why this matters

Google's leaked internal documentation describes signals similar to what this extension captures. The leaked Search API docs explicitly name **NavBoost**, a re-ranking system reported to use bad clicks, good clicks, and "last longest clicks" from browser telemetry to adjust rankings. This extension surfaces those signals for research.

What the signals tell you:

- **`pv` (visibility ratio)**: was the result actually in the viewport when clicked? A click at 3.5% viewport is a low-quality impression. Google captures this.
- **`terminus=B` (back navigation)**: the click ended in back. This is a bad-click style signal. The Sessions tab counts and flags these.
- **Last longest click**: the non-pogo click with the longest estimated dwell time. This mirrors a named signal in public NavBoost reporting.
- **Element Attention Map**: which SERP elements held attention before the click, measured by hover dwell per VED-identified element. Reconstructed from the `me=` behavioral payload.
- **AIO cache status**: a cached AIO means Google pre-computed the answer for this query (high-confidence AIO query). A fresh AIO computed on demand.
- **Fan-out timing**: `sirt-aimc`, `sart-mfc`, and related fields show how long each phase of the AI Overview rendering pipeline took.
- **`vt=paq:[...]`**: post-click attention tracking. Google encodes which result you clicked and how long until attention shifted to the AIO, in real time.

The lever is not "rank higher, get clicks." It is "earn attention, satisfy intent, suppress the return-to-SERP."

## Credits and research

This extension is an implementation of insight that belongs to the researchers below.

- **Vijay Chauhan**, "Google Is Not Just Counting Clicks. It May Be Measuring the Whole Search Journey."
  https://vijaychauhanseo.substack.com/p/google-is-not-just-counting-clicks

- **Przemek (Seekio.pl)**, "The Multidimensional Role of Clicks in Evaluation and Ranking."
  https://seekio.pl/the-multidimensional-role-of-clicks-in-evaluation-and-ranking/

- **Google Search API leak (2024)**: SearchEngineLand analysis by Rand Fishkin et al.
  https://searchengineland.com/unpacking-googles-massive-search-documentation-leak-442716

## Disclaimer

Research and educational tool. Reads only the telemetry your browser already sends to Google. Blocks nothing and transmits nothing externally. Parameter meanings are interpretations from public research, patents, and trial exhibits, not official Google documentation. None of these are confirmed direct ranking factors.

---

Made with love by [Sukhdev Miyatra](https://www.linkedin.com/in/sukhdevmiyatra/)
