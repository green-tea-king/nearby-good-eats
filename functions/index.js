const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { GoogleAuth } = require("google-auth-library");
const { MAX_ITEMS:AI_MAX_ITEMS, buildVertexRequest, parseVertexResponse } = require("./ai-classifier");
const { sanitizeApiKey, authorizationHeader } = require("./key-utils");
const { localizedText } = require("./summary-utils");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");
const REQUIRE_APP_CHECK = process.env.REQUIRE_APP_CHECK !== "false";
// Secure defaults: App Check and the 30/day quota are enabled unless explicitly disabled for a local test.
const DISABLE_SEARCH_QUOTA = process.env.DISABLE_SEARCH_QUOTA === "true";
const DAILY_SEARCH_LIMIT = Number(process.env.DAILY_SEARCH_LIMIT || 30);
const VERTEX_AI_MODEL = process.env.VERTEX_AI_MODEL || "gemini-2.5-flash-lite";
const vertexAuth = new GoogleAuth({ scopes:["https://www.googleapis.com/auth/cloud-platform"] });
const SEARCH_ACTIONS = new Set(["textSearch", "nearbySearch"]);
const API_COST_USD = {
  textSearch: 0.032,
  nearbySearch: 0.032,
  placeDetails: 0.017,
  routeMatrix: 0.01,
  geocode: 0.005,
  aiClassify: 0,
};

const ALLOWED_ORIGINS = new Set([
  "https://green-tea-king.github.io",
  "http://127.0.0.1:4177",
  "http://localhost:4177",
]);

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.priceRange",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.photos",
  "places.dineIn",
  "places.takeout",
  "places.delivery",
  "places.curbsidePickup",
  "places.reservable",
  "places.outdoorSeating",
  "places.allowsDogs",
  "places.liveMusic",
  "places.goodForChildren",
  "places.goodForGroups",
  "places.menuForChildren",
  "places.restroom",
  "places.accessibilityOptions",
  "places.paymentOptions",
  "places.parkingOptions",
  "places.servesVegetarianFood",
  "places.servesBeer",
  "places.servesWine",
  "places.servesCocktails",
  "places.servesBreakfast",
  "places.servesLunch",
  "places.servesDinner",
  "places.servesBrunch",
  "places.servesDessert",
  "places.servesCoffee",
  "places.editorialSummary",
  "places.generativeSummary",
  "places.reviewSummary",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "priceRange",
  "regularOpeningHours",
  "businessStatus",
  "formattedAddress",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "primaryType",
  "primaryTypeDisplayName",
  "photos",
  "dineIn",
  "takeout",
  "delivery",
  "curbsidePickup",
  "reservable",
  "outdoorSeating",
  "allowsDogs",
  "liveMusic",
  "goodForChildren",
  "goodForGroups",
  "menuForChildren",
  "restroom",
  "accessibilityOptions",
  "paymentOptions",
  "parkingOptions",
  "servesVegetarianFood",
  "servesBeer",
  "servesWine",
  "servesCocktails",
  "servesBreakfast",
  "servesLunch",
  "servesDinner",
  "servesBrunch",
  "servesDessert",
  "servesCoffee",
  "editorialSummary",
  "generativeSummary",
  "reviewSummary",
].join(",");

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Headers", "authorization, content-type, x-firebase-appcheck");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function httpError(message, status, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

async function requireUser(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw httpError("missing auth token", 401);
  }
  return getAuth().verifyIdToken(match[1]);
}

async function verifyAppCheck(req) {
  const token = req.headers["x-firebase-appcheck"] || req.headers["X-Firebase-AppCheck"];
  if (!token) {
    if (REQUIRE_APP_CHECK) throw httpError("missing app check token", 401, { appCheckMissing: true });
    return { ok: false, required: false, missing: true };
  }
  try {
    const decoded = await getAppCheck().verifyToken(String(token));
    return { ok: true, appId: decoded.appId || "" };
  } catch (e) {
    if (REQUIRE_APP_CHECK) throw httpError("invalid app check token", 401, { appCheckInvalid: true });
    return { ok: false, required: false, error: e.message };
  }
}

