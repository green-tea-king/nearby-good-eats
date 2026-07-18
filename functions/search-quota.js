"use strict";

const crypto = require("node:crypto");

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

function createSearchQuotaEnforcer({
  db,
  FieldValue,
  isAdminEmail,
  httpError,
  disableSearchQuota = false,
  dailySearchLimit = 30,
}) {
  const searchActions = new Set(["textSearch", "nearbySearch"]);

  return async function enforceSearchQuota(decoded, action, payload = {}) {
    if (!searchActions.has(action)) {
      return { quotaCharged: false, quotaAdmin: false, quotaTestOpen: disableSearchQuota, quotaLimit: dailySearchLimit, quotaRemaining: null };
    }
    if (disableSearchQuota) {
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
    let quotaResult = { quotaCharged: false, quotaAdmin: false, quotaLimit: dailySearchLimit, quotaRemaining: dailySearchLimit };
    await db.runTransaction(async (tx) => {
      const [quotaSnap, requestSnap] = await Promise.all([tx.get(quotaDoc), tx.get(requestDoc)]);
      const currentCount = Number(quotaSnap.data()?.searchCount || 0);
      if (requestSnap.exists) {
        quotaResult = {
          quotaCharged: false,
          quotaAdmin: false,
          quotaLimit: dailySearchLimit,
          quotaRemaining: Math.max(0, dailySearchLimit - currentCount),
        };
        return;
      }
      if (currentCount >= dailySearchLimit) {
        throw httpError("今日搜尋額度已用完（30次）", 429, {
          quotaBlocked: true,
          quotaLimit: dailySearchLimit,
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
        limit: dailySearchLimit,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      quotaResult = {
        quotaCharged: true,
        quotaAdmin: false,
        quotaLimit: dailySearchLimit,
        quotaRemaining: Math.max(0, dailySearchLimit - currentCount - 1),
      };
    });
    return quotaResult;
  };
}

module.exports = { createSearchQuotaEnforcer, stripInternalPayload };
