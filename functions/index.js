const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

admin.initializeApp();
const db = admin.firestore();
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

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
  "places.hasDineIn",
  "places.hasTakeout",
  "places.hasDelivery",
  "places.hasCurbsidePickup",
  "places.isReservable",
  "places.hasOutdoorSeating",
  "places.allowsDogs",
  "places.hasLiveMusic",
  "places.isGoodForChildren",
  "places.isGoodForGroups",
  "places.hasMenuForChildren",
  "places.hasRestroom",
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
  "hasDineIn",
  "hasTakeout",
  "hasDelivery",
  "hasCurbsidePickup",
  "isReservable",
  "hasOutdoorSeating",
  "allowsDogs",
  "hasLiveMusic",
  "isGoodForChildren",
  "isGoodForGroups",
  "hasMenuForChildren",
  "hasRestroom",
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
  res.set("Access-Control-Allow-Headers", "authorization, content-type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function requireUser(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const err = new Error("missing auth token");
    err.status = 401;
    throw err;
  }
  return admin.auth().verifyIdToken(match[1]);
}

function textOf(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.text || "";
}

function photoUrls(place) {
  return (place.photos || []).slice(0, 3).map((ph) => {
    const name = encodeURIComponent(ph.name || "");
    return name ? `https://us-central1-nearby-good-eats.cloudfunctions.net/photo?name=${name}` : "";
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
    dineIn: place.hasDineIn === true,
    takeout: place.hasTakeout === true,
    delivery: place.hasDelivery === true,
    curbside: place.hasCurbsidePickup === true,
    reservable: place.isReservable === true,
    outdoor: place.hasOutdoorSeating === true,
    allowsDogs: place.allowsDogs === true,
    liveMusic: place.hasLiveMusic === true,
    goodKids: place.isGoodForChildren === true,
    goodGroups: place.isGoodForGroups === true,
    menuKids: place.hasMenuForChildren === true,
    restroom: place.hasRestroom === true,
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

async function googleJson(url, options = {}) {
  const key = GOOGLE_MAPS_API_KEY.value();
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
  });
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
  });
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
  });
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
  });
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

function classifyOne(item) {
  const text = `${item.name || ""} ${item.type || ""} ${item.address || ""} ${item.reviewSummary || ""} ${item.editorialSummary || ""} ${item.generativeSummary || ""}`.toLowerCase();
  const has = (re) => re.test(text);
  const tags = { occasion: [], service: [], cuisine: [], style: [], type: [], diet: [] };
  const confidence = {};
  if (item.googleFlags?.goodGroups || item.googleFlags?.reservable || has(/聚餐|包廂|火鍋|燒肉|合菜|桌菜|buffet|吃到飽|group|family|bbq|hot.?pot/)) {
    tags.occasion.push("聚餐"); confidence.occasion = item.googleFlags?.goodGroups ? 0.9 : 0.72;
  } else {
    tags.occasion.push("獨享"); confidence.occasion = 0.58;
  }
  if (has(/吃到飽|自助餐|buffet|all.?you.?can.?eat|放題|饗食|旭集|饗饗|海港/)) {
    tags.service.push("吃到飽"); confidence.service = 0.82;
  } else {
    tags.service.push("單點"); confidence.service = 0.56;
  }
  if (item.googleFlags?.servesVeg || has(/素食|蔬食|vegan|vegetarian/)) {
    tags.diet.push("素食"); confidence.diet = item.googleFlags?.servesVeg ? 0.9 : 0.7;
  } else {
    tags.diet.push("葷食"); confidence.diet = 0.55;
  }
  if (has(/中式|台菜|牛肉麵|火鍋|粵|川菜|江浙|麵|餃/)) tags.cuisine.push("中式");
  if (has(/西式|義式|法式|美式|pizza|pasta|burger|steak|bistro/)) tags.cuisine.push("西式");
  if (has(/老店|傳統|古早|老字號/)) tags.style.push("傳統");
  if (has(/創意|現代|fusion|bistro|無國界|餐酒館/)) tags.style.push("現代");
  return { id: item.id, tags, confidence };
}

async function aiClassify(payload) {
  return { items: (payload.items || []).map(classifyOne) };
}

const handlers = { textSearch, nearbySearch, placeDetails, routeMatrix, aiClassify };

async function logApiEvent(decoded, action, started, ok, extra = {}) {
  try {
    await db.collection("apiEvents").add({
      uid: decoded.uid,
      email: decoded.email || "",
      action,
      ok,
      latencyMs: Date.now() - started,
      estimatedUnits: extra.estimatedUnits || 1,
      error: extra.error || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }
    decoded = await requireUser(req);
    action = String(req.body?.action || "");
    const handler = handlers[action];
    if (!handler) {
      const err = new Error("unknown action");
      err.status = 400;
      throw err;
    }
    const result = await handler(req.body?.payload || {});
    await logApiEvent(decoded, action, started, true, { estimatedUnits: action === "routeMatrix" ? 2 : 1 });
    res.json(result);
  } catch (e) {
    if (decoded) await logApiEvent(decoded, action || "unknown", started, false, { error: e.message });
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
    const url = `https://places.googleapis.com/v1/${rawName}/media?maxWidthPx=720&key=${GOOGLE_MAPS_API_KEY.value()}`;
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
