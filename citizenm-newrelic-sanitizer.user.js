// ==UserScript==
// @name         CitizenM NewRelic Sanitizer
// @namespace    https://github.com/quoid/userscripts
// @version      1.6
// @description  Strip server-only askDonation before CitizenM/New Relic client code warns about it
// @match        https://service.citizenm.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var FORBIDDEN = 'askDonation';

    function removeKey(value, key) {
        if (Array.isArray(value)) {
            return value.map(function (item) {
                return removeKey(item, key);
            });
        }
        if (value && typeof value === 'object') {
            var out = {};
            Object.keys(value).forEach(function (k) {
                if (k === key) return;
                out[k] = removeKey(value[k], key);
            });
            return out;
        }
        return value;
    }

    function stripAskDonation(text) {
        if (typeof text !== 'string' || text.indexOf(FORBIDDEN) === -1) {
            return text;
        }

        try {
            return JSON.stringify(removeKey(JSON.parse(text), FORBIDDEN));
        } catch (e) {
            return text
                .replace(
                    new RegExp(
                        ',?(\\s*)["\']?' + FORBIDDEN + '["\']?\\s*:\\s*(?:true|false|null|undefined|-?\\d+(?:\\.\\d+)?|["\'][^"\']*["\'])\\s*',
                        'gi'
                    ),
                    '$1'
                )
                .replace(/\{\s*,/g, '{')
                .replace(/\[\s*,/g, '[')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/,\s*,/g, ',');
        }
    }

    function scrubObject(value) {
        if (!value || typeof value !== 'object') return value;
        return removeKey(value, FORBIDDEN);
    }

    // Catch Next.js / API / hydration JSON before client validators run.
    var originalParse = JSON.parse;
    JSON.parse = function (text, reviver) {
        var value = originalParse.call(this, text, reviver);
        if (typeof text === 'string' && text.indexOf(FORBIDDEN) !== -1) {
            return scrubObject(value);
        }
        return value;
    };

    // Scrub response bodies without replacing window.fetch (avoids NR warning #64).
    var originalText = Response.prototype.text;
    Response.prototype.text = function () {
        return originalText.call(this).then(stripAskDonation);
    };

    var originalJson = Response.prototype.json;
    Response.prototype.json = function () {
        return originalText.call(this).then(function (text) {
            return originalParse(stripAskDonation(text));
        });
    };

    function scrubNreum(nr) {
        if (!nr || typeof nr !== 'object') return nr;
        if (nr.info) nr.info = scrubObject(nr.info);
        if (nr.init) nr.init = scrubObject(nr.init);
        if (nr.loader_config) nr.loader_config = scrubObject(nr.loader_config);
        if (nr.info && nr.info.jsAttributes) {
            nr.info.jsAttributes = scrubObject(nr.info.jsAttributes);
        }
        return scrubObject(nr);
    }

    function installNreumTrap() {
        var current = window.NREUM;
        if (current) scrubNreum(current);

        try {
            Object.defineProperty(window, 'NREUM', {
                configurable: true,
                enumerable: true,
                get: function () {
                    return current;
                },
                set: function (value) {
                    current = scrubNreum(value);
                    if (current && typeof current === 'object') {
                        trapNreumFields(current);
                    }
                }
            });
            if (current && typeof current === 'object') {
                trapNreumFields(current);
            }
        } catch (e) {
            // ignore if page already locked NREUM
        }
    }

    function trapNreumFields(nr) {
        ['info', 'init', 'loader_config'].forEach(function (field) {
            var value = nr[field];
            try {
                Object.defineProperty(nr, field, {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        return value;
                    },
                    set: function (next) {
                        value = scrubObject(next);
                    }
                });
            } catch (e) {
                // ignore
            }
        });
    }

    installNreumTrap();

    // Late assignments / inline config after our traps
    var passes = 0;
    var timer = setInterval(function () {
        passes += 1;
        if (window.NREUM) scrubNreum(window.NREUM);
        if (window.newrelic && window.newrelic !== window.NREUM) {
            scrubNreum(window.newrelic);
        }
        if (passes >= 50) clearInterval(timer);
    }, 50);
})();
