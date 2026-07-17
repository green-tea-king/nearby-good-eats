"use strict";

const assert = require("node:assert/strict");
const { localizedText } = require("./summary-utils");

assert.equal(localizedText("plain"), "plain");
assert.equal(localizedText({ text:"editorial" }), "editorial");
assert.equal(localizedText({ text:{ text:"review", languageCode:"zh-TW" } }), "review");
assert.equal(localizedText({ overview:{ text:"generative", languageCode:"zh-TW" } }), "generative");
assert.equal(localizedText({}), "");

console.log("summary utils tests passed");
