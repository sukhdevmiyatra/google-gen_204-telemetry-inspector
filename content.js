// content.js — isolated content script world
// Injects injector.js into the PAGE world via a <script src="..."> tag (CSP-safe).
// Then listens for __serp_ping__ events, decodes them richly, and persists to chrome.storage.

(function () {
  // ── 1. Inject the page-world interceptor ──────────────────────────────────
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injector.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).prepend(s);

  // ── 2. Value-level decode dictionary ──────────────────────────────────────
  const LABEL_MAP = {
    ct:    {
      slh:'Organic Click (Search Link Hit)', backbutton:'Pogo-Stick / Back-Button Return',
      srpf:'SERP Heartbeat (Foreground)', psnt:'Page Seen / Viewport Enter',
      fa:'Feature Active in Viewport', ejsa:'UI / Chrome Interaction'
    },
    t:     { fi:'First / Feature Interaction', ph:'Page Health / Performance', atr:'Attention Rollup' },
    fid:   { '18':'AI Overview', '268':'AI Mode', '15':'SERP Feature (15)', '13':'Non-AIO Feature (13)', '9':'SERP Feature (9)', '14':'SERP Feature (14)' },
    s:     { aim:'AI Mode Surface' },
    aio:   { '1':'AI Overview Rendered' },
    tt:    { popstate:'Browser Back (popstate)' },
    astyp: { aim_folwr:'AI Mode Follow-up Wrapper', folsrch:'Follow-up Search' },
    // Interaction mode (im / m)
    im:    { M:'Mouse', V:'Keyboard (virtual)', G:'Gesture / Touch' },
    m:     { M:'Mouse', V:'Keyboard (virtual)', G:'Gesture / Touch' },
    // Navigation type
    nt:    { navigate:'Navigation', reload:'Reload / Re-render', popstate:'Back', expansion:'Expansion' },
    // Event trigger
    et:    { pointerdown:'Pointer Down', mousedown:'Mouse Down', click:'Click', scroll:'Scroll', keydown:'Key Down' },
    // Action type
    atyp:  { click:'Click', i:'Interaction', e:'Event' },
  };

  // ── 3. Key-level labels (what each parameter means) ───────────────────────
  const KEY_LABELS = {
    // Identity / session
    ct:'Click / Event Type', t:'Trigger Type', et:'Event Type', atyp:'Action Type',
    ei:'Event Identifier', aqid:'Active Query ID', opi:'Operation ID (pogo anchor)',
    i:'Interaction', csi:'Client-Side Instrumentation',
    // Features & surfaces
    fid:'Feature ID', s:'Surface', aio:'AI Overview Present', uact:'User Action Type',
    // Interaction mode
    im:'Interaction Mode', m:'Mode',
    // Navigation
    tt:'Browser History Event', nt:'Navigation Type', astyp:'Async Event Type',
    folid:'Follow-up Container', aimq:'AI Mode Query ID',
    // Timing
    st:'Session / Element Time', trs:'Time Away from SERP', zx:'Unix Timestamp (ms)',
    // Attention / visibility
    pv:'Page-View / Visibility (attention)', me:'Measurement Event (behavioral payload)',
    // Keyboard accessibility
    tni:'Tab Navigation Index', atni:'Active Tab Nav Index',
    // Visual context
    ved:'Visual Element Data', vet:'Visual Element Token', vwd:'Encoded Element Payload',
    l:'UI Location / Layer',
    // Performance / Core Web Vitals
    inp:'INP — Interaction to Next Paint (ms)', lcp:'LCP — Largest Contentful Paint (ms)',
    fcp:'FCP — First Contentful Paint (ms)', cls:'CLS — Cumulative Layout Shift',
    dcl:'DOMContentLoaded (ms)', aft:'Above-the-Fold Time (ms)',
    // Build / format / plumbing
    v:'Telemetry Format Version', bb:'Build / Beta Variant', bl:'Build Label',
    hl:'Interface Language (hreflang)', fmt:'Data Format', jsbp:'JS Protocol Buffers',
    msc:'Module Service Context', gwsrpc:'Google Web Search RPC',
  };

  // ── 4. CAS model classification (Clicks · Attention · Satisfaction) ───────
  // Tags each event by which pillar of Google's CAS model it most maps to.
  function casDimension(p) {
    // Satisfaction signals — return-to-SERP, long/short dwell, reformulation
    if (p.ct === 'backbutton' || p.tt === 'popstate') return 'S';
    if (p.astyp === 'folsrch') return 'S';               // new query = dissatisfaction signal
    // Attention signals — visibility, hover, scroll, viewport, attention rollups
    if (p.pv || p.t === 'atr' || p.ct === 'psnt' || p.ct === 'fa') return 'A';
    if (p.me && /(^|,)[hSioG]/.test(p.me)) return 'A';   // hover/scroll/in-out/gesture codes
    // Click signals — explicit selection
    if (p.ct === 'slh' || p.atyp === 'click' || p.et === 'pointerdown' || p.fid) return 'C';
    return null;
  }
  const CAS_FULL = { C:'Click', A:'Attention', S:'Satisfaction' };

  // ── 5. Interaction-mode detection (mouse / keyboard / gesture) ────────────
  function interactionMode(p) {
    const code = p.im || p.m;
    if (code === 'M') return 'mouse';
    if (code === 'V' || p.tni || p.atni) return 'keyboard';
    if (code === 'G') return 'gesture';
    if (p.me && /(^|,)G/.test(p.me)) return 'gesture';
    if (p.et === 'pointerdown' || p.et === 'mousedown') return 'mouse';
    return null;
  }

  // ── 6. me payload sub-signal decoding ─────────────────────────────────────
  // The me param packs behavioral codes; surface the ones we recognise.
  function decodeMe(me) {
    if (!me) return null;
    const found = [];
    const CODES = {
      R:'geometry/region', G:'gesture/pointer', S:'scroll', V:'viewport',
      h:'hover/attention', i:'in-view', o:'out-of-view', '74':'tap'
    };
    for (const [code, meaning] of Object.entries(CODES)) {
      const re = new RegExp('(^|[,;:])' + code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
      if (re.test(me)) found.push(code + '=' + meaning);
    }
    return found.length ? found.join(' · ') : null;
  }

  // ── 7. Categorisation (drives icon + colour in the popup) ─────────────────
  function categorize(p) {
    if (p.ct === 'backbutton' || p.tt === 'popstate')   return { cat:'pogo',        label:'Pogo-Stick Return',  color:'#ff6b6b' };
    if (p.ct === 'slh')                                  return { cat:'click',       label:'Organic Click',      color:'#4ecdc4' };
    if (p.aio === '1' || p.fid === '18')                 return { cat:'ai_overview', label:'AI Overview',        color:'#a855f7' };
    if (p.s === 'aim' || p.fid === '268' || String(p.astyp||'').startsWith('aim'))
                                                         return { cat:'ai_mode',     label:'AI Mode',            color:'#6366f1' };
    if (p.m === 'V' || p.im === 'V' || p.tni || p.atni)  return { cat:'keyboard',    label:'Keyboard Navigation',color:'#0ea5e9' };
    if (p.m === 'G' || p.im === 'G' || (p.me && /(^|,)G/.test(p.me)))
                                                         return { cat:'gesture',     label:'Gesture / Touch',    color:'#14b8a6' };
    if (p.pv || p.t === 'atr')                           return { cat:'attention',   label:'Attention Signal',   color:'#eab308' };
    if (p.ct === 'srpf')                                 return { cat:'heartbeat',   label:'SERP Heartbeat',     color:'#334155' };
    if (p.ct === 'psnt' || p.ct === 'fa')                return { cat:'viewport',    label:'Viewport Event',     color:'#06b6d4' };
    if (p.t === 'ph' || p.inp || p.lcp || p.fcp)         return { cat:'perf',        label:'Performance',        color:'#f59e0b' };
    if (p.ct === 'ejsa')                                 return { cat:'ui',          label:'UI Interaction',     color:'#475569' };
    return                                                      { cat:'other',        label:'Telemetry Signal',   color:'#64748b' };
  }

  function fmtMs(v) {
    const n = parseInt(v);
    if (isNaN(n)) return v;
    return n < 1000 ? `${n}ms` : `${(n/1000).toFixed(1)}s (${n}ms)`;
  }

  // ── 8. Build the decoded parameter list ───────────────────────────────────
  function decode(params) {
    const ORDER = ['ct','t','atyp','et','im','m','fid','s','aio','uact','tt','nt','astyp',
                   'pv','st','trs','zx','tni','atni','inp','lcp','fcp','cls','dcl','aft',
                   'me','vet','ved','vwd','aimq','folid','aqid','opi','ei','l','hl','v'];
    const keys = [...ORDER, ...Object.keys(params).filter(k => !ORDER.includes(k))];
    const out = [];
    for (const k of keys) {
      if (!(k in params)) continue;
      const v = params[k];
      let display = (LABEL_MAP[k] && LABEL_MAP[k][v]) ? LABEL_MAP[k][v] : v;
      if (k === 'trs' || k === 'st') display = fmtMs(v);
      if (k === 'me') {
        const sub = decodeMe(v);
        display = (v.length > 44 ? `[${v.length} chars] ${v.slice(0,44)}…` : v) + (sub ? `  →  ${sub}` : '');
      }
      if ((k === 'ved' || k === 'vwd') && v.length > 38) display = v.slice(0,38) + '…';
      out.push({ key: k, label: KEY_LABELS[k] || k, value: display });
    }
    return out;
  }

  const MAX = 500;

  // ── 9. Listen and persist ─────────────────────────────────────────────────
  window.addEventListener('__serp_ping__', (e) => {
    const { url, pathname, params } = e.detail;
    const info = categorize(params);
    const cas = casDimension(params);
    const mode = interactionMode(params);
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: new Date().toISOString(),
      endpoint: pathname,
      url, params,
      cat: info.cat, label: info.label, color: info.color,
      cas, casFull: cas ? CAS_FULL[cas] : null,
      mode,
      decoded: decode(params),
    };
    chrome.storage.local.get(['events'], (r) => {
      const events = r.events || [];
      events.unshift(event);
      if (events.length > MAX) events.length = MAX;
      chrome.storage.local.set({ events });
    });
  });
})();
