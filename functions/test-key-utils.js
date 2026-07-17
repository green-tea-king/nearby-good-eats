"use strict";

const assert = require("node:assert/strict");
const { sanitizeApiKey, authorizationHeader } = require("./key-utils");

assert.equal(sanitizeApiKey("\uFEFF  test-key\r\n"), "test-key");
assert.equal(sanitizeApiKey("plain-key"), "plain-key");
assert.throws(() => sanitizeApiKey("\uFEFF \r\n"), /empty API key/);
assert.equal(authorizationHeader(new Headers({ authorization:"Bearer token-a" })), "Bearer token-a");
assert.equal(authorizationHeader({ Authorization:"Bearer token-b" }), "Bearer token-b");
assert.throws(() => authorizationHeader({}), /missing authorization header/);

console.log("key utils tests passed");
