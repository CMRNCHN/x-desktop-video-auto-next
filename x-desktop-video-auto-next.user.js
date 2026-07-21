// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Auto-advance to next X/Twitter video when current ends (disable loop)
// @author       You
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @downloadURL  https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Set false once it works to quiet the console.
  var DEBUG = true;
  var ADVANCE_COOLDOWN_MS = 1200;
  var END_GUARD_MS = 80;

  var attached = new WeakSet();
  var advancing = false;
  var advanceUnlockTimer = 0;

  function log() {
    if (!DEBUG) return;
    var args = ['[X-AutoNext]'].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  function isVideoContext() {
    var path = window.location.pathname || '';
    if (/\/status\/\d+/.test(path)) return true;
    if (/\/i\/videos?\//.test(path)) return true;
    if (findNextControl()) return true;
    return false;
  }

  function findNextControl() {
    var labels = [
      'Next video',
      'Next',
      'Go to next post',
      'Next post',
      'See next video'
    ];
    for (var i = 0; i < labels.length; i++) {
      var el = document.querySelector('[aria-label="' + labels[i] + '"]');
      if (el) return el;
    }
    // Fallback: any button whose label contains "next video"
    var candidates = document.querySelectorAll('[aria-label*="ext" i], [data-testid]');
    for (var j = 0; j < candidates.length; j++) {
      var label = (candidates[j].getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('next video') !== -1) return candidates[j];
    }
    return null;
  }

  function unlockAdvanceSoon() {
    window.clearTimeout(advanceUnlockTimer);
    advanceUnlockTimer = window.setTimeout(function () {
      advancing = false;
    }, ADVANCE_COOLDOWN_MS);
  }

  function fireKey(target, key, keyCode) {
    var opts = {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      view: window
    };
    try {
      target.dispatchEvent(new KeyboardEvent('keydown', opts));
      target.dispatchEvent(new KeyboardEvent('keyup', opts));
    } catch (err) {
      // ignore
    }
  }

  function hardClick(el) {
    if (!el) return false;
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      if (typeof el.click === 'function') el.click();
      return true;
    } catch (err) {
      try {
        el.click();
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  function goNext(reason) {
    if (advancing) {
      log('skip goNext (cooldown)', reason);
      return;
    }
    advancing = true;
    unlockAdvanceSoon();

    var nextBtn = findNextControl();
    log('goNext', reason, {
      path: location.pathname,
      hasNextBtn: !!nextBtn,
      nextLabel: nextBtn && nextBtn.getAttribute('aria-label'),
      videoContext: isVideoContext()
    });

    if (nextBtn && hardClick(nextBtn)) {
      log('clicked next control');
      return;
    }

    // Broadcast ArrowDown to common targets (synthetic; may be ignored by React).
    var targets = [document.activeElement, document.body, document.documentElement, window].filter(Boolean);
    for (var i = 0; i < targets.length; i++) {
      fireKey(targets[i], 'ArrowDown', 40);
    }
    log('dispatched ArrowDown to', targets.length, 'targets');
  }

  function disableLoop(video) {
    try {
      video.loop = false;
      video.removeAttribute('loop');
    } catch (err) {
      // ignore
    }

    // Prevent X from flipping loop back on for this element.
    try {
      Object.defineProperty(video, 'loop', {
        configurable: true,
        enumerable: true,
        get: function () {
          return false;
        },
        set: function () {
          // swallow
        }
      });
    } catch (err2) {
      // ignore
    }
  }

  function attachVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (attached.has(video)) return;
    attached.add(video);

    disableLoop(video);
    log('attached video', {
      src: (video.currentSrc || video.src || '').slice(0, 80),
      duration: video.duration,
      loop: video.loop
    });

    var endTimer = 0;

    function clearEndTimer() {
      if (endTimer) {
        window.clearTimeout(endTimer);
        endTimer = 0;
      }
    }

    function armEndTimer() {
      clearEndTimer();
      if (!isFinite(video.duration) || video.duration <= 0) return;
      var remainingMs = (video.duration - video.currentTime) * 1000 - END_GUARD_MS;
      if (remainingMs < 50) remainingMs = 50;
      endTimer = window.setTimeout(function () {
        endTimer = 0;
        if (video.paused) return;
        var left = video.duration - video.currentTime;
        if (left > 0.45) {
          // Seeked or duration changed; re-arm.
          armEndTimer();
          return;
        }
        log('end-guard fired', { left: left, currentTime: video.currentTime, duration: video.duration });
        try {
          video.pause();
        } catch (err) {
          // ignore
        }
        goNext('end-guard');
      }, remainingMs);
    }

    video.addEventListener('loadedmetadata', armEndTimer);
    video.addEventListener('play', function () {
      disableLoop(video);
      armEndTimer();
    });
    video.addEventListener('seeked', armEndTimer);
    video.addEventListener('pause', clearEndTimer);
    video.addEventListener('ended', function () {
      clearEndTimer();
      goNext('ended');
    });

    // If X restarts the clip (seek to start near end), treat as loop and advance.
    var nearEnd = false;
    video.addEventListener('timeupdate', function () {
      if (!isFinite(video.duration) || video.duration < 1) return;
      var remaining = video.duration - video.currentTime;
      if (remaining <= 0.35 && remaining >= 0) {
        nearEnd = true;
        return;
      }
      if (nearEnd && video.currentTime < 0.5) {
        nearEnd = false;
        log('loop-restart detected');
        goNext('loop-restart');
        return;
      }
      if (remaining > 1) nearEnd = false;
    });

    if (!video.paused) armEndTimer();
  }

  function scan() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) attachVideo(videos[i]);
  }

  function boot() {
    log('boot', location.href);
    scan();
    var observer = new MutationObserver(scan);
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
    window.setInterval(function () {
      scan();
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) disableLoop(videos[i]);
    }, 2000);
  }

  if (document.documentElement) boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Manual test from DevTools: window.__xAutoNext()
  window.__xAutoNext = function () {
    goNext('manual');
  };
  window.__xAutoNextProbe = function () {
    var videos = [].slice.call(document.querySelectorAll('video')).map(function (v) {
      return {
        paused: v.paused,
        loop: v.loop,
        currentTime: v.currentTime,
        duration: v.duration,
        src: (v.currentSrc || v.src || '').slice(0, 100)
      };
    });
    var report = {
      href: location.href,
      videoContext: isVideoContext(),
      next: findNextControl() && findNextControl().getAttribute('aria-label'),
      videos: videos
    };
    console.log('[X-AutoNext] probe', report);
    return report;
  };
})();
