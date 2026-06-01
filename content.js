// content.js — isolated content script world
// Injects injector.js into the PAGE world via a <script src="..."> tag (CSP-safe).
// Classifies signals, persists raw params to chrome.storage for popup to decode.
// decode.js is loaded before this file and provides parseMeDwell() as a global.

(function () {
  // ── 1. Inject the page-world interceptor ──────────────────────────────────
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injector.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).prepend(s);

  // ── 1b. Capture toggle ────────────────────────────────────────────────────
  // Default false — storage read corrects to actual state. Prevents capturing
  // before Start is clicked even when the content script loads immediately.
  let captureEnabled = false;
  try {
    chrome.storage.local.get(['captureEnabled'], (r) => {
      captureEnabled = r.captureEnabled === true;
    });
    chrome.storage.onChanged.addListener((changes) => {
      if ('captureEnabled' in changes) captureEnabled = changes.captureEnabled.newValue === true;
    });
  } catch { /* orphaned tab — keep default false */ }

  // ── 2. me stream parsing ──────────────────────────────────────────────────
  // Extended version: also extracts baseTs and targetToken used for click
  // fingerprinting (deduplication of repeated telemetry echoes).
  function parseMeExtras(me) {
    if (!me) return null;
    const extras = {};
    // Navigation chain depth: ,N,<depth>,<ei>
    const nMatches = me.match(/,N,(\d+),/g);
    if (nMatches && nMatches.length) {
      extras.navDepth = Math.max(...nMatches.map(m => parseInt(m.match(/\d+/)[0])));
    }
    // Engagement terminus: ,e,B (back) | ,e,C (click) | ,e,H (hover-end)
    const term = me.match(/,e,([BCH])\b/);
    if (term) extras.terminus = term[1];
    // Browser viewport height: 0,B,<height>
    const bh = me.match(/(?:^|:)0,B,(\d+)/);
    if (bh) extras.browserHeight = parseInt(bh[1]);
    // Base timestamp (13-digit Unix ms) — used for deduplication
    const base = String(me).match(/(?:^|:)(\d{13})(?:,|$)/);
    if (base) extras.baseTs = parseInt(base[1]);
    // Last gesture/hover/region VED token — identifies the clicked element
    const gestureTokens = [...String(me).matchAll(/[:,]G,\d+,([A-Za-z0-9_-]{4,})/g)];
    const hoverTokens   = [...String(me).matchAll(/[:,]h,\d+,([A-Za-z0-9_-]{4,}),(?:i|o)\b/g)];
    const regionTokens  = [...String(me).matchAll(/[:,]R,\d+,([A-Za-z0-9_-]{4,}),/g)];
    const tokenMatch = gestureTokens[gestureTokens.length - 1] ||
                       hoverTokens[hoverTokens.length - 1]  ||
                       regionTokens[regionTokens.length - 1];
    if (tokenMatch) extras.targetToken = tokenMatch[1];
    return extras;
  }

  // ── 3. CAS model classification ───────────────────────────────────────────
  // C = Click, A = Attention, S = Session Outcome (includes bad exits/pogos)
  function casDimension(p, terminus, clickCtx) {
    if (p.ct === 'backbutton' || p.tt === 'popstate') return 'S';
    if (terminus === 'B') return 'S';   // click ended with back = bad exit
    if (clickCtx && (clickCtx.kind === 'aio_control' || clickCtx.kind === 'serp_ui' || clickCtx.kind === 'internal_ui')) return 'A';
    // Organic click checked BEFORE pv — slh events carry pv (visibility ratio,
    // a 0–1 float). A truthy check on p.pv would misclassify every click as A.
    if (p.ct === 'slh') return 'C';
    // Attention: use numeric pv check (string "0" must not be truthy)
    if (parseFloat(p.pv) > 0 || p.t === 'atr' || p.ct === 'fa') return 'A';
    // me hover/scroll codes — delimited to avoid matching timing strings
    if (p.me && /(^|[:,])h,|[:,]S,\d|[:,]G,|[:,]i:|[:,]o:/.test(p.me)) return 'A';
    // Other explicit user actions
    if (p.atyp === 'click' || p.et === 'pointerdown') return 'C';
    // First-interaction with a feature (t=fi + fid) is a user click
    if (p.t === 'fi' && p.fid) return 'C';
    return null;
  }
  const CAS_FULL = { C: 'Click', A: 'Attention', S: 'Session Outcome' };

  // ── 4. Interaction-mode detection ─────────────────────────────────────────
  function interactionMode(p) {
    const code = p.im || p.m;
    if (code === 'M' || code === 'VH') return 'mouse';
    // tni=0 is falsy — use null check so keyboard at tab-index 0 isn't missed
    if (code === 'V' || p.tni != null || p.atni != null) return 'keyboard';
    if (code === 'G') return 'gesture';
    if (p.me && /[:,]G,/.test(p.me)) return 'gesture';
    if (p.et === 'pointerdown' || p.et === 'mousedown') return 'mouse';
    return null;
  }

  // ── 5. Event categorisation ───────────────────────────────────────────────
  function categorize(p, terminus, clickCtx) {
    if (p.ct === 'backbutton' || p.tt === 'popstate') return { cat:'pogo',        label:'Pogo-Stick Return',              color:'#9e2f23' };

    if (p.ct === 'slh') {
      if (clickCtx && clickCtx.kind === 'aio_control')   return { cat:'ui',        label:'AI Overview Control',            color:'#7a7164' };
      if (clickCtx && clickCtx.kind === 'aio_citation')  return { cat:'aio_citation_click', label:'AI Overview Citation Click', color:'#6e3d6a' };
      if (clickCtx && (clickCtx.kind === 'serp_ui' || clickCtx.kind === 'internal_ui'))
                                                          return { cat:'ui',        label:'SERP UI Interaction',            color:'#7a7164' };
      // slh without behavioral payload is a bare in-page interaction (AIO expand/chip)
      if (!p.aqid && !p.me && !p.pv)                     return { cat:'ui',        label:'In-page Click (AIO / filter)',   color:'#7a7164' };
      if (terminus === 'B') return { cat:'click', label:'Click — Pogo (returned to SERP)', color:'#9e2f23' };
      if (terminus === 'C') return { cat:'click', label:'Click — Satisfied',                color:'#5a7345' };
      if (terminus === 'H') return { cat:'click', label:'Click — Browsed (hover-end)',      color:'#b5821a' };
      return                       { cat:'click', label:'Organic Click',                    color:'#5a7345' };
    }

    if (p.ct === 'srpf')                                  return { cat:'heartbeat',   label:'SERP Heartbeat',              color:'#7a7164' };
    if (p.ct === 'nrr')                                   return { cat:'network',     label:'Cross-origin Resource Check', color:'#7a7164' };
    if (p.aio === '1' || p.fid === '18')                  return { cat:'ai_overview', label:'AI Overview',                 color:'#6e3d6a' };
    if (p.aio === '5')                                    return { cat:'ai_overview', label:'AI Features (partial)',        color:'#9b6b9b' };
    if (p.astyp === 'folsrch')                            return { cat:'ai_overview', label:'AIO Fan-out Timing',           color:'#6e3d6a' };
    if (p.s === 'aim' || p.fid === '268' || String(p.astyp||'').startsWith('aim'))
                                                          return { cat:'ai_mode',     label:'AI Mode',                     color:'#3f4e82' };
    if (p.t === 'fi' && clickCtx && clickCtx.kind === 'aio_control')
                                                          return { cat:'ui',          label:'AI Overview Control',          color:'#7a7164' };
    if (p.t === 'fi' && (p.et === 'pointerdown' || p.fid) && (!clickCtx || clickCtx.kind === 'organic_result'))
                                                          return { cat:'click',       label:'Pointer Down / Result Interaction', color:'#5a7345' };
    // Numeric pv check — string "0" must not classify as Attention
    if (parseFloat(p.pv) > 0 || p.t === 'atr')           return { cat:'attention',   label:'Attention Signal',            color:'#b5821a' };
    if (p.ct === 'psnt')                                  return { cat:'viewport',    label:'Page Seen / Viewport Enter',  color:'#2f7068' };
    if (p.ct === 'fa')                                    return { cat:'attention',   label:'Feature Active in Viewport',  color:'#b5821a' };
    if (p.t === 'ph' || p.inp || p.lcp || p.fcp)          return { cat:'perf',        label:'Performance',                 color:'#b5821a' };
    if (p.t === 'lsb')                                    return { cat:'perf',        label:'Layout Shift Block',          color:'#b5821a' };
    if (p.s === 'magiads')                                return { cat:'perf',        label:'Ads Timing',                  color:'#b5821a' };
    if (p.ct === 'ejsa' || String(p.ct||'').startsWith('chipC'))
                                                          return { cat:'ui',          label:'UI / Filter Interaction',     color:'#7a7164' };
    if (p.m === 'V' || p.im === 'V' || p.tni != null || p.atni != null)
                                                          return { cat:'keyboard',    label:'Keyboard Navigation',         color:'#426a8a' };
    if (p.m === 'G' || p.im === 'G' || (p.me && /[:,]G,/.test(p.me)))
                                                          return { cat:'gesture',     label:'Gesture / Touch',             color:'#2f7068' };
    // vet + uact = SERP feature view telemetry (element-level visual context)
    if (p.vet && p.uact)                                  return { cat:'serp_feature',label:'SERP Feature',                color:'#426a8a' };
    if (p.vet && p.s === 'web')                           return { cat:'serp_feature',label:'SERP Feature',                color:'#426a8a' };
    // s=jsa = JS Analytics internal interaction trace
    if (p.s === 'jsa')                                    return { cat:'jsa',         label:'JS Action Trace',             color:'#7a7164' };
    return                                                       { cat:'other',        label:'Telemetry Signal',            color:'#7a7164' };
  }

  // ── 6. Storage queue ──────────────────────────────────────────────────────
  // Serialises reads/writes per key to prevent last-writer-wins data loss.
  // A burst of 5–10 beacons firing in <200ms would otherwise interleave their
  // get/set cycles and overwrite each other.
  const MAX = 500;
  const storageQueues = {};

  function safeGet(keys, cb) {
    try {
      chrome.storage.local.get(keys, (r) => {
        try { cb(r); } catch (e) {
          if (!String(e).includes('Extension context')) throw e;
        }
      });
    } catch { /* orphaned */ }
  }
  function safeSet(data, cb) {
    try { chrome.storage.local.set(data, () => { if (cb) cb(); }); }
    catch { if (cb) cb(); }
  }

  function updateStorageList(key, fallback, updater) {
    storageQueues[key] = (storageQueues[key] || Promise.resolve()).then(() => new Promise((resolve) => {
      safeGet([key], (r) => {
        const list = Array.isArray(r[key]) ? r[key] : fallback.slice();
        updater(list);
        safeSet({ [key]: list }, resolve);
      });
    })).catch(() => {});
  }

  // ── 7. DOM click context — what did the user click? ───────────────────────
  // Listens for pointer/click events and records the interaction kind ~5s before
  // a telemetry beacon fires. This is the only reliable way to distinguish
  // "clicked AIO Show More" from "clicked organic result #3" — both fire ct=slh.
  const AIO_CONTEXT_SELECTOR = [
    '[data-attrid="AIOverview"]',
    '[data-subtree="aiov"]',
    '[data-async-type="aiSerpSideload"]',
    '#m-x-content'
  ].join(',');
  let recentInteraction = null;

  function normalizedText(el) {
    if (!el) return '';
    return ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || el.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function isAioElement(el) {
    if (!el || !el.closest) return false;
    if (el.closest(AIO_CONTEXT_SELECTOR)) return true;
    const labelled = el.closest('[aria-label],[aria-roledescription],[data-hveid]');
    const label = labelled ? normalizedText(labelled) : '';
    return /\bAI Overview\b/i.test(label);
  }

  function isInternalGoogleHref(href) {
    if (!href) return true;
    try {
      const u = new URL(href, location.href);
      return /(^|\.)google\.[a-z.]+$/i.test(u.hostname);
    } catch { return true; }
  }

  function inferInteractionKind(el) {
    const actionable = el && el.closest ? el.closest('a,button,[role="button"],[aria-expanded],[jsaction],[data-ved]') : null;
    const anchor = el && el.closest ? el.closest('a[href]') : null;
    const href = anchor ? anchor.getAttribute('href') : '';
    const text = normalizedText(actionable || anchor || el);
    const lower = text.toLowerCase();
    const inAio = isAioElement(actionable || anchor || el);
    const external = href ? citationFromHref(href) : null;
    const isExpandControl = /\b(show|see|view)\s+(more|all)|\bmore\b|expand|collapse|show less|follow[- ]?up|ask/i.test(lower);
    const isSerpControl = /\b(images|videos|news|shopping|maps|books|tools|filters?|sort|settings|sign in)\b/i.test(lower);

    if (inAio && external) return { kind: 'aio_citation',   href: external.url, text, inAio };
    if (inAio)             return { kind: 'aio_control',    href: href || '',   text, inAio };
    if (external)          return { kind: 'organic_result', href: external.url, text, inAio };
    if (isExpandControl)   return { kind: 'serp_ui',        href: href || '',   text, inAio };
    if (isSerpControl || !href || isInternalGoogleHref(href))
                           return { kind: 'serp_ui',        href: href || '',   text, inAio };
    return                        { kind: 'internal_ui',    href: href || '',   text, inAio };
  }

  function rememberInteraction(ev) {
    if (!captureEnabled) return;
    try {
      const ctx = inferInteractionKind(ev.target);
      recentInteraction = Object.assign({ ts: Date.now(), eventType: ev.type }, ctx);
    } catch { /* no-op */ }
  }
  document.addEventListener('pointerdown', rememberInteraction, true);
  document.addEventListener('click',       rememberInteraction, true);

  function contextForTelemetry(params) {
    if (!recentInteraction) return null;
    if (!params || (params.ct !== 'slh' && !(params.t === 'fi' && params.et === 'pointerdown'))) return null;
    return (Date.now() - recentInteraction.ts) <= 5000 ? recentInteraction : null;
  }

  // ── 8. Classification + session identity ──────────────────────────────────
  function classifyTelemetry(p, terminus, clickCtx) {
    const info = categorize(p, terminus, clickCtx);
    const cas  = casDimension(p, terminus, clickCtx);
    return { cat: info.cat, label: info.label, color: info.color,
             cas, casFull: cas ? CAS_FULL[cas] : null,
             mode: interactionMode(p) };
  }

  // Primary session identity is aqid (Google's per-search ID).
  // Falls back to query text so sessions still group without aqid.
  function currentSessionKey(params) {
    const query = currentQuery();
    if (params.aqid)  return 'aqid:'  + params.aqid;
    if (params.aimq)  return 'aimq:'  + params.aimq;
    return query ? 'query:' + query.trim().toLowerCase() : null;
  }

  // Click fingerprint for deduplication: base timestamp + VED element token + pv.
  // Google fires multiple slh telemetry echoes for one click; same fingerprint = same click.
  function clickFingerprint(params, extras) {
    if (!params || params.ct !== 'slh') return null;
    const pv     = params.pv ? Number(parseFloat(params.pv).toFixed(3)) : '';
    const target = extras && extras.targetToken ? extras.targetToken : '';
    const base   = extras && extras.baseTs      ? extras.baseTs      : '';
    return [target, pv, base].filter(v => v !== '').join('|') || null;
  }

  // ── 9. Event listener — persist each telemetry ping ───────────────────────
  window.addEventListener('__serp_ping__', (e) => {
    if (!captureEnabled) return;
    const { url, pathname, params, transport } = e.detail;

    const meExtras = params.me ? parseMeExtras(params.me) : null;
    const terminus = meExtras && meExtras.terminus;
    const clickCtx = contextForTelemetry(params);
    // /log endpoint is Google's batched JS beacon logger — label it directly
    const cls = pathname === '/log'
      ? { cat:'jsbp_log', label:'JS Beacon Log', color:'#7a7164', cas:null, casFull:null, mode:null }
      : classifyTelemetry(params, terminus, clickCtx);
    const query    = currentQuery() || null;

    // parseMeDwell is provided by decode.js (loaded before this file)
    const dwellMs = params.me && typeof parseMeDwell === 'function'
      ? parseMeDwell(params.me) : null;

    const event = {
      id:          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts:          new Date().toISOString(),
      endpoint:    pathname,
      transport:   transport || null,    // sendBeacon / fetch / xhr / image
      url,
      params,                            // raw — decode.js renders these at popup time
      query,
      aqid:        params.aqid || null,
      sessionKey:  currentSessionKey(params),
      cat:         cls.cat,
      label:       cls.label,
      color:       cls.color,
      cas:         cls.cas,
      casFull:     cls.casFull,
      mode:        cls.mode,
      navDepth:    meExtras && meExtras.navDepth,
      terminus:    meExtras && meExtras.terminus,
      meBaseTs:    meExtras && meExtras.baseTs,
      clickTarget: meExtras && meExtras.targetToken,
      clickKind:   clickCtx && clickCtx.kind,
      clickHref:   clickCtx && clickCtx.href,
      clickText:   clickCtx && clickCtx.text,
      inAio:       clickCtx && clickCtx.inAio,
      clickKey:    clickFingerprint(params, meExtras),
      dwellMs,
    };

    updateStorageList('events', [], (events) => {
      events.unshift(event);
      if (events.length > MAX) events.length = MAX;
    });

    if (params.aio === '1' || params.aio === '5' || params.fid === '18') {
      aioSeen = true;
      lastAioSeenAt = Date.now();
      scheduleAioScrape();
    }
    if ((params.aio === '1' || params.aio === '5') && params.t === 'all') {
      captureAioMeta(params);
    }
    if (params.astyp === 'folsrch' && params.t === 'all') {
      captureFanout(params);
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  //  AI Overview citation capture
  // ════════════════════════════════════════════════════════════════════════
  const AIO_MAX = 100;
  const AIO_SESSION_GAP_MS = 5 * 60 * 1000; // 5 min gap = new AIO card for same query
  let aioSeen = false;
  let lastAioSeenAt = 0;

  // Find the most recent AIO entry for this query/sessionKey if it was updated
  // within the gap window; otherwise create a new entry. This ensures re-searching
  // the same query after a gap produces a fresh card rather than appending to stale data.
  function findOrCreateAioEntry(events, query, sessionKey) {
    const existing = events.find(e =>
      (sessionKey && e.sessionKey === sessionKey) || (!sessionKey && e.query === query));
    if (existing && (Date.now() - new Date(existing.ts).getTime()) < AIO_SESSION_GAP_MS) {
      return existing;
    }
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    ts: new Date().toISOString(), query, sessionKey, sources: [], via: [] };
    events.unshift(entry);
    return entry;
  }

  const INTERNAL_HOSTS = /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|googleapis\.com|ggpht\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|googlesyndication\.com)$/i;
  const SKIP_DOMAINS   = new Set(['w3.org','schema.org','openstreetmap.org','g.co']);

  function currentQuery() {
    try { return new URL(location.href).searchParams.get('q') || ''; }
    catch { return ''; }
  }

  function citationFromHref(href) {
    if (!href) return null;
    const clean = String(href).replace(/&quot;|&amp;|&lt;|&gt;/gi, '').replace(/[<>"';,]+$/, '').trim();
    if (!clean) return null;
    try {
      let u = new URL(clean, location.href);
      if ((u.pathname === '/url' || u.pathname === '/aclk') && u.searchParams.get('q')) {
        u = new URL(u.searchParams.get('q'));
      }
      if (!/^https?:$/.test(u.protocol)) return null;
      if (INTERNAL_HOSTS.test(u.hostname)) return null;
      const domain = u.hostname.replace(/^www\./, '');
      if (SKIP_DOMAINS.has(domain)) return null;
      if (/[&<>"']/.test(u.hostname)) return null;
      return { url: u.href, domain };
    } catch { return null; }
  }

  // AIO container selectors in specificity order. Google changes markup often;
  // we try the most specific first and fall back gracefully.
  const AIO_CONTAINER_SELECTORS = [
    '[data-attrid="AIOverview"]',
    '[data-subtree="aiov"]',
    '[data-async-type="aiSerpSideload"]',
    'div[data-mcpr]',
    '#m-x-content',
    '[jsname][data-ved][data-async-context]',
  ];

  function findAioContainer() {
    for (const sel of AIO_CONTAINER_SELECTORS) {
      try { const el = document.querySelector(sel); if (el) return el; }
      catch { /* invalid selector on older Chrome */ }
    }
    // Fallback: walk from an "AI Overview" labelled element to its block root
    for (const n of document.querySelectorAll('[aria-label],[aria-roledescription],[data-hveid]')) {
      const label = n.getAttribute('aria-label') || n.getAttribute('aria-roledescription') || '';
      if (/\bAI Overview\b/i.test(label)) {
        return n.closest('[data-async-id],[data-attrid="AIOverview"],[data-subtree="aiov"],[data-async-type="aiSerpSideload"]') || n;
      }
    }
    return null;
  }

  function scrapeAioCitations() {
    const container = findAioContainer();
    if (!container) return [];
    const seenUrl = new Set(), seenDomain = new Set(), out = [];

    // Strategy 1: Google's tracked redirect links — most reliable citations
    const tracked = container.querySelectorAll('a[href*="/url?q="], a[href*="/aclk?"], a[data-ved][href*="http"]');
    if (tracked.length > 0) {
      tracked.forEach((a) => {
        const c = citationFromHref(a.getAttribute('href'));
        if (c && !seenUrl.has(c.url)) { seenUrl.add(c.url); out.push(c); }
      });
    }
    // Strategy 2: data-ved external links (reliable when /url?q= isn't used)
    if (out.length === 0) {
      container.querySelectorAll('a[data-ved][href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('http') && !href.startsWith('/url')) return;
        const c = citationFromHref(href);
        if (c && !seenUrl.has(c.url)) { seenUrl.add(c.url); out.push(c); }
      });
    }
    // Strategy 3: broadest fallback — all external links with visible text
    if (out.length === 0) {
      container.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('http') && !href.startsWith('/url')) return;
        if (!((a.textContent || '').trim().length >= 3)) return;
        const c = citationFromHref(href);
        if (c && !seenDomain.has(c.domain)) { seenDomain.add(c.domain); seenUrl.add(c.url); out.push(c); }
      });
    }
    return out;
  }

  function extractUrlsFromText(text) {
    const out = [], seenUrl = new Set(), domainCount = {};
    const re = /https?:\/\/[^\s"'\\<>)}\];&#]+/g;
    let m, guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 20000) {
      const raw = m[0].replace(/[.,]+$/, '');
      const c = citationFromHref(raw);
      if (c && !seenUrl.has(c.url)) {
        seenUrl.add(c.url);
        domainCount[c.domain] = (domainCount[c.domain] || 0) + 1;
        if (domainCount[c.domain] <= 3) out.push(c);
      }
      if (out.length >= 80) break;
    }
    return out;
  }

  function parseKV(str) {
    const out = {};
    if (!str) return out;
    String(str).split(',').forEach(tok => {
      const i = tok.indexOf('.');
      if (i !== -1) {
        const v = tok.slice(i + 1);
        const n = parseFloat(v);
        out[tok.slice(0, i)] = isNaN(n) ? v : n;
      }
    });
    return out;
  }

  function captureAioMeta(params) {
    if (!captureEnabled) return;
    const query = currentQuery();
    if (!query) return;
    const sessionKey = currentSessionKey(params);
    const timing     = parseKV(params.rt);
    const netInfo    = parseKV(params.net);
    const svConfig   = parseKV(params.sv);

    const meta = {
      fillTime:      params.ts   ? parseInt(params.ts)   : null,
      moduleCount:   params.imn  ? parseInt(params.imn)  : null,
      activeModules: params.ima  ? parseInt(params.ima)  : null,
      activeCount:   params.imac ? parseInt(params.imac) : null,
      // Cache: dt='cache' = Google cached the AIO answer; ant='traverse' = back/forward restore
      cacheStatus:   (params.dt === 'cache' || params.ant === 'traverse') ? 'cache' : 'fresh',
      navMechanism:  params.ant || null,
      svConfig,
      timing,
      hasAiMode:     ('sgl' in timing || 'sgsrt' in timing || 'sgls' in timing),
      network:       netInfo,
      containerIds:  [params.folr, params.folid].filter(Boolean),
      capturedAt:    new Date().toISOString(),
    };

    updateStorageList('aioEvents', [], (events) => {
      const entry = findOrCreateAioEntry(events, query, sessionKey);
      entry.aioMeta = meta;
      entry.ts = new Date().toISOString();
      if (events.length > AIO_MAX) events.length = AIO_MAX;
    });
  }

  function captureFanout(params) {
    if (!captureEnabled) return;
    const query = currentQuery();
    if (!query) return;
    const sessionKey = currentSessionKey(params);
    const timing     = parseKV(params.rt);

    const fanoutEvent = {
      ts:          new Date().toISOString(),
      foldId:      params.folid || null,
      ttfb:        timing.ttfb  || null,
      artMs:       timing.art   || null,
      irfi:        timing.irfi  || null,
      moduleCount: params.imn ? parseInt(params.imn) : null,
      activeIndex: params.ima ? parseInt(params.ima) : null,
      svConfig:    parseKV(params.sv),
      timing,
    };

    updateStorageList('aioEvents', [], (events) => {
      const entry = findOrCreateAioEntry(events, query, sessionKey);
      if (!entry.fanoutEvents) entry.fanoutEvents = [];
      const isDupe = entry.fanoutEvents.some(f => Math.abs((f.ttfb||0) - (fanoutEvent.ttfb||0)) < 20);
      if (!isDupe) entry.fanoutEvents.push(fanoutEvent);
      if (events.length > AIO_MAX) events.length = AIO_MAX;
    });
  }

  function upsertAio(sources, via) {
    if (!sources || !sources.length || !captureEnabled) return;
    const query = currentQuery();
    if (!query) return;
    const sessionKey = currentSessionKey({});
    updateStorageList('aioEvents', [], (events) => {
      const entry = findOrCreateAioEntry(events, query, sessionKey);
      const known = new Set(entry.sources.map((x) => x.url));
      let added = false;
      sources.forEach((x) => { if (!known.has(x.url)) { known.add(x.url); entry.sources.push(x); added = true; } });
      if (!entry.via.includes(via)) entry.via.push(via);
      if (added) entry.ts = new Date().toISOString();
      if (events.length > AIO_MAX) events.length = AIO_MAX;
    });
  }

  let scrapeTimer = null;
  function scheduleAioScrape() {
    clearTimeout(scrapeTimer);
    scrapeTimer = setTimeout(() => {
      const c = scrapeAioCitations();
      if (c.length) upsertAio(c, 'dom');
    }, 700);
  }

  function startAioObserver() {
    try {
      const obs = new MutationObserver(() => { if (aioSeen && captureEnabled) scheduleAioScrape(); });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch { /* no-op */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAioObserver, { once: true });
  } else {
    startAioObserver();
  }

  // Response-body AIO URL capture — gated: only runs when AIO was recently seen
  // AND the response body/URL contains an AIO marker. This prevents random
  // Google async responses from becoming false AIO citation entries.
  window.addEventListener('__serp_response__', (e) => {
    if (!captureEnabled) return;
    try {
      const detail = e.detail || {};
      const body   = String(detail.body || '');
      const url    = String(detail.url  || '');
      const recentlySawAio = aioSeen && (Date.now() - lastAioSeenAt) < AIO_SESSION_GAP_MS;
      const hasAioMarker   = /AIOverview|AI Overview|aiSerpSideload|data-subtree=["']?aiov|[?&]aio=|aiov/i
                               .test(url + '\n' + body.slice(0, 200000));
      if (!recentlySawAio && !hasAioMarker) return;
      const found = extractUrlsFromText(body);
      if (found.length) upsertAio(found, 'response');
    } catch { /* no-op */ }
  });

  // POST body capture — fires for /gen_204, /client_204, and /log POST requests.
  // The /log endpoint (play.google.com/log?format=json) receives batched JSON telemetry
  // that may contain structured attention/hover data not visible in URL params.
  // We store whatever parses as JSON and surface it as a separate body_log event.
  const LOG_BODIES_KEY = 'logBodies';
  const LOG_BODY_MAX   = 50;

  window.addEventListener('__serp_body__', (e) => {
    if (!captureEnabled) return;
    try {
      const { url, body } = e.detail || {};
      if (!body || !body.trim()) return;

      // Try JSON parse — /log bodies are JSON. Protos will fail and be skipped.
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { return; /* binary or non-JSON body — nothing useful to store */ }

      const query      = currentQuery() || null;
      const sessionKey = currentSessionKey({});

      // Walk the JSON to extract any recognisable attention/hover fields.
      // Google's log format nests events inside arrays; we do a depth-limited search.
      const extracted  = extractLogSignals(parsed);

      const entry = {
        id:         `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ts:         new Date().toISOString(),
        url:        String(url || ''),
        query,
        sessionKey,
        raw:        parsed,       // full parsed body for export/inspection
        signals:    extracted,    // any recognised structured fields
      };

      updateStorageList(LOG_BODIES_KEY, [], (list) => {
        list.unshift(entry);
        if (list.length > LOG_BODY_MAX) list.length = LOG_BODY_MAX;
      });
    } catch { /* no-op */ }
  });

  // Depth-limited walk of a parsed log body, looking for known field names.
  // Returns a flat array of {path, key, value} for any matches.
  function extractLogSignals(obj, path, depth) {
    if (!obj || typeof obj !== 'object') return [];
    path  = path  || '';
    depth = depth || 0;
    if (depth > 8) return [];

    const INTERESTING = new Set([
      'attentionRollup','hoverInCount','hoverDwellMs','vetToken','vet',
      'clickCount','dwellMs','dwellTimeMs','visibilityMs','exposureTimeMs',
      'clickRank','clickPosition','serp_rank','impressionMs',
      'userActionType','interactionType','featureId','surfaceId',
    ]);

    const out = [];
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? path + '.' + k : k;
      if (INTERESTING.has(k)) out.push({ path: p, key: k, value: v });
      if (v && typeof v === 'object') {
        out.push(...extractLogSignals(v, p, depth + 1));
      }
    }
    return out;
  }
})();
