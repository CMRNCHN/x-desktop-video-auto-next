// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    https://github.com/CMRNCHN/x-desktop-video-auto-next
// @version      2.0.1
// @description  On X/Twitter desktop, when a video ends, play the next video instead of looping. Works in Chrome, Firefox, Safari, Edge, Brave, Opera.
// @author       You
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @downloadURL  https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @run-at       document-idle
// @grant        none
// @inject-into  page
// ==/UserScript==

/*
 * IMPORTANT: Delete every older copy (v1.x / duplicate installs) in Tampermonkey.
 * You must see exactly one boot line:  [X-AutoNext] boot v2.0.1
 *
 * Firefox page console cannot always call userscript functions (Xray /
 * "Permission denied"). Use postMessage or localStorage instead:
 *
 *   postMessage({ source: 'x-autonext', cmd: 'next' }, '*')
 *   postMessage({ source: 'x-autonext', cmd: 'probe' }, '*')
 *   localStorage.setItem('xAutoNext.browser', 'firefox'); location.reload()
 *   localStorage.setItem('xAutoNext.settings', JSON.stringify({ endGuardMs: 250 })); location.reload()
 *   localStorage.removeItem('xAutoNext.browser'); localStorage.removeItem('xAutoNext.settings'); location.reload()
 *
 * Chrome / Edge usually also get:
 *   __xAutoNext()  /  __xAutoNextProbe()
 */

