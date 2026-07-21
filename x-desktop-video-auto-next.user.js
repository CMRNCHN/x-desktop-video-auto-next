// ==UserScript==
// @name         X Desktop Video Auto Next
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Auto-advance to next X/Twitter video when current ends (disable loop)
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

  var ADVANCE_COOLDOWN_MS = 900;
  var NEAR_END_SECONDS = 0.4;
  var attached = new WeakSet();
  var advancing = false;
  var advanceUnlockTimer = 0;

  function isVideoContext() {
    var path = window.location.pathname;
    if (/\/status\/\d+(\/video\/\d+)?\/?$/.test(path)) return true;
    if (document.querySelector('[aria-label="Next video"]')) return true;
    return false;
  }

  function unlockAdvanceSoon() {
    window.clearTimeout(advanceUnlockTimer);
    advanceUnlockTimer = window.setTimeout(function () {
      advancing = false;
    }, ADVANCE_COOLDOWN_MS);
  }

  function goNext() {
    if (advancing || !isVideoContext()) return;
    advancing = true;
    unlockAdvanceSoon();

    var nextBtn = document.querySelector('[aria-label="Next video"]');
    if (nextBtn) {
      nextBtn.click();
      return;
    }

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true
      })
    );
  }

  function disableLoop(video) {
    try {
      video.loop = false;
      video.removeAttribute('loop');
    } catch (err) {
      // ignore
    }
  }

  function attachVideo(video) {
    if (attached.has(video)) return;
    attached.add(video);

    disableLoop(video);

    var nearEnd = false;

    video.addEventListener('play', function () {
      disableLoop(video);
      nearEnd = false;
    });

    video.addEventListener('ended', function () {
      goNext();
    });

    // X often restarts the same clip (loop) without a reliable ended event.
    video.addEventListener('timeupdate', function () {
      if (!isVideoContext()) return;
      if (!video.duration || !Number.isFinite(video.duration) || video.duration < 1) return;

      var remaining = video.duration - video.currentTime;
      if (remaining <= NEAR_END_SECONDS && remaining >= 0) {
        nearEnd = true;
        return;
      }

      if (nearEnd && video.currentTime < 0.6) {
        nearEnd = false;
        disableLoop(video);
        goNext();
        return;
      }

      if (remaining > 1.25) {
        nearEnd = false;
      }
    });
  }

  function scan() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      attachVideo(videos[i]);
    }
  }

  var observer = new MutationObserver(function () {
    scan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(function () {
    if (!isVideoContext()) return;
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      disableLoop(videos[i]);
    }
  }, 1500);

  scan();
})();
