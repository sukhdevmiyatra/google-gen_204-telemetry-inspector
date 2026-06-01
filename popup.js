// popup.js — side-panel script (MV3 CSP compliant)

let all = [], aio = [], filter = 'all', expanded = null, tab = 'signals', capturing = false;
let loadInterval = null;

const CAT_STYLE = {
  click:       { icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', fg: 'var(--green)',  bg: 'var(--green-bg)' },
  pogo:        { icon: 'M9 14l-4-4 4-4M5 10h11a4 4 0 0 1 0 8h-1',                                     fg: 'var(--red)',    bg: 'var(--red-bg)' },
  ai_overview: { icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z',           fg: 'var(--purple)', bg: 'var(--purple-bg)' },
  aio_citation_click: { icon: 'M7 7h10v10M7 17 17 7M5 5h6M5 5v6',                                      fg: 'var(--purple)', bg: 'var(--purple-bg)' },
  ai_mode:     { icon: 'M12 2a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 3 3 0 0 0 4-3 3 3 0 0 0 1-5 3 3 0 0 0-2-5 3 3 0 0 0-3-3z', fg: 'var(--indigo)', bg: 'var(--indigo-bg)' },
  keyboard:    { icon: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',                fg: 'var(--blue)',   bg: 'var(--blue-bg)' },
  gesture:     { icon: 'M9 11V6a2 2 0 0 1 4 0v5M13 9a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7 7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 3-1l1 2', fg: 'var(--cyan)', bg: 'var(--cyan-bg)' },
  attention:   { icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', fg: 'var(--amber)',  bg: 'var(--amber-bg)' },
  heartbeat:   { icon: 'M22 12h-4l-3 9L9 3l-3 9H2',                                                    fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  viewport:    { icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', fg: 'var(--cyan)',   bg: 'var(--cyan-bg)' },
  perf:        { icon: 'M13 2L3 14h7v8l10-12h-7z',                                                     fg: 'var(--amber)',  bg: 'var(--amber-bg)' },
  ui:          { icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',                           fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  other:        { icon: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2',  fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  serp_feature: { icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',                               fg: 'var(--blue)',   bg: 'var(--blue-bg)' },
  jsa:          { icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',               fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  jsbp_log:     { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', fg: 'var(--slate)', bg: 'var(--slate-bg)' },
  network:      { icon: 'M8.56 2.9A7 7 0 0 1 19 9v1h2a2 2 0 0 1 0 4h-2.5a4.5 4.5 0 0 1-9 0H3a2 2 0 0 1 0-4h2V9c0-.68.09-1.35.25-1.99', fg: 'var(--slate)', bg: 'var(--slate-bg)' },
};

const CAS_STYLE = {
  C: { fg:'var(--green)',  bg:'var(--green-bg)' },
  A: { fg:'var(--amber)',  bg:'var(--amber-bg)' },
  S: { fg:'var(--purple)', bg:'var(--purple-bg)' },
};
const MODE_ICON = {
  mouse:    'M9 3a3 3 0 0 1 6 0v8a6 6 0 0 1-12 0V8M9 7v4',
  keyboard: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M7 14h10',
  gesture:  'M9 11V6a2 2 0 0 1 4 0v5M13 9a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7 7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 3-1l1 2',
};

function styleFor(cat) { return CAT_STYLE[cat] || CAT_STYLE.other; }

function cleanLabel(label) {
  return String(label).replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]+\s*/u, '').trim();
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function svgIcon(path, color, sz) {
  sz = sz || 16;
  return '<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>';
}
const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

// ── Param filtering — what to suppress in the decoded grid ────────────────
// These add no value when zero/empty: zero-value AIO engagement sub-counts,
// threshold delays, always-same plumbing, and redundant state flags.
const HIDE_WHEN_ZERO = new Set([
  'imeh','imeha','imehb','imea','imeb','imeeb','imexb','imel','imed',
  'tbdba','tbdaa','thdba','thdaa','scp','pcon','ic','lic',
]);
const HIDE_WHEN_EMPTY = new Set(['hp','cad','adh','dt','vwd','vet']);
// Always hide these specific keys regardless of value
const HIDE_KEY_ALWAYS = new Set(['errsrp-init','errsrp','lpl','bb']);
const HIDE_ALWAYS = new Set([
  'dt19','prm23',   // always same value, no per-signal meaning
  'lts','cb','ucb', // cumulative bytes — context-only
  'mem','nv',       // heap stats + experiment ID — AIO tab only
  'imn','ima','imac','imad', // AIO module counts — AIO tab only
  'sv','net',       // module config + network — AIO tab only
  'ddl','wh','nhp', // AIO slot housekeeping
  'stc','dtc','fld','ts', // AIO plumbing
  'bb','query',     // build variant (always 1) + internal session field
  // YouTube embed / cross-origin params (ct=nrr events)
  'embed_config','autoplay','rel','playsinline','fs','awwd','gpa','em',
  'pid','spid','dpi','cn','rot','origin','mnrr','nrrr','exp_id','murl',
]);

function shouldShowDecoded(d) {
  const v = String(d.value || '');
  if (HIDE_ALWAYS.has(d.key)) return false;
  if (HIDE_KEY_ALWAYS.has(d.key)) return false;
  if (HIDE_WHEN_ZERO.has(d.key) && (v === '0' || v === '(empty)' || v === '')) return false;
  if (HIDE_WHEN_EMPTY.has(d.key) && (!v || v === '(empty)' || v === '')) return false;
  if (d.key === 'p' && v === 'bs.false') return false;
  if (d.key === 'ant' && (v === 'push' || v === '')) return false;
  if (d.key === 'vet' && (!v || v === '')) return false; // empty vet token adds no value
  return true;
}

// Priority order for rt timing rows shown by default (top 7, rest collapsed)
const RT_PRIORITY = ['wsrt','ttfb','aft','prt','lcp','fcp','hst','dlt','sct','frts','frvt','dcl','afts','afti','aftr'];
// Priority order for jsi rows (top 6)
const JSI_PRIORITY = ['fht','bf','et','af','st','n','tni','atni','sned','snei','cn'];

function renderTimingRows(rows, key) {
  const priority = key === 'jsi' ? JSI_PRIORITY : RT_PRIORITY;
  const sorted = rows.slice().sort(function(a, b) {
    const ai = priority.indexOf(a.k), bi = priority.indexOf(b.k);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  const limit = key === 'jsi' ? 6 : 7;
  const visible = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  let html = '<div class="tgrid">' + visible.map(function(r) {
    return '<div class="trow"><code>'+esc(r.k)+'</code><span>'+esc(r.v)+'</span></div>';
  }).join('');
  if (rest.length) {
    html += '<div class="trow trow-more" data-rest="'+esc(JSON.stringify(rest))+'">' +
              '<code class="tmore-toggle">+'+rest.length+' more</code><span></span>' +
            '</div>';
  }
  html += '</div>';
  return html;
}

// ── Signals list ──────────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('list');
  const emp = document.getElementById('emp');
  const items = filter === 'all' ? all : all.filter(function(e) {
    return e.cat === filter || filter === 'cas_' + (e.cas || '').toLowerCase();
  });

  // Preserve scroll positions before removing DOM nodes.
  // Removing all .ei makes the list momentarily empty, which clamps scrollTop to 0.
  const savedListScroll = list.scrollTop;
  let savedRawScroll = 0;
  const openCard = list.querySelector('.ei.open');
  if (openCard) {
    const rawDiv = openCard.querySelector('.raw');
    if (rawDiv) savedRawScroll = rawDiv.scrollLeft;
  }

  list.querySelectorAll('.ei').forEach(el => el.remove());

  if (items.length === 0) { emp.style.display = 'flex'; return; }
  emp.style.display = 'none';

  items.forEach(ev => {
    const st = styleFor(ev.cat);
    const el = document.createElement('div');
    el.className = 'ei' + (expanded === ev.id ? ' open' : '');
    el.style.setProperty('--accent-c', st.fg);

    // Auth token — extract first, render as special banner
    const decodedRows = typeof decode === 'function' ? decode(ev.params || {}) : (ev.decoded || []);
    const authEntry = decodedRows.find(function(d) { return d.key === 'auth'; });

    let attnMapHtml = '';
    const decoded = decodedRows.filter(shouldShowDecoded).map(function(d) {
      if (d.key === 'auth') return ''; // rendered as banner below
      // Collect attention map HTML — rendered below all decoded rows
      if (d.attentionMap) attnMapHtml = renderAttentionMap(d.attentionMap);
      const conf = d.conf || 'decoded';
      const dot = '<span class="cdot c-'+conf+'" title="'+conf+'"></span>';
      let body;
      if (d.rows && d.rows.length) {
        body = renderTimingRows(d.rows, d.key);
      } else {
        body = '<div class="dval">'+esc(cleanLabel(d.value))+'</div>';
      }
      return '<div class="drow'+(d.rows && d.rows.length ? ' wide' : '')+'">' +
               '<div class="dkey">'+dot+'<code>'+esc(d.key)+'</code> '+esc(d.label)+'</div>'+body +
             '</div>';
    }).join('');

    const rawHtml = Object.entries(ev.params || {}).map(function(pair) {
      const k = pair[0], v = pair[1];
      const sv = v.length > 40 ? v.substring(0,40)+'…' : v;
      return '<code>'+esc(k)+'</code>='+esc(sv);
    }).join('&nbsp;&nbsp;');

    let badges = '';
    if (ev.cas) {
      const cs = CAS_STYLE[ev.cas] || CAS_STYLE.C;
      badges += '<span class="badge" style="color:'+cs.fg+';background:'+cs.bg+'">'+ev.cas+' - '+esc(ev.casFull||'')+'</span>';
    }
    if (ev.mode && MODE_ICON[ev.mode]) {
      badges += '<span class="badge mode">'+svgIcon(MODE_ICON[ev.mode],'var(--text-2)',11)+esc(ev.mode)+'</span>';
    }
    if (ev.navDepth && ev.navDepth > 1) {
      badges += '<span class="badge nav-chain" title="Google tracked '+ev.navDepth+' prior sessions in this click payload">N'+ev.navDepth+'</span>';
    }
    if (ev.terminus) {
      const termLabel = {'B':'back','C':'click','H':'hover-end'}[ev.terminus] || ev.terminus;
      badges += '<span class="badge term-'+ev.terminus+'" title="Session ended by: '+termLabel+'">'+termLabel+'</span>';
    }
    if (ev.clickKind) {
      const kindLabel = {
        organic_result:'organic',
        aio_citation:'AIO citation',
        aio_control:'AIO control',
        serp_ui:'SERP UI',
        internal_ui:'internal UI'
      }[ev.clickKind] || ev.clickKind;
      badges += '<span class="badge" title="'+esc(ev.clickText || ev.clickHref || kindLabel)+'">'+esc(kindLabel)+'</span>';
    }
    if (ev.transport && ev.transport !== 'unknown') {
      badges += '<span class="badge transport" title="Transport method">'+esc(ev.transport)+'</span>';
    }

    el.innerHTML =
      '<div class="eh">' +
        '<div class="eicon" style="background:'+st.bg+'">'+svgIcon(st.icon, st.fg)+'</div>' +
        '<div class="einfo">' +
          '<div class="elabel">'+esc(cleanLabel(ev.label))+'</div>' +
          '<div class="emeta">' +
            '<span class="eep">'+esc((ev.endpoint||'').replace('/',''))+'</span>' +
            '<span class="etime">'+fmt(ev.ts)+'</span>' +
            badges +
          '</div>' +
        '</div>' +
        '<span class="echev">'+CHEVRON+'</span>' +
      '</div>' +
      '<div class="edetail">' +
        (authEntry ? '<div class="auth-warn">Google auth token present — signals tied to a signed-in account</div>' : '') +
        (decoded ? '<div class="dsec">Decoded signals'+CONF_LEGEND+'</div><div class="dgrid">'+decoded+'</div>' : '') +
        attnMapHtml +
        '<div class="dsec">Raw parameters</div>' +
        '<div class="raw">'+(rawHtml || '<span style="color:var(--text-3)">none</span>')+'</div>' +
      '</div>';

    el.addEventListener('click', function(e) {
      // Timing "+N more" toggle — inside .edetail, handle explicitly before the guard
      const moreBtn = e.target.closest('.tmore-toggle');
      if (moreBtn) {
        e.stopPropagation();
        const row = moreBtn.closest('.trow-more');
        const rest = JSON.parse(row.dataset.rest || '[]');
        const grid = row.closest('.tgrid');
        row.remove();
        rest.forEach(function(r) {
          const d = document.createElement('div');
          d.className = 'trow';
          d.innerHTML = '<code>'+esc(r.k)+'</code><span>'+esc(r.v)+'</span>';
          grid.appendChild(d);
        });
        return;
      }

      // Only toggle when clicking the header (.eh), never the detail content.
      // Clicks inside .edetail are for text selection and link interaction — don't close.
      if (!e.target.closest('.eh')) return;

      // Don't close while the user has text selected (mid-copy drag).
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.toString().length > 0) return;

      // Toggle expand in-place
      const isOpen = el.classList.contains('open');
      if (isOpen) {
        el.classList.remove('open');
        expanded = null;
      } else {
        const prev = document.querySelector('.ei.open');
        if (prev) prev.classList.remove('open');
        el.classList.add('open');
        expanded = ev.id;
      }
    });

    list.appendChild(el);
  });

  // Restore scroll positions after DOM rebuild.
  list.scrollTop = savedListScroll;
  if (expanded && savedRawScroll > 0) {
    const newOpen = list.querySelector('.ei.open');
    if (newOpen) {
      const rawDiv = newOpen.querySelector('.raw');
      if (rawDiv) rawDiv.scrollLeft = savedRawScroll;
    }
  }
}

const CONF_LEGEND =
  '<span class="legend">' +
    '<span class="cdot c-decoded"></span>decoded' +
    '<span class="cdot c-inferred"></span>inferred' +
    '<span class="cdot c-observed"></span>observed' +
  '</span>';

// ── Element Attention Map ─────────────────────────────────────────────────
// Renders the per-element hover/gesture table derived from the me= stream.
// Score = hoverDwellMs + (gestures * 250) — mirrors Vijay's formula.
function renderAttentionMap(items) {
  if (!items || !items.length) return '';
  const winner = items[0];
  let rows = items.slice(0, 15).map(function(el, i) {
    const isWin = i === 0;
    const rect = el.rect ? el.rect.w + 'x' + el.rect.h + ' @(' + el.rect.x + ',' + el.rect.y + ')' : '—';
    const dwell = el.hoverDwellMs > 0 ? (el.hoverDwellMs >= 1000 ? (el.hoverDwellMs/1000).toFixed(1)+'s' : el.hoverDwellMs+'ms') : '—';
    const score = el.score > 0 ? el.score + 'ms' : '—';
    return '<tr class="attn-row'+(isWin?' attn-win':'') +'">' +
      '<td class="attn-n">'+(i+1)+'</td>' +
      '<td class="attn-ved"><code>'+esc(el.ved)+'</code></td>' +
      '<td class="attn-rect">'+esc(rect)+'</td>' +
      '<td class="attn-hover">'+el.hoverInCount+'</td>' +
      '<td class="attn-dwell'+(el.hoverDwellMs > 2000?' attn-hot':'')+'">'+esc(dwell)+'</td>' +
      '<td class="attn-gest">'+(el.gestures > 0 ? el.gestures : '—')+'</td>' +
      '<td class="attn-score'+(isWin?' attn-win-score':'')+'">'+esc(score)+'</td>' +
    '</tr>';
  }).join('');
  const more = items.length > 15 ? '<tr><td colspan="7" class="attn-more">+' + (items.length-15) + ' more elements</td></tr>' : '';
  return '<div class="attn-map">' +
    '<div class="attn-title">Element Attention Map <span class="attn-sub">' +
      items.length + ' interacted elements — ranked by hover dwell + gestures' +
    '</span></div>' +
    '<table class="attn-table">' +
      '<thead><tr>' +
        '<th>#</th><th>Element VED</th><th>Rect</th>' +
        '<th>Hovers</th><th>Dwell</th><th>Gestures</th><th>Score</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + more + '</tbody>' +
    '</table>' +
  '</div>';
}

// ── AI Overviews list ─────────────────────────────────────────────────────
// ── AIO module config decoder ──────────────────────────────────────────────
const SV_LABELS = {
  mul:'multiline', mfc:'features', aimc:'AI model config v',
  aimfl:'follow-up links', mfl:'multi-links', dfa:'data freshness (days)',
};
function decodeSv(svConfig) {
  if (!svConfig || !Object.keys(svConfig).length) return '';
  return Object.entries(svConfig).map(function(pair) {
    const k = pair[0], v = pair[1];
    return (SV_LABELS[k] || k) + ':' + v;
  }).join(' / ');
}
function fmtNet(net) {
  if (!net || !Object.keys(net).length) return '';
  const parts = [];
  if (net.ect) parts.push(String(net.ect).toUpperCase());
  if (net.rtt != null) parts.push(net.rtt + 'ms RTT');
  if (net.dl != null) parts.push((net.dl / 1000).toFixed(1) + ' Mbps');
  return parts.join(' / ');
}
function fmtTiming(t, key) {
  if (t == null) return '—';
  return t + 'ms';
}

function renderAio() {
  const list = document.getElementById('aiolist');
  const emp = document.getElementById('aioemp');
  list.querySelectorAll('.aie').forEach(el => el.remove());

  if (aio.length === 0) { emp.style.display = 'flex'; return; }
  emp.style.display = 'none';

  aio.forEach(function(ev) {
    const el = document.createElement('div');
    el.className = 'aie';
    const m = ev.aioMeta;
    const fo = ev.fanoutEvents;
    const t = m && m.timing || {};

    const via = (ev.via || []).map(function(v) {
      return '<span class="via via-'+esc(v)+'">'+esc(v)+'</span>';
    }).join('');

    // ── Performance strip ──
    let perfHtml = '';
    if (m && m.timing && Object.keys(m.timing).length) {
      const perfItems = [];
      if (t.wsrt != null) perfItems.push('<div class="aio-stat"><div class="aio-stat-v">'+t.wsrt+'ms</div><div class="aio-stat-l">index response</div></div>');
      if (t.aft  != null) perfItems.push('<div class="aio-stat"><div class="aio-stat-v">'+t.aft+'ms</div><div class="aio-stat-l">AIO visible</div></div>');
      if (t.prt  != null) perfItems.push('<div class="aio-stat"><div class="aio-stat-v">'+t.prt+'ms</div><div class="aio-stat-l">page render</div></div>');
      if (t.lcp  != null) perfItems.push('<div class="aio-stat"><div class="aio-stat-v">'+t.lcp+'ms</div><div class="aio-stat-l">LCP</div></div>');
      if (t.fcp  != null) perfItems.push('<div class="aio-stat"><div class="aio-stat-v">'+t.fcp+'ms</div><div class="aio-stat-l">FCP</div></div>');
      if (perfItems.length) {
        perfHtml = '<div class="aio-section">' +
          '<div class="aio-section-title">Render performance</div>' +
          '<div class="aio-perf">'+perfItems.join('')+'</div>' +
        '</div>';
      }
    }

    // ── Structure strip ──
    let structHtml = '';
    if (m) {
      const structItems = [];
      if (m.moduleCount != null) structItems.push('<span class="aio-pill">'+m.moduleCount+' modules</span>');
      if (m.activeModules != null) structItems.push('<span class="aio-pill">'+m.activeModules+' active</span>');
      if (m.cacheStatus)  structItems.push('<span class="aio-pill '+(m.cacheStatus==='cache'?'pill-cache':'pill-fresh')+'">'+m.cacheStatus+'</span>');
      if (m.navMechanism) structItems.push('<span class="aio-pill">'+m.navMechanism+'</span>');
      if (m.fillTime != null && m.fillTime > 400) structItems.push('<span class="aio-pill pill-warn">fill '+m.fillTime+'ms</span>');
      if (m.hasAiMode)   structItems.push('<span class="aio-pill pill-ai">AI Mode grounding</span>');
      if (m.network && Object.keys(m.network).length) structItems.push('<span class="aio-pill">'+fmtNet(m.network)+'</span>');
      // Data freshness age from sv config (dfa = data freshness in days)
      if (m.svConfig && m.svConfig.dfa != null) {
        const dfaDays = parseInt(m.svConfig.dfa);
        if (!isNaN(dfaDays)) {
          const dfaLabel = dfaDays === 0 ? 'sources: today' : 'sources: ~' + dfaDays + 'd old';
          const dfaCls = dfaDays > 14 ? 'pill-warn' : dfaDays > 7 ? 'pill-age' : '';
          structItems.push('<span class="aio-pill '+dfaCls+'" title="Data freshness age from sv config">'+esc(dfaLabel)+'</span>');
        }
      }
      const svStr = decodeSv(m.svConfig);
      if (svStr) structItems.push('<span class="aio-pill pill-sv" title="'+esc(svStr)+'">'+esc(svStr.slice(0,40))+'</span>');
      if (structItems.length) {
        structHtml = '<div class="aio-section">' +
          '<div class="aio-section-title">Structure</div>' +
          '<div class="aio-pills">'+structItems.join('')+'</div>' +
        '</div>';
      }
    }

    // ── Fan-out sub-queries ──
    let fanoutHtml = '';
    if (fo && fo.length) {
      const rows = fo.map(function(f, i) {
        const parts = [];
        if (f.ttfb != null) parts.push('TTFB <b>'+f.ttfb+'ms</b>');
        if (f.artMs != null) parts.push('render <b>'+f.artMs+'ms</b>');
        if (f.moduleCount != null) parts.push('modules <b>'+f.moduleCount+'</b>');
        if (f.foldId && f.foldId !== 'undefined') parts.push('folid <code>'+esc(f.foldId)+'</code>');
        return '<div class="fanout-row"><span class="fanout-n">'+(i+1)+'</span>'+parts.join(' / ')+'</div>';
      }).join('');
      fanoutHtml = '<div class="aio-section">' +
        '<div class="aio-section-title">Fan-out sub-queries ('+fo.length+')</div>' +
        '<div class="fanout-list">'+rows+'</div>' +
      '</div>';
    }

    // ── Sources ──
    const srcs = (ev.sources || []).map(function(s) {
      return '<a class="src" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(s.url)+'">' +
        '<img class="fav" src="https://www.google.com/s2/favicons?domain='+encodeURIComponent(s.domain)+'&sz=32" width="16" height="16" alt="">' +
        '<span class="src-d">'+esc(s.domain)+'</span>' +
      '</a>';
    }).join('');

    el.innerHTML =
      '<div class="aih">' +
        '<div class="aiq">'+esc(ev.query || '(query unknown)')+'</div>' +
        '<div class="aimeta">' +
          '<span class="aicount">'+(ev.sources||[]).length+' source'+((ev.sources||[]).length===1?'':'s')+'</span>' +
          (fo && fo.length ? '<span class="aicount fanout-count">'+fo.length+' fan-out</span>' : '') +
          via +
          '<span class="etime">'+fmt(ev.ts)+'</span>' +
        '</div>' +
      '</div>' +
      perfHtml +
      structHtml +
      fanoutHtml +
      '<div class="aisrc">'+(srcs || '<span class="muted">No external citations captured</span>')+'</div>';

    list.appendChild(el);
  });
}

// ── Sessions engine ────────────────────────────────────────────────────────

function getQueryFromEvents(events) {
  // Primary: each event now stores query directly from location.href
  for (var i = 0; i < events.length; i++) {
    if (events[i].query) return events[i].query;
  }
  // Fallback for older stored events: murl param in ct=nrr events
  for (var i = 0; i < events.length; i++) {
    var murl = (events[i].params || {}).murl;
    if (murl) { try { var q = new URL(murl).searchParams.get('q'); if (q) return q; } catch (e) {} }
  }
  return null;
}

function fmtDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m + 'm ' + (s > 0 ? s + 's' : '');
}

// Per Google's leaked documentation: NavBoost re-ranks using bad clicks,
// good clicks, and "last longest clicks" from click logs. This function
// generates insights mapped directly to those documented signals.
function generateInsight(sess) {
  const parts = [];
  const { clicks, pogos, satisfiedClick, aioEvent, aioCached, avgPv, maxNavDepth,
          durationMs, lastLongestClick, sameResultRepeat } = sess;

  // ── NavBoost: bad click / good click framing ──────────────────────────
  if (pogos.length === 0 && clicks.length === 1 && satisfiedClick) {
    parts.push('NavBoost: positive — first-click satisfaction, no pogo. Strong good-click signal for this query.');
  } else if (pogos.length >= 3) {
    parts.push('NavBoost: ' + pogos.length + ' bad clicks (pogo) logged — repeated dissatisfaction signals for this query.');
  } else if (pogos.length > 0) {
    parts.push('NavBoost: ' + pogos.length + ' bad click' + (pogos.length > 1 ? 's' : '') + ' (pogo-stick) + ' + (satisfiedClick ? '1 good click' : 'no good click') + ' recorded.');
  }

  // ── Last longest click (named signal in leaked NavBoost docs) ─────────
  if (lastLongestClick) {
    const pvPct = Math.round(parseFloat((lastLongestClick.click.params || {}).pv || 0) * 100);
    const dwellS = (lastLongestClick.dwellMs / 1000).toFixed(1);
    parts.push('Last longest click: ' + dwellS + 's dwell — ' + pvPct + '% visibility. This is the strongest NavBoost good-click signal in this session.');
  }

  // ── Impression quality (pv = visibility ratio) ────────────────────────
  if (avgPv !== null && avgPv < 0.1 && clicks.length > 0) {
    parts.push('Impression quality: critical — avg ' + Math.round(avgPv * 100) + '% visibility. Results barely in viewport = low-quality impressions despite clicks.');
  } else if (avgPv !== null && avgPv > 0.7 && clicks.length > 0) {
    parts.push('Impression quality: strong — avg ' + Math.round(avgPv * 100) + '% visibility. High above-fold placement confirmed.');
  }

  // ── CTR pattern / trendSpam indicator ────────────────────────────────
  if (sameResultRepeat >= 3) {
    parts.push('CTR pattern flag: same result clicked ' + sameResultRepeat + 'x with same visibility ratio — matches trendSpam detection pattern in Google docs.');
  }

  // ── AIO impact on organic clicks ──────────────────────────────────────
  if (aioEvent) {
    const rt = (aioEvent.params || {}).rt || '';
    const aftMs = rt.match(/\baft\.(\d+)/);
    const aftStr = aftMs ? aftMs[1] + 'ms' : null;
    // aioCached = AIO content served from cache (dt=cache) or page reached via
    // back/forward restore (ant=traverse). Either way Google did not recompute.
    const cacheTag = aioCached ? ' (cached)' : ' (fresh)';
    if (pogos.length > 0) {
      parts.push('AIO present' + (aftStr ? ' (' + aftStr + cacheTag + ')' : cacheTag) + ' but generated bad clicks on organic results — intent not fully satisfied by AI answer.');
    } else if (satisfiedClick && clicks.length === 1) {
      parts.push('AIO present' + cacheTag + ' but user clicked organic — AIO did not fully address intent.');
    } else {
      parts.push('AIO rendered' + (aftStr ? ' in ' + aftStr : '') + cacheTag + '.');
    }
  }

  // ── Search journey depth ──────────────────────────────────────────────
  if (maxNavDepth >= 4) {
    parts.push('Nav chain depth ' + maxNavDepth + ': Google logged ' + maxNavDepth + ' prior sessions in this click — high-intent refinement journey.');
  }

  // ── Long session without satisfaction ────────────────────────────────
  if (!satisfiedClick && durationMs > 90000 && clicks.length > 0) {
    parts.push('No satisfaction after ' + fmtDuration(durationMs) + ' — strong intent gap signal for this query.');
  }

  // ── Browsing without commitment ───────────────────────────────────────
  const browsing = clicks.filter(function(c) { return c.terminus === 'H'; });
  if (browsing.length > 0 && pogos.length === 0 && !satisfiedClick) {
    parts.push('Browsing pattern — hover attention without committed clicks. Possible good abandonment or result scanning.');
  }

  return parts.length ? parts : null;
}

function clickMeExtras(ev) {
  const me = String(((ev.params || {}).me) || '');
  const extras = {};
  if (!me) return extras;
  const base = me.match(/(?:^|:)(\d{13})(?:,|$)/);
  if (base) extras.baseTs = parseInt(base[1]);
  const gestureTokens = Array.from(me.matchAll(/[:,]G,\d+,([A-Za-z0-9_-]{4,})/g));
  const hoverTokens = Array.from(me.matchAll(/[:,]h,\d+,([A-Za-z0-9_-]{4,}),(?:i|o)\b/g));
  const regionTokens = Array.from(me.matchAll(/[:,]R,\d+,([A-Za-z0-9_-]{4,}),/g));
  const tokenMatch = gestureTokens[gestureTokens.length - 1] ||
                     hoverTokens[hoverTokens.length - 1] ||
                     regionTokens[regionTokens.length - 1];
  if (tokenMatch) extras.targetToken = tokenMatch[1];
  return extras;
}

function clickKey(ev) {
  if (ev.clickKey) return ev.clickKey;
  const p = ev.params || {};
  const extras = clickMeExtras(ev);
  const pv = p.pv ? Number(parseFloat(p.pv).toFixed(3)) : '';
  const target = ev.clickTarget || extras.targetToken || '';
  const base = ev.meBaseTs || extras.baseTs || '';
  return [target, pv, base].filter(function(v) { return v !== ''; }).join('|') || null;
}

function pvBucket(ev) {
  const pv = parseFloat(((ev.params || {}).pv) || 0);
  return isNaN(pv) ? '' : pv.toFixed(3);
}

function mergeClickState(target, source) {
  if (!target.terminus && source.terminus) target.terminus = source.terminus;
  if (target.dwellMs == null && source.dwellMs != null) target.dwellMs = source.dwellMs;
  if (!target.clickTarget && source.clickTarget) target.clickTarget = source.clickTarget;
  if (!target.clickKey && source.clickKey) target.clickKey = source.clickKey;
  if (source.terminus === 'C') {
    target.label = 'Click — Satisfied';
  } else if (source.terminus === 'B') {
    target.label = 'Click — Pogo (returned to SERP)';
  } else if (source.terminus === 'H' && !/Satisfied/.test(target.label || '')) {
    target.label = 'Click — Browsed (hover-end)';
  }
}

function normalizeClicks(rawClicks) {
  const clicks = [];
  rawClicks.forEach(function(raw) {
    const c = Object.assign({}, raw);
    const ts = new Date(c.ts).getTime();
    const key = clickKey(c);
    const bucket = pvBucket(c);
    const extras = clickMeExtras(c);
    const outcomeOnly = !!c.terminus && !c.clickTarget && !extras.targetToken && c.dwellMs != null;

    if (outcomeOnly) {
      for (var i = clicks.length - 1; i >= 0; i--) {
        const prev = clicks[i];
        const age = ts - new Date(prev.ts).getTime();
        if (age < 0 || age > Math.max(120000, (c.dwellMs || 0) + 5000)) continue;
        if (pvBucket(prev) === bucket && prev.terminus !== 'C') {
          mergeClickState(prev, c);
          return;
        }
      }
    }

    const prev = clicks[clicks.length - 1];
    if (prev) {
      const age = ts - new Date(prev.ts).getTime();
      const sameKey = key && clickKey(prev) === key;
      const sameNearPv = bucket && pvBucket(prev) === bucket && age >= 0 && age < 1500;
      if (sameKey || sameNearPv) {
        mergeClickState(prev, c);
        return;
      }
    }

    c.clickKey = key;
    if (!c.clickTarget && extras.targetToken) c.clickTarget = extras.targetToken;
    if (!c.meBaseTs && extras.baseTs) c.meBaseTs = extras.baseTs;
    clicks.push(c);
  });
  return clicks;
}

function clickDwellMs(click, events) {
  var dwell = click.dwellMs;
  if (dwell == null && click.params && click.params.me && typeof parseMeDwell === 'function') {
    dwell = parseMeDwell(click.params.me);
  }
  if (dwell == null) {
    var clickTs = new Date(click.ts).getTime();
    var nextEvt = events.find(function(e) { return new Date(e.ts).getTime() > clickTs; });
    if (nextEvt) dwell = new Date(nextEvt.ts).getTime() - clickTs;
  }
  return dwell;
}

function isSatisfiedClick(click, events) {
  if (click.terminus === 'C') return true;
  if (click.terminus === 'B') return false;
  if (click.terminus === 'H') return false;
  const dwell = clickDwellMs(click, events);
  return dwell != null && dwell >= 30000;
}

function buildSessionFromEvents(query, events) {
  events.sort(function(a, b) { return new Date(a.ts) - new Date(b.ts); });

  const rawClicks = events.filter(function(e) {
    return e.cat === 'click' &&
      (e.params || {}).ct === 'slh' &&
      (!e.clickKind || e.clickKind === 'organic_result');
  });
  const clicks = normalizeClicks(rawClicks);
  const explicitPogos = events.filter(function(e) { return e.cat === 'pogo'; });
  const pogos = clicks.filter(function(c) { return c.terminus === 'B'; }).concat(explicitPogos);
  const satisfiedClick = clicks.find(function(c) {
    return isSatisfiedClick(c, events);
  }) || null;
  const aioEvents = events.filter(function(e) { return e.cat === 'ai_overview'; });
  const aioEvent = aioEvents[0] || null;
  // Real cache signal: dt='cache' (content served from cache) or ant='traverse'
  // (page reached via back/forward = bfcache restore). Scan ALL aio events since
  // the cache flag lives on the t=all event, not always the first one found.
  var aioCached = aioEvents.some(function(e) {
    var p = e.params || {};
    return p.dt === 'cache' || p.ant === 'traverse';
  });
  const startTs = new Date(events[0].ts);
  const endTs = new Date(events[events.length - 1].ts);
  const durationMs = endTs - startTs;
  const maxNavDepth = clicks.reduce(function(m, c) { return Math.max(m, c.navDepth || 0); }, 0);
  const pvValues = clicks.map(function(c) { return parseFloat((c.params || {}).pv || 0); }).filter(function(v) { return v > 0; });
  const avgPv = pvValues.length ? pvValues.reduce(function(s, v) { return s + v; }, 0) / pvValues.length : null;

  // "Last longest click" — named NavBoost signal
  var lastLongestClick = null, maxDwell = 0;
  clicks.forEach(function(c) {
    if (c.terminus === 'B') return;
    var dwell = clickDwellMs(c, events);
    if (dwell != null && dwell > maxDwell) {
      maxDwell = dwell;
      lastLongestClick = { click: c, dwellMs: dwell };
    }
  });

  // trendSpam: repeated same target/visibility pattern
  var pvCounts = {};
  clicks.forEach(function(c) {
    var repeatKey = c.clickTarget || pvBucket(c);
    if (repeatKey) pvCounts[repeatKey] = (pvCounts[repeatKey] || 0) + 1;
  });
  var pvCountVals = Object.values(pvCounts);
  var sameResultRepeat = pvCountVals.length ? pvCountVals.reduce(function(m, v) { return Math.max(m, v); }, 0) : 0;

  // Aggregate element attention across ALL me= streams in this session.
  // A single click event only covers one hover session; multiple events together
  // reconstruct the full picture of which SERP elements held attention.
  const attnAgg = {};
  events.forEach(function(ev) {
    const me = (ev.params || {}).me;
    if (!me) return;
    const map = typeof parseMeAttentionMap === 'function' ? parseMeAttentionMap(me) : null;
    if (!map) return;
    map.forEach(function(el) {
      if (!attnAgg[el.ved]) attnAgg[el.ved] = { ved: el.ved, hoverInCount: 0, hoverDwellMs: 0, gestures: 0, rect: null };
      attnAgg[el.ved].hoverInCount += el.hoverInCount;
      attnAgg[el.ved].hoverDwellMs += el.hoverDwellMs;
      attnAgg[el.ved].gestures     += el.gestures;
      if (el.rect) attnAgg[el.ved].rect = el.rect; // keep most-recent rect
    });
  });
  const attentionRollup = Object.values(attnAgg)
    .filter(function(el) { return el.hoverInCount > 0 || el.gestures > 0; })
    .sort(function(a, b) {
      return (b.hoverDwellMs + b.gestures * 250) - (a.hoverDwellMs + a.gestures * 250);
    });

  return { query, events, clicks, pogos, satisfiedClick, aioEvent, aioCached,
           startTs, durationMs, maxNavDepth, avgPv, lastLongestClick, sameResultRepeat,
           attentionRollup: attentionRollup.length ? attentionRollup : null };
}

function computeSessions(signals) {
  // Group by aqid/sessionKey when available. Identical query text can be
  // separate searches; aqid is Google's per-search identity.
  const byKey = {};
  signals.forEach(function(s) {
    const q = s.query;
    if (!q || q.trim().length < 2) return;  // skip null, empty, or homepage events
    const key = s.sessionKey || s.aqid || (s.params && s.params.aqid) || ('query:' + q);
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(s);
  });

  // Legacy/no-aqid query groups still split by long gaps.
  const SESSION_GAP_MS = 5 * 60 * 1000; // 5 minutes of inactivity = new session
  const groups = [];
  Object.entries(byKey).forEach(function(entry) {
    var evs = entry[1].slice().sort(function(a, b) { return new Date(a.ts) - new Date(b.ts); });
    var q = getQueryFromEvents(evs) || '';
    var isLegacyQueryKey = entry[0].indexOf('query:') === 0;
    if (!isLegacyQueryKey) {
      groups.push({ q: q, events: evs });
      return;
    }
    var current = [evs[0]];
    for (var i = 1; i < evs.length; i++) {
      var gap = new Date(evs[i].ts) - new Date(evs[i - 1].ts);
      if (gap > SESSION_GAP_MS) { groups.push({ q: q, events: current }); current = []; }
      current.push(evs[i]);
    }
    if (current.length) groups.push({ q: q, events: current });
  });

  return groups
    .map(function(g) {
      var sess = buildSessionFromEvents(g.q, g.events);
      sess.insights = generateInsight(sess);
      return sess;
    })
    // Sessions require at least one organic click. An AIO rendering alone is
    // a page load event, not a user session — AIO data enriches sessions that
    // already have clicks but does not create sessions on its own.
    .filter(function(s) {
      if (s.clicks.length === 0) return false;
      // Also filter out sessions that are just one ambiguous click with nothing else
      const hasPogo = s.pogos.length > 0;
      const hasSatisfied = !!s.satisfiedClick;
      const hasMultipleClicks = s.clicks.length >= 2;
      const hasDepth = s.maxNavDepth >= 2;
      const hasAio = !!s.aioEvent;
      return hasPogo || hasSatisfied || hasMultipleClicks || hasDepth || hasAio;
    })
    .sort(function(a, b) { return b.startTs - a.startTs; });
}

// ── Session rendering ──────────────────────────────────────────────────────

const TERM_DOT = { B: 'dot-pogo', C: 'dot-good', H: 'dot-browse', null: 'dot-unknown' };
const TERM_TITLE = { B: 'Pogo (back)', C: 'Satisfied', H: 'Browsing', null: 'Click' };

function renderSessions() {
  const list = document.getElementById('sesslist');
  const emp = document.getElementById('sessemp');
  const countEl = document.getElementById('sessCount');
  list.querySelectorAll('.sess-card').forEach(function(el) { el.remove(); });

  const sessions = computeSessions(all);
  if (countEl) countEl.textContent = sessions.length;

  if (sessions.length === 0) { emp.style.display = 'flex'; return; }
  emp.style.display = 'none';

  sessions.forEach(function(sess) {
    const el = document.createElement('div');
    el.className = 'sess-card';

    // Header: query + meta badges
    const hasPogos = sess.pogos.length > 0;
    const metaBadges = [];
    if (sess.pogos.length)      metaBadges.push('<span class="sess-badge badge-pogo">'+sess.pogos.length+' pogo</span>');
    if (sess.satisfiedClick)    metaBadges.push('<span class="sess-badge badge-good">satisfied</span>');
    if (sess.aioEvent)          metaBadges.push('<span class="sess-badge badge-aio">AIO</span>');
    if (sess.maxNavDepth >= 3)  metaBadges.push('<span class="sess-badge badge-depth">depth '+sess.maxNavDepth+'</span>');
    if (sess.avgPv !== null && sess.avgPv < 0.1) metaBadges.push('<span class="sess-badge badge-warn">low visibility</span>');

    // Timeline: position each click + AIO event by relative time within session
    const totalMs = Math.max(sess.durationMs, 1000); // minimum 1s scale
    const llcId = sess.lastLongestClick && sess.lastLongestClick.click.id;
    let tldots = sess.clicks.map(function(c) {
      const pct = Math.min(98, Math.round(((new Date(c.ts) - sess.startTs) / totalMs) * 100));
      const cls = TERM_DOT[c.terminus] || 'dot-unknown';
      const pvPct = Math.round(parseFloat((c.params||{}).pv||0) * 100);
      const isLLC = c.id === llcId;
      const dwellStr = isLLC && sess.lastLongestClick ? ' — dwell ' + (sess.lastLongestClick.dwellMs/1000).toFixed(1) + 's' : '';
      const title = (isLLC ? 'LAST LONGEST CLICK — ' : '') + (TERM_TITLE[c.terminus]||'Click') + ' — pv ' + pvPct + '%' + dwellStr;
      return '<span class="tl-dot '+cls+(isLLC?' dot-llc':'') +'" style="left:'+pct+'%" title="'+esc(title)+'"></span>';
    }).join('');
    // Add AIO marker when present — even for AIO-only sessions (good abandonment)
    if (sess.aioEvent) {
      const aioPct = Math.min(98, Math.round(((new Date(sess.aioEvent.ts) - sess.startTs) / totalMs) * 100));
      const rt = (sess.aioEvent.params || {}).rt || '';
      const aftMs = rt.match(/\baft\.(\d+)/);
      const title = 'AI Overview rendered' + (aftMs ? ' — visible in ' + aftMs[1] + 'ms' : '');
      tldots += '<span class="tl-dot dot-aio" style="left:'+aioPct+'%" title="'+esc(title)+'"></span>';
    }
    // Per-click dwell chain (Vijay-style: Click · dwell=1.8s → Click · dwell=0.4s →)
    const chainHtml = sess.clicks.map(function(c, i) {
      const dwell = clickDwellMs(c, sess.events);
      const cls = c.terminus === 'C' ? 'cc-good' : c.terminus === 'B' ? 'cc-pogo' : c.terminus === 'H' ? 'cc-browse' : 'cc-other';
      const isLLC = sess.lastLongestClick && c.id === sess.lastLongestClick.click.id;
      const dwellStr = dwell != null ? (dwell >= 1000 ? (dwell/1000).toFixed(1)+'s' : dwell+'ms') : '?';
      const label = c.terminus === 'C' ? 'Satisfied' : c.terminus === 'B' ? 'Pogo' : c.terminus === 'H' ? 'Browsed' : 'Click';
      return (i > 0 ? '<span class="cc-arrow">→</span>' : '') +
        '<span class="cc-chip '+cls+(isLLC?' cc-llc':'')+'" title="dwell: '+esc(dwellStr)+'">' +
          label + (dwell != null ? ' · ' + esc(dwellStr) : '') +
        '</span>';
    }).join('');

    // Insight bullets
    const insightHtml = sess.insights ? sess.insights.map(function(line) {
      return '<div class="insight-line">'+esc(line)+'</div>';
    }).join('') : '';

    // Session attention rollup (top 5 elements)
    let rollupHtml = '';
    if (sess.attentionRollup && sess.attentionRollup.length) {
      const top = sess.attentionRollup.slice(0, 5);
      rollupHtml = '<div class="sess-attn">' +
        '<div class="sess-attn-title">Attention rollup</div>' +
        top.map(function(el, i) {
          const score = el.hoverDwellMs + el.gestures * 250;
          const dwell = el.hoverDwellMs >= 1000 ? (el.hoverDwellMs/1000).toFixed(1)+'s' : el.hoverDwellMs+'ms';
          const bar   = Math.round((score / (sess.attentionRollup[0].hoverDwellMs + sess.attentionRollup[0].gestures*250)) * 100);
          return '<div class="sess-attn-row">' +
            '<code class="attn-ved-sm">'+esc(el.ved)+'</code>' +
            '<div class="attn-bar-wrap"><div class="attn-bar" style="width:'+bar+'%"></div></div>' +
            '<span class="attn-dwell-sm">'+(el.hoverDwellMs > 0 ? esc(dwell) : '')+(el.gestures > 0 ? (el.hoverDwellMs>0?' ':'')+(el.gestures)+'×click' : '')+'</span>' +
          '</div>';
        }).join('') +
        (sess.attentionRollup.length > 5 ? '<div class="sess-attn-more">+' + (sess.attentionRollup.length-5) + ' more</div>' : '') +
      '</div>';
    }

    el.innerHTML =
      '<div class="sess-header">' +
        '<div class="sess-query">'+(sess.query ? esc(sess.query) : '<span class="muted">query unknown</span>')+'</div>' +
        '<div class="sess-meta">' +
          '<span class="etime">'+fmtDuration(sess.durationMs)+'</span>' +
          metaBadges.join('') +
        '</div>' +
      '</div>' +
      (sess.clicks.length ? '<div class="sess-chain">'+chainHtml+'</div>' : '') +
      rollupHtml +
      (insightHtml ? '<div class="sess-insight">'+insightHtml+'</div>' : '');

    list.appendChild(el);
  });
}

function updateStats() {
  document.getElementById('sc').textContent = all.filter(function(e){return e.cas==='C';}).length;
  document.getElementById('sp').textContent = all.filter(function(e){return e.cas==='A';}).length;
  document.getElementById('sa').textContent = all.filter(function(e){return e.cas==='S';}).length;
  document.getElementById('st').textContent = all.length;
  document.getElementById('aioCount').textContent = aio.length;
  const sessCountEl = document.getElementById('sessCount');
  if (sessCountEl) sessCountEl.textContent = computeSessions(all).length;
}

// Signature of the current data — cheap way to detect "nothing changed" so we
// can skip the DOM rebuild. Rebuilding wipes text selection and resets scroll.
function dataSignature(events, aioEvents) {
  const e0 = events[0] || {};
  const a0 = aioEvents[0] || {};
  const aSrc = (a0.sources || []).length;
  const aFan = (a0.fanoutEvents || []).length;
  return events.length + '|' + (e0.id || '') + '|' + aioEvents.length + '|' + (a0.id || '') + '|' + aSrc + '|' + aFan;
}
let lastSig = null;

function load() {
  chrome.storage.local.get(['events','aioEvents'], function(r) {
    const events = r.events || [];
    const aioEvents = r.aioEvents || [];
    const sig = dataSignature(events, aioEvents);
    // Nothing changed since last poll — leave the DOM (and the user's text
    // selection / scroll position) completely untouched.
    if (sig === lastSig) return;
    // Don't yank the DOM out from under an active text selection (copy in progress).
    // Defer until the next poll when the data has settled and selection is clear.
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
    lastSig = sig;
    all = events;
    aio = aioEvents;
    updateStats();
    render();
    renderAio();
    renderSessions();
  });
}

// ── Tab switching ───────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function(b) {
  b.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
    tab = b.dataset.tab;
    document.getElementById('view-signals').classList.toggle('hidden', tab !== 'signals');
    document.getElementById('view-aio').classList.toggle('hidden', tab !== 'aio');
    document.getElementById('view-sessions').classList.toggle('hidden', tab !== 'sessions');
  });
});

document.querySelectorAll('.fb').forEach(function(b) {
  b.addEventListener('click', function() {
    document.querySelectorAll('.fb').forEach(function(x){ x.classList.remove('on'); });
    b.classList.add('on');
    filter = b.dataset.f;
    expanded = null;
    render();
  });
});

document.getElementById('bcl').addEventListener('click', function() {
  chrome.storage.local.set({ events: [], aioEvents: [] }, function() {
    all = []; aio = []; expanded = null; updateStats(); render(); renderAio(); renderSessions();
  });
});

document.getElementById('bex').addEventListener('click', function() {
  chrome.storage.local.get(['events','aioEvents','logBodies'], function(r) {
    const sessions = computeSessions(r.events || []);
    // Slim down sessions for export: omit the full events array (already in signals)
    const sessionsExport = sessions.map(function(s) {
      return {
        query:          s.query,
        aqid:           (s.clicks[0] && s.clicks[0].aqid) || null,
        ei:             (s.clicks[0] && (s.clicks[0].params || {}).ei) || null,
        spanMs:         s.durationMs,
        clicks:         s.clicks.length,
        pogos:          s.pogos.length,
        satisfiedClick: !!s.satisfiedClick,
        aioCached:      s.aioCached || false,
        maxNavDepth:    s.maxNavDepth,
        avgPv:          s.avgPv,
        lastLongestClick: s.lastLongestClick ? {
          dwellMs:    s.lastLongestClick.dwellMs,
          terminus:   s.lastLongestClick.click.terminus,
          pv:         parseFloat((s.lastLongestClick.click.params || {}).pv || 0),
        } : null,
        attentionRollup: s.attentionRollup || null,
        insights:        s.insights || null,
      };
    });
    const payload = {
      exportedAt:    new Date().toISOString(),
      signals:       r.events    || [],
      aiOverviews:   r.aioEvents || [],
      sessions:      sessionsExport,
      logBodies:     r.logBodies || [],   // raw POST body captures from /log
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'serp-telemetry-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

// ── Start / Stop capture ────────────────────────────────────────────────────
function startPolling() {
  if (loadInterval) return; // guard against duplicate intervals
  load();
  loadInterval = setInterval(load, 800);
}

function stopPolling() {
  if (loadInterval) { clearInterval(loadInterval); loadInterval = null; }
}

function applyCapturUI(isCapturing) {
  capturing = isCapturing;
  document.getElementById('start-screen').classList.toggle('hidden', isCapturing);
  document.getElementById('main-ui').classList.toggle('hidden', !isCapturing);
  if (isCapturing) {
    startPolling();
  } else {
    stopPolling();
  }
}

// Read initial state on panel open — start-screen is visible by default in HTML,
// so there's no blank flash while storage is read.
chrome.storage.local.get(['captureEnabled'], function(r) {
  applyCapturUI(r.captureEnabled === true);
});

document.getElementById('btnStart').addEventListener('click', function() {
  chrome.storage.local.set({ captureEnabled: true });
  applyCapturUI(true);
});

document.getElementById('btnStop').addEventListener('click', function() {
  chrome.storage.local.set({ captureEnabled: false });
  applyCapturUI(false);
});
