// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    http://tampermonkey.net/
// @version      1.5.1
// @description  On X/Twitter desktop, when a video ends, play the next video instead of looping
// @author       You
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @downloadURL  https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @run-at       document-idle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  var DEBUG = true;

  /**
   * Per-browser tuning. Detected browser picks one profile at boot.
   * Override any key via localStorage:
   *   localStorage.setItem('xAutoNext.browser', 'chrome'|'firefox'|'edge'|'safari'|'opera'|'brave'|'other')
   *   localStorage.setItem('xAutoNext.settings', JSON.stringify({ advanceCooldownMs: 3000 }))
   */
  var BROWSER_PROFILES = {
    chrome: {
      advanceCooldownMs: 2200,
      endGuardMs: 140,
      heartbeatMs: 900,
      playNudgeDelayMs: 400,
      playRetryDelayMs: 900,
      openViewerHardNavDelayMs: 350,
      scrollLoadDelayMs: 800,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: true,
      exportHelpersToPage: true,
      notes: 'Chrome/Windows primary target. Mute before play() for autoplay policy.'
    },
    edge: {
      advanceCooldownMs: 2200,
      endGuardMs: 140,
      heartbeatMs: 900,
      playNudgeDelayMs: 400,
      playRetryDelayMs: 900,
      openViewerHardNavDelayMs: 350,
      scrollLoadDelayMs: 800,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: true,
      exportHelpersToPage: true,
      notes: 'Chromium Edge — same autoplay rules as Chrome.'
    },
    brave: {
      advanceCooldownMs: 2400,
      endGuardMs: 160,
      heartbeatMs: 1000,
      playNudgeDelayMs: 450,
      playRetryDelayMs: 1000,
      openViewerHardNavDelayMs: 400,
      scrollLoadDelayMs: 850,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: true,
      exportHelpersToPage: true,
      notes: 'Brave shields can delay media; slightly longer delays.'
    },
    opera: {
      advanceCooldownMs: 2200,
      endGuardMs: 140,
      heartbeatMs: 900,
      playNudgeDelayMs: 400,
      playRetryDelayMs: 900,
      openViewerHardNavDelayMs: 350,
      scrollLoadDelayMs: 800,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: true,
      exportHelpersToPage: true,
      notes: 'Opera Chromium build.'
    },
    firefox: {
      advanceCooldownMs: 2600,
      endGuardMs: 180,
      heartbeatMs: 1100,
      playNudgeDelayMs: 500,
      playRetryDelayMs: 1100,
      openViewerHardNavDelayMs: 450,
      scrollLoadDelayMs: 900,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: false,
      exportHelpersToPage: true,
      notes: 'Firefox needs unsafeWindow for console helpers; prefer .click() over PointerEvent.'
    },
    safari: {
      advanceCooldownMs: 2800,
      endGuardMs: 200,
      heartbeatMs: 1200,
      playNudgeDelayMs: 550,
      playRetryDelayMs: 1200,
      openViewerHardNavDelayMs: 500,
      scrollLoadDelayMs: 1000,
      minVideoWidth: 140,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: false,
      usePointerEvents: false,
      exportHelpersToPage: true,
      notes: 'Safari autoplay is strict; rely more on viewer navigation + muted play.'
    },
    other: {
      advanceCooldownMs: 2500,
      endGuardMs: 160,
      heartbeatMs: 1000,
      playNudgeDelayMs: 450,
      playRetryDelayMs: 1000,
      openViewerHardNavDelayMs: 400,
      scrollLoadDelayMs: 850,
      minVideoWidth: 120,
      preferViewerNavigation: true,
      muteForAutoplay: true,
      dispatchArrowDown: true,
      usePointerEvents: true,
      exportHelpersToPage: true,
      notes: 'Generic fallback profile.'
    }
  };

  function detectBrowserId() {
    try {
      var forced = localStorage.getItem('xAutoNext.browser');
      if (forced && BROWSER_PROFILES[forced]) return forced;
    } catch (err) {
      // ignore
    }

    var ua = navigator.userAgent || '';
    var brands =
      (navigator.userAgentData && navigator.userAgentData.brands) || [];
    var brandStr = brands
      .map(function (b) {
        return b.brand || '';
      })
      .join(' ')
      .toLowerCase();

    // Order matters (Edge/Opera/Brave include Chrome in UA).
    if (/brave/i.test(ua) || brandStr.indexOf('brave') !== -1) return 'brave';
    if (/edg\//i.test(ua) || brandStr.indexOf('microsoft edge') !== -1) return 'edge';
    if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'opera';
    if (/firefox\//i.test(ua) || typeof InstallTrigger !== 'undefined') return 'firefox';
    if (
      /safari/i.test(ua) &&
      !/chrome|chromium|crios|android/i.test(ua)
    ) {
      return 'safari';
    }
    if (/chrome|crios|chromium/i.test(ua) || brandStr.indexOf('chrome') !== -1) {
      return 'chrome';
    }
    return 'other';
  }

  function loadSettings() {
    var id = detectBrowserId();
    var base = BROWSER_PROFILES[id] || BROWSER_PROFILES.other;
    var settings = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) settings[key] = base[key];
    }
    settings.browserId = id;

    try {
      var raw = localStorage.getItem('xAutoNext.settings');
      if (raw) {
        var override = JSON.parse(raw);
        for (key in override) {
          if (Object.prototype.hasOwnProperty.call(override, key)) {
            settings[key] = override[key];
          }
        }
      }
    } catch (err2) {
      // ignore bad overrides
    }
    return settings;
  }

  var CFG = loadSettings();
  var pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  var attached = new WeakSet();
  var endTimers = new WeakMap();
  var advancing = false;
  var advanceUnlockTimer = 0;
  var lastActiveVideo = null;
  var lastAdvanceAt = 0;
  var lastAdvanceFromSrc = '';

  function log() {
    if (!DEBUG) return;
    var args = ['[X-AutoNext]'].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  function unlockAdvanceSoon() {
    window.clearTimeout(advanceUnlockTimer);
    advanceUnlockTimer = window.setTimeout(function () {
      advancing = false;
    }, CFG.advanceCooldownMs);
  }

  function isVideoEl(node) {
    return !!(node && node.nodeType === 1 && String(node.tagName).toUpperCase() === 'VIDEO');
  }

  function findNextVideoButton() {
    var exact = document.querySelector('[aria-label="Next video"]');
    if (exact) return exact;
    var nodes = document.querySelectorAll('[aria-label]');
    for (var i = 0; i < nodes.length; i++) {
      var label = (nodes[i].getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('next video') !== -1) return nodes[i];
    }
    return null;
  }

  function hardClick(el) {
    if (!el) return false;
    try {
      if (CFG.usePointerEvents && typeof PointerEvent === 'function') {
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            view: pageWindow
          })
        );
      }
      el.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: pageWindow })
      );
      if (CFG.usePointerEvents && typeof PointerEvent === 'function') {
        el.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            view: pageWindow
          })
        );
      }
      el.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: pageWindow })
      );
      el.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: pageWindow })
      );
      if (typeof el.click === 'function') el.click();
      return true;
    } catch (err) {
      try {
        if (typeof el.click === 'function') {
          el.click();
          return true;
        }
      } catch (err2) {
        // ignore
      }
      return false;
    }
  }

  function isUsableVideo(video) {
    if (!isVideoEl(video) || !video.isConnected) return false;
    var rect = video.getBoundingClientRect();
    if (rect.width < CFG.minVideoWidth || rect.height < CFG.minVideoWidth) return false;
    return true;
  }

  function visibilityScore(video) {
    var rect = video.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    if (visible <= 0) return 0;
    return visible / Math.max(rect.height, 1);
  }

  function listTimelineVideos() {
    var nodes = document.querySelectorAll('video');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isUsableVideo(nodes[i])) out.push(nodes[i]);
    }
    return out;
  }

  function containerFor(video) {
    return (
      video.closest('article') ||
      video.closest('[data-testid="cellInnerDiv"]') ||
      video.parentElement ||
      video
    );
  }

  function srcKey(video) {
    return (video && (video.currentSrc || video.src || '')) || '';
  }

  function clearEndTimer(video) {
    var t = endTimers.get(video);
    if (t) {
      window.clearTimeout(t);
      endTimers.delete(video);
    }
  }

  function disableLoop(video) {
    try {
      video.loop = false;
      video.removeAttribute('loop');
    } catch (err) {
      // ignore
    }
  }

  function statusVideoHref(video) {
    var box = containerFor(video);
    var existing = box.querySelector('a[href*="/status/"][href*="/video/"]');
    if (existing) {
      try {
        return existing.href;
      } catch (err) {
        // ignore
      }
    }
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

    var fromTop = fromVideo
      ? fromVideo.getBoundingClientRect().top + window.scrollY
      : window.scrollY;
    for (var i = 0; i < videos.length; i++) {
      if (videos[i] === fromVideo) continue;
      var top = videos[i].getBoundingClientRect().top + window.scrollY;
      if (top > fromTop + 80) return videos[i];
    }
    return null;
  }

  function playVideo(video) {
    disableLoop(video);
    if (CFG.muteForAutoplay) {
      try {
        video.defaultMuted = true;
        video.muted = true;
        video.setAttribute('muted', '');
        video.volume = 0;
      } catch (err) {
        // ignore
      }
    }
    var box = containerFor(video);
    var player =
      box.querySelector('[data-testid="videoPlayer"]') ||
      box.querySelector('[data-testid="videoComponent"]') ||
      video;
    hardClick(player);
    var playBtn =
      box.querySelector('[aria-label="Play"]') ||
      box.querySelector('[aria-label="Play video"]');
    if (playBtn) hardClick(playBtn);
    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (err2) {
      // ignore
    }
  }

  function openInVideoViewer(video) {
    var href = statusVideoHref(video);
    log('open viewer', href);
    if (!href) return false;

    var box = containerFor(video);
    var link = box.querySelector('a[href*="/status/"][href*="/video/"]');
    if (link) {
      hardClick(link);
      return true;
    }

    try {
      pageWindow.history.pushState({}, '', href);
      pageWindow.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      // ignore
    }
    window.setTimeout(function () {
      if (!/\/status\/\d+\/video\//.test(location.pathname)) {
        location.assign(href);
      }
    }, CFG.openViewerHardNavDelayMs);
    return true;
  }

  function activateTimelineVideo(next, fromVideo) {
    log('activate timeline video', {
      from: srcKey(fromVideo).slice(0, 64),
      to: srcKey(next).slice(0, 64)
    });

    if (fromVideo && fromVideo !== next) {
      clearEndTimer(fromVideo);
      try {
        fromVideo.pause();
      } catch (err) {
        // ignore
      }
    }

    if (CFG.preferViewerNavigation && openInVideoViewer(next)) {
      lastActiveVideo = next;
      return;
    }

    var box = containerFor(next);
    try {
      box.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (err2) {
      box.scrollIntoView(true);
    }

    window.setTimeout(function () {
      playVideo(next);
      lastActiveVideo = next;
    }, CFG.playNudgeDelayMs);
    window.setTimeout(function () {
      if (next.isConnected && next.paused) playVideo(next);
    }, CFG.playRetryDelayMs);
  }

  function scrollToNextTimelineVideo(fromVideo) {
    var next = findNextTimelineVideo(fromVideo);
    if (!next) {
      log('no next video in DOM — scrolling to load more');
      window.scrollBy(0, Math.max(window.innerHeight * 0.9, 700));
      window.setTimeout(function () {
        var candidate = findNextTimelineVideo(fromVideo);
        if (candidate) activateTimelineVideo(candidate, fromVideo);
        else {
          log('still no next video after scroll');
          advancing = false;
        }
      }, CFG.scrollLoadDelayMs);
      return;
    }
    activateTimelineVideo(next, fromVideo);
  }

  function goNext(reason, fromVideo) {
    var now = Date.now();
    var source = fromVideo || lastActiveVideo;
    var key = srcKey(source);

    if (advancing) {
      log('skip goNext (cooldown)', reason);
      return;
    }
    if (key && key === lastAdvanceFromSrc && now - lastAdvanceAt < CFG.advanceCooldownMs) {
      log('skip goNext (same clip)', reason);
      return;
    }

    advancing = true;
    lastAdvanceAt = now;
    lastAdvanceFromSrc = key;
    unlockAdvanceSoon();

    var viewerNext = findNextVideoButton();
    log('goNext', reason, {
      browser: CFG.browserId,
      path: location.pathname,
      hasViewerNext: !!viewerNext,
      videos: listTimelineVideos().length
    });

    if (viewerNext && hardClick(viewerNext)) {
      log('clicked Next video');
      return;
    }

    if (CFG.dispatchArrowDown && /\/status\/\d+/.test(location.pathname)) {
      try {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            code: 'ArrowDown',
            keyCode: 40,
            which: 40,
            bubbles: true,
            cancelable: true,
            view: pageWindow
          })
        );
        log('dispatched ArrowDown');
      } catch (err) {
        // ignore
      }
    }

    scrollToNextTimelineVideo(source);
  }

  function armEndTimer(video) {
    clearEndTimer(video);
    if (!isFinite(video.duration) || video.duration <= 0.5) return;
    if (video.paused) return;

    var remainingMs = (video.duration - video.currentTime) * 1000 - CFG.endGuardMs;
    if (remainingMs < 40) remainingMs = 40;

    var timer = window.setTimeout(function () {
      endTimers.delete(video);
      if (video.paused) return;
      if (video !== lastActiveVideo && visibilityScore(video) < 0.5) return;
      var left = video.duration - video.currentTime;
      if (left > 0.55) {
        armEndTimer(video);
        return;
      }
      log('end-guard', { left: left, duration: video.duration });
      try {
        video.pause();
      } catch (err) {
        // ignore
      }
      goNext('end-guard', video);
    }, remainingMs);

    endTimers.set(video, timer);
  }

  function markPlaying(video, why) {
    if (!isUsableVideo(video) || video.paused) return;
    if (lastActiveVideo !== video) {
      log('playing', why, {
        duration: video.duration,
        t: Math.round(video.currentTime * 100) / 100,
        vis: Math.round(visibilityScore(video) * 100) + '%'
      });
    }
    lastActiveVideo = video;
    disableLoop(video);
    armEndTimer(video);
  }

  function attachVideo(video) {
    if (!isUsableVideo(video) || attached.has(video)) return;
    attached.add(video);
    disableLoop(video);

    log('attached', {
      w: Math.round(video.getBoundingClientRect().width),
      duration: video.duration,
      paused: video.paused
    });

    var nearEnd = false;

    video.addEventListener('play', function () {
      nearEnd = false;
      markPlaying(video, 'play-event');
    });
    video.addEventListener('playing', function () {
      markPlaying(video, 'playing-event');
    });
    video.addEventListener('loadedmetadata', function () {
      if (!video.paused) markPlaying(video, 'metadata');
    });
    video.addEventListener('durationchange', function () {
      if (!video.paused) markPlaying(video, 'durationchange');
    });
    video.addEventListener('seeked', function () {
      if (!video.paused) armEndTimer(video);
    });
    video.addEventListener('pause', function () {
      clearEndTimer(video);
    });
    video.addEventListener('ended', function () {
      clearEndTimer(video);
      if (video === lastActiveVideo || visibilityScore(video) >= 0.5) {
        goNext('ended', video);
      }
    });

    video.addEventListener('timeupdate', function () {
      if (!isFinite(video.duration) || video.duration < 1 || video.paused) return;
      if (video.currentTime > 0.05) markPlaying(video, 'timeupdate');

      var remaining = video.duration - video.currentTime;
      if (remaining <= 0.35 && remaining >= 0) {
        nearEnd = true;
        return;
      }
      if (nearEnd && video.currentTime < 0.45) {
        nearEnd = false;
        if (video !== lastActiveVideo && visibilityScore(video) < 0.5) return;
        log('loop-restart');
        try {
          video.pause();
        } catch (err) {
          // ignore
        }
        goNext('loop-restart', video);
        return;
      }
      if (remaining > 1) nearEnd = false;
    });

    if (!video.paused) markPlaying(video, 'already-playing');
  }

  function scan() {
    var nodes = document.querySelectorAll('video');
    for (var i = 0; i < nodes.length; i++) attachVideo(nodes[i]);
  }

  function heartbeat() {
    scan();
    var videos = listTimelineVideos();
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.paused || !isFinite(v.duration) || v.duration < 0.5) continue;
      if (v.currentTime < 0.05) continue;
      var score = visibilityScore(v);
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    if (best) markPlaying(best, 'heartbeat');
  }

  function setBrowserOverride(id) {
    if (!BROWSER_PROFILES[id]) {
      console.warn('[X-AutoNext] unknown browser id', id, Object.keys(BROWSER_PROFILES));
      return false;
    }
    localStorage.setItem('xAutoNext.browser', id);
    console.log('[X-AutoNext] browser override saved:', id, '— reload the page');
    return true;
  }

  function setSettingsOverride(partial) {
    var current = {};
    try {
      current = JSON.parse(localStorage.getItem('xAutoNext.settings') || '{}');
    } catch (err) {
      current = {};
    }
    var key;
    for (key in partial || {}) {
      if (Object.prototype.hasOwnProperty.call(partial, key)) current[key] = partial[key];
    }
    localStorage.setItem('xAutoNext.settings', JSON.stringify(current));
    console.log('[X-AutoNext] settings override saved — reload the page', current);
    return current;
  }

  function clearOverrides() {
    localStorage.removeItem('xAutoNext.browser');
    localStorage.removeItem('xAutoNext.settings');
    console.log('[X-AutoNext] overrides cleared — reload the page');
  }

  function exportFn(fn, target, name) {
    if (typeof exportFunction === 'function') {
      try {
        exportFunction(fn, target, { defineAs: name });
        return true;
      } catch (err) {
        // fall through
      }
    }
    try {
      target[name] = fn;
      return true;
    } catch (err2) {
      return false;
    }
  }

  function exportHelpers() {
    if (!CFG.exportHelpersToPage) return;

    function nextFn() {
      goNext('manual', lastActiveVideo);
    }
    function settingsFn() {
      // Return a plain JSON-safe clone for page consoles.
      return JSON.parse(JSON.stringify({
        browserId: CFG.browserId,
        advanceCooldownMs: CFG.advanceCooldownMs,
        endGuardMs: CFG.endGuardMs,
        heartbeatMs: CFG.heartbeatMs,
        preferViewerNavigation: CFG.preferViewerNavigation,
        muteForAutoplay: CFG.muteForAutoplay,
        usePointerEvents: CFG.usePointerEvents,
        dispatchArrowDown: CFG.dispatchArrowDown,
        notes: CFG.notes
      }));
    }
    function profilesFn() {
      return JSON.parse(JSON.stringify(BROWSER_PROFILES));
    }
    function probeFn() {
      return probe();
    }

    // Firefox: page console cannot call raw sandbox functions — use exportFunction.
    var apiTarget = pageWindow;
    if (typeof createObjectIn === 'function') {
      try {
        apiTarget = createObjectIn(pageWindow, { defineAs: '__xAutoNextApi' });
      } catch (err) {
        apiTarget = pageWindow;
      }
    } else {
      try {
        if (!pageWindow.__xAutoNextApi) pageWindow.__xAutoNextApi = {};
        apiTarget = pageWindow.__xAutoNextApi;
      } catch (err2) {
        apiTarget = pageWindow;
      }
    }

    exportFn(nextFn, pageWindow, '__xAutoNext');
    exportFn(probeFn, pageWindow, '__xAutoNextProbe');
    exportFn(nextFn, apiTarget, 'next');
    exportFn(probeFn, apiTarget, 'probe');
    exportFn(settingsFn, apiTarget, 'settings');
    exportFn(setBrowserOverride, apiTarget, 'setBrowser');
    exportFn(setSettingsOverride, apiTarget, 'setSettings');
    exportFn(clearOverrides, apiTarget, 'clearOverrides');
    exportFn(profilesFn, apiTarget, 'profiles');

    if (apiTarget !== pageWindow) {
      try {
        pageWindow.__xAutoNextApi = apiTarget;
      } catch (err3) {
        // ignore
      }
    }

    // Page-safe fallback (works even when function export is blocked):
    //   localStorage.setItem('xAutoNext.browser', 'chrome'); location.reload();
    //   window.postMessage({ source: 'x-autonext', cmd: 'setBrowser', id: 'chrome' }, '*');
    pageWindow.addEventListener('message', function (event) {
      if (event.source !== pageWindow) return;
      var data = event.data;
      if (!data || data.source !== 'x-autonext') return;
      if (data.cmd === 'next') nextFn();
      else if (data.cmd === 'probe') {
        var report = probeFn();
        pageWindow.postMessage({ source: 'x-autonext-result', cmd: 'probe', report: report }, '*');
      } else if (data.cmd === 'setBrowser') setBrowserOverride(data.id);
      else if (data.cmd === 'setSettings') setSettingsOverride(data.settings || {});
      else if (data.cmd === 'clearOverrides') clearOverrides();
      else if (data.cmd === 'settings') {
        pageWindow.postMessage(
          { source: 'x-autonext-result', cmd: 'settings', settings: settingsFn() },
          '*'
        );
      }
    });
  }

  function probe() {
    var active = lastActiveVideo;
    var report = {
      browser: CFG.browserId,
      settings: {
        advanceCooldownMs: CFG.advanceCooldownMs,
        endGuardMs: CFG.endGuardMs,
        preferViewerNavigation: CFG.preferViewerNavigation,
        muteForAutoplay: CFG.muteForAutoplay,
        usePointerEvents: CFG.usePointerEvents,
        dispatchArrowDown: CFG.dispatchArrowDown
      },
      notes: CFG.notes,
      href: location.href,
      viewerNext: !!findNextVideoButton(),
      timelineVideos: listTimelineVideos().length,
      lastActive: !!(active && active.isConnected),
      nextHref: active ? statusVideoHref(findNextTimelineVideo(active) || active) : null,
      advancing: advancing
    };
    console.log('[X-AutoNext] probe', report);
    return report;
  }

  function boot() {
    log('boot v1.5.1', {
      browser: CFG.browserId,
      notes: CFG.notes,
      href: location.href
    });
    exportHelpers();
    scan();
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.setInterval(heartbeat, CFG.heartbeatMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
