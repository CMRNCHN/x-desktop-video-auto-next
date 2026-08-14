// ==UserScript==
// @name        CitizenM NewRelic Sanitizer
// @version     1.9
// @description Strip askDonation from client JSON
// @match       https://service.citizenm.com/*
// @run-at      document-start
// @grant       none
// @inject-into auto
// ==/UserScript==

(function () {
    "use strict";

    var keyRe = /,?\s*["']?askDonation["']?\s*:\s*(?:true|false|null|undefined|-?\d+(?:\.\d+)?|["'][^"']*["'])\s*/gi;

    var strip = function (text) {
        if (typeof text !== "string" || text.indexOf("askDonation") === -1) {
            return text;
        }
        return text
            .replace(keyRe, "")
            .replace(/\{\s*,/g, "{")
            .replace(/\[\s*,/g, "[")
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/,\s*,/g, ",");
    };

    var originalParse = JSON.parse;
    JSON.parse = function (text, reviver) {
        if (typeof text === "string") {
            text = strip(text);
        }
        return originalParse.call(this, text, reviver);
    };
})();
