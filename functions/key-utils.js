"use strict";

function sanitizeApiKey(value) {
  const key = String(value || "").replace(/^\uFEFF/, "").trim();
  if (!key) throw new Error("empty API key");
  return key;
}

function authorizationHeader(headers) {
  const value = typeof headers?.get === "function"
    ? headers.get("authorization")
    : (headers?.authorization || headers?.Authorization || "");
  if (!value) throw new Error("missing authorization header");
  return value;
}

module.exports = { sanitizeApiKey, authorizationHeader };
