const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const externalSignalsPath = path.join(repoRoot, "assets", "external-signals.json");
const externalAwardsPath = path.join(repoRoot, "assets", "external-awards.manual.json");
const fiftyDiscoveryCandidatesPath = path.join(repoRoot, "assets", "50best-discovery-taiwan-candidates.json");
const oadCandidatesPath = path.join(repoRoot, "assets", "oad-asia-2025-candidates.json");
const bestChefCandidatesPath = path.join(repoRoot, "assets", "thebestchef-taiwan-2025-candidates.json");
const designAwardsCandidatesPath = path.join(repoRoot, "assets", "restaurant-design-awards-taiwan-candidates.json");
const fmgCandidatesPath = path.join(repoRoot, "assets", "fmg-taiwan-2025-candidates.json");
const greenVeggieCandidatesPath = path.join(repoRoot, "assets", "green-veggie-guide-2025-candidates.json");
const gdgAwardsCandidatesPath = path.join(repoRoot, "assets", "gdg-awards-2025-candidates.json");
const michelinSpecialCandidatesPath = path.join(repoRoot, "assets", "michelin-special-awards-2025-candidates.json");
const tcfPraiseCandidatesPath = path.join(repoRoot, "assets", "tcf-praise-2025-candidates.json");
const taichungLowCarbonCandidatesPath = path.join(repoRoot, "assets", "taichung-low-carbon-2023-candidates.json");
const muslimFriendlyCandidatesPath = path.join(repoRoot, "assets", "muslim-friendly-2026-candidates.json");
const fdaRestaurantHygieneCandidatesPath = path.join(repoRoot, "assets", "fda-restaurant-hygiene-2024-candidates.json");
const platformManualPath = path.join(repoRoot, "assets", "platform-signals.manual.json");
const platformProbePath = path.join(repoRoot, "assets", "platform-source-probe-report.json");
const sweetCandidatesPath = path.join(repoRoot, "assets", "500sweet-2025-candidates.json");
const indexPath = path.join(repoRoot, "index.html");
const outputPath = path.join(repoRoot, "assets", "external-source-coverage.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function countGuides(awards) {
  const guides = {};
  for (const row of awards.restaurants || []) {
    for (const award of row.awards || []) guides[award.guide] = (guides[award.guide] || 0) + 1;
  }
  return guides;
}

function platformProbe(id, probe) {
  return (probe.sources || []).find((source) => source.id === id) || {};
}

