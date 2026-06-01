// decode.js — shared decode/parse machinery.
// Loaded in BOTH worlds via one source of truth:
//   - content script (manifest js: ["decode.js","content.js"]) for me-stream parsing
//   - side panel (popup.html <script src="decode.js"> before popup.js) for render-time decode
// Everything here is a pure function of the raw params — no DOM, no storage.
// Decoding happens at RENDER time, so label improvements apply to old logs too.

// ── Value-level decode dictionary ──────────────────────────────────────────
const LABEL_MAP = {
  ct: {
    slh:'Organic Click (Search Link Hit)', backbutton:'Pogo-Stick / Back-Button Return',
    srpf:'SERP Heartbeat (Foreground)', psnt:'Page Seen / Viewport Enter',
    fa:'Feature Active in Viewport', ejsa:'UI / Chrome Interaction',
    nrr:'Cross-origin Resource Check (cookie rotation)',
  },
  t:     { fi:'First / Feature Interaction', ph:'Page Health / Performance', atr:'Attention Rollup' },
  fid:   { '18':'AI Overview', '268':'AI Mode', '15':'SERP Feature (15)', '13':'Non-AIO Feature (13)', '9':'SERP Feature (9)', '14':'SERP Feature (14)' },
  s:     { aim:'AI Mode Surface', web:'Web SERP', webhp:'Google Homepage', jsa:'JS Analytics (internal)', async:'Async/AIO Content', relq:'Related Queries', promo:'Promo/Homepage Bar', magiads:'Google Ads Pipeline', '0':'AIO Block (surface 0)', '1':'AIO Block (surface 1)', '2':'AIO Block (surface 2)', '3':'AIO Block (surface 3)', '4':'AIO Block (surface 4)', '5':'AIO Block (surface 5)' },
  aio:   { '1':'AI Overview Rendered', '5':'AI Features Active (partial load)' },
  tt:    { popstate:'Browser Back (popstate)' },
  astyp: { aim_folwr:'AI Mode Follow-up Wrapper', folsrch:'AIO Fan-out (background sub-query)', hpba:'Homepage Bar Async' },
  im:    { M:'Mouse', V:'Keyboard (virtual)', G:'Gesture / Touch' },
  m:     { M:'Mouse', V:'Keyboard (virtual)', G:'Gesture / Touch', VH:'Mouse + visual-hover' },
  nt:    { navigate:'Navigation', reload:'Reload / Re-render', popstate:'Back', expansion:'Expansion', back_forward:'Back / Forward (cached)', prerender:'Prerendered (Google predicted this search)' },
  et:    { pointerdown:'Pointer Down', mousedown:'Mouse Down', click:'Click', scroll:'Scroll', keydown:'Key Down' },
  atyp:  { click:'Click', i:'Interaction', e:'Event', csi:'Client-Side Instrumentation' },
};

