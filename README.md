# SERP Telemetry Inspector

A Chrome extension that **captures and decodes Google's `/gen_204` SERP telemetry in real time** — so you can watch, signal by signal, how Google measures your behaviour on a search results page.

Every time you search, scroll, hover, click, or hit the back button on Google, your browser quietly fires tiny tracking pings to endpoints like `/gen_204`, `/client_204`, and `/log`. This extension intercepts those pings, decodes their cryptic parameters into plain English, and classifies each one against Google's internal **CAS model — Clicks · Attention · Satisfaction**.

> **This tool is built directly on the public reverse-engineering research of two people. All credit for the underlying analysis belongs to them — see [Credits & Research](#credits--research).**

---

## 📸 Screenshot

![SERP Telemetry Inspector capturing live signals on a Google search](screenshot.png)

*Live capture on a `best seo tools` query — Attention, SERP Heartbeat, and raw telemetry signals streaming in alongside the AI Overview, with running CAS counts (4 Clicks · 16 Attention · 2 Satisfaction · 70 total).*

---

## ✨ Features

- **🔴 Live capture** — pings appear in the popup the instant they fire, with no page reload.
- **🧠 CAS classification** — every signal is tagged as **C** (Click), **A** (Attention), or **S** (Satisfaction), the three pillars Google Research uses to judge result quality.
- **🔤 Full parameter decoding** — ~40 telemetry parameters translated from codes like `ct=slh` into readable labels like *"Organic Click (Search Link Hit)."*
- **🖱️ Interaction-mode detection** — badges each event as **Mouse**, **Keyboard** (incl. accessibility tab-nav), or **Gesture/Touch**.
- **🤖 AI-surface awareness** — separately recognises **AI Overview** (`aio=1`, `fid=18`) and **AI Mode** (`fid=268`) telemetry.
- **🏷️ Smart categorisation** — colour-coded event types: Organic Click, Pogo-Stick Return, Attention Signal, Viewport, Performance, SERP Heartbeat, and more.
- **🔎 Filtering** — one-tap filters by CAS pillar or by signal category.
- **📊 Live stats** — running counts of Click / Attention / Satisfaction signals.
- **💾 JSON export** — dump the full captured event log for offline analysis.
- **🔒 Local-only** — everything stays in `chrome.storage.local`. Nothing is ever sent anywhere.

---

## 🛠️ How it works

The extension is a small, dependency-free Manifest V3 build. Capturing telemetry that the *page itself* generates requires a two-world trick, because content scripts run in an isolated JS world and can't see the page's `fetch`/`XHR` calls directly.

```
┌─────────────────────── google.com tab ───────────────────────┐
│                                                               │
│   PAGE WORLD                         ISOLATED WORLD           │
│  ┌──────────────┐   __serp_ping__   ┌──────────────┐         │
│  │ injector.js  │ ───CustomEvent──▶ │  content.js  │         │
│  │              │                   │              │         │
│  │ wraps:       │                   │ decode() +   │         │
│  │ • fetch      │                   │ categorize() │         │
│  │ • XHR.open   │                   │ + CAS tag    │         │
│  │ • sendBeacon │                   └──────┬───────┘         │
│  │ • img.src    │                          │                 │
│  └──────────────┘                          ▼                 │
│                                  chrome.storage.local        │
└───────────────────────────────────────────┬─────────────────┘
                                             │ polled every 800ms
                                             ▼
                                   ┌──────────────────┐
                                   │  popup.html/js   │
                                   │  live dashboard  │
                                   └──────────────────┘
```

1. **`content.js`** (isolated world) runs at `document_start` and injects `injector.js` into the page via a `<script src>` tag — a CSP-safe way to reach the page's JS world.
2. **`injector.js`** (page world) monkey-patches the four ways Google fires a telemetry ping — `fetch`, `XMLHttpRequest.open`, `navigator.sendBeacon`, and `<img>.src` (1×1 pixel pings). When a request matches a telemetry endpoint, it parses the URL params and dispatches a `__serp_ping__` `CustomEvent`. The original network call still proceeds untouched — **nothing is blocked or modified.**
3. **`content.js`** listens for `__serp_ping__`, then:
   - **decodes** each parameter using a key-label + value-label dictionary,
   - **categorises** the event (Organic Click, Pogo, AI Overview, …) for the icon/colour,
   - **tags the CAS dimension** (C/A/S),
   - **detects interaction mode** (mouse/keyboard/gesture),
   - and persists the enriched event to `chrome.storage.local` (capped at the most recent 500).
4. **`popup.js`** polls storage every 800 ms and renders the live, filterable dashboard.

### Decoded parameters

| Param | Meaning |
|-------|---------|
| `ct` | Click/event type — `slh` (search link hit), `backbutton`, `srpf`, `psnt`, `fa`, `ejsa` |
| `me` | Measurement event — behavioural payload. Sub-codes decoded: `R` geometry, `G` gesture, `S` scroll, `V` viewport, `h` hover, `i` in-view, `o` out-of-view, `74` tap |
| `pv` | Page-view / element visibility — the CAS **attention** signal |
| `im` / `m` | Interaction mode — M mouse, V keyboard, G gesture |
| `tni` / `atni` | Tab / active-tab navigation index (keyboard accessibility) |
| `trs` | Time away from SERP before returning (pogo dwell) |
| `st` | Session / element time before the ping |
| `opi` | Operation ID — the anchor Google uses to measure pogo-sticking |
| `aqid` / `ei` | Active query ID / event identifier |
| `fid` | Feature ID — `18` AI Overview, `268` AI Mode, others SERP features |
| `aio` | AI Overview rendered (`=1`) |
| `s` / `astyp` / `aimq` / `folid` | AI Mode surface, async event type, query ID, follow-up container |
| `ved` / `vet` / `vwd` | Visual element data / token / encoded payload |
| `uact` | User action type (UI feature interactions) |
| `nt` | Navigation type — `navigate`, `reload`/re-render, `expansion` |
| `inp` `lcp` `fcp` `cls` `dcl` `aft` | Core Web Vitals & page-health timing |
| `zx` | Unix timestamp (ms) |
| `v` `bb` `bl` `hl` `fmt` `jsbp` `msc` `gwsrpc` | Format version, build variant/label, language, format, JS protobuf, module/RPC plumbing |

---

## 📥 Install (Chrome / Edge / Brave)

1. Download or clone this folder.
2. Go to `chrome://extensions/`.
3. Enable **Developer Mode** (top-right toggle).
4. Click **Load unpacked** → select the `gen204-inspector` folder.
5. The blue signal icon appears in your toolbar. Pin it for quick access.

## ▶️ Use

1. Click the toolbar icon to open the inspector.
2. In another tab, search on **google.com** — then click results, press **back**, hover, scroll, and interact with **AI Overviews / AI Mode**.
3. Watch signals stream in. Filter by **C / A / S** to study each CAS pillar, or by category (Clicks, Pogo, AIO, Keyboard, Gesture, Perf…).
4. Click any event to expand its **decoded signals** and **raw parameters**.
5. Hit **Export** to save the full log as JSON for offline analysis.

---

## 💡 Why this matters — the analysis

This is where the research behind the tool comes in. The two articles below, cross-referenced with DOJ-trial testimony from Google's Pandu Nayak, point to one conclusion: **raw `/gen_204` interaction data is the irreplaceable fuel for Google's ranking models.** It trains **Navboost** (a click-memory system), seeds **RankBrain** (originally ~13 months of click+query data) and RankEmbed BERT — which are then *fine-tuned* on human IS (Information Satisfaction) ratings.

The practical reframing for SEO:

- A click is not the goal — a **good click** (long dwell, no return) is. A **bad click** (fast pogo-stick back to the SERP) is a negative signal.
- **Good abandonment** is real: a zero-click answer where the user leaves satisfied (e.g. *"capital of Poland"*) counts as success in the CAS / IS4@5 framework, even with zero CTR.
- **Attention precedes the click** — visibility (`pv`), hover dwell, and scroll are measured *before* any click happens. Earning attention is its own optimisation target.
- **Reduce the need to return.** Time-away (`trs`) plus a back-button event is the clearest dissatisfaction fingerprint Google can log.

So the lever isn't "rank higher → get clicks." It's **earn attention → satisfy intent → suppress the return-to-SERP.** This inspector lets you watch all three happening on your own queries.

---

## 🙏 Credits & Research

This extension is purely an **implementation** of insight that belongs to the researchers below. Please read their original work — it is the real value here:

- **Vijay Chauhan** — *"Google Is Not Just Counting Clicks. It May Be Measuring the Whole Search Journey."*
  📄 https://vijaychauhanseo.substack.com/p/google-is-not-just-counting-clicks

- **Przemek (Seekio.pl)** — *"The Multidimensional Role of Clicks in Evaluation and Ranking."*
  📄 https://seekio.pl/the-multidimensional-role-of-clicks-in-evaluation-and-ranking/

The CAS model, the `/gen_204` parameter interpretations, the Navboost / RankBrain / IS4@5 framing, and the good-click / good-abandonment concepts all come from their analysis. This tool just makes those signals visible in your own browser.

---

## ⚠️ Disclaimer

Research / educational tool. It only **reads** telemetry your own browser already sends to Google — it blocks nothing and transmits nothing externally. Parameter meanings are well-reasoned interpretations from public research, patents, and trial exhibits — **not** official Google documentation. None of these are confirmed direct ranking factors.

---

<p align="center">
  Made with ❤️ by <a href="https://www.linkedin.com/in/sukhdevmiyatra/"><b>Sukhdev Miyatra</b></a>
</p>
