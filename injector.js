// injector.js — executes in the PAGE's JS world (not isolated content script world)
// Wraps network APIs to intercept telemetry pings, response bodies, and POST bodies.

(function () {
  const ENDPOINTS = ['/gen_204', '/client_204', '/log'];
  const RESPONSE_MATCHERS = ['async=', 'batchexecute', '/_/', 'aiov', 'udm='];
  const MAX_BODY = 500000;

  function isTarget(url) {
    try {
      const u = new URL(url, location.href);
      return ENDPOINTS.some(ep => u.pathname === ep);
    } catch { return false; }
  }

  function isResponseTarget(url) {
    try {
      const u = new URL(url, location.href);
      if (!/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) return false;
      if (isTarget(url)) return false;
      return RESPONSE_MATCHERS.some(m => u.href.includes(m));
    } catch { return false; }
  }

  function dispatch(url, transport) {
    try {
      const u = new URL(url, location.href);
      const params = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      window.dispatchEvent(new CustomEvent('__serp_ping__', {
        detail: { url: u.href, pathname: u.pathname, params, transport: transport || 'unknown' }
      }));
    } catch (e) { }
  }

  function dispatchResponse(url, body) {
    try {
      window.dispatchEvent(new CustomEvent('__serp_response__', {
        detail: { url, body: String(body).slice(0, MAX_BODY) }
      }));
    } catch (e) { }
  }

  // Dispatch a POST body so the content script can mine it for structured data
  // (attentionRollup, batched events, etc.). Only called for target endpoints.
  function dispatchBodyStr(url, str) {
    if (!str || !str.trim()) return;
    try {
      window.dispatchEvent(new CustomEvent('__serp_body__', {
        detail: { url, body: str.slice(0, MAX_BODY) }
      }));
    } catch (e) { }
  }

  // Convert whatever a caller passes as a POST body into a string, then dispatch.
  // Handles: string, URLSearchParams, FormData. Blobs are read async (fire-and-forget).
  // ArrayBuffer / TypedArray: attempt UTF-8 decode, ignore if not text.
  function captureBody(url, data) {
    if (!data) return;
    if (typeof data === 'string') { dispatchBodyStr(url, data); return; }
    if (data instanceof URLSearchParams) { dispatchBodyStr(url, data.toString()); return; }
    if (data instanceof FormData) {
      try {
        const parts = [];
        data.forEach((v, k) => parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)));
        dispatchBodyStr(url, parts.join('&'));
      } catch { }
      return;
    }
    if (data instanceof Blob) {
      // Async: fires after sendBeacon returns, but the CustomEvent still reaches the content script
      data.text().then(str => dispatchBodyStr(url, str)).catch(() => {});
      return;
    }
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      try {
        const str = new TextDecoder('utf-8', { fatal: true }).decode(data);
        dispatchBodyStr(url, str);
      } catch { /* binary proto, skip */ }
    }
  }

  // ── fetch ──────────────────────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (input instanceof Request) ? input.url : String(input);
    if (isTarget(url)) {
      dispatch(url, 'fetch');
      // Capture POST/PUT body — GET requests have no body so captureBody is a no-op
      captureBody(url, init && init.body);
    }
    const p = _fetch.apply(this, arguments);
    if (isResponseTarget(url)) {
      p.then((res) => {
        try { res.clone().text().then((b) => dispatchResponse(url, b)).catch(() => {}); }
        catch (e) { }
      }).catch(() => {});
    }
    return p;
  };

  // ── XMLHttpRequest ─────────────────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const captured = String(url);
    this.__captureUrl = isTarget(captured) ? captured : null;
    if (this.__captureUrl) {
      this.addEventListener('loadstart', function () { dispatch(captured, 'xhr'); }, { once: true });
    }
    if (isResponseTarget(captured)) {
      this.addEventListener('load', function () {
        try { dispatchResponse(captured, this.responseText || ''); } catch (e) { }
      }, { once: true });
    }
    return _open.apply(this, arguments);
  };

  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__captureUrl) captureBody(this.__captureUrl, body);
    return _send.apply(this, arguments);
  };

  // ── sendBeacon ─────────────────────────────────────────────────────────────
  const _beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    const urlStr = String(url);
    if (isTarget(urlStr)) {
      dispatch(urlStr, 'sendBeacon');
      captureBody(urlStr, data);
    }
    return _beacon(url, data);
  };

  // ── <img> src ping ────────────────────────────────────────────────────────
  const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imgDesc && imgDesc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set(val) {
        if (isTarget(String(val))) dispatch(String(val), 'image');
        imgDesc.set.call(this, val);
      },
      get() { return imgDesc.get.call(this); },
      configurable: true,
    });
  }
})();
