const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "assets", "social-signal-config.json");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const signalsPath = path.join(repoRoot, "assets", "external-signals.json");

const today = new Date().toISOString().slice(0, 10);

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&+＋x×]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function textContainsName(text, names) {
  const normalized = normalizeName(text);
  return names.some((name) => {
    const n = normalizeName(name);
    return n.length >= 2 && normalized.includes(n);
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const msg = parsed?.error?.message || `${res.statusCode}`;
            reject(new Error(`HTTP ${res.statusCode}: ${msg}`));
            return;
          }
          resolve(parsed);
        });
      })
      .on("error", reject);
  });
}

function distinct(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function awardPriority(row, priorityGuides) {
  const awards = row.awards || [];
  const priority = priorityGuides.findIndex((guide) => awards.some((a) => a.guide === guide));
  return priority >= 0 ? priority : priorityGuides.length + 1;
}

function buildRestaurantCandidates(config, awards) {
  const priorityGuides = config.restaurantSource?.priorityGuides || [];
  const skipGuides = new Set(config.restaurantSource?.skipGuides || []);
  const maxNameLength = Number(config.restaurantSource?.maxNameLength || 48);
  return (awards.restaurants || [])
    .filter((row) => row.name && (row.city || row.address))
    .filter((row) => !(row.awards || []).some((award) => skipGuides.has(award.guide)))
    .filter((row) => String(row.name).length <= maxNameLength)
    .map((row) => ({
      name: row.name,
      aliases: distinct(row.aliases || []),
      city: row.city || cityFromAddress(row.address) || "",
      area: row.area || areaFromAddress(row.address) || "",
      address: row.address || "",
      awards: row.awards || [],
      priority: awardPriority(row, priorityGuides),
    }))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "zh-Hant"));
}

function cityFromAddress(address) {
  const match = String(address || "").match(/([台臺][北中南東]市|新北市|桃園市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/);
  return match ? match[1].replace(/臺/g, "台") : "";
}

function areaFromAddress(address) {
  const match = String(address || "").match(/([^縣市,，\s]+[區鄉鎮市])/);
  return match ? match[1] : "";
}

function fillQuery(template, row) {
  return String(template || "{city} {name} 美食")
    .replace(/\{name\}/g, row.name)
    .replace(/\{city\}/g, row.city || "")
    .replace(/\{area\}/g, row.area || "")
    .replace(/\s+/g, " ")
    .trim();
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days || 180));
  return date.toISOString();
}

function youtubeSearchUrl(apiKey, query, config) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(config.defaultMaxResultsPerRestaurant || 8),
    order: "relevance",
    q: query,
    publishedAfter: daysAgo(config.publishedWithinDays || 180),
    regionCode: config.regionCode || "TW",
    relevanceLanguage: config.relevanceLanguage || "zh-Hant",
    key: apiKey,
  });
  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

function youtubeVideosUrl(apiKey, ids) {
  const params = new URLSearchParams({
    part: "statistics,snippet",
    id: ids.join(","),
    key: apiKey,
  });
  return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
}

function calculateYoutubeScore(metrics, config) {
  const scoreConfig = config.score || {};
  const viewPart = Math.log10((metrics.totalViews || 0) + 1) * Number(scoreConfig.viewLogWeight || 18);
  const videoPart = (metrics.videoCount || 0) * Number(scoreConfig.videoWeight || 6);
  const recentPart = (metrics.recentVideoCount || 0) * Number(scoreConfig.recentVideoWeight || 4);
  return Math.min(Number(scoreConfig.cap || 100), Math.round(viewPart + videoPart + recentPart));
}