// ── Key-level labels ────────────────────────────────────────────────────────
const KEY_LABELS = {
  // Identity / session
  ct:'Click / Event Type', t:'Trigger Type', et:'Event Type', atyp:'Action Type',
  ei:'Event Identifier', aqid:'Active Query ID', opi:'Operation ID (pogo anchor)',
  // Features & surfaces
  fid:'Feature ID', s:'Surface', aio:'AI Overview Present', uact:'User Action Type',
  // Interaction mode
  im:'Interaction Mode', m:'Mode',
  // Navigation
  tt:'Browser History Event', nt:'Navigation Type', astyp:'Async Event Type',
  folid:'Async / Follow-up Container ID', folr:'Async / Follow-up Container ID',
  aimq:'AI Mode Query ID',
  // Timing
  st:'Session / Element Time', trs:'Time Away from SERP', zx:'Unix Timestamp (ms)',
  rt:'Response Timing', jsi:'JS Interaction Trace',
  // Attention / visibility
  pv:'Visibility / Attention', pvt:'Page-View Time (~ms)',
  me:'Measurement Event (behavioral payload)',
  // Keyboard accessibility
  tni:'Tab Navigation Index', atni:'Active Tab Nav Index',
  // Visual context
  ved:'Visual Element Data', vet:'Visual Element Token', vwd:'Encoded Element Payload',
  l:'UI Location / Layer',
  // Performance / Core Web Vitals
  inp:'INP — Interaction to Next Paint (ms)', lcp:'LCP — Largest Contentful Paint (ms)',
  fcp:'FCP — First Contentful Paint (ms)', cls:'CLS — Cumulative Layout Shift',
  dcl:'DOMContentLoaded (ms)', aft:'Above-the-Fold Time (ms)',
  // Interaction counts (performance events)
  ic:'Total Interactions (this page)', lic:'Long Interactions >100ms',
  // Reload counter
  r:'Reload / Re-render Count',
  // Layout shift
  lsbs:'Layout Shift Block Score', lsbl:'Layout Shift Block Count', tsli:'Time Since Last Interaction (ms)',
  // Ad / feature health
  adh:'Ad Health / Feature Bucket',
  // Plumbing
  errsrp:'SERP Error Reporter', pcon:'Prefetch Connection Status',
  dt19:'Device / Data Tier Flag', prm23:'Permission / Experiment Flag',
  auth:'Google Auth Token (signed-in session)',
  // Cross-origin / nrr
  rot:'Cross-origin Domains Rotated', mnrr:'Cross-origin Load Mode',
  murl:'Matched URL (triggering search)', vt:'Post-click Tracking Payload',
  // Viewport / device (from client_204)
  biw:'Browser Inner Width (px)', bih:'Browser Inner Height (px)', dpr:'Device Pixel Ratio',
  // Build / format
  v:'Telemetry Format Version', bb:'Build / Beta Variant', bl:'Build Label',
  hl:'Interface Language (hreflang)', fmt:'Data Format', jsbp:'JS Protocol Buffers',
  msc:'Module Service Context', gwsrpc:'Google Web Search RPC',
  // AIO module metrics
  imn:'Inline Module Count', ima:'Inline Module Index (active)',
  imac:'Inline Module Active Count', imad:'Inline Module Available',
  ime:'IM Engagement', imeh:'IM Engagement Hover', imeha:'IM Engagement Hover (A)',
  imehb:'IM Engagement Hover (B)', imea:'IM Engagement Action',
  imeb:'IM Engagement Block', imeeb:'IM Engagement External Block',
  imexb:'IM Engagement Expanded Block', imel:'IM Engagement Link',
  imed:'IM Engagement Dismiss',
  sv:'AIO Module / Service Versions',
  // AIO misc
  ddl:'Dynamic Detail Level', wh:'Viewport Height', nhp:'AIO Slot Heading Level',
  ant:'Navigation Mechanism', dt:'Page Load Type (empty=fresh, cache=cached)',
  ts:'AIO Slot Timestamp', stc:'Style Token Count', dtc:'Design Token Count',
  fld:'Field Load Data', lts:'Local Timestamp', cb:'Cumulative Bytes',
  ucb:'User Cumulative Bytes', adh_b:'Ad Health Bucket',
  tbdba:'Threshold Delay Before (A)', tbdaa:'Threshold Delay After (A)',
  thdba:'Threshold Hold Delay Before (A)', thdaa:'Threshold Hold Delay After (A)',
  hp:'High Priority Flag', p:'Page State Flags', scp:'Scroll Position',
  mem:'JS Heap Stats', net:'Network Conditions', nv:'Navigation Count + Experiment ID',
};

