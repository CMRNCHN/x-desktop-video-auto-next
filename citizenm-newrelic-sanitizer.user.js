// ==UserScript==
// @name         CitizenM NewRelic Sanitizer
// @namespace    https://github.com/quoid/userscripts
// @version      1.4
// @match        https://service.citizenm.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function getUrl(input) {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.href;
        if (input && typeof input.url === 'string') return input.url;
        try {
            return String(input);
        } catch (e) {
            return '';
        }
    }

    function isNewRelic(url) {
        return /newrelic/i.test(url || '');
    }

    function removeKey(value, key) {
        if (Array.isArray(value)) {
            return value.map((item) => removeKey(item, key));
        }
        if (value && typeof value === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                if (k === key) continue;
                out[k] = removeKey(v, key);
            }
            return out;
        }
        return value;
    }

    function stripAskDonation(text) {
        if (!text || !/askDonation/i.test(text)) return text;

        try {
            return JSON.stringify(removeKey(JSON.parse(text), 'askDonation'));
        } catch (e) {
            // Non-JSON payloads (JS snippets / config fragments)
            return text
                .replace(
                    /,?(\s*)["']?askDonation["']?\s*:\s*(?:true|false|null|undefined|-?\d+(?:\.\d+)?|["'][^"']*["'])\s*/gi,
                    '$1'
                )
                .replace(/\{\s*,/g, '{')
                .replace(/\[\s*,/g, '[')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/,\s*,/g, ',');
        }
    }

    async function sanitizeResponse(response) {
        const clone = response.clone();
        const text = await clone.text();
        const cleaned = stripAskDonation(text);

        if (cleaned === text) return response;

        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');

        return new Response(cleaned, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = getUrl(args[0]);
        const result = originalFetch.apply(this, args);
        if (!isNewRelic(url)) return result;
        return Promise.resolve(result).then(sanitizeResponse);
    };
})();
