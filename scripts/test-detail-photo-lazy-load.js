const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const functionsIndex = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");

assert.match(
  indexHtml,
  /function\s+photoStripHTML\s*\(\s*photoUrls,\s*name\s*\)[\s\S]*data-lazy-src="\$\{escapeHTML\(u\)\}"[\s\S]*loading="lazy"[\s\S]*decoding="async"/,
  "詳情照片必須先寫入 data-lazy-src，並保留 lazy/async 屬性",
);

assert.doesNotMatch(
  indexHtml.match(/function\s+photoStripHTML\s*\(\s*photoUrls,\s*name\s*\)[\s\S]*?\n\}/)?.[0] || "",
  /<img[^>]+\ssrc="\$\{escapeHTML\(u\)\}"/,
  "詳情照片不得在卡片初始 render 時直接寫入 src",
);

assert.match(
  indexHtml,
  /function\s+loadDetailPhotos\s*\(\s*card\s*\)[\s\S]*img\.src\s*=\s*img\.dataset\.lazySrc[\s\S]*img\.removeAttribute\("data-lazy-src"\)/,
  "展開詳情時必須把 data-lazy-src 寫入 src 並移除 lazy 標記",
);

assert.match(
  indexHtml,
  /root\.querySelectorAll\("\[data-detail\]"\)[\s\S]*d\.classList\.contains\("open"\)[\s\S]*loadDetailPhotos\(card\)/,
  "點開詳情時必須觸發照片載入",
);

assert.match(
  indexHtml,
  /\.ph-img\.is-broken\{display:none;\}/,
  "照片載入失敗時必須隱藏壞圖，避免留下假 placeholder",
);

assert.match(
  indexHtml,
  /function\s+ensureDetailPhotos\s*\(\s*card[\s\S]*fetchPhotoFallbackForCard\(card,[\s\S]*inner\.insertAdjacentHTML\("afterbegin",\s*photoStripHTML\(photos,\s*name\)\)[\s\S]*loadDetailPhotos\(card\)/,
  "沒有詳情照片或照片壞掉時，必須能補查照片並立即套用 lazy load 流程",
);

assert.match(
  functionsIndex,
  /function\s+photoUrls\s*\(\s*place\s*\)[\s\S]*cloudfunctions\.net\/photo\?name=\$\{name\}&exp=\$\{exp\}&sig=\$\{sig\}/,
  "Functions 必須回傳簽名 photo proxy URL，而不是把 Google API key 暴露到前端",
);

assert.match(
  functionsIndex,
  /exports\.photo[\s\S]*validPhotoSignature\(rawName,\s*req\.query\.exp,\s*req\.query\.sig\)[\s\S]*places\.googleapis\.com\/v1\/\$\{rawName\}\/media/,
  "photo proxy 必須驗證簽名後再向 Google Places media 取圖",
);

console.log("detail photo lazy-load tests passed");