// ── Confidence tiers ──────────────────────────────────────────────────────
const CONF_INFERRED = new Set([
  'pv','pvt','folid','folr','opi','vet','ved','vwd','uact','astyp',
  'aimq','bb','bl','rt','jsi','trs','msc','gwsrpc','jsbp',
  'imn','ima','imac','imad','ime','imeh','imeha','imehb','imea','imeb',
  'imeeb','imexb','imel','imed','sv','ddl','wh','nhp','ant','dt','ts',
  'stc','dtc','fld','lts','cb','ucb','tbdba','tbdaa','thdba','thdaa',
  'hp','p','scp','mem','net','nv','adh','lsbs','lsbl','tsli','ic','lic','r',
]);
function confOf(key) {
  if (key === 'auth') return 'observed';   // always flag auth tokens as observed
  if (CONF_INFERRED.has(key)) return 'inferred';
  if (KEY_LABELS[key]) return 'decoded';
  return 'observed';
}

// ── Timing-string glossary ─────────────────────────────────────────────────
const RT_GLOSS = {
  ttfb:'time to first byte', wsrt:'web-search response time',
  hst:'header start', dlt:'data-load time', sct:'script time',
  frts:'first-result time', frvt:'first-result visible',
  prt:'page render time', aft:'above-the-fold time',
  afts:'above-the-fold start', afti:'above-the-fold (initial)',
  aftr:'above-the-fold (rendered)',
  fcp:'first contentful paint', lcp:'largest contentful paint',
  dcl:'DOMContentLoaded',
  xjspls:'XJS preload start', xjsls:'XJS load start',
  xjses:'XJS eval start', xjsee:'XJS eval end', xjs:'XJS total',
  dit:'document interactive time',
  cst:'connection start', dnst:'DNS time',
  rqst:'request start', rspt:'response start', rqstt:'request total',
  unt:'unload time', cstt:'connection setup total',
  'sirt-mul':'AIO multiline - render init',
  'sart-mul':'AIO multiline - async render',
  'scrt-mul':'AIO multiline - render complete',
  'saft-mul':'AIO multiline - after-fold time',
  'sirt-mfc':'AIO multi-feature - render init',
  'sart-mfc':'AIO multi-feature - async render',
  'scrt-mfc':'AIO multi-feature - render complete',
  'saft-mfc':'AIO multi-feature - after-fold time',
  'sirt-aimc':'AIO model component - render init',
  'sart-aimc':'AIO model component - async render',
  'scrt-aimc':'AIO model component - render complete',
  'saft-aimc':'AIO model component - after-fold time',
  'sirt-aimfl':'AIO follow-up links - render init',
  'sart-aimfl':'AIO follow-up links - async render',
  'scrt-aimfl':'AIO follow-up links - render complete',
  'saft-aimfl':'AIO follow-up links - after-fold time',
  'sirt-mfl':'AIO multi-feature links - render init',
  'sart-mfl':'AIO multi-feature links - async render',
  'scrt-mfl':'AIO multi-feature links - render complete',
  'saft-mfl':'AIO multi-feature links - after-fold time',
  'sirt-dfa':'AIO data freshness - render init',
  'sart-dfa':'AIO data freshness - async render',
  'scrt-dfa':'AIO data freshness - render complete',
  irfi:'inline result fetch initiated',
  irfie:'inline result fetch ended',
  irli:'inline result load initiated',
  aaft:'above-fold AI time',
  aafit:'above-fold AI time (initial)',
  aafct:'above-fold AI complete time',
  ipf:'initial page fetch',
  ipfr:'initial page fetch response',
  ipfrl:'initial page fetch response latency',
  acrt:'async complete render time',
  art:'async render time',
  ns:'nav-start offset',
  mart:'ad render time (mobile)',
  relqft:'related queries fetch time',
  hpbas:'homepage bar appearance start',
  hpbarr:'homepage bar arrival',
  // JSI sub-keys
  st:'session time at interaction',
  fht:'first hover time (how long before first hover)',
  bf:'tab background time (tab was hidden this long)',
  tni:'tab nav index', atni:'active tab nav index',
  n:'JS handler component', an:'ancestor component',
  cn:'component nesting depth', ie:'internal event flag',
  af:'event listeners fired', ett:'event type code',
  sned:'event bubbled down', snei:'event bubbled up',
  t:'timing before event', at:'timing after event',
  tie:'tied event type', hd:'homepage dwell flag',
};