async function isAdminEmail(email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return false;
  try {
    const snap = await db.collection("admins").doc(normalized).get();
    if (snap.exists) return true;
  } catch (e) {
    logger.warn("admin lookup failed", { email: normalized, error: e.message });
  }
  return normalized === "rh.taipei@gmail.com";
}

function taipeiDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);
}

function stripInternalPayload(payload = {}) {
  const clean = { ...payload };
  delete clean.__quota;
  return clean;
}

function estimatedUnits(action) {
  if (action === "routeMatrix") return 2;
  if (action === "aiClassify") return 0;
  return 1;
}

function estimatedCostUsd(action) {
  return Number(API_COST_USD[action] || 0);
}

async function enforceSearchQuota(decoded, action, payload = {}) {
  if (!SEARCH_ACTIONS.has(action)) {
    return { quotaCharged: false, quotaAdmin: false, quotaTestOpen: DISABLE_SEARCH_QUOTA, quotaLimit: DAILY_SEARCH_LIMIT, quotaRemaining: null };
  }
  if (DISABLE_SEARCH_QUOTA) {
    return { quotaCharged: false, quotaAdmin: false, quotaTestOpen: true, quotaLimit: null, quotaRemaining: null };
  }
  const adminUser = await isAdminEmail(decoded.email || "");
  if (adminUser) {
    return { quotaCharged: false, quotaAdmin: true, quotaTestOpen: false, quotaLimit: null, quotaRemaining: null };
  }
  const day = taipeiDayKey();
  const quotaDoc = db.collection("quotaUsage").doc(`${decoded.uid}_${day}`);
  const quotaKey = String(payload.__quota?.key || `${action}:${JSON.stringify(stripInternalPayload(payload)).slice(0, 1200)}`);
  const requestDoc = quotaDoc.collection("requests").doc(hashKey(quotaKey));
  const requestHash = requestDoc.id;
  let quotaResult = { quotaCharged: false, quotaAdmin: false, quotaLimit: DAILY_SEARCH_LIMIT, quotaRemaining: DAILY_SEARCH_LIMIT };
  await db.runTransaction(async (tx) => {
    const [quotaSnap, requestSnap] = await Promise.all([tx.get(quotaDoc), tx.get(requestDoc)]);
    const currentCount = Number(quotaSnap.data()?.searchCount || 0);
    if (requestSnap.exists) {
      quotaResult = {
        quotaCharged: false,
        quotaAdmin: false,
        quotaLimit: DAILY_SEARCH_LIMIT,
        quotaRemaining: Math.max(0, DAILY_SEARCH_LIMIT - currentCount),
      };
      return;
    }
    if (currentCount >= DAILY_SEARCH_LIMIT) {
      throw httpError("今日搜尋額度已用完（30次）", 429, {
        quotaBlocked: true,
        quotaLimit: DAILY_SEARCH_LIMIT,
        quotaRemaining: 0,
      });
    }
    tx.set(requestDoc, {
      action,
      keyHash: requestHash,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(quotaDoc, {
      uid: decoded.uid,
      email: decoded.email || "",
      day,
      searchCount: currentCount + 1,
      limit: DAILY_SEARCH_LIMIT,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    quotaResult = {
      quotaCharged: true,
      quotaAdmin: false,
      quotaLimit: DAILY_SEARCH_LIMIT,
      quotaRemaining: Math.max(0, DAILY_SEARCH_LIMIT - currentCount - 1),
    };
  });
  return quotaResult;
}

function textOf(v) {
  return localizedText(v);
}

function photoSignature(name, exp) {
  return crypto.createHmac("sha256", googleApiKey("PHOTOS"))
    .update(`${name}|${exp}`)
    .digest("base64url");
}

function validPhotoSignature(name, exp, sig) {
  const expires = Number(exp || 0);
  if (!name || !sig || !Number.isFinite(expires) || Date.now() > expires) return false;
  const expected = Buffer.from(photoSignature(name, expires));
  const actual = Buffer.from(String(sig));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function photoUrls(place) {
  return (place.photos || []).slice(0, 3).map((ph) => {
    const rawName = ph.name || "";
    if (!rawName) return "";
    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const name = encodeURIComponent(rawName);
    const sig = encodeURIComponent(photoSignature(rawName, exp));
    return `https://us-central1-nearby-good-eats.cloudfunctions.net/photo?name=${name}&exp=${exp}&sig=${sig}`;
  }).filter(Boolean);
}

function normalizePlace(place) {
  const photos = photoUrls(place);
  return {
    id: place.id || "",
    name: textOf(place.displayName),
    loc: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null,
    rating: place.rating || 0,
    count: place.userRatingCount || 0,
    priceLevel: place.priceLevel || "",
    priceText: priceRangeText(place.priceRange),
    openNow: openNow(place.regularOpeningHours),
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    typeName: textOf(place.primaryTypeDisplayName),
    pt: place.primaryType || "",
    ptd: textOf(place.primaryTypeDisplayName),
    website: place.websiteUri || "",
    mapsUri: place.googleMapsUri || "",
    photos,
    photo: photos[0] || "",
    photoBig: photos[0] || "",
    dineIn: place.dineIn === true,
    takeout: place.takeout === true,
    delivery: place.delivery === true,
    curbside: place.curbsidePickup === true,
    reservable: place.reservable === true,
    outdoor: place.outdoorSeating === true,
    allowsDogs: place.allowsDogs === true,
    liveMusic: place.liveMusic === true,
    goodKids: place.goodForChildren === true,
    goodGroups: place.goodForGroups === true,
    menuKids: place.menuForChildren === true,
    restroom: place.restroom === true,
    servesVeg: place.servesVegetarianFood === true,
    servesAlcohol: place.servesBeer === true || place.servesWine === true || place.servesCocktails === true,
    servesBreakfast: place.servesBreakfast === true,
    servesLunch: place.servesLunch === true,
    servesDinner: place.servesDinner === true,
    servesBrunch: place.servesBrunch === true,
    servesDessert: place.servesDessert === true,
    servesCoffee: place.servesCoffee === true,
    reviewSummary: textOf(place.reviewSummary),
    summary: textOf(place.editorialSummary),
    generativeSummary: textOf(place.generativeSummary),
    accessStr: optionText(place.accessibilityOptions),
    payStr: optionText(place.paymentOptions),
    parkStr: optionText(place.parkingOptions),
    awards: [],
    aiReason: null,
  };
}

function optionText(obj) {
  if (!obj || typeof obj !== "object") return "";
  return Object.entries(obj).filter(([, v]) => v === true).map(([k]) => k).join(", ");
}

function priceRangeText(pr) {
  if (!pr) return "";
  const s = pr.startPrice?.units;
  const e = pr.endPrice?.units;
  const c = pr.startPrice?.currencyCode || pr.endPrice?.currencyCode || "";
  if (s && e) return `${c} ${s}-${e}`;
  if (s) return `${c} ${s}+`;
  return "";
}

function openNow(oh) {
  if (!oh || !Array.isArray(oh.periods) || !oh.periods.length) return null;
  const now = new Date();
  const mow = now.getUTCDay() * 1440 + (now.getUTCHours() + 8) % 24 * 60 + now.getUTCMinutes();
  for (const p of oh.periods) {
    if (!p.open) continue;
    const s = p.open.day * 1440 + (p.open.hour || 0) * 60 + (p.open.minute || 0);
    let e = p.close ? p.close.day * 1440 + (p.close.hour || 0) * 60 + (p.close.minute || 0) : s + 1440;
    if (e <= s) e += 7 * 1440;
    if ((mow >= s && mow < e) || (mow + 7 * 1440 >= s && mow + 7 * 1440 < e)) return true;
  }
  return false;
}

function googleApiKey(purpose = "PLACES") {
  return sanitizeApiKey(process.env[`GOOGLE_${purpose}_API_KEY`] || GOOGLE_MAPS_API_KEY.value());
}

async function googleJson(url, options = {}, purpose = "PLACES") {
  const key = googleApiKey(purpose);
  const res = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

async function textSearch(payload) {
  const body = {
    textQuery: payload.textQuery,
    maxResultCount: Math.min(Number(payload.maxResultCount || 20), 20),
    languageCode: "zh-TW",
    regionCode: "TW",
  };
  const bias = payload.locationBias || null;
  if (bias?.center && Number.isFinite(Number(bias.center.lat)) && Number.isFinite(Number(bias.center.lng))) {
    body.locationBias = {
      circle: {
        center: {
          latitude: Number(bias.center.lat),
          longitude: Number(bias.center.lng),
        },
        radius: Math.min(Number(bias.radius || 800), 5000),
      },
    };
  }
  const data = await googleJson("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "x-goog-fieldmask": FIELD_MASK },
    body: JSON.stringify(body),
  }, "PLACES");
  return { items: (data.places || []).map(normalizePlace) };
}

async function nearbySearch(payload) {
  const center = payload.center || {};
  const data = await googleJson("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "x-goog-fieldmask": FIELD_MASK },
    body: JSON.stringify({
      includedPrimaryTypes: payload.includedPrimaryTypes || ["restaurant"],
      maxResultCount: Math.min(Number(payload.maxResultCount || 20), 20),
      rankPreference: "POPULARITY",
      languageCode: "zh-TW",
      regionCode: "TW",
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: Math.min(Number(payload.radius || 800), 5000),
        },
      },
    }),
  }, "PLACES");
  return { items: (data.places || []).map(normalizePlace) };
}

async function placeDetails(payload) {
  const id = String(payload.placeId || "").trim();
  if (!id) {
    const err = new Error("missing placeId");
    err.status = 400;
    throw err;
  }
  const data = await googleJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { "x-goog-fieldmask": DETAIL_FIELDS },
  }, "PLACES");
  return { item: normalizePlace(data) };
}

