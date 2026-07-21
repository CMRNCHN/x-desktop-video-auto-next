// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    http://tampermonkey.net/
// @version      1.3.1
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

  var DEBUG = true;
  var ADVANCE_COOLDOWN_MS = 2200;
  var END_GUARD_MS = 150;

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
    }, ADVANCE_COOLDOWN_MS);
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
      el.click();
      return true;
    } catch (err) {
      return false;
    }
  }

  function isUsableVideo(video) {
    if (!isVideoEl(video) || !video.isConnected) return false;
    var rect = video.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return false;
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

  function playVideo(video) {
    disableLoop(video);
    var box = containerFor(video);
    hardClick(video);
    var playBtn =
      box.querySelector('[data-testid="play"]') ||
      box.querySelector('[aria-label="Play"]') ||
      box.querySelector('[aria-label="Play video"]');
    if (playBtn) hardClick(playBtn);
    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (err) {
      // ignore
    }
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

    var box = containerFor(next);
    try {
      box.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (err2) {
      box.scrollIntoView(true);
    }

    window.setTimeout(function () {
      playVideo(next);
      lastActiveVideo = next;
    }, 400);
    window.setTimeout(function () {
      if (next.paused) playVideo(next);
    }, 900);
  }

  function scrollToNextTimelineVideo(fromVideo) {
    var videos = listTimelineVideos();
    var idx = fromVideo ? videos.indexOf(fromVideo) : -1;
    var next = null;

    if (idx >= 0 && idx < videos.length - 1) {
      next = videos[idx + 1];
    } else {
      var fromTop = fromVideo
        ? fromVideo.getBoundingClientRect().top + window.scrollY
        : window.scrollY;
      for (var i = 0; i < videos.length; i++) {
        var top = videos[i].getBoundingClientRect().top + window.scrollY;
        if (videos[i] !== fromVideo && top > fromTop + 80) {
          next = videos[i];
          break;
        }
      }
    }

    if (!next) {
      log('no next video in DOM — scrolling to load more');
      window.scrollBy(0, Math.max(window.innerHeight * 0.9, 700));
      window.setTimeout(function () {
        var again = listTimelineVideos();
        var fromIdx = fromVideo ? again.indexOf(fromVideo) : -1;
        var candidate =
          fromIdx >= 0 && fromIdx < again.length - 1 ? again[fromIdx + 1] : null;
        if (!candidate) {
          for (var j = 0; j < again.length; j++) {
            if (again[j] === fromVideo) continue;
            var t = again[j].getBoundingClientRect().top + window.scrollY;
            var ft = fromVideo
              ? fromVideo.getBoundingClientRect().top + window.scrollY
              : 0;
            if (t > ft + 80) {
              candidate = again[j];
              break;
            }
          }
        }
        if (candidate) activateTimelineVideo(candidate, fromVideo);
        else {
          log('still no next video after scroll');
          advancing = false;
        }
      }, 800);
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
    if (key && key === lastAdvanceFromSrc && now - lastAdvanceAt < ADVANCE_COOLDOWN_MS) {
      log('skip goNext (same clip)', reason);
      return;
    }

    advancing = true;
    lastAdvanceAt = now;
    lastAdvanceFromSrc = key;
    unlockAdvanceSoon();

    var viewerNext = findNextVideoButton();
    log('goNext', reason, {
      path: location.pathname,
      hasViewerNext: !!viewerNext,
      videos: listTimelineVideos().length
    });

    if (viewerNext && hardClick(viewerNext)) {
      log('clicked Next video');
      return;
    }

    scrollToNextTimelineVideo(source);
  }

  function armEndTimer(video) {
    clearEndTimer(video);
    if (!isFinite(video.duration) || video.duration <= 0.5) return;
    if (video.paused) return;

    var remainingMs = (video.duration - video.currentTime) * 1000 - END_GUARD_MS;
    if (remainingMs < 40) remainingMs = 40;

    var timer = window.setTimeout(function () {
      endTimers.delete(video);
      if (video.paused) return;
      if (visibilityScore(video) < 0.25 && video !== lastActiveVideo) return;
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
        t: video.currentTime,
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
      goNext('ended', video);
    });

    video.addEventListener('timeupdate', function () {
      if (!isFinite(video.duration) || video.duration < 1) return;
      if (video.paused) return;

      // HLS often skips a clean play event — treat timeupdate as proof of playback.
      if (video.currentTime > 0.05) markPlaying(video, 'timeupdate');

      var remaining = video.duration - video.currentTime;
      if (remaining <= 0.35 && remaining >= 0) {
        nearEnd = true;
        return;
      }
      if (nearEnd && video.currentTime < 0.45) {
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

    if (!video.paused) markPlaying(video, 'already-playing');
  }

  function scan() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) attachVideo(videos[i]);
  }

  // Catch players that start without firing play/playing reliably.
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

  function boot() {
    log('boot v1.3.1 — timeline scroll mode', location.href);
    scan();
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    window.setInterval(heartbeat, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function probe() {
    var vids = listTimelineVideos().map(function (v) {
      return {
        paused: v.paused,
        t: Math.round(v.currentTime * 10) / 10,
        d: isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null,
        vis: Math.round(visibilityScore(v) * 100)
      };
    });
    var report = {
      href: location.href,
      viewerNext: !!findNextVideoButton(),
      timelineVideos: vids.length,
      lastActive: !!(lastActiveVideo && lastActiveVideo.isConnected),
      advancing: advancing,
      vids: vids
    };
    console.log('[X-AutoNext] probe', report);
    return report;
  }

  window.__xAutoNext = function () {
    goNext('manual', lastActiveVideo);
  };
  window.__xAutoNextProbe = probe;
})();
