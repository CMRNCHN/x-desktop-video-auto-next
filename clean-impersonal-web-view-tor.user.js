// ==UserScript==
// @name        Clean Impersonal Web View (Tor)
// @namespace   https://github.com/CMRNCHN/x-desktop-video-auto-next
// @version     1.7.0
// @description Tor-safe impersonal restyle: no external fonts/images, offline SVG placeholders, onion-friendly. Use Violentmonkey in Tor Browser.
// @author      Senior Engineer
// @match       http://*/*
// @match       https://*/*
// @match       *://*.onion/*
// @updateURL   https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/clean-impersonal-web-view-tor.user.js
// @downloadURL https://raw.githubusercontent.com/CMRNCHN/x-desktop-video-auto-next/main/clean-impersonal-web-view-tor.user.js
// @homepageURL https://github.com/CMRNCHN/x-desktop-video-auto-next
// @run-at      document-start
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    // Tor notes:
    // - No Google Fonts / Unsplash / any third-party fetches
    // - Media replaced with inline data: SVG only
    // - Prefs in sessionStorage (cleared with the tab; avoids durable disk writes)
    // - System fonts only (matches Tor Browser fingerprint better than webfonts)

    const STYLE_ID = 'impersonal-tor-theme-styles';
    const MARK = 'data-impersonal-media';
    const NUM_CLASS = 'impersonal-num';
    const PANEL_ID = 'impersonal-tor-controls';
    const STORAGE_KEY = 'impersonal-tor-view-settings-v1';

    const BASE_TEXT = '#5c5954';
    const BASE_MUTED = '#8a8580';
    const BASE_NUM = '#b45309';
    const BASE_ACCENT = '#7a8580';

    const DEFAULTS = {
        siteBrightness: 100,
        siteContrast: 100,
        fontBrightness: 100,
        fontContrast: 100,
    };

    let settings = loadSettings();
    let TEXT = BASE_TEXT;
    let NUM = BASE_NUM;

    const PLACEHOLDER_PALETTES = [
        ['#d9d5cf', '#c4bfb7', '#a8a39b'],
        ['#d5d8d4', '#b7beb8', '#949e96'],
        ['#d7d2cc', '#bfb6ad', '#9b9289'],
        ['#d2d6d8', '#b3bbc0', '#8e989f'],
        ['#d8d4d0', '#c0b8b2', '#9a918a'],
        ['#d4d7d2', '#b5bdb6', '#8f9891'],
        ['#d6d3ce', '#bbb4ac', '#968f87'],
        ['#d3d5d7', '#b4b9be', '#8d949a'],
    ];

    function svgDataUri(svg) {
        return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    function makePlaceholder(w, h, key, kind) {
        const width = Math.min(1600, Math.max(40, Math.round(w) || 800));
        const height = Math.min(1200, Math.max(40, Math.round(h) || 500));
        const palette = pick(PLACEHOLDER_PALETTES, String(key) + kind);
        const seed = hashString(String(key) + kind + width + 'x' + height);

        if (kind === 'avatar') {
            const r = Math.min(width, height) / 2;
            return svgDataUri(
                '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                    width +
                    '" height="' +
                    height +
                    '" viewBox="0 0 ' +
                    width +
                    ' ' +
                    height +
                    '">' +
                    '<rect width="100%" height="100%" fill="' +
                    palette[0] +
                    '"/>' +
                    '<circle cx="' +
                    width / 2 +
                    '" cy="' +
                    height * 0.38 +
                    '" r="' +
                    r * 0.28 +
                    '" fill="' +
                    palette[1] +
                    '"/>' +
                    '<ellipse cx="' +
                    width / 2 +
                    '" cy="' +
                    height * 0.78 +
                    '" rx="' +
                    r * 0.42 +
                    '" ry="' +
                    r * 0.3 +
                    '" fill="' +
                    palette[2] +
                    '"/>' +
                    '</svg>'
            );
        }

        const x1 = (seed % 40) + 10;
        const y1 = ((seed >> 3) % 35) + 10;
        const x2 = ((seed >> 6) % 45) + 40;
        const y2 = ((seed >> 9) % 40) + 35;
        return svgDataUri(
            '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                width +
                '" height="' +
                height +
                '" viewBox="0 0 ' +
                width +
                ' ' +
                height +
                '">' +
                '<rect width="100%" height="100%" fill="' +
                palette[0] +
                '"/>' +
                '<rect x="' +
                (width * x1) / 100 +
                '" y="' +
                (height * y1) / 100 +
                '" width="' +
                width * 0.42 +
                '" height="' +
                height * 0.34 +
                '" rx="12" fill="' +
                palette[1] +
                '" opacity="0.9"/>' +
                '<rect x="' +
                (width * x2) / 100 +
                '" y="' +
                (height * y2) / 100 +
                '" width="' +
                width * 0.28 +
                '" height="' +
                height * 0.4 +
                '" rx="10" fill="' +
                palette[2] +
                '" opacity="0.85"/>' +
                '</svg>'
        );
    }

    const GENERIC_LOGO = svgDataUri(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40" fill="none">' +
            '<rect width="160" height="40" rx="8" fill="#E4E1DC"/>' +
            '<rect x="10" y="10" width="20" height="20" rx="6" fill="#9AA3A0"/>' +
            '<rect x="40" y="14" width="72" height="12" rx="4" fill="#B0AAA3"/>' +
            '</svg>'
    );

    const LOGO_SELECTORS = [
        '[class*="logo" i]',
        '[id*="logo" i]',
        '[aria-label*="logo" i]',
        '[alt*="logo" i]',
        '[class*="brand" i]',
        '[id*="brand" i]',
        '[class*="wordmark" i]',
        '[class*="site-title" i]',
        'a[href="/"] img',
        'a[href="/"] svg',
        'header > a > img',
        'header > a > svg',
        '[role="banner"] > a > img',
        '[role="banner"] > a > svg',
    ].join(', ');

    const AVATAR_SELECTORS = [
        '[class*="avatar" i]',
        '[class*="profile-pic" i]',
        '[class*="profilePic" i]',
        '[class*="user-image" i]',
        '[class*="userImage" i]',
        'img[alt*="avatar" i]',
        'img[alt*="profile" i]',
    ].join(', ');

    function hashString(str) {
        let h = 2166136261;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function pick(list, key) {
        return list[hashString(key) % list.length];
    }

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function storage() {
        try {
            return window.sessionStorage;
        } catch (err) {
            return null;
        }
    }

    function loadSettings() {
        try {
            const store = storage();
            const raw = store && store.getItem(STORAGE_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            const parsed = JSON.parse(raw);
            return {
                siteBrightness: clamp(Number(parsed.siteBrightness) || DEFAULTS.siteBrightness, 50, 150),
                siteContrast: clamp(Number(parsed.siteContrast) || DEFAULTS.siteContrast, 50, 150),
                fontBrightness: clamp(Number(parsed.fontBrightness) || DEFAULTS.fontBrightness, 50, 150),
                fontContrast: clamp(Number(parsed.fontContrast) || DEFAULTS.fontContrast, 50, 150),
            };
        } catch (err) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function saveSettings() {
        try {
            const store = storage();
            if (store) store.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (err) {
            // private mode / blocked storage
        }
    }

    function hexToRgb(hex) {
        const h = String(hex).replace('#', '');
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }

    function rgbToHex(r, g, b) {
        return (
            '#' +
            [r, g, b]
                .map(function (v) {
                    return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
                })
                .join('')
        );
    }

    function adjustTone(hex, brightnessPct, contrastPct) {
        const rgb = hexToRgb(hex);
        const br = brightnessPct / 100;
        let r = rgb.r * br;
        let g = rgb.g * br;
        let b = rgb.b * br;
        const mid = 128;
        const c = contrastPct / 100;
        r = mid + (r - mid) * c;
        g = mid + (g - mid) * c;
        b = mid + (b - mid) * c;
        return rgbToHex(r, g, b);
    }

    function deriveFontColors() {
        // Higher font brightness => darker ink on the light page (easier to read)
        const inkBrightness = clamp(200 - settings.fontBrightness, 50, 150);
        TEXT = adjustTone(BASE_TEXT, inkBrightness, settings.fontContrast);
        NUM = adjustTone(BASE_NUM, inkBrightness, settings.fontContrast);
        return {
            text: TEXT,
            muted: adjustTone(BASE_MUTED, inkBrightness, settings.fontContrast),
            num: NUM,
            accent: adjustTone(BASE_ACCENT, inkBrightness, settings.fontContrast),
        };
    }

    function applyVisualSettings() {
        const colors = deriveFontColors();
        const root = document.documentElement;
        if (!root) return;

        const inkBrightness = clamp(200 - settings.fontBrightness, 50, 150);
        root.style.setProperty('--text', colors.text, 'important');
        root.style.setProperty('--text-muted', colors.muted, 'important');
        root.style.setProperty('--num', colors.num, 'important');
        root.style.setProperty('--accent', colors.accent, 'important');
        root.style.setProperty('--accent-hover', adjustTone(BASE_ACCENT, inkBrightness * 0.9, settings.fontContrast), 'important');

        if (document.body) {
            const b = (settings.siteBrightness / 100).toFixed(3);
            const c = (settings.siteContrast / 100).toFixed(3);
            document.body.style.setProperty('filter', 'brightness(' + b + ') contrast(' + c + ')', 'important');
        }
    }

    function injectStyles() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            if (!document.documentElement) return;
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }

        const colors = deriveFontColors();
        const inkBrightness = clamp(200 - settings.fontBrightness, 50, 150);

        style.textContent = [
            ':root {',
            '  --bg: #e8e5e0 !important;',
            '  --surface: #f0eeea !important;',
            '  --surface-muted: #e2dfd9 !important;',
            '  --text: ' + colors.text + ' !important;',
            '  --text-muted: ' + colors.muted + ' !important;',
            '  --num: ' + colors.num + ' !important;',
            '  --border: #d2cec7 !important;',
            '  --accent: ' + colors.accent + ' !important;',
            '  --accent-hover: ' + adjustTone(BASE_ACCENT, inkBrightness * 0.9, settings.fontContrast) + ' !important;',
            '  --accent-soft: #d8ddd9 !important;',
            '  --shadow: none !important;',
            '  --radius: 10px !important;',
            '  --radius-sm: 6px !important;',
            '  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Liberation Sans", FreeSans, sans-serif !important;',
            '  --font-mono: ui-monospace, "Liberation Mono", FreeMono, monospace !important;',
            '}',
            'html {',
            '  background: var(--bg) !important;',
            '}',
            'html, body {',
            '  background: var(--bg) !important;',
            '  background-image: none !important;',
            '  color: var(--text) !important;',
            '  font-family: var(--font) !important;',
            '  line-height: 1.55 !important;',
            '  -webkit-font-smoothing: antialiased !important;',
            '}',
            'body, body *, body *::before, body *::after {',
            '  font-family: inherit !important;',
            '  color: var(--text) !important;',
            '  text-shadow: none !important;',
            '  caret-color: var(--text) !important;',
            '  scrollbar-color: #b0aaa3 var(--surface-muted) !important;',
            '}',
            'body div, body section, body article, body main, body header, body footer, body aside, body nav,',
            'body ul, body ol, body li, body p, body span, body label, body td, body th, body small, body strong, body em, body b, body i,',
            'body h1, body h2, body h3, body h4, body h5, body h6, body figcaption, body blockquote, body time, body cite {',
            '  color: var(--text) !important;',
            '  background-image: none !important;',
            '}',
            'body h1, body h2, body h3, body h4, body h5, body h6 {',
            '  font-family: var(--font) !important;',
            '  font-weight: 600 !important;',
            '  letter-spacing: -0.01em !important;',
            '  line-height: 1.3 !important;',
            '  color: var(--text) !important;',
            '}',
            'body .' + NUM_CLASS + ',',
            'body .' + NUM_CLASS + ' * {',
            '  color: var(--num) !important;',
            '  font-weight: 800 !important;',
            '  font-size: 1.08em !important;',
            '  font-variant-numeric: tabular-nums !important;',
            '  letter-spacing: 0.01em !important;',
            '}',
            'body .' + NUM_CLASS + '.impersonal-cc {',
            '  letter-spacing: 0.04em !important;',
            '  white-space: nowrap !important;',
            '  font-size: 1.12em !important;',
            '  font-weight: 800 !important;',
            '}',
            'body header, body footer, body nav, body [role="banner"], body [role="navigation"],',
            'body [class*="header" i], body [id*="header" i],',
            'body [class*="nav" i], body [id*="nav" i],',
            'body [class*="toolbar" i], body [class*="sidebar" i], body [class*="aside" i] {',
            '  background-color: var(--surface) !important;',
            '  background-image: none !important;',
            '  border-color: var(--border) !important;',
            '  box-shadow: none !important;',
            '  color: var(--text) !important;',
            '}',
            'body main, body article, body [role="main"],',
            'body [class*="card" i], body [class*="panel" i], body [class*="modal" i],',
            'body [class*="dialog" i], body [class*="popover" i], body [class*="dropdown" i] {',
            '  background-color: var(--surface) !important;',
            '  border-color: var(--border) !important;',
            '  border-radius: var(--radius) !important;',
            '  box-shadow: none !important;',
            '  color: var(--text) !important;',
            '}',
            'body [style*="gradient"],',
            'body [class*="gradient" i],',
            'body [class*="glow" i],',
            'body [class*="neon" i] {',
            '  background-image: none !important;',
            '  box-shadow: none !important;',
            '  filter: none !important;',
            '}',
            'body img, body picture, body video, body canvas, body embed, body object, body iframe {',
            '  opacity: 0.78 !important;',
            '  visibility: visible !important;',
            '  filter: saturate(0.4) brightness(0.94) contrast(0.92) !important;',
            '  border-radius: var(--radius-sm) !important;',
            '  object-fit: cover !important;',
            '}',
            'body img[' + MARK + '], body video[' + MARK + '] {',
            '  background: var(--surface-muted) !important;',
            '}',
            LOGO_SELECTORS.split(', ').map(function (s) { return 'body ' + s; }).join(', ') + ' {',
            '  opacity: 0.7 !important;',
            '  visibility: visible !important;',
            '  filter: saturate(0.2) brightness(0.95) !important;',
            '}',
            'body svg { color: var(--text-muted) !important; fill: currentColor; }',
            'body [class*="promo" i],',
            'body [class*="advert" i],',
            'body [class*="sponsor" i],',
            'body [class*="mascot" i],',
            'body [class*="confetti" i],',
            'body [id*="cookie" i],',
            'body [class*="cookie" i],',
            'body [class*="consent" i] {',
            '  opacity: 0 !important;',
            '  visibility: hidden !important;',
            '  pointer-events: none !important;',
            '  max-height: 0 !important;',
            '  overflow: hidden !important;',
            '}',
            'body a {',
            '  color: var(--accent) !important;',
            '  text-decoration: none !important;',
            '  font-weight: 500 !important;',
            '  background-image: none !important;',
            '}',
            'body a:hover {',
            '  color: var(--accent-hover) !important;',
            '  text-decoration: underline !important;',
            '}',
            'body nav a, body header a, body [role="navigation"] a {',
            '  color: var(--text) !important;',
            '  font-weight: 500 !important;',
            '  text-decoration: none !important;',
            '  padding: 6px 10px !important;',
            '  border-radius: 6px !important;',
            '}',
            'body nav a:hover, body header a:hover, body [role="navigation"] a:hover {',
            '  background-color: var(--surface-muted) !important;',
            '  color: var(--text) !important;',
            '  text-decoration: none !important;',
            '}',
            'body button,',
            'body input[type="button"],',
            'body input[type="submit"],',
            'body input[type="reset"],',
            'body [role="button"],',
            'body [class*="btn" i],',
            'body [class*="button" i] {',
            '  background: var(--surface-muted) !important;',
            '  color: var(--text) !important;',
            '  border: 1px solid var(--border) !important;',
            '  border-radius: 6px !important;',
            '  font-weight: 500 !important;',
            '  font-family: var(--font) !important;',
            '  box-shadow: none !important;',
            '}',
            'body button:hover,',
            'body input[type="button"]:hover,',
            'body input[type="submit"]:hover,',
            'body [role="button"]:hover,',
            'body [class*="btn" i]:hover {',
            '  background: var(--border) !important;',
            '  border-color: var(--text-muted) !important;',
            '  color: var(--text) !important;',
            '}',
            'body button *, body [role="button"] *, body [class*="btn" i] *, body [class*="button" i] * {',
            '  color: var(--text) !important;',
            '}',
            'body input, body textarea, body select {',
            '  background: var(--surface) !important;',
            '  color: var(--text) !important;',
            '  border: 1px solid var(--border) !important;',
            '  border-radius: var(--radius-sm) !important;',
            '  font-family: var(--font) !important;',
            '  box-shadow: none !important;',
            '  padding: 8px 12px !important;',
            '}',
            'body input:focus, body textarea:focus, body select:focus {',
            '  border-color: var(--accent) !important;',
            '  outline: 2px solid var(--accent-soft) !important;',
            '  box-shadow: none !important;',
            '}',
            'body ::placeholder { color: var(--text-muted) !important; opacity: 1 !important; }',
            'body .impersonal-table-shell {',
            '  display: flex !important;',
            '  flex-direction: column !important;',
            '  align-items: stretch !important;',
            '  justify-content: flex-start !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  min-height: 0 !important;',
            '  margin: 8px 0 12px !important;',
            '  padding: 0 !important;',
            '  box-sizing: border-box !important;',
            '  position: relative !important;',
            '  left: auto !important;',
            '  transform: none !important;',
            '}',
            'body .impersonal-bin-filter,',
            'body .impersonal-table-filters {',
            '  display: flex !important;',
            '  flex-wrap: wrap !important;',
            '  align-items: flex-end !important;',
            '  justify-content: flex-start !important;',
            '  gap: 8px 10px !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  margin: 0 0 8px !important;',
            '  padding: 8px 10px !important;',
            '  border: 1px solid #bdb7ae !important;',
            '  border-radius: 8px !important;',
            '  background: #ebe7e1 !important;',
            '  color: var(--text) !important;',
            '  font-size: 13px !important;',
            '  font-weight: 700 !important;',
            '  box-sizing: border-box !important;',
            '}',
            'body .impersonal-table-filters .imp-filter-group {',
            '  display: flex !important;',
            '  flex-direction: column !important;',
            '  gap: 3px !important;',
            '  min-width: 110px !important;',
            '  flex: 1 1 110px !important;',
            '  max-width: 180px !important;',
            '}',
            'body .impersonal-bin-filter label,',
            'body .impersonal-table-filters label {',
            '  font-weight: 800 !important;',
            '  color: var(--text) !important;',
            '  margin: 0 !important;',
            '  font-size: 11px !important;',
            '  text-transform: uppercase !important;',
            '  letter-spacing: 0.03em !important;',
            '}',
            'body .impersonal-bin-filter input[type="search"],',
            'body .impersonal-bin-filter textarea.imp-bin-search,',
            'body .impersonal-bin-filter select,',
            'body .impersonal-table-filters textarea,',
            'body .impersonal-table-filters select {',
            '  min-width: 0 !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  padding: 5px 8px !important;',
            '  border: 1px solid #a8a297 !important;',
            '  border-radius: 5px !important;',
            '  background: #f7f5f1 !important;',
            '  color: var(--text) !important;',
            '  font-size: 13px !important;',
            '  font-weight: 700 !important;',
            '  box-sizing: border-box !important;',
            '}',
            'body .impersonal-bin-filter select[multiple],',
            'body .impersonal-table-filters select[multiple] {',
            '  min-height: 72px !important;',
            '}',
            'body .impersonal-bin-filter textarea.imp-bin-search,',
            'body .impersonal-table-filters textarea {',
            '  min-height: 72px !important;',
            '  resize: vertical !important;',
            '  font-family: var(--font-mono) !important;',
            '  line-height: 1.3 !important;',
            '}',
            'body .impersonal-bin-filter button,',
            'body .impersonal-table-filters button {',
            '  padding: 6px 10px !important;',
            '  border: 1px solid #a8a297 !important;',
            '  border-radius: 5px !important;',
            '  background: #d8d3cb !important;',
            '  color: var(--text) !important;',
            '  font-size: 13px !important;',
            '  font-weight: 800 !important;',
            '  cursor: pointer !important;',
            '  align-self: flex-end !important;',
            '  white-space: nowrap !important;',
            '}',
            'body .impersonal-bin-filter .imp-bin-count,',
            'body .impersonal-table-filters .imp-filter-count {',
            '  color: var(--text-muted) !important;',
            '  font-size: 12px !important;',
            '  font-weight: 700 !important;',
            '  align-self: center !important;',
            '}',
            'body .dataTables_filter,',
            'body .dataTables_length,',
            'body .dt-search,',
            'body .dt-length,',
            'body [data-impersonal-native-filter-hidden="1"] {',
            '  display: none !important;',
            '  visibility: hidden !important;',
            '  height: 0 !important;',
            '  max-height: 0 !important;',
            '  overflow: hidden !important;',
            '  margin: 0 !important;',
            '  padding: 0 !important;',
            '}',
            'body .impersonal-table-wrap {',
            '  display: block !important;',
            '  width: 100% !important;',
            '  max-width: 100% !important;',
            '  overflow-x: auto !important;',
            '  overflow-y: visible !important;',
            '  -webkit-overflow-scrolling: touch !important;',
            '  margin: 0 !important;',
            '  padding: 0 !important;',
            '  border: 1px solid #9f978c !important;',
            '  border-radius: 8px !important;',
            '  background: #f7f5f1 !important;',
            '  box-shadow: none !important;',
            '  box-sizing: border-box !important;',
            '}',
            'body .impersonal-table-shell table,',
            'body .impersonal-table-wrap table,',
            'body table {',
            '  border-collapse: collapse !important;',
            '  border-spacing: 0 !important;',
            '  width: 100% !important;',
            '  min-width: 100% !important;',
            '  max-width: none !important;',
            '  table-layout: auto !important;',
            '  margin: 0 !important;',
            '}',
            'body th, body td {',
            '  border: 1px solid #a59e94 !important;',
            '  padding: 6px 8px !important;',
            '  color: var(--text) !important;',
            '  vertical-align: middle !important;',
            '  white-space: normal !important;',
            '  word-break: break-word !important;',
            '  overflow-wrap: anywhere !important;',
            '  hyphens: auto !important;',
            '  width: auto !important;',
            '  min-width: 0 !important;',
            '  max-width: 18rem !important;',
            '  font-size: clamp(15px, 0.55vw + 13px, 20px) !important;',
            '  font-weight: 800 !important;',
            '  line-height: 1.25 !important;',
            '  overflow: visible !important;',
            '}',
            'body td .badge,',
            'body td [class*="badge" i],',
            'body td span.bg-info,',
            'body td span[class*="bg-opacity" i],',
            'body td span.fs-11px,',
            'body td span.text-info {',
            '  display: inline-block !important;',
            '  max-width: none !important;',
            '  width: auto !important;',
            '  box-sizing: border-box !important;',
            '  white-space: nowrap !important;',
            '  overflow-wrap: normal !important;',
            '  word-break: normal !important;',
            '  font-size: clamp(12px, 0.4vw + 11px, 15px) !important;',
            '  font-weight: 800 !important;',
            '  line-height: 1.15 !important;',
            '  padding: 3px 6px !important;',
            '  margin: 0 !important;',
            '  vertical-align: middle !important;',
            '  border-width: 1px !important;',
            '}',
            'body td[data-impersonal-type-col="1"],',
            'body th[data-impersonal-type-col="1"] {',
            '  min-width: 0 !important;',
            '  max-width: 9rem !important;',
            '  width: auto !important;',
            '  text-align: center !important;',
            '  padding: 5px 6px !important;',
            '  white-space: nowrap !important;',
            '}',
            'body th {',
            '  background: #d2ccc3 !important;',
            '  font-size: clamp(13px, 0.45vw + 11px, 16px) !important;',
            '  font-weight: 800 !important;',
            '  letter-spacing: 0.02em !important;',
            '  text-transform: uppercase !important;',
            '  position: sticky !important;',
            '  top: 0 !important;',
            '  z-index: 2 !important;',
            '  border-bottom: 2px solid #8f877c !important;',
            '  white-space: nowrap !important;',
            '  max-width: none !important;',
            '}',
            'body tbody tr:nth-child(odd) td { background: #f7f5f1 !important; }',
            'body tbody tr:nth-child(even) td { background: #ebe6de !important; }',
            'body tbody tr:hover td { background: #ddd6cb !important; }',
            'body td:nth-child(even) { box-shadow: none !important; }',
            'body caption { caption-side: top !important; text-align: left !important; padding: 4px 6px !important; color: var(--text-muted) !important; font-weight: 700 !important; font-size: 13px !important; }',
            'body tr[data-impersonal-bin-hidden="1"],',
            'body tr[data-impersonal-colfilter-hidden="1"],',
            'body tr[data-impersonal-complete-hidden="1"] { display: none !important; }',
            'body tr[data-impersonal-complete="1"]:not([data-impersonal-bin-hidden="1"]):not([data-impersonal-colfilter-hidden="1"]) td {',
            '  background: #c8ecd0 !important;',
            '  border-color: #7fb88a !important;',
            '}',
            'body tr[data-impersonal-complete="1"]:not([data-impersonal-bin-hidden="1"]):not([data-impersonal-colfilter-hidden="1"]):hover td {',
            '  background: #b6e3c0 !important;',
            '}',
            'body td .' + NUM_CLASS + ',',
            'body th .' + NUM_CLASS + ',',
            'body td .' + NUM_CLASS + ' *,',
            'body th .' + NUM_CLASS + ' * {',
            '  font-size: 1.06em !important;',
            '  font-weight: 800 !important;',
            '  white-space: nowrap !important;',
            '}',
            'body code, body pre, body kbd, body samp {',
            '  font-family: var(--font-mono) !important;',
            '  background: var(--surface-muted) !important;',
            '  color: var(--text) !important;',
            '  border: 1px solid var(--border) !important;',
            '  border-radius: 6px !important;',
            '}',
            'body blockquote {',
            '  border-left: 3px solid var(--border) !important;',
            '  background: var(--surface-muted) !important;',
            '  color: var(--text-muted) !important;',
            '  padding: 12px 16px !important;',
            '  margin: 16px 0 !important;',
            '  border-radius: 0 var(--radius-sm) var(--radius-sm) 0 !important;',
            '}',
            'body ::selection { background: var(--accent-soft) !important; color: var(--text) !important; }',
            '#' + PANEL_ID + ' {',
            '  all: initial;',
            '  position: fixed !important;',
            '  right: 16px !important;',
            '  bottom: 16px !important;',
            '  z-index: 2147483646 !important;',
            '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Liberation Sans", FreeSans, sans-serif !important;',
            '  color: #5c5954 !important;',
            '}',
            '#' + PANEL_ID + ' * {',
            '  box-sizing: border-box !important;',
            '  font-family: inherit !important;',
            '  color: inherit !important;',
            '}',
            '#' + PANEL_ID + ' .imp-toggle {',
            '  display: inline-flex !important;',
            '  align-items: center !important;',
            '  justify-content: center !important;',
            '  width: 40px !important;',
            '  height: 40px !important;',
            '  border-radius: 999px !important;',
            '  border: 1px solid #d2cec7 !important;',
            '  background: #f0eeea !important;',
            '  color: #5c5954 !important;',
            '  cursor: pointer !important;',
            '  box-shadow: 0 8px 24px rgba(40, 36, 30, 0.12) !important;',
            '  font-size: 13px !important;',
            '  font-weight: 600 !important;',
            '}',
            '#' + PANEL_ID + ' .imp-panel {',
            '  display: none !important;',
            '  width: 240px !important;',
            '  margin-bottom: 10px !important;',
            '  padding: 14px !important;',
            '  border-radius: 12px !important;',
            '  border: 1px solid #d2cec7 !important;',
            '  background: #f0eeea !important;',
            '  box-shadow: 0 12px 32px rgba(40, 36, 30, 0.14) !important;',
            '}',
            '#' + PANEL_ID + '.imp-open .imp-panel { display: block !important; }',
            '#' + PANEL_ID + ' .imp-title {',
            '  font-size: 12px !important;',
            '  font-weight: 650 !important;',
            '  letter-spacing: 0.04em !important;',
            '  text-transform: uppercase !important;',
            '  color: #8a8580 !important;',
            '  margin: 0 0 12px !important;',
            '}',
            '#' + PANEL_ID + ' .imp-row {',
            '  display: grid !important;',
            '  grid-template-columns: 1fr auto !important;',
            '  gap: 4px 8px !important;',
            '  align-items: center !important;',
            '  margin: 0 0 10px !important;',
            '}',
            '#' + PANEL_ID + ' .imp-row label {',
            '  font-size: 12px !important;',
            '  color: #5c5954 !important;',
            '}',
            '#' + PANEL_ID + ' .imp-row output {',
            '  font-size: 11px !important;',
            '  color: #8a8580 !important;',
            '  font-variant-numeric: tabular-nums !important;',
            '}',
            '#' + PANEL_ID + ' .imp-row input[type="range"] {',
            '  grid-column: 1 / -1 !important;',
            '  width: 100% !important;',
            '  margin: 0 !important;',
            '  accent-color: #7a8580 !important;',
            '}',
            '#' + PANEL_ID + ' .imp-actions {',
            '  display: flex !important;',
            '  justify-content: flex-end !important;',
            '  margin-top: 4px !important;',
            '}',
            '#' + PANEL_ID + ' .imp-reset {',
            '  border: 1px solid #d2cec7 !important;',
            '  background: #e2dfd9 !important;',
            '  color: #5c5954 !important;',
            '  border-radius: 6px !important;',
            '  padding: 6px 10px !important;',
            '  font-size: 12px !important;',
            '  cursor: pointer !important;',
            '}',
        ].join('\n');
    }

    function ensureSettingsPanel() {
        if (!document.documentElement) return;
        let root = document.getElementById(PANEL_ID);
        if (root) {
            syncPanelInputs(root);
            return;
        }

        root = document.createElement('div');
        root.id = PANEL_ID;
        root.setAttribute(MARK, 'ui');

        const panel = document.createElement('div');
        panel.className = 'imp-panel';
        panel.innerHTML = [
            '<p class="imp-title">Display (Tor)</p>',
            sliderHtml('siteBrightness', 'Site brightness'),
            sliderHtml('siteContrast', 'Site contrast'),
            sliderHtml('fontBrightness', 'Font brightness'),
            sliderHtml('fontContrast', 'Font contrast'),
            '<div class="imp-actions"><button type="button" class="imp-reset">Reset</button></div>',
        ].join('');

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'imp-toggle';
        toggle.setAttribute('aria-label', 'Display settings');
        toggle.textContent = 'Aa';

        root.appendChild(panel);
        root.appendChild(toggle);
        document.documentElement.appendChild(root);

        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            root.classList.toggle('imp-open');
        });

        panel.addEventListener('input', function (e) {
            const t = e.target;
            if (!t || t.tagName !== 'INPUT' || t.type !== 'range') return;
            const key = t.getAttribute('data-key');
            if (!key || !(key in settings)) return;
            settings[key] = clamp(Number(t.value), 50, 150);
            const out = t.parentElement && t.parentElement.querySelector('output');
            if (out) out.textContent = String(settings[key]);
            saveSettings();
            applyVisualSettings();
            blankInlineBrandStyles(document);
        });

        panel.querySelector('.imp-reset').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            settings = Object.assign({}, DEFAULTS);
            saveSettings();
            syncPanelInputs(root);
            applyVisualSettings();
            blankInlineBrandStyles(document);
        });

        syncPanelInputs(root);
    }

    function sliderHtml(key, label) {
        const val = settings[key];
        return [
            '<div class="imp-row">',
            '<label for="imp-' + key + '">' + label + '</label>',
            '<output for="imp-' + key + '">' + val + '</output>',
            '<input id="imp-' + key + '" data-key="' + key + '" type="range" min="50" max="150" step="1" value="' + val + '" />',
            '</div>',
        ].join('');
    }

    function syncPanelInputs(root) {
        if (!root) return;
        Object.keys(DEFAULTS).forEach(function (key) {
            const input = root.querySelector('input[data-key="' + key + '"]');
            if (!input) return;
            input.value = String(settings[key]);
            const out = input.parentElement && input.parentElement.querySelector('output');
            if (out) out.textContent = String(settings[key]);
        });
    }

    function isOurUrl(url) {
        if (!url) return false;
        return String(url).indexOf('data:image/svg+xml') === 0 || String(url).indexOf('data:image/svg+xml') !== -1;
    }

    function looksLikeAvatar(el) {
        if (!el || el.nodeType !== 1) return false;
        try {
            if (el.matches && el.matches(AVATAR_SELECTORS)) return true;
            if (el.closest && el.closest(AVATAR_SELECTORS)) return true;
        } catch (err) {
            // older browsers / invalid selector edge cases
        }
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (rect && rect.width > 0 && rect.width <= 96 && rect.height > 0 && rect.height <= 96) {
            const ratio = rect.width / rect.height;
            if (ratio > 0.75 && ratio < 1.35) return true;
        }
        return false;
    }

    function looksLikeLogo(el) {
        if (!el || el.nodeType !== 1) return false;
        try {
            if (el.matches && el.matches(LOGO_SELECTORS)) return true;
            if (el.closest && el.closest(LOGO_SELECTORS)) return true;
        } catch (err) {
            // ignore
        }
        const alt = (el.getAttribute && (el.getAttribute('alt') || el.getAttribute('aria-label'))) || '';
        if (/logo|brand|wordmark/i.test(alt)) return true;
        return false;
    }

    function looksLikeHero(el) {
        if (!el || !el.getBoundingClientRect) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 480 && rect.height >= 180;
    }

    function sizeFor(el, fallbackW, fallbackH) {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        const w = Math.max(40, Math.round((rect && rect.width) || fallbackW || 800));
        const h = Math.max(40, Math.round((rect && rect.height) || fallbackH || 500));
        return { w, h };
    }

    function chooseReplacement(el, kind) {
        const key = el.currentSrc || el.src || el.getAttribute('src') || el.outerHTML || 'x';
        if (kind === 'logo') return GENERIC_LOGO;
        if (kind === 'avatar') {
            const size = sizeFor(el, 96, 96);
            return makePlaceholder(size.w, size.h, key, 'avatar');
        }
        if (kind === 'hero') {
            const size = sizeFor(el, 1400, 700);
            return makePlaceholder(size.w, size.h, key, 'hero');
        }
        const size = sizeFor(el, 1000, 640);
        return makePlaceholder(size.w, size.h, key, 'photo');
    }

    function replaceImage(img) {
        if (!img || img.tagName !== 'IMG') return;
        if (img.getAttribute(MARK) === 'done') {
            // SPA may have mutated src back — re-assert
            const desired = img.getAttribute('data-impersonal-src');
            if (desired && img.src && !isOurUrl(img.src) && img.src !== desired) {
                img.src = desired;
                img.removeAttribute('srcset');
            }
            return;
        }

        let kind = 'photo';
        if (looksLikeLogo(img)) kind = 'logo';
        else if (looksLikeAvatar(img)) kind = 'avatar';
        else if (looksLikeHero(img)) kind = 'hero';

        const next = chooseReplacement(img, kind);
        img.setAttribute(MARK, 'done');
        img.setAttribute('data-impersonal-src', next);
        img.removeAttribute('srcset');
        img.sizes = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = next;
        if (kind === 'avatar') {
            img.style.borderRadius = '999px';
            img.style.objectFit = 'cover';
        }
    }

    function replacePicture(picture) {
        if (!picture || picture.tagName !== 'PICTURE') return;
        if (picture.getAttribute(MARK) === 'done') return;
        picture.setAttribute(MARK, 'done');
        picture.querySelectorAll('source').forEach((s) => s.remove());
        const img = picture.querySelector('img');
        if (img) replaceImage(img);
    }

    function replaceVideo(video) {
        if (!video || video.tagName !== 'VIDEO') return;
        if (video.getAttribute(MARK) === 'done') return;
        const key = video.currentSrc || video.poster || video.outerHTML || 'video';
        const size = sizeFor(video, 1280, 720);
        const poster = makePlaceholder(size.w, size.h, key, 'video');
        video.setAttribute(MARK, 'done');
        video.poster = poster;
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach((s) => s.remove());
        try {
            video.load();
        } catch (err) {
            // ignore
        }
    }

    function replaceSvgLogo(svg) {
        if (!svg || svg.tagName !== 'SVG') return;
        if (svg.getAttribute(MARK) === 'done') return;
        if (!looksLikeLogo(svg)) return;
        svg.setAttribute(MARK, 'done');
        const img = document.createElement('img');
        img.src = GENERIC_LOGO;
        img.alt = 'Logo';
        img.setAttribute(MARK, 'done');
        img.setAttribute('data-impersonal-src', GENERIC_LOGO);
        const rect = svg.getBoundingClientRect();
        if (rect.width) img.width = Math.round(rect.width);
        if (rect.height) img.height = Math.round(rect.height);
        img.style.maxHeight = '40px';
        img.style.width = 'auto';
        svg.replaceWith(img);
    }

    function scrubBackgroundImages(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const nodes = scope.querySelectorAll
            ? scope.querySelectorAll('[style*="background"], [style*="Background"]')
            : [];

        nodes.forEach((el, index) => {
            if (el.getAttribute(MARK + '-bg') === 'done') return;
            const bg = el.style.backgroundImage || el.style.background || '';
            if (!/url\(/i.test(bg)) return;
            if (isOurUrl(bg)) return;

            el.setAttribute(MARK + '-bg', 'done');
            const size = sizeFor(el, 1200, 600);
            const url = makePlaceholder(size.w, size.h, bg + index, 'bg');
            el.style.backgroundImage = 'url("' + url + '")';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
        });
    }

    function blankInlineBrandStyles(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const nodes = scope.querySelectorAll ? scope.querySelectorAll('[style]') : [];

        nodes.forEach((el) => {
            if (el.closest && el.closest('#' + PANEL_ID)) return;
            if (el.style.boxShadow && /rgb|#|hsl/i.test(el.style.boxShadow)) {
                // Keep layout quiet; drop neon brand shadows
                if (/0px|rgba\(0,\s*0,\s*0/i.test(el.style.boxShadow) === false) {
                    el.style.boxShadow = '';
                }
            }
            if (el.style.filter && /hue|saturate|drop-shadow/i.test(el.style.filter)) {
                el.style.filter = 'none';
            }
            if (el.style.color && /rgb|#|hsl|var\(/i.test(el.style.color)) {
                // Force readable muted text (sites often leave white text after we lighten backgrounds)
                el.style.setProperty('color', TEXT, 'important');
            }
            if (el.style.webkitTextFillColor) {
                el.style.setProperty('-webkit-text-fill-color', TEXT, 'important');
            }
        });
    }

    function formatCardNumber(digits) {
        return String(digits).replace(/(\d{4})(?=\d)/g, '$1-');
    }

    function looksLikeCardNumber(raw) {
        if (!raw || !/^[\d\s-]+$/.test(raw.trim())) return false;
        if (/\.\d/.test(raw)) return false;
        const digits = raw.replace(/\D/g, '');
        return digits.length >= 13 && digits.length <= 19;
    }

    function tintNumbers(root) {
        const scope = root && root.nodeType ? root : document.body;
        if (!scope || !document.createTreeWalker) return;

        const skip = 'script, style, noscript, textarea, input, select, option, code, pre, kbd, samp, #' + PANEL_ID + ', .' + NUM_CLASS;
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || !/\d/.test(node.nodeValue)) {
                    return NodeFilter.FILTER_REJECT;
                }
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest && parent.closest(skip)) return NodeFilter.FILTER_REJECT;
                if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach(function (textNode) {
            const text = textNode.nodeValue;
            // Prefer long digit runs (cards with spaces/dashes), then normal numbers
            const re = /(?:\d[\d\s-]{11,30}\d)|(?:\d[\d,]*(?:\.\d+)?)/g;
            let match;
            let last = 0;
            const frag = document.createDocumentFragment();
            let touched = false;

            while ((match = re.exec(text))) {
                touched = true;
                if (match.index > last) {
                    frag.appendChild(document.createTextNode(text.slice(last, match.index)));
                }
                const raw = match[0];
                const span = document.createElement('span');
                span.className = NUM_CLASS;
                if (looksLikeCardNumber(raw)) {
                    span.className = NUM_CLASS + ' impersonal-cc';
                    span.textContent = formatCardNumber(raw.replace(/\D/g, ''));
                } else {
                    span.textContent = raw;
                }
                frag.appendChild(span);
                last = match.index + raw.length;
            }

            if (!touched || !textNode.parentNode) return;
            if (last < text.length) {
                frag.appendChild(document.createTextNode(text.slice(last)));
            }
            textNode.parentNode.replaceChild(frag, textNode);
        });
    }

    const HIDDEN_TABLE_HEADERS = {
        DL: true,
        EMAIL: true,
        PASSWORD: true,
        'PHONE NUMBER': true,
        PHONENUMBER: true,
        PHONE: true,
        IP: true,
        'USER AGENT': true,
        USERAGENT: true,
        PRICE: true,
        VENDOR: true,
        MMN: true,
        ITEM: true,
        BASE: true,
        COUNTRY: true,
    };

    const BIN_HEADER_LABELS = {
        BIN: true,
        BINS: true,
        'CARD BIN': true,
        CARDBIN: true,
        IIN: true,
    };

    const CARD_HEADER_LABELS = {
        CARD: true,
        CC: true,
        PAN: true,
        NUMBER: true,
        'CARD NUMBER': true,
        CARDNUMBER: true,
        'CC NUMBER': true,
        CCNUMBER: true,
        'CREDIT CARD': true,
        CREDITCARD: true,
    };

    const COMPLETE_CHECK_HEADERS = [
        { key: 'FULLNAME', labels: { FULLNAME: true, 'FULL NAME': true } },
        { key: 'ADDRESS', labels: { ADDRESS: true, ADDR: true } },
        { key: 'DOB', labels: { DOB: true, 'DATE OF BIRTH': true, DATEOFBIRTH: true } },
        { key: 'SSN', labels: { SSN: true } },
    ];

    function normalizeHeaderLabel(text) {
        return String(text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function headerShouldHide(text) {
        const label = normalizeHeaderLabel(text);
        if (!label) return false;
        if (HIDDEN_TABLE_HEADERS[label]) return true;
        const compact = label.replace(/\s+/g, '');
        return !!HIDDEN_TABLE_HEADERS[compact];
    }

    function getTableHeaderCells(table) {
        const headerCells = [];
        const theadRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
        if (theadRow) {
            Array.prototype.forEach.call(theadRow.cells, function (cell) {
                headerCells.push(cell);
            });
            return headerCells;
        }
        const firstRow = table.querySelector('tr');
        if (!firstRow) return headerCells;
        Array.prototype.forEach.call(firstRow.cells, function (cell) {
            if (cell.tagName === 'TH') headerCells.push(cell);
        });
        if (!headerCells.length) {
            Array.prototype.forEach.call(firstRow.cells, function (cell) {
                headerCells.push(cell);
            });
        }
        return headerCells;
    }

    function findColumnIndexByLabels(headerCells, labelMap) {
        for (let i = 0; i < headerCells.length; i++) {
            const label = normalizeHeaderLabel(headerCells[i].innerText || headerCells[i].textContent || '');
            const compact = label.replace(/\s+/g, '');
            if (labelMap[label] || labelMap[compact]) return i;
        }
        return -1;
    }

    function extractBinFromText(text) {
        const digits = String(text || '').replace(/\D/g, '');
        if (digits.length >= 6) return digits.slice(0, 6);
        return '';
    }

    function getRowBin(row, binIdx, cardIdx) {
        if (binIdx >= 0 && row.cells[binIdx]) {
            const fromBin = extractBinFromText(row.cells[binIdx].innerText || row.cells[binIdx].textContent || '');
            if (fromBin) return fromBin;
        }
        if (cardIdx >= 0 && row.cells[cardIdx]) {
            const fromCard = extractBinFromText(row.cells[cardIdx].innerText || row.cells[cardIdx].textContent || '');
            if (fromCard) return fromCard;
        }
        for (let i = 0; i < row.cells.length; i++) {
            const cell = row.cells[i];
            if (cell.getAttribute('data-impersonal-col-hidden') === '1') continue;
            const raw = cell.innerText || cell.textContent || '';
            const digits = raw.replace(/\D/g, '');
            if (digits.length >= 13 && digits.length <= 19) {
                return digits.slice(0, 6);
            }
        }
        return '';
    }

    function isHeaderRow(row, table) {
        if (!row) return true;
        if (table.tHead && row.parentElement === table.tHead) return true;
        if (row.querySelector('th') && row === table.querySelector('tr')) return true;
        return false;
    }

    function cellIsChecked(cell) {
        if (!cell) return false;
        const text = String(cell.innerText || cell.textContent || '').trim();
        const lower = text.toLowerCase();
        const html = String(cell.innerHTML || '');

        if (
            /[✗✘×❌✕⨉]|^\s*x+\s*$/i.test(text) ||
            /^(no|false|fail|missing|none|n\/a|na)$/i.test(lower)
        ) {
            return false;
        }
        if (/fa-times|fa-xmark|icon-x|icon-cross|cross-mark|status-fail|status-no|text-danger/i.test(html)) {
            return false;
        }

        if (
            /[✓✔✅☑√]|^\s*[yY]\s*$/.test(text) ||
            /^(yes|true|ok|pass|checked|complete|valid|1)$/i.test(lower)
        ) {
            return true;
        }
        if (
            /fa-check|check-mark|icon-check|status-ok|status-yes|text-success|bi-check|glyphicon-ok/i.test(html) ||
            /&#10003;|&#10004;|&check;|\\u2713|\\u2714/i.test(html)
        ) {
            return true;
        }

        const img = cell.querySelector && cell.querySelector('img, svg, i, span[class*="check" i], span[class*="tick" i]');
        if (img) {
            const blob = (
                (img.getAttribute && (img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('class') || '')) +
                ' ' +
                (img.className || '')
            ).toLowerCase();
            if (/check|tick|ok|success|valid|yes/.test(blob)) return true;
            if (/cross|times|fail|invalid|no|xmark/.test(blob)) return false;
        }

        return false;
    }

    function findCompleteCheckColumns(headerCells) {
        const indexes = [];
        for (let c = 0; c < COMPLETE_CHECK_HEADERS.length; c++) {
            const idx = findColumnIndexByLabels(headerCells, COMPLETE_CHECK_HEADERS[c].labels);
            if (idx < 0) return null;
            indexes.push(idx);
        }
        return indexes;
    }

    function applyCompleteProfileFilter(table) {
        const headerCells = getTableHeaderCells(table);
        const cols = findCompleteCheckColumns(headerCells);
        if (!cols) return;

        Array.prototype.forEach.call(table.rows, function (row) {
            if (isHeaderRow(row, table)) {
                row.removeAttribute('data-impersonal-complete');
                row.removeAttribute('data-impersonal-complete-hidden');
                return;
            }

            let allChecked = true;
            for (let i = 0; i < cols.length; i++) {
                if (!cellIsChecked(row.cells[cols[i]])) {
                    allChecked = false;
                    break;
                }
            }

            if (allChecked) {
                row.setAttribute('data-impersonal-complete', '1');
                row.removeAttribute('data-impersonal-complete-hidden');
            } else {
                row.setAttribute('data-impersonal-complete', '0');
                row.setAttribute('data-impersonal-complete-hidden', '1');
            }
        });
    }

    const TYPE_HEADER_LABELS = {
        TYPE: true,
        'CARD TYPE': true,
        CARDTYPE: true,
        LEVEL: true,
        'CARD LEVEL': true,
        CARDLEVEL: true,
        PRODUCT: true,
        SCHEME: true,
        BRAND: true,
    };

    function markTypeColumns(table) {
        const headerCells = getTableHeaderCells(table);
        const typeIdx = findColumnIndexByLabels(headerCells, TYPE_HEADER_LABELS);
        if (typeIdx < 0) {
            let best = -1;
            let bestHits = 0;
            const sampleRows = Math.min(table.rows.length, 12);
            for (let c = 0; c < headerCells.length; c++) {
                let hits = 0;
                for (let r = 0; r < sampleRows; r++) {
                    const row = table.rows[r];
                    if (!row || isHeaderRow(row, table) || !row.cells[c]) continue;
                    if (row.cells[c].querySelector && row.cells[c].querySelector('.badge, [class*="badge" i], .fs-11px')) {
                        hits += 1;
                    }
                }
                if (hits > bestHits) {
                    bestHits = hits;
                    best = c;
                }
            }
            if (bestHits < 2) return;
            markColumnCells(table, best);
            return;
        }
        markColumnCells(table, typeIdx);
    }

    function markColumnCells(table, index) {
        Array.prototype.forEach.call(table.rows, function (row) {
            const cell = row.cells[index];
            if (!cell) return;
            cell.setAttribute('data-impersonal-type-col', '1');
            const badges = cell.querySelectorAll
                ? cell.querySelectorAll('.badge, [class*="badge" i], span.fs-11px, span.text-info, span.bg-info')
                : [];
            Array.prototype.forEach.call(badges, function (badge) {
                badge.style.setProperty('max-width', 'none', 'important');
                badge.style.setProperty('white-space', 'nowrap', 'important');
                badge.style.setProperty('font-size', '14px', 'important');
                badge.style.setProperty('padding', '3px 6px', 'important');
                badge.style.setProperty('font-weight', '800', 'important');
                badge.style.setProperty('display', 'inline-block', 'important');
                badge.style.setProperty('box-sizing', 'border-box', 'important');
                badge.style.setProperty('width', 'auto', 'important');
            });
        });
    }

    function hideUnwantedTableColumns(table) {
        const headerCells = getTableHeaderCells(table);
        if (!headerCells.length) return;

        const hideIdx = [];
        headerCells.forEach(function (cell, index) {
            const label = cell.innerText || cell.textContent || '';
            if (headerShouldHide(label)) hideIdx.push(index);
        });

        if (!hideIdx.length) {
            table.setAttribute(MARK + '-cols', 'done');
            return;
        }

        const hideSet = {};
        hideIdx.forEach(function (i) {
            hideSet[i] = true;
        });

        Array.prototype.forEach.call(table.rows, function (row) {
            Array.prototype.forEach.call(row.cells, function (cell, index) {
                if (!hideSet[index]) return;
                cell.style.setProperty('display', 'none', 'important');
                cell.setAttribute('data-impersonal-col-hidden', '1');
                cell.setAttribute('aria-hidden', 'true');
            });
        });

        table.setAttribute(MARK + '-cols', 'done');
    }

    function collectTableBins(table, binIdx, cardIdx) {
        const bins = {};
        Array.prototype.forEach.call(table.rows, function (row) {
            if (isHeaderRow(row, table)) return;
            const bin = getRowBin(row, binIdx, cardIdx);
            if (bin) bins[bin] = true;
            row.setAttribute('data-impersonal-bin', bin || '');
        });
        return Object.keys(bins).sort();
    }

    function parseBinQueries(raw) {
        return String(raw || '')
            .split(/[\s,;|/]+/)
            .map(function (part) {
                return part.replace(/\D/g, '');
            })
            .filter(function (part) {
                return part.length > 0;
            });
    }

    function parseTextQueries(raw) {
        return String(raw || '')
            .split(/[\n,;|]+/)
            .map(function (part) {
                return part.replace(/\s+/g, ' ').trim().toLowerCase();
            })
            .filter(function (part) {
                return part.length > 0;
            });
    }

    function getMultiSelectValues(select) {
        if (!select) return [];
        const values = [];
        Array.prototype.forEach.call(select.selectedOptions || [], function (opt) {
            const v = String(opt.value || '').trim();
            if (v) values.push(v);
        });
        return values;
    }

    function cellText(cell) {
        return String((cell && (cell.innerText || cell.textContent)) || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const TABLE_FILTER_DEFS = [
        {
            key: 'bin',
            label: 'BIN',
            labels: BIN_HEADER_LABELS,
            numeric: true,
            fallbackCard: true,
        },
        {
            key: 'city',
            label: 'CITY',
            labels: { CITY: true, TOWN: true },
            numeric: false,
        },
        {
            key: 'state',
            label: 'STATE',
            labels: { STATE: true, ST: true, PROVINCE: true, REGION: true },
            numeric: false,
        },
        {
            key: 'zip',
            label: 'ZIP',
            labels: { ZIP: true, ZIPCODE: true, 'ZIP CODE': true, POSTAL: true, 'POSTAL CODE': true },
            numeric: false,
        },
        {
            key: 'bank',
            label: 'BANK',
            labels: { BANK: true, 'BANK NAME': true, BANKNAME: true, ISSUER: true },
            numeric: false,
        },
    ];

    function collectColumnValues(table, colIdx, numeric) {
        const values = {};
        if (colIdx < 0) return [];
        Array.prototype.forEach.call(table.rows, function (row) {
            if (isHeaderRow(row, table) || !row.cells[colIdx]) return;
            let raw = cellText(row.cells[colIdx]);
            if (numeric) raw = raw.replace(/\D/g, '').slice(0, 6);
            if (!raw) return;
            values[raw] = true;
        });
        return Object.keys(values).sort(function (a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    function rowValueForFilter(row, def, colIdx, cardIdx) {
        if (def.key === 'bin') {
            return getRowBin(row, colIdx, cardIdx) || '';
        }
        if (colIdx < 0 || !row.cells[colIdx]) return '';
        return cellText(row.cells[colIdx]);
    }

    function valueMatchesFilter(rawValue, selected, typed, numeric) {
        const queries = selected.concat(typed);
        if (!queries.length) return true;
        if (!rawValue) return false;
        const value = numeric
            ? String(rawValue).replace(/\D/g, '')
            : String(rawValue).trim().toLowerCase();
        for (let i = 0; i < queries.length; i++) {
            let q = queries[i];
            if (numeric) {
                q = String(q).replace(/\D/g, '');
                if (!q) continue;
                if (value === q || value.indexOf(q) === 0) return true;
            } else {
                q = String(q).trim().toLowerCase();
                if (!q) continue;
                if (value === q || value.indexOf(q) === 0 || value.indexOf(q) !== -1) return true;
            }
        }
        return false;
    }

    function applyColumnFilters(table, filterRoot) {
        const headerCells = getTableHeaderCells(table);
        const cardIdx = findColumnIndexByLabels(headerCells, CARD_HEADER_LABELS);
        const active = [];

        TABLE_FILTER_DEFS.forEach(function (def) {
            const group = filterRoot.querySelector('[data-filter-key="' + def.key + '"]');
            if (!group || group.style.display === 'none') return;
            const select = group.querySelector('select');
            const area = group.querySelector('textarea');
            const colIdx = findColumnIndexByLabels(headerCells, def.labels);
            const selected = getMultiSelectValues(select).map(function (v) {
                return def.numeric ? v.replace(/\D/g, '') : v.toLowerCase();
            });
            const typed = def.numeric ? parseBinQueries(area && area.value) : parseTextQueries(area && area.value);
            active.push({
                def: def,
                colIdx: colIdx,
                cardIdx: def.fallbackCard ? cardIdx : -1,
                selected: selected,
                typed: typed,
            });
        });

        let visible = 0;
        let total = 0;
        Array.prototype.forEach.call(table.rows, function (row) {
            if (isHeaderRow(row, table)) return;
            total += 1;
            let show = true;
            for (let i = 0; i < active.length; i++) {
                const a = active[i];
                const raw = rowValueForFilter(row, a.def, a.colIdx, a.cardIdx);
                if (!valueMatchesFilter(raw, a.selected, a.typed, a.def.numeric)) {
                    show = false;
                    break;
                }
            }
            if (show) {
                row.removeAttribute('data-impersonal-colfilter-hidden');
                row.removeAttribute('data-impersonal-bin-hidden');
                if (row.getAttribute('data-impersonal-complete-hidden') !== '1') visible += 1;
            } else {
                row.setAttribute('data-impersonal-colfilter-hidden', '1');
                row.setAttribute('data-impersonal-bin-hidden', '1');
            }
        });
        return { visible: visible, total: total };
    }

    function stripNativeFilters(root) {
        const scope = (root && root.querySelectorAll ? root : document).body || document;
        if (!scope || !scope.querySelectorAll) return;

        const selectors = [
            '.dataTables_filter',
            '.dataTables_length',
            '.dt-search',
            '.dt-length',
            '.table-filters',
            '.filter-toolbar',
            '.filter-bar',
            '.filters-bar',
            '.search-filters',
            '.datatable-filter',
            '[class*="tableFilter" i]',
            '[class*="filter-bar" i]',
            '[class*="filterBar" i]',
            '[class*="filters-wrap" i]',
            '[id*="table-filter" i]',
            '[id*="datatable-filter" i]',
        ];

        selectors.forEach(function (sel) {
            let nodes;
            try {
                nodes = scope.querySelectorAll(sel);
            } catch (err) {
                return;
            }
            Array.prototype.forEach.call(nodes, function (el) {
                if (!el || !el.style) return;
                if (el.closest && el.closest('.impersonal-table-shell, .impersonal-table-filters, .impersonal-bin-filter, #' + PANEL_ID)) {
                    return;
                }
                el.style.setProperty('display', 'none', 'important');
                el.setAttribute('data-impersonal-native-filter-hidden', '1');
                el.setAttribute('aria-hidden', 'true');
            });
        });

        // Hide unlabeled filter forms sitting directly above our tables
        Array.prototype.forEach.call(document.querySelectorAll('.impersonal-table-shell'), function (shell) {
            let prev = shell.previousElementSibling;
            let hops = 0;
            while (prev && hops < 4) {
                hops += 1;
                if (prev.classList && (prev.classList.contains('impersonal-table-shell') || prev.classList.contains('impersonal-table-filters'))) {
                    break;
                }
                const text = (prev.innerText || '').toLowerCase();
                const looksFilter =
                    (prev.matches && prev.matches('form, .card, .card-header, .row, .toolbar, [class*="filter" i], [class*="search" i]')) ||
                    /filter|search|bin\b|show\s+\d+|entries/.test(text);
                const hasControls = prev.querySelector && prev.querySelector('select, input[type="search"], input[type="text"], button');
                if (looksFilter && hasControls && !(prev.querySelector && prev.querySelector('table'))) {
                    prev.style.setProperty('display', 'none', 'important');
                    prev.setAttribute('data-impersonal-native-filter-hidden', '1');
                }
                prev = prev.previousElementSibling;
            }
        });
    }

    function ensureTableFilters(shell, table) {
        // Remove duplicates / legacy bars — only one filter UI per shell
        const existingBars = shell.querySelectorAll('.impersonal-bin-filter, .impersonal-table-filters');
        let filter = null;
        Array.prototype.forEach.call(existingBars, function (el) {
            if (!filter && el.classList.contains('impersonal-table-filters') && el.getAttribute(MARK) === 'table-filters') {
                filter = el;
            } else {
                el.parentNode && el.parentNode.removeChild(el);
            }
        });

        const headerCells = getTableHeaderCells(table);
        const cardIdx = findColumnIndexByLabels(headerCells, CARD_HEADER_LABELS);

        if (!filter) {
            filter = document.createElement('div');
            filter.className = 'impersonal-table-filters';
            filter.setAttribute(MARK, 'table-filters');

            TABLE_FILTER_DEFS.forEach(function (def) {
                const group = document.createElement('div');
                group.className = 'imp-filter-group';
                group.setAttribute('data-filter-key', def.key);
                group.innerHTML = [
                    '<label>' + def.label + '</label>',
                    '<select class="imp-filter-select" multiple size="4" aria-label="Filter by ' + def.label + '"></select>',
                    '<textarea class="imp-filter-text" rows="3" spellcheck="false" placeholder="' +
                        (def.numeric ? 'Multiple OK\n411111, 424242' : 'Multiple OK\nvalue1, value2') +
                        '" aria-label="' + def.label + ' list filter"></textarea>',
                ].join('');
                filter.appendChild(group);
            });

            const actions = document.createElement('div');
            actions.className = 'imp-filter-group';
            actions.innerHTML = '<label>&nbsp;</label><button type="button" class="imp-filter-clear">Clear filters</button><span class="imp-filter-count"></span>';
            filter.appendChild(actions);
            shell.insertBefore(filter, shell.firstChild);

            function runFilter() {
                const stats = applyColumnFilters(table, filter);
                const countEl = filter.querySelector('.imp-filter-count');
                if (countEl) countEl.textContent = stats.visible + ' / ' + stats.total + ' rows';
            }

            filter.addEventListener('change', runFilter);
            filter.addEventListener('input', runFilter);
            filter.querySelector('.imp-filter-clear').addEventListener('click', function (e) {
                e.preventDefault();
                Array.prototype.forEach.call(filter.querySelectorAll('select option'), function (opt) {
                    opt.selected = false;
                });
                Array.prototype.forEach.call(filter.querySelectorAll('textarea'), function (area) {
                    area.value = '';
                });
                runFilter();
            });

            filter._impRunFilter = runFilter;
        }

        let anyVisible = false;
        TABLE_FILTER_DEFS.forEach(function (def) {
            const group = filter.querySelector('[data-filter-key="' + def.key + '"]');
            if (!group) return;
            const select = group.querySelector('select');
            const colIdx = findColumnIndexByLabels(headerCells, def.labels);
            let values = collectColumnValues(table, colIdx, def.numeric);

            if (def.key === 'bin' && !values.length) {
                // fallback from card numbers
                const bins = {};
                Array.prototype.forEach.call(table.rows, function (row) {
                    if (isHeaderRow(row, table)) return;
                    const bin = getRowBin(row, colIdx, cardIdx);
                    if (bin) bins[bin] = true;
                });
                values = Object.keys(bins).sort();
            }

            if (!values.length && colIdx < 0 && !(def.key === 'bin')) {
                group.style.display = 'none';
                return;
            }
            if (!values.length && def.key === 'bin') {
                group.style.display = 'none';
                return;
            }

            group.style.display = 'flex';
            anyVisible = true;

            const previouslySelected = {};
            Array.prototype.forEach.call(select.selectedOptions || [], function (opt) {
                previouslySelected[opt.value] = true;
            });

            // rebuild options while preserving selections
            const keep = {};
            values.forEach(function (v) {
                keep[v] = true;
            });
            Array.prototype.forEach.call(Array.prototype.slice.call(select.options), function (opt) {
                if (!keep[opt.value]) select.removeChild(opt);
            });
            const existing = {};
            Array.prototype.forEach.call(select.options, function (opt) {
                existing[opt.value] = true;
            });
            values.forEach(function (v) {
                if (existing[v]) return;
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                if (previouslySelected[v]) opt.selected = true;
                select.appendChild(opt);
            });
        });

        filter.style.display = anyVisible ? 'flex' : 'none';
        if (filter._impRunFilter) filter._impRunFilter();
    }

    function fixTables(root) {
        const scope = root && root.querySelectorAll ? root : document;
        if (!scope.querySelectorAll) return;

        // Drop empty duplicate shells left over from earlier runs
        Array.prototype.forEach.call(document.querySelectorAll('.impersonal-table-shell'), function (shell) {
            if (!shell.querySelector('table')) {
                shell.parentNode && shell.parentNode.removeChild(shell);
            }
        });

        // Remove legacy single-BIN bars from older script versions
        Array.prototype.forEach.call(document.querySelectorAll('.impersonal-bin-filter'), function (el) {
            el.parentNode && el.parentNode.removeChild(el);
        });

        scope.querySelectorAll('table').forEach(function (table) {
            if (!table || !table.parentNode) return;
            if (table.closest && table.closest('#' + PANEL_ID)) return;
            if (table.closest && table.closest('.impersonal-table-filters, .impersonal-bin-filter')) return;

            hideUnwantedTableColumns(table);
            applyCompleteProfileFilter(table);
            markTypeColumns(table);

            let wrap = table.parentElement;
            let shell = null;

            if (wrap && wrap.classList.contains('impersonal-table-wrap')) {
                shell = wrap.parentElement && wrap.parentElement.classList.contains('impersonal-table-shell')
                    ? wrap.parentElement
                    : null;
            } else if (wrap && wrap.classList.contains('impersonal-table-shell')) {
                shell = wrap;
                wrap = null;
            } else {
                wrap = null;
                shell = null;
            }

            if (!shell) {
                shell = document.createElement('div');
                shell.className = 'impersonal-table-shell';
                shell.setAttribute(MARK, 'table-shell');
                table.parentNode.insertBefore(shell, table);
            }

            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'impersonal-table-wrap';
                wrap.setAttribute(MARK, 'table');
                shell.appendChild(wrap);
                wrap.appendChild(table);
            } else if (wrap.parentElement !== shell) {
                shell.appendChild(wrap);
            } else if (table.parentElement !== wrap) {
                wrap.appendChild(table);
            }

            ensureTableFilters(shell, table);
        });

        stripNativeFilters(scope);
    }

    function neutralizeDocumentTitle() {
        if (!document.title || document.title === 'Page') return;
        document.title = 'Page';
    }

    function replaceMedia(root) {
        const scope = root && root.querySelectorAll ? root : document;
        if (!scope.querySelectorAll) return;

        scope.querySelectorAll('picture').forEach(replacePicture);
        scope.querySelectorAll('img').forEach(replaceImage);
        scope.querySelectorAll('video').forEach(replaceVideo);
        scope.querySelectorAll('svg').forEach(replaceSvgLogo);
        scrubBackgroundImages(scope);
    }

    function applyTheme(root) {
        injectStyles();
        applyVisualSettings();
        ensureSettingsPanel();
        blankInlineBrandStyles(root || document);
        replaceMedia(root || document);
        fixTables(root || document);
        tintNumbers((root && root.body) || root || document.body || document.documentElement);
        neutralizeDocumentTitle();
    }

    function cleanURLParams() {
        try {
            const url = new URL(window.location.href);
            const trackerKeys = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', 'mc_eid', '_hsenc', '_hsmi', 'yclid',
                'igshid', 'si', 'ref', 'ref_src',
            ];
            let modified = false;
            trackerKeys.forEach((key) => {
                if (url.searchParams.has(key)) {
                    url.searchParams.delete(key);
                    modified = true;
                }
            });
            if (modified) {
                window.history.replaceState({}, '', url.toString());
            }
        } catch (err) {
            // ignore opaque/about URLs
        }
    }

    cleanURLParams();
    applyTheme(document);

    const earlyObserver = new MutationObserver(() => {
        if (document.head || document.documentElement) {
            injectStyles();
        }
        if (document.body) {
            earlyObserver.disconnect();
            applyTheme(document);
            watchDom();
        }
    });
    earlyObserver.observe(document.documentElement, { childList: true, subtree: true });

    let debounceTimer = null;
    function watchDom() {
        const observer = new MutationObserver((mutations) => {
            let touched = false;
            for (const mutation of mutations) {
                const t = mutation.target;
                if (t && t.closest && t.closest('#' + PANEL_ID)) continue;
                if (mutation.addedNodes && mutation.addedNodes.length) {
                    let onlyPanel = true;
                    mutation.addedNodes.forEach(function (n) {
                        if (n.id === PANEL_ID) return;
                        if (n.nodeType === 1 && n.closest && n.closest('#' + PANEL_ID)) return;
                        onlyPanel = false;
                    });
                    if (!onlyPanel) {
                        touched = true;
                        break;
                    }
                }
                if (
                    mutation.type === 'attributes' &&
                    (mutation.attributeName === 'style' ||
                        mutation.attributeName === 'src' ||
                        mutation.attributeName === 'srcset')
                ) {
                    touched = true;
                    break;
                }
            }
            if (!touched) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => applyTheme(document), 80);
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'src', 'srcset'],
        });
    }

    if (document.body) {
        watchDom();
    }
})();