function parseTiming(str, isJsi) {
  return String(str).split(',').map((tok) => {
    const i = tok.indexOf('.');
    if (i === -1) return { k: tok, v: '(flag)' };
    const k = tok.slice(0, i);
    const raw = tok.slice(i + 1);
    const isInteger = /^-?\d+$/.test(raw);
    const isFloat = /^-?\d+\.\d+$/.test(raw);
    const gloss = RT_GLOSS[k] ? '  -  ' + RT_GLOSS[k] : '';
    let val;
    if (isInteger) {
      const n = parseInt(raw);
      val = (isJsi && (k === 'fht' || k === 'bf') && n > 1000)
        ? `${(n/1000).toFixed(1)}s (${n}ms)`
        : `${raw} ms`;
    } else if (isFloat) {
      val = raw;
    } else {
      val = raw;
    }
    return { k, v: val + gloss };
  });
}

// ── me stream parsing ───────────────────────────────────────────────────────
// The me stream is a ':'-delimited list of behavioral segments. The first
// segment is a sequence id; one segment carries a 13-digit base timestamp + the
// initial viewport (V) record; later segments each begin with a delta-ms offset
// then an event code (h=hover, S=scroll, R=region, G=gesture, e=terminus...).
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
  // Browser viewport height at event time: 0,B,<height>
  const bh = me.match(/(?:^|:)0,B,(\d+)/);
  if (bh) extras.browserHeight = parseInt(bh[1]);
  return extras;
}

// True dwell to terminus, when the me stream is the unambiguous simple form:
//   <seq>:<base_ts>,V,...:<delta>,e,<X>
// Here the single delta IS the full dwell (verified: 61090ms = 61s session).
// Complex multi-segment streams use deltas we can't fully reconstruct, so we
// return null and let the caller fall back to next-event timing. No overclaiming.
function parseMeDwell(me) {
  if (!me) return null;
  const segs = String(me).split(':');
  if (segs.length !== 3) return null;          // not the simple 3-segment form
  const m = segs[2].match(/^(\d+),e,[BCH]\b/);  // <delta>,e,<terminus>
  if (!m) return null;
  const n = parseInt(m[1]);
  return isNaN(n) ? null : n;
}

function decodeMe(me) {
  if (!me) return null;
  const found = [];
  // Delimiter-bounded matching avoids false positives from base64 tokens.
  const CHECKS = [
    [/[:,]R,\d/,      'R=geometry/region'],
    [/[:,]G,\d/,      'G=gesture/pointer'],
    [/[:,]S,[-\d]/,   'S=scroll'],
    [/[:,]V,\d/,      'V=viewport'],
    [/[:,]h,\d/,      'h=hover/attention'],
    [/[:,]74,/,       '74=tap'],
    [/[:,]M,/,        'M=mouse-hover'],
    [/[:,]C,\d/,      'C=click-target'],
    [/(?:^|:)0,B,\d/, 'B=browser-height'],
    [/[:,]N,\d/,      'N=nav-chain'],
    [/[:,]T:/,        'T=tab-focus'],
    [/[:,]i:/,        'i=in-view'],
    [/[:,]o:/,        'o=out-of-view'],
  ];
  for (const [re, label] of CHECKS) {
    if (re.test(me)) found.push(label);
  }
  return found.length ? found.join(' - ') : null;
}

function fmtMs(v) {
  const n = parseInt(v);
  if (isNaN(n)) return v;
  return n < 1000 ? `${n}ms` : `${(n/1000).toFixed(1)}s (${n}ms)`;
}

