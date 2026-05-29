// popup.js — external script (MV3 CSP compliant)

let all = [], filter = 'all', expanded = null;

const CAT_STYLE = {
  click:       { icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', fg: 'var(--green)',  bg: 'var(--green-bg)' },
  pogo:        { icon: 'M9 14l-4-4 4-4M5 10h11a4 4 0 0 1 0 8h-1',                                     fg: 'var(--red)',    bg: 'var(--red-bg)' },
  ai_overview: { icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z',           fg: 'var(--purple)', bg: 'var(--purple-bg)' },
  ai_mode:     { icon: 'M12 2a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 3 3 0 0 0 4-3 3 3 0 0 0 1-5 3 3 0 0 0-2-5 3 3 0 0 0-3-3z', fg: 'var(--indigo)', bg: 'var(--indigo-bg)' },
  keyboard:    { icon: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',                fg: 'var(--blue)',   bg: 'var(--blue-bg)' },
  gesture:     { icon: 'M9 11V6a2 2 0 0 1 4 0v5M13 9a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7 7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 3-1l1 2', fg: 'var(--cyan)', bg: 'var(--cyan-bg)' },
  attention:   { icon: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', fg: 'var(--amber)',  bg: 'var(--amber-bg)' },
  heartbeat:   { icon: 'M22 12h-4l-3 9L9 3l-3 9H2',                                                    fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  viewport:    { icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', fg: 'var(--cyan)',   bg: 'var(--cyan-bg)' },
  perf:        { icon: 'M13 2L3 14h7v8l10-12h-7z',                                                     fg: 'var(--amber)',  bg: 'var(--amber-bg)' },
  ui:          { icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',                           fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
  other:       { icon: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0 2 1 1 0 0 0 0-2',  fg: 'var(--slate)',  bg: 'var(--slate-bg)' },
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
  return String(label).replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F\u2190-\u21FF]+\s*/u, '').trim();
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

function render() {
  const list = document.getElementById('list');
  const emp = document.getElementById('emp');
  const items = filter === 'all' ? all : all.filter(e => e.cat === filter || (filter === 'cas_'+ (e.cas||'').toLowerCase()));

  list.querySelectorAll('.ei').forEach(el => el.remove());

  if (items.length === 0) { emp.style.display = 'flex'; return; }
  emp.style.display = 'none';

  items.forEach(ev => {
    const st = styleFor(ev.cat);
    const el = document.createElement('div');
    el.className = 'ei' + (expanded === ev.id ? ' open' : '');

    const decoded = (ev.decoded || []).map(function(d) {
      return '<div class="drow"><div class="dkey"><code>'+esc(d.key)+'</code> '+esc(d.label)+'</div><div class="dval">'+esc(cleanLabel(d.value))+'</div></div>';
    }).join('');

    const rawHtml = Object.entries(ev.params || {}).map(function(pair) {
      const k = pair[0], v = pair[1];
      const sv = v.length > 40 ? v.substring(0,40)+'…' : v;
      return '<code>'+esc(k)+'</code>='+esc(sv);
    }).join('&nbsp;&nbsp;');

    // badges: CAS dimension + interaction mode
    let badges = '';
    if (ev.cas) {
      const cs = CAS_STYLE[ev.cas] || CAS_STYLE.C;
      badges += '<span class="badge" style="color:'+cs.fg+';background:'+cs.bg+'">'+ev.cas+' · '+esc(ev.casFull||'')+'</span>';
    }
    if (ev.mode && MODE_ICON[ev.mode]) {
      badges += '<span class="badge mode">'+svgIcon(MODE_ICON[ev.mode],'var(--text-2)',11)+esc(ev.mode)+'</span>';
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
        (decoded ? '<div class="dsec">Decoded signals</div><div class="dgrid">'+decoded+'</div>' : '') +
        '<div class="dsec">Raw parameters</div>' +
        '<div class="raw">'+(rawHtml || '<span style="color:var(--text-3)">none</span>')+'</div>' +
      '</div>';

    el.addEventListener('click', function() {
      expanded = expanded === ev.id ? null : ev.id;
      render();
    });

    list.appendChild(el);
  });
}

function updateStats() {
  document.getElementById('sc').textContent = all.filter(function(e){return e.cas==='C';}).length;
  document.getElementById('sp').textContent = all.filter(function(e){return e.cas==='A';}).length;
  document.getElementById('sa').textContent = all.filter(function(e){return e.cas==='S';}).length;
  document.getElementById('st').textContent = all.length;
}

function load() {
  chrome.storage.local.get(['events'], function(r) {
    all = r.events || [];
    updateStats();
    render();
  });
}

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
  chrome.storage.local.set({ events: [] }, function() {
    all = []; expanded = null; updateStats(); render();
  });
});

document.getElementById('bex').addEventListener('click', function() {
  const blob = new Blob([JSON.stringify(all, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'serp-telemetry-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

load();
setInterval(load, 800);
