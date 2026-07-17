"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

assert.doesNotMatch(
  source,
  /require\(["']firebase-admin["']\)/,
  "legacy firebase-admin namespace import remains"
);
assert.doesNotMatch(
  source,
  /\badmin\.(?:initializeApp|auth|appCheck|firestore)\b/,
  "legacy firebase-admin namespace call remains"
);

assert.match(source, /require\(["']firebase-admin\/app["']\)/);
assert.match(source, /require\(["']firebase-admin\/auth["']\)/);
assert.match(source, /require\(["']firebase-admin\/app-check["']\)/);
assert.match(source, /require\(["']firebase-admin\/firestore["']\)/);
assert.match(source, /\binitializeApp\(\)/);
assert.match(source, /\bgetFirestore\(\)/);
assert.match(source, /\bgetAuth\(\)\.verifyIdToken\(/);
assert.match(source, /\bgetAppCheck\(\)\.verifyToken\(/);
assert.match(source, /\bFieldValue\.serverTimestamp\(\)/);

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

assert.equal(typeof initializeApp, "function");
assert.equal(typeof getAuth, "function");
assert.equal(typeof getAppCheck, "function");
assert.equal(typeof getFirestore, "function");
assert.equal(typeof FieldValue.serverTimestamp, "function");

console.log("Firebase Admin SDK modular contract tests passed");
