/*
 * Boot guard — runs before the React bundle.
 *  1. Paints the correct background immediately (no white flash / white screen).
 *  2. Keeps React alive when Google/Chrome Translate rewrites text nodes
 *     (the classic "removeChild / insertBefore ... not a child of this node" crash that blanks the page).
 *  3. If the app crashes or never mounts, shows a readable message with a reload button instead of white.
 */
(function () {
  'use strict';

  // 1. Background colour matching the saved theme
  try {
    var light = localStorage.getItem('dgc_theme') === 'light';
    var bg = light ? '#f8fafc' : '#020617';
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.style.backgroundColor = '#020617';
  }

  // 2. Translate-safe DOM operations
  if (typeof Node === 'function' && Node.prototype) {
    var origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
      if (child && child.parentNode !== this) {
        if (typeof console !== 'undefined') console.warn('[boot-guard] removeChild skipped: node was moved by the translator');
        return child;
      }
      return origRemoveChild.apply(this, arguments);
    };
    var origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (newNode, referenceNode) {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (typeof console !== 'undefined') console.warn('[boot-guard] insertBefore skipped: reference node was moved by the translator');
        return newNode;
      }
      return origInsertBefore.apply(this, arguments);
    };
  }

  // 3. Fallback screen + self-diagnostics
  var lastError = '';
  var problems = [];
  function note(msg) { if (problems.length < 12 && problems.indexOf(msg) === -1) problems.push(msg); }

  // Resource (script/css) load failures do not bubble: listen in the capture phase
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t !== window && (t.src || t.href)) note('LOAD FAILED: ' + (t.src || t.href));
  }, true);
  // Content-Security-Policy blocks
  document.addEventListener('securitypolicyviolation', function (e) {
    note('CSP BLOCKED (' + e.violatedDirective + '): ' + (e.blockedURI || 'inline'));
  });

  function resourceReport() {
    var out = [];
    try {
      var list = performance.getEntriesByType('resource');
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (/\.(js|css)(\?|$)/.test(r.name) || r.name.indexOf('/assets/') !== -1) {
          var short = r.name.replace(location.origin, '');
          out.push(short.slice(0, 60) + ' -> status ' + (r.responseStatus || '?') + ', ' + Math.round(r.duration) + 'ms, ' + (r.transferSize || 0) + 'B');
        }
      }
    } catch (e) {}
    return out.slice(0, 10);
  }
  function showFallback(reason) {
    var root = document.getElementById('root');
    if (root && root.childNodes.length > 0) return; // app is alive
    if (document.getElementById('dgc-boot-fallback')) return;

    var box = document.createElement('div');
    box.id = 'dgc-boot-fallback';
    box.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;' +
      'background:#020617;color:#f1f5f9;font-family:system-ui,Segoe UI,Roboto,sans-serif;text-align:center;z-index:2147483647';
    var inner = document.createElement('div');
    inner.style.cssText = 'max-width:460px';

    var h = document.createElement('h1');
    h.textContent = 'ገጹ መጫን አልቻለም';
    h.style.cssText = 'font-size:22px;margin:0 0 8px;color:#fbbf24';
    var p = document.createElement('p');
    p.textContent = 'እባክዎ ገጹን እንደገና ይጫኑ። ችግሩ ከቀጠለ የትርጉም (Translate) አገልግሎትን ያጥፉ ወይም ሌላ ብራውዘር ይሞክሩ። (The page could not load. Please reload.)';
    p.style.cssText = 'font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px';
    var btn = document.createElement('button');
    btn.textContent = 'እንደገና ጫን (Reload)';
    btn.style.cssText = 'padding:10px 22px;border:0;border-radius:12px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:14px;cursor:pointer';
    btn.onclick = function () { location.reload(); };
    inner.appendChild(h); inner.appendChild(p); inner.appendChild(btn);

    var detail = [reason || lastError]
      .concat(problems)
      .concat(['--- resources ---'])
      .concat(resourceReport())
      .concat(['--- page ---', location.href, 'online=' + navigator.onLine])
      .join('\n');
    var d = document.createElement('pre');
    d.textContent = detail.slice(0, 1500);
    d.style.cssText = 'margin-top:16px;font-size:11px;color:#94a3b8;white-space:pre-wrap;word-break:break-all;text-align:left;background:#0f172a;padding:10px;border-radius:8px';
    inner.appendChild(d);
    box.appendChild(inner);
    document.body.appendChild(box);
  }

  window.addEventListener('error', function (e) {
    lastError = (e && e.message) || 'Script error';
    setTimeout(function () { showFallback(lastError); }, 1500);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    lastError = (r && (r.message || String(r))) || 'Unhandled promise rejection';
  });
  // If React has not mounted anything after 10 seconds (slow network, blocked script, failed chunk)
  window.addEventListener('load', function () {
    setTimeout(function () { showFallback('App did not start within 15 seconds'); }, 15000);
  });

  // Load Google Fonts without blocking first paint
  var f = document.getElementById('gfonts');
  if (f) {
    var enable = function () { f.media = 'all'; };
    f.addEventListener('load', enable);
    setTimeout(enable, 3000);
  }
})();