async function routeMatrix(payload) {
  const origin = payload.origin || {};
  const targets = (payload.targets || []).slice(0, 20);
  const mode = payload.travelMode === "DRIVING" ? "DRIVE" : "WALK";
  const data = await googleJson("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: { "x-goog-fieldmask": "originIndex,destinationIndex,status,condition,distanceMeters,duration" },
    body: JSON.stringify({
      origins: [{ waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } } }],
      destinations: targets.map((t) => ({ waypoint: { location: { latLng: { latitude: t.lat, longitude: t.lng } } } })),
      travelMode: mode,
      units: "METRIC",
    }),
  }, "ROUTES");
  const rows = Array.isArray(data) ? data : [];
  const items = targets.map((_, i) => {
    const row = rows.find((x) => x.destinationIndex === i) || {};
    const seconds = Number(String(row.duration || "0s").replace("s", "")) || 0;
    return {
      condition: row.condition || (row.status ? row.status.code : "ROUTE_EXISTS"),
      distanceMeters: row.distanceMeters || null,
      durationMillis: seconds ? seconds * 1000 : null,
    };
  });
  return { items };
}

async function geocode(payload) {
  const address = String(payload.address || "").trim();
  if (!address) throw httpError("missing address", 400);
  const params = new URLSearchParams({
    address,
    region: "tw",
    language: "zh-TW",
    key: googleApiKey("GEOCODE"),
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "OK") {
    throw httpError(`Geocode ${data.status || res.status}: ${data.error_message || "not found"}`, res.ok ? 404 : res.status);
  }
  const first = data.results?.[0] || {};
  const loc = first.geometry?.location || {};
  return {
    center: Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng)) ? { lat:Number(loc.lat), lng:Number(loc.lng) } : null,
    formattedAddress: first.formatted_address || "",
    placeId: first.place_id || "",
  };
}