(function () {
  'use strict';

  var VERSION = '2.0.1';
  var DEBUG = true;

  // Prevent double-running when multiple copies are installed.
  try {
    if (window.__X_AUTO_NEXT_VERSION__) {
      console.warn('[X-AutoNext] another copy already running (' + window.__X_AUTO_NEXT_VERSION__ + '). Delete old scripts in Tampermonkey. Skipping this copy v' + VERSION);
      return;
    }
    window.__X_AUTO_NEXT_VERSION__ = VERSION;
  } catch (e) { /* ignore */ }

  // ---- Per-browser tuning ------------------------------------------------
  var BROWSER_PROFILES = {
    chrome: { advanceCooldownMs: 2200, endGuardMs: 140, heartbeatMs: 900, playNudgeMs: 400, playRetryMs: 900, viewerNavDelayMs: 350, scrollLoadMs: 800, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: true, notes: 'Chrome primary target.' },
    edge:   { advanceCooldownMs: 2200, endGuardMs: 140, heartbeatMs: 900, playNudgeMs: 400, playRetryMs: 900, viewerNavDelayMs: 350, scrollLoadMs: 800, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: true, notes: 'Chromium Edge.' },
    brave:  { advanceCooldownMs: 2400, endGuardMs: 160, heartbeatMs: 1000, playNudgeMs: 450, playRetryMs: 1000, viewerNavDelayMs: 400, scrollLoadMs: 850, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: true, notes: 'Brave shields may delay media.' },
    opera:  { advanceCooldownMs: 2200, endGuardMs: 140, heartbeatMs: 900, playNudgeMs: 400, playRetryMs: 900, viewerNavDelayMs: 350, scrollLoadMs: 800, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: true, notes: 'Opera Chromium.' },
    firefox:{ advanceCooldownMs: 2600, endGuardMs: 180, heartbeatMs: 1100, playNudgeMs: 500, playRetryMs: 1100, viewerNavDelayMs: 450, scrollLoadMs: 900, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: false, notes: 'Firefox: prefer .click() over PointerEvent.' },
    safari: { advanceCooldownMs: 2800, endGuardMs: 200, heartbeatMs: 1200, playNudgeMs: 550, playRetryMs: 1200, viewerNavDelayMs: 500, scrollLoadMs: 1000, minVideoPx: 140, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: false, usePointerEvents: false, notes: 'Safari autoplay is strict; rely on viewer nav + muted play.' },
    other:  { advanceCooldownMs: 2500, endGuardMs: 160, heartbeatMs: 1000, playNudgeMs: 450, playRetryMs: 1000, viewerNavDelayMs: 400, scrollLoadMs: 850, minVideoPx: 120, preferViewer: true, muteForAutoplay: true, dispatchArrowDown: true, usePointerEvents: true, notes: 'Generic fallback.' }
  };

  function detectBrowserId() {
    try {
      var forced = localStorage.getItem('xAutoNext.browser');
      if (forced && BROWSER_PROFILES[forced]) return forced;
    } catch (e) { /* ignore */ }

    var ua = navigator.userAgent || '';
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    var brandStr = brands.map(function (b) { return b.brand || ''; }).join(' ').toLowerCase();

    // Order matters: Edge/Opera/Brave UAs also contain "Chrome".
    if (navigator.brave || brandStr.indexOf('brave') !== -1) return 'brave';
    if (/edg\//i.test(ua) || brandStr.indexOf('microsoft edge') !== -1) return 'edge';
    if (/opr\//i.test(ua) || /opera/i.test(ua) || brandStr.indexOf('opera') !== -1) return 'opera';
    if (/firefox\//i.test(ua)) return 'firefox';
    if (/safari/i.test(ua) && !/chrome|chromium|crios|android/i.test(ua)) return 'safari';
    if (/chrome|crios|chromium/i.test(ua) || brandStr.indexOf('chromium') !== -1) return 'chrome';
    return 'other';
  }

  function loadConfig() {
    var id = detectBrowserId();
    var base = BROWSER_PROFILES[id] || BROWSER_PROFILES.other;
    var cfg = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) cfg[k] = base[k];
    cfg.browserId = id;

    try {
      var raw = localStorage.getItem('xAutoNext.settings');
      if (raw) {
        var ov = JSON.parse(raw);
        for (var j in ov) if (Object.prototype.hasOwnProperty.call(ov, j)) cfg[j] = ov[j];
      }
    } catch (e) { /* ignore bad overrides */ }
    return cfg;
  }

  var CFG = loadConfig();

  // ---- State -------------------------------------------------------------
  var attached = new WeakSet();
  var endTimers = new WeakMap();
  var advancing = false;
  var advanceUnlockTimer = 0;
  var lastActiveVideo = null;
  var lastAdvanceAt = 0;
  var lastAdvanceFromSrc = '';

  function log() {
    if (!DEBUG) return;
    console.log.apply(console, ['[X-AutoNext]'].concat([].slice.call(arguments)));
  }

  // ---- Helpers -----------------------------------------------------------
  function isVideoEl(node) {
    return !!(node && node.nodeType === 1 && String(node.tagName).toUpperCase() === 'VIDEO');
  }

  function isUsableVideo(v) {
    if (!isVideoEl(v) || !v.isConnected) return false;
    var r = v.getBoundingClientRect();
    return r.width >= CFG.minVideoPx && r.height >= CFG.minVideoPx;
  }

  function visibilityScore(v) {
    var r = v.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (visible <= 0) return 0;
    return visible / Math.max(r.height, 1);
  }

  function listTimelineVideos() {
    var nodes = document.querySelectorAll('video');
    var out = [];
    for (var i = 0; i < nodes.length; i++) if (isUsableVideo(nodes[i])) out.push(nodes[i]);
    return out;
  }

  function containerFor(v) {
    return v.closest('article') || v.closest('[data-testid="cellInnerDiv"]') || v.parentElement || v;
  }

  function srcKey(v) {
    return (v && (v.currentSrc || v.src || '')) || '';
  }

  function clearEndTimer(v) {
    var t = endTimers.get(v);
    if (t) { window.clearTimeout(t); endTimers.delete(v); }
  }

  function disableLoop(v) {
    try { v.loop = false; v.removeAttribute('loop'); } catch (e) { /* ignore */ }
  }

  function findNextVideoButton() {
    var exact = document.querySelector('[aria-label="Next video"]');
    if (exact) return exact;
    var nodes = document.querySelectorAll('[aria-label]');
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].getAttribute('aria-label') || '').toLowerCase().indexOf('next video') !== -1) return nodes[i];
    }
    return null;
  }

  function hardClick(el) {
    if (!el) return false;
    try {
      var opts = { bubbles: true, cancelable: true, view: window };
      if (CFG.usePointerEvents && typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', view: window }));
      }
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      if (CFG.usePointerEvents && typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', view: window }));
      }
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      if (typeof el.click === 'function') el.click();
      return true;
    } catch (e) {
      try { if (typeof el.click === 'function') { el.click(); return true; } } catch (e2) { /* ignore */ }
      return false;
    }
  }

  function statusVideoHref(v) {
    var box = containerFor(v);
    var direct = box.querySelector('a[href*="/status/"][href*="/video/"]');
    if (direct) { try { return direct.href; } catch (e) { /* ignore */ } }
    var anchors = box.querySelectorAll('a[href*="/status/"]');
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href') || '';
      var m = href.match(/^(\/[^/?#]+\/status\/\d+)/);
      if (m) return location.origin + m[1] + '/video/1';
    }
    return null;
  }

  function findNextTimelineVideo(fromVideo) {
    var videos = listTimelineVideos();
    var idx = fromVideo ? videos.indexOf(fromVideo) : -1;
    if (idx >= 0 && idx < videos.length - 1) return videos[idx + 1];

    var fromTop = fromVideo ? fromVideo.getBoundingClientRect().top + window.scrollY : window.scrollY;
    for (var i = 0; i < videos.length; i++) {
      if (videos[i] === fromVideo) continue;
      if (videos[i].getBoundingClientRect().top + window.scrollY > fromTop + 80) return videos[i];
    }
    return null;
  }

  // ---- Playback ----------------------------------------------------------
  function playVideo(v) {
    disableLoop(v);
    if (CFG.muteForAutoplay) {
      try { v.defaultMuted = true; v.muted = true; v.setAttribute('muted', ''); v.volume = 0; } catch (e) { /* ignore */ }
    }
    var box = containerFor(v);
    var player = box.querySelector('[data-testid="videoPlayer"]') || box.querySelector('[data-testid="videoComponent"]') || v;
    hardClick(player);
    var playBtn = box.querySelector('[aria-label="Play"]') || box.querySelector('[aria-label="Play video"]');
    if (playBtn) hardClick(playBtn);
    try {
      var p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay blocked */ });
    } catch (e) { /* ignore */ }
  }

  function openInVideoViewer(v) {
    var href = statusVideoHref(v);
    log('open viewer', href);
    if (!href) return false;

    var box = containerFor(v);
    var link = box.querySelector('a[href*="/status/"][href*="/video/"]');
    if (link) { hardClick(link); return true; }

    try {
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) { /* ignore */ }
    window.setTimeout(function () {
      if (!/\/status\/\d+\/video\//.test(location.pathname)) location.assign(href);
    }, CFG.viewerNavDelayMs);
    return true;
  }

  function activateTimelineVideo(next, fromVideo) {
    log('activate', { from: srcKey(fromVideo).slice(0, 48), to: srcKey(next).slice(0, 48) });

    if (fromVideo && fromVideo !== next) {
      clearEndTimer(fromVideo);
      try { fromVideo.pause(); } catch (e) { /* ignore */ }
    }

    if (CFG.preferViewer && openInVideoViewer(next)) {
      lastActiveVideo = next;
      return;
    }

    var box = containerFor(next);
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); }
    catch (e) { box.scrollIntoView(true); }

    window.setTimeout(function () { playVideo(next); lastActiveVideo = next; }, CFG.playNudgeMs);
    window.setTimeout(function () { if (next.isConnected && next.paused) playVideo(next); }, CFG.playRetryMs);
  }

  function scrollToNextTimelineVideo(fromVideo) {
    var next = findNextTimelineVideo(fromVideo);
    if (next) { activateTimelineVideo(next, fromVideo); return; }

    log('no next video in DOM — scrolling to load more');
    window.scrollBy(0, Math.max(window.innerHeight * 0.9, 700));
    window.setTimeout(function () {
      var candidate = findNextTimelineVideo(fromVideo);
      if (candidate) activateTimelineVideo(candidate, fromVideo);
      else { log('still no next video after scroll'); advancing = false; }
    }, CFG.scrollLoadMs);
  }

  function unlockAdvanceSoon() {
    window.clearTimeout(advanceUnlockTimer);
    advanceUnlockTimer = window.setTimeout(function () { advancing = false; }, CFG.advanceCooldownMs);
  }

  function goNext(reason, fromVideo) {
    var now = Date.now();
    var source = fromVideo || lastActiveVideo;
    var key = srcKey(source);

    if (advancing) { log('skip (cooldown)', reason); return; }
    if (key && key === lastAdvanceFromSrc && now - lastAdvanceAt < CFG.advanceCooldownMs) {
      log('skip (same clip)', reason);
      return;
    }

    advancing = true;
    lastAdvanceAt = now;
    lastAdvanceFromSrc = key;
    unlockAdvanceSoon();

    var viewerNext = findNextVideoButton();
    log('goNext', reason, { browser: CFG.browserId, path: location.pathname, hasViewerNext: !!viewerNext, videos: listTimelineVideos().length });

    // In the immersive video viewer, X's own Next-video control gives endless play.
    if (viewerNext && hardClick(viewerNext)) { log('clicked Next video'); return; }

    if (CFG.dispatchArrowDown && /\/status\/\d+/.test(location.pathname)) {
      try {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true, view: window
        }));
        log('dispatched ArrowDown');
      } catch (e) { /* ignore */ }
    }

    scrollToNextTimelineVideo(source);
  }

  // ---- End detection -----------------------------------------------------
  function armEndTimer(v) {
    clearEndTimer(v);
    if (!isFinite(v.duration) || v.duration <= 0.5 || v.paused) return;

    var remainingMs = (v.duration - v.currentTime) * 1000 - CFG.endGuardMs;
    if (remainingMs < 40) remainingMs = 40;

    endTimers.set(v, window.setTimeout(function () {
      endTimers.delete(v);
      if (v.paused) return;
      if (v !== lastActiveVideo && visibilityScore(v) < 0.5) return;
      var left = v.duration - v.currentTime;
      if (left > 0.55) { armEndTimer(v); return; }
      log('end-guard', { left: left, duration: v.duration });
      try { v.pause(); } catch (e) { /* ignore */ }
      goNext('end-guard', v);
    }, remainingMs));
  }

  function markPlaying(v, why) {
    if (!isUsableVideo(v) || v.paused) return;
    if (lastActiveVideo !== v) {
      log('playing', why, { d: v.duration, t: Math.round(v.currentTime * 100) / 100, vis: Math.round(visibilityScore(v) * 100) + '%' });
    }
    lastActiveVideo = v;
    disableLoop(v);
    armEndTimer(v);
  }

  function attachVideo(v) {
    if (!isUsableVideo(v) || attached.has(v)) return;
    attached.add(v);
    disableLoop(v);
    log('attached', { w: Math.round(v.getBoundingClientRect().width), duration: v.duration, paused: v.paused });

    var nearEnd = false;

    v.addEventListener('play', function () { nearEnd = false; markPlaying(v, 'play'); });
    v.addEventListener('playing', function () { markPlaying(v, 'playing'); });
    v.addEventListener('loadedmetadata', function () { if (!v.paused) markPlaying(v, 'metadata'); });
    v.addEventListener('durationchange', function () { if (!v.paused) markPlaying(v, 'durationchange'); });
    v.addEventListener('seeked', function () { if (!v.paused) armEndTimer(v); });
    v.addEventListener('pause', function () { clearEndTimer(v); });
    v.addEventListener('ended', function () {
      clearEndTimer(v);
      if (v === lastActiveVideo || visibilityScore(v) >= 0.5) goNext('ended', v);
    });

    v.addEventListener('timeupdate', function () {
      if (!isFinite(v.duration) || v.duration < 1 || v.paused) return;
      if (v.currentTime > 0.05) markPlaying(v, 'timeupdate');

      var remaining = v.duration - v.currentTime;
      if (remaining <= 0.35 && remaining >= 0) { nearEnd = true; return; }
      if (nearEnd && v.currentTime < 0.45) {
        nearEnd = false;
        if (v !== lastActiveVideo && visibilityScore(v) < 0.5) return;
        log('loop-restart');
        try { v.pause(); } catch (e) { /* ignore */ }
        goNext('loop-restart', v);
        return;
      }
      if (remaining > 1) nearEnd = false;
    });

    if (!v.paused) markPlaying(v, 'already-playing');
  }

  function scan() {
    var nodes = document.querySelectorAll('video');
    for (var i = 0; i < nodes.length; i++) attachVideo(nodes[i]);
  }

  function heartbeat() {
    scan();
    var videos = listTimelineVideos();
    var best = null, bestScore = 0;
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.paused || !isFinite(v.duration) || v.duration < 0.5 || v.currentTime < 0.05) continue;
      var s = visibilityScore(v);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    if (best) markPlaying(best, 'heartbeat');
  }

  // ---- Console / messaging API -------------------------------------------
  function probe() {
    var active = lastActiveVideo;
    var report = {
      version: VERSION,
      browser: CFG.browserId,
      notes: CFG.notes,
      href: location.href,
      viewerNext: !!findNextVideoButton(),
      timelineVideos: listTimelineVideos().length,
      lastActive: !!(active && active.isConnected),
      nextHref: active ? statusVideoHref(findNextTimelineVideo(active) || active) : null,
      advancing: advancing,
      settings: {
        advanceCooldownMs: CFG.advanceCooldownMs,
        endGuardMs: CFG.endGuardMs,
        preferViewer: CFG.preferViewer,
        muteForAutoplay: CFG.muteForAutoplay,
        usePointerEvents: CFG.usePointerEvents,
        dispatchArrowDown: CFG.dispatchArrowDown
      }
    };
    console.log('[X-AutoNext] probe', report);
    return report;
  }

  function setBrowserOverride(id) {
    if (!BROWSER_PROFILES[id]) {
      console.warn('[X-AutoNext] unknown browser id', id, Object.keys(BROWSER_PROFILES));
      return false;
    }
    try { localStorage.setItem('xAutoNext.browser', id); } catch (e) { /* ignore */ }
    console.log('[X-AutoNext] browser set to', id, '— reload the page');
    return true;
  }

  function setSettingsOverride(partial) {
    var current = {};
    try { current = JSON.parse(localStorage.getItem('xAutoNext.settings') || '{}'); } catch (e) { current = {}; }
    for (var k in (partial || {})) if (Object.prototype.hasOwnProperty.call(partial, k)) current[k] = partial[k];
    try { localStorage.setItem('xAutoNext.settings', JSON.stringify(current)); } catch (e2) { /* ignore */ }
    console.log('[X-AutoNext] settings saved — reload the page', current);
    return current;
  }

  function clearOverrides() {
    try {
      localStorage.removeItem('xAutoNext.browser');
      localStorage.removeItem('xAutoNext.settings');
    } catch (e) { /* ignore */ }
    console.log('[X-AutoNext] overrides cleared — reload the page');
  }

  function handleCommand(data) {
    if (!data || typeof data !== 'object') return;
    var cmd = data.cmd;
    if (cmd === 'next') goNext('manual', lastActiveVideo);
    else if (cmd === 'probe') {
      var report = probe();
      try { window.postMessage({ source: 'x-autonext-result', cmd: 'probe', report: report }, '*'); } catch (e) { /* ignore */ }
    } else if (cmd === 'setBrowser') setBrowserOverride(data.id);
    else if (cmd === 'setSettings' || cmd === 'set') setSettingsOverride(data.settings || data.partial || {});
    else if (cmd === 'clearOverrides' || cmd === 'clear') clearOverrides();
    else if (cmd === 'settings') {
      try { window.postMessage({ source: 'x-autonext-result', cmd: 'settings', settings: CFG }, '*'); } catch (e2) { /* ignore */ }
    }
  }

  function installApi() {
    // Always-works path in Firefox page console (no function call across Xray).
    window.addEventListener('message', function (event) {
      if (event.source !== window) return;
      var data = event.data;
      if (!data || data.source !== 'x-autonext') return;
      handleCommand(data);
    });

    // Best-effort direct helpers (Chrome/Edge; may fail in Firefox page console).
    try {
      var api = function () { goNext('manual', lastActiveVideo); };
      api.probe = probe;
      api.settings = function () { return CFG; };
      api.profiles = BROWSER_PROFILES;
      api.setBrowser = setBrowserOverride;
      api.set = setSettingsOverride;
      api.clear = clearOverrides;
      window.__xAutoNext = api;
      window.__xAutoNextProbe = probe;
    } catch (e) { /* ignore */ }

    try {
      document.documentElement.setAttribute('data-x-autonext', VERSION);
    } catch (e2) { /* ignore */ }

    log('commands: postMessage({source:"x-autonext",cmd:"next"|"probe"|"setBrowser"|"setSettings"|"clear"}, "*")');
  }

  // ---- Boot --------------------------------------------------------------
  function boot() {
    log('boot v' + VERSION, { browser: CFG.browserId, notes: CFG.notes, href: location.href });
    installApi();
    scan();
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    window.setInterval(heartbeat, CFG.heartbeatMs);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
