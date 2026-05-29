// injector.js — executes in the PAGE's JS world (not isolated content script world)
// Wraps network APIs to intercept Google's telemetry pings before they fire.

(function () {
  const ENDPOINTS = ['/gen_204', '/client_204', '/log'];

  function isTarget(url) {
    try {
      const u = new URL(url, location.href);
      return ENDPOINTS.some(ep => u.pathname === ep || u.pathname.startsWith(ep + '?'));
    } catch { return false; }
  }

  function dispatch(url) {
    try {
      const u = new URL(url, location.href);
      const params = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      window.dispatchEvent(new CustomEvent('__serp_ping__', {
        detail: { url: u.href, pathname: u.pathname, params }
      }));
    } catch (e) { }
  }

  // ── fetch ──────────────────────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (input instanceof Request) ? input.url : String(input);
    if (isTarget(url)) dispatch(url);
    return _fetch.apply(this, arguments);
  };

  // ── XMLHttpRequest ─────────────────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isTarget(String(url))) {
      const captured = String(url);
      this.addEventListener('loadstart', function () { dispatch(captured); }, { once: true });
    }
    return _open.apply(this, arguments);
  };

  // ── sendBeacon ─────────────────────────────────────────────────────────────
  const _beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    if (isTarget(String(url))) dispatch(String(url));
    return _beacon(url, data);
  };

  // ── <img> src ping (Google uses 1x1 pixel pings too) ──────────────────────
  const imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imgDesc && imgDesc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set(val) {
        if (isTarget(String(val))) dispatch(String(val));
        imgDesc.set.call(this, val);
      },
      get() { return imgDesc.get.call(this); },
      configurable: true,
    });
  }
})();