async function aiClassify(payload) {
  const items = Array.isArray(payload.items) ? payload.items.slice(0, AI_MAX_ITEMS) : [];
  if (!items.length) return { enabled:true, model:VERTEX_AI_MODEL, items:[] };
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(process.env.GCLOUD_PROJECT || "nearby-good-eats")}/locations/us-central1/publishers/google/models/${encodeURIComponent(VERTEX_AI_MODEL)}:generateContent`;
  const client = await vertexAuth.getClient();
  const authHeaders = await client.getRequestHeaders(url);
  const response = await fetch(url, {
    method:"POST",
    headers:{
      "content-type":"application/json",
      authorization:authorizationHeader(authHeaders),
    },
    body:JSON.stringify(buildVertexRequest({ ...payload, items })),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(`Vertex AI ${response.status}: ${data.error?.message || "classification failed"}`, 502);
  const allowedIds = new Set(items.map(item => String(item.id || "")).filter(Boolean));
  return {
    enabled:true,
    model:VERTEX_AI_MODEL,
    items:parseVertexResponse(data, allowedIds),
    usage:data.usageMetadata || null,
  };
}

const handlers = { textSearch, nearbySearch, placeDetails, routeMatrix, geocode, aiClassify };

async function logApiEvent(decoded, action, started, ok, extra = {}) {
  try {
    await db.collection("apiEvents").add({
      uid: decoded?.uid || "",
      email: decoded?.email || "",
      action,
      ok,
      latencyMs: Date.now() - started,
      estimatedUnits: extra.estimatedUnits ?? estimatedUnits(action),
      estimatedCostUsd: extra.estimatedCostUsd ?? estimatedCostUsd(action),
      quotaCharged: extra.quotaCharged === true,
      quotaAdmin: extra.quotaAdmin === true,
      quotaTestOpen: extra.quotaTestOpen === true,
      quotaBlocked: extra.quotaBlocked === true,
      quotaLimit: extra.quotaLimit ?? null,
      quotaRemaining: extra.quotaRemaining ?? null,
      appCheck: extra.appCheck === true,
      appId: extra.appId || "",
      error: extra.error || "",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    logger.warn("apiEvents write failed", e.message);
  }
}

exports.api = onRequest({ region: "us-central1", secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 30, memory: "512MiB" }, async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  const started = Date.now();
  let decoded = null;
  let action = "";
  let appCheck = { ok: false };
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }
    decoded = await requireUser(req);
    appCheck = await verifyAppCheck(req);
    action = String(req.body?.action || "");
    const handler = handlers[action];
    if (!handler) {
      throw httpError("unknown action", 400);
    }
    const rawPayload = req.body?.payload || {};
    const quota = await enforceSearchQuota(decoded, action, rawPayload);
    const result = await handler(stripInternalPayload(rawPayload));
    logger.info("api success", {
      action,
      itemCount: Array.isArray(result?.items) ? result.items.length : null,
      hasResult: result != null,
    });
    await logApiEvent(decoded, action, started, true, {
      ...quota,
      estimatedUnits: estimatedUnits(action),
      estimatedCostUsd: estimatedCostUsd(action),
      appCheck: appCheck.ok,
      appId: appCheck.appId || "",
    });
    res.json(result);
  } catch (e) {
    if (decoded) {
      await logApiEvent(decoded, action || "unknown", started, false, {
        error: e.message,
        quotaBlocked: e.quotaBlocked === true,
        quotaLimit: e.quotaLimit ?? null,
        quotaRemaining: e.quotaRemaining ?? null,
        appCheck: appCheck.ok,
        appId: appCheck.appId || "",
        estimatedUnits: 0,
        estimatedCostUsd: 0,
      });
    }
    logger.error("api failed", e);
    res.status(e.status || 500).json({ error: e.message || "server error" });
  }
});

exports.photo = onRequest({ region: "us-central1", secrets: [GOOGLE_MAPS_API_KEY], timeoutSeconds: 30, memory: "256MiB" }, async (req, res) => {
  const started = Date.now();
  try {
    const rawName = String(req.query.name || "");
    if (!rawName || !rawName.startsWith("places/")) {
      res.status(400).send("missing photo name");
      return;
    }
    if (!validPhotoSignature(rawName, req.query.exp, req.query.sig)) {
      res.status(403).send("invalid photo signature");
      return;
    }
    const url = `https://places.googleapis.com/v1/${rawName}/media?maxWidthPx=720&key=${googleApiKey("PHOTOS")}`;
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      res.status(upstream.status).send("photo unavailable");
      return;
    }
    res.set("cache-control", "public, max-age=86400");
    res.set("content-type", upstream.headers.get("content-type") || "image/jpeg");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    logger.warn("photo proxy failed", { error: e.message, latencyMs: Date.now() - started });
    res.status(500).send("photo proxy failed");
  }
});