// ── me= Element Attention Map ───────────────────────────────────────────────
// Parses the full me= behavioral stream to reconstruct per-element attention:
// hover dwell time, gesture count, and a composite score.
//
// Stream format: <seq>:<base_ts>,<event>:<delta_ms>,<event>:...
// Each colon-delimited segment after the seq is ONE event.
// Deltas accumulate from the previous event (not from base).
//
// Event codes relevant to attention:
//   R,<level>,<VED>,<x>,<y>,<w>,<h>    element geometry record
//   h,<n>,<VED>,<i|o>                   hover enter (i) / exit (o)
//   G,<n>,<VED>,<x>,<y>,<n>             gesture (pointer movement or click)
//
// Score = hoverDwellMs + (gestures * 250)   [same formula as Vijay's tool]
function parseMeAttentionMap(me) {
  if (!me) return null;
  const segs = me.split(':');
  if (segs.length < 3) return null; // need seq + base + at least one other event

  // segs[0] = seq id; segs[1] starts with the 13-digit base timestamp
  const baseTs = parseInt(segs[1].split(',')[0]);
  if (isNaN(baseTs) || String(baseTs).length < 12) return null;

  const els = {}; // VED token → { rects[], hovers[], gestures }
  function getEl(ved) {
    if (!els[ved]) els[ved] = { rects: [], hovers: [], gestures: 0 };
    return els[ved];
  }

  let absT = baseTs;

  for (let si = 1; si < segs.length; si++) {
    const parts = segs[si].split(',');
    // segs[1]: [baseTs, code, arg, arg, ...]  (absT = baseTs, no delta)
    // segs[2+]: [deltaMs, code, arg, arg, ...]
    let code, args;
    if (si === 1) {
      code = parts[1]; args = parts.slice(2);
    } else {
      const delta = parseInt(parts[0]);
      if (!isNaN(delta) && delta >= 0) absT += delta;
      code = parts[1]; args = parts.slice(2);
    }
    if (!code) continue;

    if (code === 'R' && args.length >= 5) {
      // R,<level>,<VED>,<x>,<y>,<w>,<h>
      const [, ved, xs, ys, ws, hs] = args;
      const x=parseInt(xs), y=parseInt(ys), w=parseInt(ws), h=parseInt(hs);
      if (ved && !isNaN(w) && w > 0 && h > 0) getEl(ved).rects.push({x,y,w,h});
    } else if (code === 'h' && args.length >= 3) {
      // h,<count>,<VED>,<state>   state = 'i' (enter) or 'o' (exit)
      const [, ved, state] = args;
      if (ved && (state === 'i' || state === 'o')) getEl(ved).hovers.push({t: absT, state});
    } else if (code === 'G' && args.length >= 2) {
      // G,<count>,<VED>,<x>,<y>,<n>
      const [, ved] = args;
      if (ved) getEl(ved).gestures++;
    }
  }

  // Compute per-element metrics from the accumulated records
  const results = [];
  for (const [ved, el] of Object.entries(els)) {
    let hoverDwellMs = 0, hoverInCount = 0, lastEnterT = null;
    for (const ev of el.hovers) {
      if (ev.state === 'i') { lastEnterT = ev.t; hoverInCount++; }
      else if (ev.state === 'o' && lastEnterT !== null) {
        hoverDwellMs += ev.t - lastEnterT; lastEnterT = null;
      }
    }
    const rect = el.rects[el.rects.length - 1] || null;
    const score = hoverDwellMs + (el.gestures * 250);
    if (hoverInCount === 0 && el.gestures === 0) continue; // skip zero-interaction elements
    results.push({ ved, rect, hoverInCount, hoverDwellMs, gestures: el.gestures, score });
  }

  if (!results.length) return null;
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ── Build the decoded parameter list from raw params (render-time) ──────────
function decode(params) {
  const ORDER = ['ct','t','atyp','et','im','m','fid','s','aio','uact','tt','nt','astyp',
                 'pv','pvt','st','trs','zx','tni','atni','inp','lcp','fcp','cls','dcl','aft',
                 'rt','jsi','me','vet','ved','vwd','aimq','folid','folr','aqid','opi','ei','l','hl','v'];
  const keys = [...ORDER, ...Object.keys(params).filter(k => !ORDER.includes(k))];
  const out = [];
  for (const k of keys) {
    if (!(k in params)) continue;
    const v = params[k];
    let label = KEY_LABELS[k] || k;
    let display = (LABEL_MAP[k] && LABEL_MAP[k][v]) ? LABEL_MAP[k][v] : v;
    let rows = null;

    if (k === 'trs' || k === 'st') display = fmtMs(v);

    if (k === 'pv') {
      const num = parseFloat(v);
      if (!isNaN(num) && num > 0 && num <= 1) {
        label = 'Visibility ratio at click (0-1)';
        display = num.toFixed(4);
      } else {
        label = 'Attention / dwell (units)';
      }
    }

    if (k === 'rt' && typeof v === 'string' && v.includes('.')) {
      rows = parseTiming(v, false);
      display = `${rows.length} metric${rows.length === 1 ? '' : 's'}`;
    }
    if (k === 'jsi' && typeof v === 'string') {
      rows = parseTiming(v, true);
      display = `${rows.length} metric${rows.length === 1 ? '' : 's'}`;
    }

    if (k === 'me') {
      const sub = decodeMe(v);
      const extras = parseMeExtras(v);
      let extraStr = '';
      if (extras) {
        if (extras.navDepth) extraStr += `  [nav-chain depth ${extras.navDepth}]`;
        if (extras.terminus) extraStr += `  [ends: ${extras.terminus === 'B' ? 'back-button' : extras.terminus === 'C' ? 'click' : 'hover-end'}]`;
        if (extras.browserHeight) extraStr += `  [viewport-h ${extras.browserHeight}px]`;
      }
      display = (v.length > 44 ? `[${v.length} chars] ${v.slice(0,44)}…` : v)
        + (sub ? `  →  ${sub}` : '') + extraStr;
      // Attach element attention map — rendered separately in popup.js
      const attnMap = parseMeAttentionMap(v);
      if (attnMap) {
        out.push({ key: k, label, value: display, conf: confOf(k), rows, attentionMap: attnMap });
        continue;
      }
    }

    if ((k === 'ved' || k === 'vwd') && typeof v === 'string' && v.length > 38) display = v.slice(0,38) + '…';

    // vt field: decode paq (post-action query tracking) and seer (AIO element reference)
    if (k === 'vt' && typeof v === 'string') {
      const paqMatch = v.match(/^paq:\[.*?\[(\d+),null,null,"([^"]+)",(\d+),(\d+)\]/);
      if (paqMatch) {
        const clickCount = paqMatch[1], aqid = paqMatch[2];
        const attentionTs = parseInt(paqMatch[3]), clickTs = parseInt(paqMatch[4]);
        const dwell = attentionTs - clickTs;
        display = 'post-click tracking — ' + clickCount + ' click on ' + aqid.slice(0,12) + '…'
          + (dwell > 0 ? '  attention ' + dwell + 'ms after click' : '');
      } else if (v.startsWith('seer:')) {
        display = 'AIO element reference token';
      } else if (v.length > 60) {
        display = v.slice(0,60) + '…';
      }
    }

    // Flag auth tokens prominently
    if (k === 'auth') {
      display = '[Google auth token — signed-in session confirmed]';
      label = 'Google Auth Token';
    }

    // Flag folid=undefined (Google JS bug)
    if (k === 'folid' && v === 'undefined') {
      display = 'undefined (JS bug — container not set before event fired)';
    }

    out.push({ key: k, label, value: display, conf: confOf(k), rows });
  }
  return out;
}