async function fetchYoutubeSignal(apiKey, row, config) {
  const names = distinct([row.name, ...(row.aliases || [])]);
  const query = fillQuery(config.queryTemplate, row);
  const search = await requestJson(youtubeSearchUrl(apiKey, query, config));
  const videoIds = (search.items || [])
    .map((item) => item.id?.videoId)
    .filter(Boolean);
  if (!videoIds.length) return null;

  const videos = await requestJson(youtubeVideosUrl(apiKey, videoIds));
  const matched = (videos.items || [])
    .map((video) => {
      const title = video.snippet?.title || "";
      const description = video.snippet?.description || "";
      if (!textContainsName(`${title} ${description}`, names)) return null;
      return {
        id: video.id,
        title,
        channelTitle: video.snippet?.channelTitle || "",
        publishedAt: video.snippet?.publishedAt || "",
        views: Number(video.statistics?.viewCount || 0),
        url: `https://www.youtube.com/watch?v=${video.id}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.views - a.views);

  if (!matched.length) return null;
  const metrics = {
    videoCount: matched.length,
    recentVideoCount: matched.filter((video) => {
      const age = Date.now() - new Date(video.publishedAt).getTime();
      return Number.isFinite(age) && age <= 90 * 24 * 60 * 60 * 1000;
    }).length,
    totalViews: matched.reduce((sum, video) => sum + video.views, 0),
    topVideos: matched.slice(0, 3),
    query,
  };
  const score = calculateYoutubeScore(metrics, config);
  return {
    type: "youtubeBuzz",
    sourceId: "youtube-api",
    label: score >= 75 ? "影音熱度高" : "影音提及",
    score,
    confidence: matched.length >= 3 ? "high" : "medium",
    metrics,
    evidence: matched.slice(0, 3).map((video) => `${video.channelTitle}：${video.title}`),
    url: matched[0]?.url || "",
    updated: today,
    generatedBy: "scripts/update-external-signals.js",
  };
}

function ensureCatalog(signals) {
  signals.sourceCatalog = Array.isArray(signals.sourceCatalog) ? signals.sourceCatalog : [];
  if (!signals.sourceCatalog.some((source) => source.id === "youtube-api")) {
    signals.sourceCatalog.push({
      id: "youtube-api",
      label: "YouTube Data API",
      type: "social",
      updateCadence: "weekly",
      runtimeLookup: false,
      quotaPolicy: "batch-only; default 10 restaurant searches per run",
    });
  }
  signals.signalDefinitions = signals.signalDefinitions || {};
  signals.signalDefinitions.youtubeBuzz = signals.signalDefinitions.youtubeBuzz || {
    label: "影音聲量",
    scoreRange: [0, 100],
    display: "badgeWhenHighConfidence",
    rankUse: "light",
  };
}

function signalKey(signal) {
  return `${signal.type}|${signal.sourceId}`;
}

function mergeRestaurantSignal(signals, row, signal) {
  signals.restaurants = Array.isArray(signals.restaurants) ? signals.restaurants : [];
  const rowNames = [row.name, ...(row.aliases || [])].map(normalizeName);
  let target = signals.restaurants.find((item) => {
    if ((item.city || "") !== (row.city || "")) return false;
    const names = [item.name, ...(item.aliases || [])].map(normalizeName);
    return rowNames.some((name) => names.includes(name));
  });
  if (!target) {
    target = {
      placeId: "",
      name: row.name,
      city: row.city || "",
      area: row.area || "",
      aliases: row.aliases || [],
      signals: [],
    };
    signals.restaurants.push(target);
  }
  target.signals = (target.signals || []).filter((existing) => signalKey(existing) !== signalKey(signal));
  target.signals.push(signal);
}

function nextOffset(signals, total, count) {
  const current = Number(signals.automation?.nextAwardOffset || 0);
  if (!Number.isFinite(current) || current < 0) return count % total;
  return (current + count) % Math.max(total, 1);
}

async function main() {
  const config = readJson(configPath);
  const awards = readJson(awardsPath, { restaurants: [] });
  const signals = readJson(signalsPath, { restaurants: [] });
  ensureCatalog(signals);

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY || "";
  const maxRestaurants = Number(process.env.SOCIAL_SIGNAL_MAX_RESTAURANTS || config.youtube?.defaultMaxRestaurants || 10);
  const offset = Number(process.env.SOCIAL_SIGNAL_OFFSET || signals.automation?.nextAwardOffset || 0);
  const candidates = buildRestaurantCandidates(config, awards);
  const selected = candidates.slice(offset, offset + maxRestaurants);
  const wrapped = selected.length < maxRestaurants
    ? selected.concat(candidates.slice(0, maxRestaurants - selected.length))
    : selected;

  const report = {
    generatedAt: new Date().toISOString(),
    provider: "youtube",
    apiEnabled: Boolean(apiKey),
    totalCandidates: candidates.length,
    offset,
    requestedRestaurants: wrapped.length,
    updatedSignals: 0,
    skippedNoMatch: 0,
    errors: [],
  };

  if (!apiKey) {
    signals.version = `api-batch-${today}`;
    signals.updated = today;
    signals.automation = {
      ...(signals.automation || {}),
      provider: "youtube",
      lastRun: new Date().toISOString(),
      lastStatus: "skipped_missing_api_key",
      nextAwardOffset: offset,
      note: "Set YOUTUBE_API_KEY in the environment or GitHub Actions secrets.",
    };
    writeJson(signalsPath, signals);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const row of wrapped) {
    try {
      const signal = await fetchYoutubeSignal(apiKey, row, config.youtube || {});
      if (signal) {
        mergeRestaurantSignal(signals, row, signal);
        report.updatedSignals += 1;
      } else {
        report.skippedNoMatch += 1;
      }
    } catch (error) {
      report.errors.push({ name: row.name, message: error.message });
    }
  }

  signals.version = `api-batch-${today}`;
  signals.updated = today;
  signals.automation = {
    ...(signals.automation || {}),
    provider: "youtube",
    lastRun: new Date().toISOString(),
    lastStatus: report.errors.length ? "completed_with_errors" : "completed",
    lastUpdatedSignals: report.updatedSignals,
    nextAwardOffset: nextOffset(signals, candidates.length, wrapped.length),
  };
  writeJson(signalsPath, signals);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
