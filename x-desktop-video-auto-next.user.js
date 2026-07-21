// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  On X/Twitter desktop, when a video ends, play the next timeline video instead of looping
// @author       You
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @downloadURL  https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/x-desktop-video-auto-next.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Flip to false once confirmed working.
  var DEBUG = true;
  var ADVANCE_COOLDOWN_MS = 1500;
  var END_GUARD_MS = 120;

  var attached = new WeakSet();
  var advancing = false;
  var advanceUnlockTimer = 0;
  var lastActiveVideo = null;

  function log() {
    if (!DEBUG) return;
    var args = ['[X-AutoNext]'].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  function unlockAdvanceSoon() {
    window.clearTimeout(advanceUnlockTimer);
    advanceUnlockTimer = window.setTimeout(function () {
      advancing = false;
    }, ADVANCE_COOLDOWN_MS);
  }

  /** Only the dedicated video-viewer control — never generic "Next". */
  function findNextVideoButton() {
    var exact = document.querySelector('[aria-label="Next video"]');
    if (exact) return exact;
    var nodes = document.querySelectorAll('[aria-label]');
    for (var i = 0; i < nodes.length; i++) {
      var label = (nodes[i].getAttribute('aria-label') || '').toLowerCase();
      if (label === 'next video' || label.indexOf('next video') !== -1) {
        return nodes[i];
      }
    }
    return null;
  }

  function hardClick(el) {
    if (!el) return false;
    try {
      el.click();
      return true;
    } catch (err) {
      return false;
    }
  }

  function isUsableVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return false;
    if (!video.isConnected) return false;
    // Skip tiny / hidden players (profile hover cards, etc.)
    var rect = video.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    return true;
  }

  function listTimelineVideos() {
    var nodes = document.querySelectorAll('video');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      if (isUsableVideo(nodes[i])) out.push(nodes[i]);
    }
    // Document order ≈ timeline order
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

  function disableLoop(video) {
    try {
      video.loop = false;
      video.removeAttribute('loop');
    } catch (err) {
      // ignore
    }
    try {
      Object.defineProperty(video, 'loop', {
        configurable: true,
        enumerable: true,
        get: function () {
          return false;
        },
        set: function () {}
      });
    } catch (err2) {
      // ignore
    }
  }

  function playVideo(video) {
    disableLoop(video);
    try {
      // Chrome autoplay policy: muted play is allowed without a gesture.
      video.muted = true;
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          hardClick(video);
          var btn =
            containerFor(video).querySelector('[data-testid="playButton"]') ||
            containerFor(video).querySelector('[aria-label="Play"]');
          if (btn) hardClick(btn);
        });
      }
    } catch (err) {
      hardClick(video);
    }
  }

  function scrollToNextTimelineVideo(fromVideo) {
    var videos = listTimelineVideos();
    var idx = fromVideo ? videos.indexOf(fromVideo) : -1;
    var next = null;

    if (idx >= 0 && idx < videos.length - 1) {
      next = videos[idx + 1];
    } else {
      // Fallback: first usable video below the current one in the viewport/document.
      var fromTop = fromVideo
        ? fromVideo.getBoundingClientRect().top + window.scrollY
        : window.scrollY;
      for (var i = 0; i < videos.length; i++) {
        var top = videos[i].getBoundingClientRect().top + window.scrollY;
        if (videos[i] !== fromVideo && top > fromTop + 40) {
          next = videos[i];
          break;
        }
      }
    }

    if (!next) {
      log('no next video in DOM — scrolling to load more');
      window.scrollBy({ top: Math.max(window.innerHeight * 0.85, 600), behavior: 'smooth' });
      window.setTimeout(function () {
        var again = listTimelineVideos();
        var fromIdx = fromVideo ? again.indexOf(fromVideo) : -1;
        var candidate =
          fromIdx >= 0 && fromIdx < again.length - 1
            ? again[fromIdx + 1]
            : again.find(function (v) {
                return v !== fromVideo;
              });
        if (candidate) {
          activateTimelineVideo(candidate, fromVideo);
        } else {
          log('still no next video after scroll');
          advancing = false;
        }
      }, 700);
      return;
    }

    activateTimelineVideo(next, fromVideo);
  }

  function activateTimelineVideo(next, fromVideo) {
    log('activate timeline video', {
      from: fromVideo && (fromVideo.currentSrc || '').slice(0, 60),
      to: (next.currentSrc || next.src || '').slice(0, 60)
    });

    if (fromVideo) {
      try {
        fromVideo.pause();
      } catch (err) {
        // ignore
      }
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
    }, 350);
  }

  function goNext(reason, fromVideo) {
    if (advancing) {
      log('skip goNext (cooldown)', reason);
      return;
    }
    advancing = true;
    unlockAdvanceSoon();

    var source = fromVideo || lastActiveVideo;
    var viewerNext = findNextVideoButton();

    log('goNext', reason, {
      path: location.pathname,
      hasViewerNext: !!viewerNext,
      videos: listTimelineVideos().length
    });

    // Dedicated video viewer (status /video/ UI): use real Next video control.
    if (viewerNext) {
      if (hardClick(viewerNext)) {
        log('clicked Next video');
        return;
      }
    }

    // Home / timeline / explore: scroll to & play the next feed video.
    scrollToNextTimelineVideo(source);
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

    var endTimer = 0;

    function clearEndTimer() {
      if (endTimer) {
        window.clearTimeout(endTimer);
        endTimer = 0;
      }
    }

    function armEndTimer() {
      clearEndTimer();
      if (!isFinite(video.duration) || video.duration <= 0.5) return;
      var remainingMs = (video.duration - video.currentTime) * 1000 - END_GUARD_MS;
      if (remainingMs < 40) remainingMs = 40;
      endTimer = window.setTimeout(function () {
        endTimer = 0;
        if (video.paused) return;
        var left = video.duration - video.currentTime;
        if (left > 0.5) {
          armEndTimer();
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
    }

    video.addEventListener('play', function () {
      lastActiveVideo = video;
      disableLoop(video);
      armEndTimer();
    });
    video.addEventListener('loadedmetadata', armEndTimer);
    video.addEventListener('seeked', function () {
      if (!video.paused) armEndTimer();
    });
    video.addEventListener('pause', clearEndTimer);
    video.addEventListener('ended', function () {
      clearEndTimer();
      goNext('ended', video);
    });

    // Detect soft-loop (seek back to start near end).
    var nearEnd = false;
    video.addEventListener('timeupdate', function () {
      if (!isFinite(video.duration) || video.duration < 1) return;
      var remaining = video.duration - video.currentTime;
      if (remaining <= 0.35 && remaining >= 0) {
        nearEnd = true;
        return;
      }
      if (nearEnd && video.currentTime < 0.45 && !video.paused) {
        nearEnd = false;
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

    if (!video.paused) {
      lastActiveVideo = video;
      armEndTimer();
    }
  }

  function scan() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) attachVideo(videos[i]);
  }

  function boot() {
    log('boot', location.href);
    scan();
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.setInterval(scan, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__xAutoNext = function () {
    goNext('manual', lastActiveVideo);
  };
  window.__xAutoNextProbe = function () {
    var report = {
      href: location.href,
      viewerNext: !!(findNextVideoButton() && findNextVideoButton().getAttribute('aria-label')),
      timelineVideos: listTimelineVideos().length,
      lastActive: !!(lastActiveVideo && lastActiveVideo.isConnected)
    };
    console.log('[X-AutoNext] probe', report);
    return report;
  };
})();