function main() {
  const awards = readJson(awardsPath);
  const guides = countGuides(awards);
  const externalSignals = readJson(externalSignalsPath);
  const externalAwards = fs.existsSync(externalAwardsPath) ? readJson(externalAwardsPath) : { sources: [] };
  const fiftyDiscoveryCandidates = fs.existsSync(fiftyDiscoveryCandidatesPath) ? readJson(fiftyDiscoveryCandidatesPath) : { restaurants: [] };
  const oadCandidates = fs.existsSync(oadCandidatesPath) ? readJson(oadCandidatesPath) : { restaurants: [] };
  const bestChefCandidates = fs.existsSync(bestChefCandidatesPath) ? readJson(bestChefCandidatesPath) : { restaurants: [] };
  const designAwardsCandidates = fs.existsSync(designAwardsCandidatesPath) ? readJson(designAwardsCandidatesPath) : { restaurants: [] };
  const fmgCandidates = fs.existsSync(fmgCandidatesPath) ? readJson(fmgCandidatesPath) : { restaurants: [] };
  const greenVeggieCandidates = fs.existsSync(greenVeggieCandidatesPath) ? readJson(greenVeggieCandidatesPath) : { restaurants: [], needsCityReview: [] };
  const gdgAwardsCandidates = fs.existsSync(gdgAwardsCandidatesPath) ? readJson(gdgAwardsCandidatesPath) : { restaurants: [], needsCityReview: [] };
  const michelinSpecialCandidates = fs.existsSync(michelinSpecialCandidatesPath) ? readJson(michelinSpecialCandidatesPath) : { restaurants: [] };
  const tcfPraiseCandidates = fs.existsSync(tcfPraiseCandidatesPath) ? readJson(tcfPraiseCandidatesPath) : { restaurants: [], needsCityReview: [] };
  const taichungLowCarbonCandidates = fs.existsSync(taichungLowCarbonCandidatesPath) ? readJson(taichungLowCarbonCandidatesPath) : { restaurants: [] };
  const muslimFriendlyCandidates = fs.existsSync(muslimFriendlyCandidatesPath) ? readJson(muslimFriendlyCandidatesPath) : { restaurants: [] };
  const fdaRestaurantHygieneCandidates = fs.existsSync(fdaRestaurantHygieneCandidatesPath) ? readJson(fdaRestaurantHygieneCandidatesPath) : { restaurants: [] };
  const platformManual = readJson(platformManualPath);
  const platformProbeReport = readJson(platformProbePath);
  const sweetCandidates = readJson(sweetCandidatesPath);
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const platformRows = platformManual.restaurants || [];
  const platformSignals = platformRows.reduce((sum, row) => sum + ((row.signals || []).length), 0);
  const sourceCatalogIds = new Set((externalSignals.sourceCatalog || []).map((source) => source.id));

  const coverage = {
    version: "external-source-coverage-2026-07-01",
    updated: taipeiDate(),
    policy: {
      runtimeExternalLookup: false,
      costFirst: true,
      noFakeData: true,
      notes: [
        "已接入代表有正式資料或安全批次管線；不代表每個外部平台都有可自動抓取資料。",
        "平台來源若 robots、授權或登入限制不適合自動抓取，只允許授權 API、人工整理或可追溯批次 CSV 匯入。",
        "Google 評分與評論數仍是排序主體，外部來源只做加分、提示或可信度調整。",
      ],
    },
    summary: {
      awardsRestaurants: (awards.restaurants || []).length,
      externalSignalSources: sourceCatalogIds.size,
      externalSignalRestaurants: (externalSignals.restaurants || []).length,
      externalSignals: (externalSignals.restaurants || []).reduce((sum, row) => sum + ((row.signals || []).length), 0),
      platformManualRestaurants: platformRows.length,
      platformManualSignals: platformSignals,
      externalAwardSources: (externalAwards.sources || []).length,
      fiftyDiscoveryCandidates: (fiftyDiscoveryCandidates.restaurants || []).length,
      oadCandidates: (oadCandidates.restaurants || []).length,
      bestChefCandidates: (bestChefCandidates.restaurants || []).length,
      designAwardsCandidates: (designAwardsCandidates.restaurants || []).length,
      fmgCandidates: (fmgCandidates.restaurants || []).length,
      greenVeggieCandidates: (greenVeggieCandidates.restaurants || []).length,
      greenVeggieNeedsCityReview: (greenVeggieCandidates.needsCityReview || []).length,
      gdgAwardsCandidates: (gdgAwardsCandidates.restaurants || []).length,
      gdgAwardsNeedsCityReview: (gdgAwardsCandidates.needsCityReview || []).length,
      michelinSpecialCandidates: (michelinSpecialCandidates.restaurants || []).length,
      tcfPraiseCandidates: (tcfPraiseCandidates.restaurants || []).length,
      tcfPraiseNeedsCityReview: (tcfPraiseCandidates.needsCityReview || []).length,
      taichungLowCarbonCandidates: (taichungLowCarbonCandidates.restaurants || []).length,
      muslimFriendlyCandidates: (muslimFriendlyCandidates.restaurants || []).length,
      fdaRestaurantHygieneCandidates: (fdaRestaurantHygieneCandidates.restaurants || []).length,
    },
    sources: [
      {
        id: "michelin-guide-taiwan",
        label: "米其林指南台灣",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        sourceCatalog: ["michelin-guide", "bib-gourmand"],
        counts: {
          stars: guides.michelin || 0,
          selected: guides.michelin_selected || 0,
          bib: guides.bib || 0,
          greenstar: guides.greenstar || 0,
        },
        runtimeLookup: false,
      },
      {
        id: "500plate",
        label: "500盤",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        count: guides["500plate"] || 0,
        runtimeLookup: false,
      },
      {
        id: "500bowl",
        label: "500碗",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        count: guides["500bowl"] || 0,
        runtimeLookup: false,
      },
      {
        id: "500sweet",
        label: "500甜",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/500sweet-2025-candidates.json",
        count: guides["500sweet"] || 0,
        candidates: (sweetCandidates.restaurants || []).length,
        highConfidence: (sweetCandidates.restaurants || []).filter((row) => row.importConfidence === "high").length,
        runtimeLookup: false,
      },
      {
        id: "50best",
        label: "50 Best",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        sourceFile: "assets/external-awards.manual.json",
        count: guides["50best"] || 0,
        runtimeLookup: false,
      },
      {
        id: "50bestdiscovery",
        label: "50 Best Discovery",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/50best-discovery-taiwan-candidates.json",
        count: guides["50bestdiscovery"] || 0,
        candidates: (fiftyDiscoveryCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "oad",
        label: "OAD Top Restaurants Asia",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/oad-asia-2025-candidates.json",
        count: guides.oad || 0,
        candidates: (oadCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "thebestchef",
        label: "The Best Chef Awards",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/thebestchef-taiwan-2025-candidates.json",
        count: guides.thebestchef || 0,
        candidates: (bestChefCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "designawards",
        label: "Restaurant & Bar Design Awards",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/restaurant-design-awards-taiwan-candidates.json",
        count: guides.designawards || 0,
        candidates: (designAwardsCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "fmg",
        label: "Food Made Good Taiwan",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/fmg-taiwan-2025-candidates.json",
        count: guides.fmg || 0,
        candidates: (fmgCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "greenveggie",
        label: "綠・蔬食評鑑指南",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/green-veggie-guide-2025-candidates.json",
        count: guides.greenveggie || 0,
        candidates: (greenVeggieCandidates.restaurants || []).length,
        needsCityReview: (greenVeggieCandidates.needsCityReview || []).length,
        runtimeLookup: false,
      },
      {
        id: "gdgawards",
        label: "綠色餐飲指南年度評鑑入圍",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/gdg-awards-2025-candidates.json",
        count: guides.gdgawards || 0,
        candidates: (gdgAwardsCandidates.restaurants || []).length,
        needsCityReview: (gdgAwardsCandidates.needsCityReview || []).length,
        runtimeLookup: false,
      },
      {
        id: "michelinspecial",
        label: "米其林特別獎",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/michelin-special-awards-2025-candidates.json",
        count: guides.michelinspecial || 0,
        candidates: (michelinSpecialCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "tcfpraise",
        label: "美食指南點讚榜臺灣站",
        status: (tcfPraiseCandidates.restaurants || []).length ? "integrated_data" : "candidate_needs_city_review",
        dataFile: (tcfPraiseCandidates.restaurants || []).length ? "assets/awards-taiwan.json" : null,
        candidatesFile: "assets/tcf-praise-2025-candidates.json",
        count: guides.tcfpraise || 0,
        candidates: (tcfPraiseCandidates.restaurants || []).length,
        needsCityReview: (tcfPraiseCandidates.needsCityReview || []).length,
        runtimeLookup: false,
      },
      {
        id: "taichunglowcarbon",
        label: "臺中市低碳餐廳認證",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/taichung-low-carbon-2023-candidates.json",
        count: guides.taichunglowcarbon || 0,
        candidates: (taichungLowCarbonCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "muslimfriendly",
        label: "穆斯林友善餐飲認證",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/muslim-friendly-2026-candidates.json",
        count: guides.muslimfriendly || 0,
        candidates: (muslimFriendlyCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "fdagrade",
        label: "餐飲衛生分級",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        candidatesFile: "assets/fda-restaurant-hygiene-2024-candidates.json",
        count: guides.fdagrade || 0,
        candidates: (fdaRestaurantHygieneCandidates.restaurants || []).length,
        runtimeLookup: false,
      },
      {
        id: "tatlerbest",
        label: "Tatler Best",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        sourceFile: "assets/external-awards.manual.json",
        count: guides.tatlerbest || 0,
        runtimeLookup: false,
      },
      {
        id: "worldculinary",
        label: "World Culinary Awards",
        status: "integrated_data",
        dataFile: "assets/awards-taiwan.json",
        sourceFile: "assets/external-awards.manual.json",
        count: guides.worldculinary || 0,
        runtimeLookup: false,
      },
      {
        id: "google-maps-reviews",
        label: "Google Maps 評論",
        status: "runtime_primary_with_noise_guard",
        dataFile: "Google Places API response",
        fields: ["rating", "userRatingCount", "reviewSummary", "editorialSummary", "generativeSummary"],
        safeguards: {
          bayesianScore: indexHtml.includes("function bayes"),
          reviewCountBonus: indexHtml.includes("function reviewCountBonus"),
          reviewNoiseHints: indexHtml.includes("function reviewNoiseHints"),
          promoTextPenalty: indexHtml.includes("PROMO_TEXT_PENALTY"),
          noFullReviewStorage: true,
        },
        runtimeLookup: "via Google Places only",
      },
      ...["ifoodie", "openrice-tw", "tripadvisor-tw"].map((id) => {
        const probe = platformProbe(id, platformProbeReport);
        const currentManualRows = platformRows.filter((row) => (row.signals || []).some((signal) => signal.sourceId === id)).length;
        const currentManualSignals = platformRows.reduce((sum, row) => sum + (row.signals || []).filter((signal) => signal.sourceId === id).length, 0);
        return {
          id,
          label: probe.label || id,
          status: currentManualSignals ? "manual_data_available" : "batch_pipeline_ready_no_data",
          dataFile: "assets/platform-signals.manual.json",
          importCsv: "assets/platform-signals.import.csv",
          sourceCatalogPresent: sourceCatalogIds.has(id),
          currentManualRows,
          currentManualSignals,
          probeDecision: probe.decision || "",
          recommendedImportMode: probe.recommendedImportMode || "manual_or_authorized_api",
          runtimeLookup: false,
        };
      }),
    ],
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    output: "assets/external-source-coverage.json",
    sources: coverage.sources.length,
    summary: coverage.summary,
  }, null, 2));
}

main();
