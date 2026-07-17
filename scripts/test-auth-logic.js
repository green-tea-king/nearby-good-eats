const assert = require("node:assert/strict");
const { loginStrategy } = require("../assets/auth-logic.js");

assert.equal(loginStrategy({ embedded:false }), "popup");
assert.equal(loginStrategy({ embedded:true }), "external-browser-required");

console.log("auth logic tests passed");
