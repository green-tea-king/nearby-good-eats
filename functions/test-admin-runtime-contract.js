"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { createSearchQuotaEnforcer } = require("./search-quota");

const PROJECT_ID = "nearby-good-eats";

function assertLocalEmulator(name, value, expectedPort) {
  assert.ok(value, `${name} must be configured`);
  const endpoint = new URL(`http://${value}`);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname), `${name} must be local`);
  assert.equal(endpoint.port, String(expectedPort), `${name} must use the test port`);
}

function addExpressResponseMethods(res) {
  res.set = (name, value) => {
    res.setHeader(name, value);
    return res;
  };
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (payload) => {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
    return res;
  };
  res.send = (payload) => {
    res.end(payload);
    return res;
  };
}

async function createEmulatorUser() {
  const endpoint = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
  const email = `runtime-contract-${Date.now()}@example.test`;
  const response = await fetch(
    `${endpoint}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "emulator-contract-password", returnSecureToken: true }),
    }
  );
  const body = await response.json();
  assert.equal(response.status, 200, `Auth Emulator sign-up failed: ${JSON.stringify(body)}`);
  assert.ok(body.idToken, "Auth Emulator did not return an ID token");
  return { email, idToken: body.idToken, uid: body.localId };
}

async function startApiServer(api) {
  const server = http.createServer(async (req, res) => {
    addExpressResponseMethods(res);
    req.body = { action: "unknown", payload: {} };
    try {
      await api(req, res);
    } catch (error) {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

async function postApi(server, headers = {}) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ action: "unknown", payload: {} }),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  assert.equal(process.version.split(".")[0], "v22", "runtime contract must run on Node 22");
  assert.equal(process.env.GCLOUD_PROJECT, PROJECT_ID, "unexpected Firebase project namespace");
  assert.equal(process.env.GOOGLE_CLOUD_PROJECT, PROJECT_ID, "unexpected Google project namespace");
  assertLocalEmulator("FIRESTORE_EMULATOR_HOST", process.env.FIRESTORE_EMULATOR_HOST, 18080);
  assertLocalEmulator("FIREBASE_AUTH_EMULATOR_HOST", process.env.FIREBASE_AUTH_EMULATOR_HOST, 19099);

  const { api } = require("./index");
  const db = getFirestore();
  const enforceSearchQuota = createSearchQuotaEnforcer({
    db,
    FieldValue,
    isAdminEmail: async () => false,
    httpError(message, status, extra = {}) {
      const error = new Error(message);
      error.status = status;
      Object.assign(error, extra);
      return error;
    },
    dailySearchLimit: 30,
    disableSearchQuota: false,
  });

  const identity = await createEmulatorUser();
  const payload = { __quota: { key: "runtime-contract-same-request" }, textQuery: "emulator-only" };
  const first = await enforceSearchQuota(identity, "textSearch", payload);
  const second = await enforceSearchQuota(identity, "textSearch", payload);
  assert.equal(first.quotaCharged, true);
  assert.equal(second.quotaCharged, false);
  console.log("PASS Firestore transaction charges the first quota request only");

  const quotaSnapshot = await db.collection("quotaUsage").where("uid", "==", identity.uid).get();
  assert.equal(quotaSnapshot.size, 1, "expected one quota aggregate document");
  const quotaDocument = quotaSnapshot.docs[0];
  assert.equal(quotaDocument.data().searchCount, 1);
  assert.ok(quotaDocument.data().updatedAt instanceof Timestamp, "quota updatedAt is not a Firestore Timestamp");
  const requestSnapshot = await quotaDocument.ref.collection("requests").get();
  assert.equal(requestSnapshot.size, 1, "expected one deduplicated quota request document");
  assert.ok(requestSnapshot.docs[0].data().createdAt instanceof Timestamp, "request createdAt is not a Firestore Timestamp");
  console.log("PASS Firestore request createdAt and aggregate updatedAt resolve to server timestamps");

  const server = await startApiServer(api);
  try {
    const withoutAuth = await postApi(server);
    assert.equal(withoutAuth.status, 401);
    assert.equal(withoutAuth.body.error, "missing auth token");
    console.log("PASS API rejects a request without Firebase Auth with HTTP 401");

    const authorization = { authorization: `Bearer ${identity.idToken}` };
    const missingAppCheck = await postApi(server, authorization);
    assert.equal(missingAppCheck.status, 401);
    assert.equal(missingAppCheck.body.error, "missing app check token");
    console.log("PASS API accepts Auth Emulator identity then rejects missing App Check with HTTP 401");

    const invalidAppCheck = await postApi(server, {
      ...authorization,
      "x-firebase-appcheck": "not-a-jwt",
    });
    assert.equal(invalidAppCheck.status, 401);
    assert.equal(invalidAppCheck.body.error, "invalid app check token");
    console.log("PASS API accepts Auth Emulator identity then rejects invalid App Check with HTTP 401");
  } finally {
    server.close();
    await once(server, "close");
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
