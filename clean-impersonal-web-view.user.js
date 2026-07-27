// ==UserScript==
// @name        Clean Impersonal Web View
// @version     3.0.1
// @description Strips branding and restyles pages to a modern generic look; swaps media for a curated stock set so sites still read like ordinary websites.
// @author      Senior Engineer
// @match       http://*/*
// @match       https://*/*
// @run-at      document-start
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'impersonal-theme-styles';
    const FONT_ID = 'impersonal-theme-font';
    const MARK = 'data-impersonal-media';

    // Curated stock photos: office, city, nature, product, lifestyle
    const STOCK_PHOTOS = [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1557804506-669a7099bdb4?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1542744173-8e2bd417cb53?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80',
    ];

    const STOCK_AVATARS = [
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
    ];

    const STOCK_HERO = STOCK_PHOTOS[0];

    const GENERIC_LOGO =
        'data:image/svg+xml,' +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40" fill="none">' +
                '<rect width="160" height="40" rx="8" fill="#EEF2F7"/>' +
                '<rect x="10" y="10" width="20" height="20" rx="6" fill="#3B82F6"/>' +
                '<rect x="40" y="14" width="72" height="12" rx="4" fill="#94A3B8"/>' +
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

    function injectFont() {
        if (document.getElementById(FONT_ID)) return;
        if (!document.documentElement) return;
        const link = document.createElement('link');
        link.id = FONT_ID;
        link.rel = 'stylesheet';
        link.href =
            'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
        (document.head || document.documentElement).appendChild(link);
    }

    function injectStyles() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            if (!document.documentElement) return;
            style = document.createElement('style');
            style.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }

        style.textContent = [
            ':root {',
            '  --bg: #f4f6f9 !important;',
            '  --surface: #ffffff !important;',
            '  --surface-muted: #eef2f7 !important;',
            '  --text: #0f172a !important;',
            '  --text-muted: #64748b !important;',
            '  --border: #e2e8f0 !important;',
            '  --accent: #3b82f6 !important;',
            '  --accent-hover: #2563eb !important;',
            '  --accent-soft: #dbeafe !important;',
            '  --shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06) !important;',
            '  --radius: 12px !important;',
            '  --radius-sm: 8px !important;',
            '  --font: "Plus Jakarta Sans", "Segoe UI", sans-serif !important;',
            '  --font-mono: "IBM Plex Mono", ui-monospace, monospace !important;',
            '}',
            'html, body {',
            '  background: var(--bg) !important;',
            '  background-image: none !important;',
            '  color: var(--text) !important;',
            '  font-family: var(--font) !important;',
            '  line-height: 1.55 !important;',
            '  -webkit-font-smoothing: antialiased !important;',
            '}',
            '*, *::before, *::after {',
            '  font-family: inherit;',
            '  text-shadow: none !important;',
            '  scrollbar-color: #94a3b8 var(--surface-muted) !important;',
            '}',
            'body, p, li, span, label, td, th, small, strong, em, h1, h2, h3, h4, h5, h6 {',
            '  color: var(--text) !important;',
            '}',
            'h1, h2, h3, h4, h5, h6 {',
            '  font-family: var(--font) !important;',
            '  font-weight: 650 !important;',
            '  letter-spacing: -0.02em !important;',
            '  line-height: 1.25 !important;',
            '}',
            'header, footer, nav, [role="banner"], [role="navigation"],',
            '[class*="header" i], [id*="header" i],',
            '[class*="nav" i], [id*="nav" i],',
            '[class*="toolbar" i], [class*="sidebar" i], [class*="aside" i] {',
            '  background-color: var(--surface) !important;',
            '  background-image: none !important;',
            '  border-color: var(--border) !important;',
            '  box-shadow: none !important;',
            '}',
            'main, article, [role="main"],',
            '[class*="card" i], [class*="panel" i], [class*="modal" i],',
            '[class*="dialog" i], [class*="popover" i], [class*="dropdown" i] {',
            '  background-color: var(--surface) !important;',
            '  border-color: var(--border) !important;',
            '  border-radius: var(--radius) !important;',
            '  box-shadow: var(--shadow) !important;',
            '}',
            '[style*="gradient"],',
            '[class*="gradient" i],',
            '[class*="glow" i],',
            '[class*="neon" i] {',
            '  background-image: none !important;',
            '  box-shadow: var(--shadow) !important;',
            '  filter: none !important;',
            '}',
            'img, picture, video, canvas, embed, object, iframe {',
            '  opacity: 1 !important;',
            '  visibility: visible !important;',
            '  filter: none !important;',
            '  border-radius: var(--radius-sm) !important;',
            '  object-fit: cover !important;',
            '}',
            'img[' + MARK + '], video[' + MARK + '] {',
            '  background: var(--surface-muted) !important;',
            '}',
            LOGO_SELECTORS + ' {',
            '  opacity: 1 !important;',
            '  visibility: visible !important;',
            '  filter: none !important;',
            '}',
            'svg { color: var(--text-muted) !important; }',
            '[class*="promo" i],',
            '[class*="advert" i],',
            '[class*="sponsor" i],',
            '[class*="mascot" i],',
            '[class*="confetti" i],',
            '[id*="cookie" i],',
            '[class*="cookie" i],',
            '[class*="consent" i] {',
            '  opacity: 0 !important;',
            '  visibility: hidden !important;',
            '  pointer-events: none !important;',
            '  max-height: 0 !important;',
            '  overflow: hidden !important;',
            '}',
            'a {',
            '  color: var(--accent) !important;',
            '  text-decoration: none !important;',
            '  font-weight: 550 !important;',
            '  background-image: none !important;',
            '  transition: color 0.15s ease, background-color 0.15s ease !important;',
            '}',
            'a:hover {',
            '  color: var(--accent-hover) !important;',
            '  text-decoration: underline !important;',
            '}',
            'nav a, header a, [role="navigation"] a {',
            '  color: var(--text) !important;',
            '  font-weight: 600 !important;',
            '  text-decoration: none !important;',
            '  padding: 8px 12px !important;',
            '  border-radius: 999px !important;',
            '}',
            'nav a:hover, header a:hover, [role="navigation"] a:hover {',
            '  background-color: var(--surface-muted) !important;',
            '  color: var(--text) !important;',
            '  text-decoration: none !important;',
            '}',
            'button,',
            'input[type="button"],',
            'input[type="submit"],',
            'input[type="reset"],',
            '[role="button"],',
            '[class*="btn" i],',
            '[class*="button" i] {',
            '  background: var(--accent) !important;',
            '  color: #ffffff !important;',
            '  border: 1px solid var(--accent) !important;',
            '  border-radius: 999px !important;',
            '  font-weight: 600 !important;',
            '  font-family: var(--font) !important;',
            '  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25) !important;',
            '  transition: background 0.15s ease, transform 0.15s ease !important;',
            '}',
            'button:hover,',
            'input[type="button"]:hover,',
            'input[type="submit"]:hover,',
            '[role="button"]:hover,',
            '[class*="btn" i]:hover {',
            '  background: var(--accent-hover) !important;',
            '  border-color: var(--accent-hover) !important;',
            '  color: #ffffff !important;',
            '}',
            'input, textarea, select {',
            '  background: var(--surface) !important;',
            '  color: var(--text) !important;',
            '  border: 1px solid var(--border) !important;',
            '  border-radius: var(--radius-sm) !important;',
            '  font-family: var(--font) !important;',
            '  box-shadow: none !important;',
            '  padding: 8px 12px !important;',
            '}',
            'input:focus, textarea:focus, select:focus {',
            '  border-color: var(--accent) !important;',
            '  outline: 3px solid var(--accent-soft) !important;',
            '  box-shadow: none !important;',
            '}',
            'table { border-collapse: separate !important; border-spacing: 0 !important; width: 100% !important; }',
            'th, td { border: 1px solid var(--border) !important; padding: 10px 14px !important; }',
            'th { background: var(--surface-muted) !important; font-weight: 650 !important; color: var(--text) !important; }',
            'code, pre, kbd, samp {',
            '  font-family: var(--font-mono) !important;',
            '  background: var(--surface-muted) !important;',
            '  color: var(--text) !important;',
            '  border: 1px solid var(--border) !important;',
            '  border-radius: 6px !important;',
            '}',
            'blockquote {',
            '  border-left: 3px solid var(--accent) !important;',
            '  background: var(--surface-muted) !important;',
            '  color: var(--text-muted) !important;',
            '  padding: 12px 16px !important;',
            '  margin: 16px 0 !important;',
            '  border-radius: 0 var(--radius-sm) var(--radius-sm) 0 !important;',
            '}',
            '::selection { background: var(--accent-soft) !important; color: var(--text) !important; }',
        ].join('\n');
    }

    function isOurUrl(url) {
        if (!url) return false;
        return (
            url.startsWith('data:image/svg+xml') ||
            url.includes('images.unsplash.com/photo-') ||
            url.includes('fonts.googleapis.com') ||
            url.includes('fonts.gstatic.com')
        );
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

    function sizedStock(url, w, h) {
        try {
            const u = new URL(url);
            u.searchParams.set('w', String(Math.min(1600, Math.max(40, w))));
            u.searchParams.set('h', String(Math.min(1200, Math.max(40, h))));
            u.searchParams.set('fit', 'crop');
            return u.toString();
        } catch (err) {
            return url;
        }
    }

    function chooseReplacement(el, kind) {
        const key = el.currentSrc || el.src || el.getAttribute('src') || el.outerHTML || Math.random();
        if (kind === 'logo') return GENERIC_LOGO;
        if (kind === 'avatar') {
            const { w, h } = sizeFor(el, 96, 96);
            return sizedStock(pick(STOCK_AVATARS, key), w, h);
        }
        if (kind === 'hero') {
            const { w, h } = sizeFor(el, 1400, 700);
            return sizedStock(STOCK_HERO, w, h);
        }
        const { w, h } = sizeFor(el, 1000, 640);
        return sizedStock(pick(STOCK_PHOTOS, key), w, h);
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
        const key = video.currentSrc || video.poster || video.outerHTML;
        const { w, h } = sizeFor(video, 1280, 720);
        const poster = sizedStock(pick(STOCK_PHOTOS, key), w, h);
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
            const { w, h } = sizeFor(el, 1200, 600);
            const url = sizedStock(pick(STOCK_PHOTOS, bg + index), w, h);
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
            if (el.style.boxShadow && /rgb|#|hsl/i.test(el.style.boxShadow)) {
                // Keep light elevation via CSS theme; drop neon brand shadows
                if (/0px|rgba\(0,\s*0,\s*0/i.test(el.style.boxShadow) === false) {
                    el.style.boxShadow = '';
                }
            }
            if (el.style.filter && /hue|saturate|drop-shadow/i.test(el.style.filter)) {
                el.style.filter = 'none';
            }
            if (el.style.color && /rgb|#|hsl/i.test(el.style.color)) {
                // Let stylesheet color tokens win
                el.style.color = '';
            }
        });
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
        injectFont();
        injectStyles();
        blankInlineBrandStyles(root || document);
        replaceMedia(root || document);
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
            injectFont();
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
                if (mutation.addedNodes && mutation.addedNodes.length) {
                    touched = true;
                    break;
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
