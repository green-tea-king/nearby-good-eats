const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourcePath = "C:\\Users\\Administrator\\Desktop\\michelin_taipei_restaurants_zh.md";
const awardsPath = path.join(repoRoot, "assets", "awards-taiwan.json");
const outPath = path.join(repoRoot, "assets", "michelin-taipei-2025-candidates.json");

const OFFICIAL_SOURCES = {
  fullList: "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/taiwan-full-list",
  bib: "https://guide.michelin.com/tw/zh_TW/article/michelin-guide-ceremony/michelin-guide-taiwan-2025-bib-gourmand-selection",
  taipeiSelection: "https://guide.michelin.com/tw/zh_TW/taipei-region/taipei/restaurants",
};

const GUIDE_MAP = {
  "三星": { guide: "michelin", level: "三星" },
  "二星": { guide: "michelin", level: "二星" },
  "一星": { guide: "michelin", level: "一星" },
  "必比登推介": { guide: "bib" },
  "入選餐廳": { guide: "michelin_selected", level: "入選餐廳" },
};

const BUILTIN_ALIASES = {
  "Taïrroir": ["態芮", "Tairroir"],
  "Le Palais": ["頤宮"],
  "RAW": ["RAW"],
  "logy": ["Logy"],
  "A": ["Restaurant A"],
  "Golden Formosa": ["金蓬萊遵古台菜"],
  "Mountain and Sea House": ["山海樓"],
  "Ming Fu": ["明福台菜海產"],
  "The Guest House": ["請客樓"],
  "Tien Hsiang Lo": ["天香樓"],
  "Ya Ge": ["雅閣"],
  "de nuit": ["De Nuit"],
  "Impromptu by Paul Lee": ["Impromptu"],
  "Sushi Ryu": ["鮨隆"],
  "Sushi Akira": ["鮨明"],
  "Sushi Kajin": ["鮨嘉仁"],
  "Sushiyoshi": ["鮨よし"],
  "Fujin Tree Taiwanese Cuisine & Champagne (Songshan)": ["富錦樹台菜香檳", "富錦樹台菜香檳 松山"],
  "Din Tai Fung (Xinyi Road)": ["鼎泰豐", "鼎泰豐 信義店"],
  "Little Tree Food (Da'an Road)": ["小小樹食", "小小樹食 大安路"],
  "Huang Chi Lu Rou Fan": ["黃記魯肉飯"],
  "MoonMoonFood (Qingdao East Road)": ["雙月食品社", "雙月食品社 青島店"],
  "Wang's Broth": ["小王煮瓜"],
  "Yuan Fang Guabao": ["源芳刈包"],
  "Yi Jia Zi": ["一甲子餐飲"],
  "Mai Mien Yen Tsai": ["賣麵炎仔"],
  "Lao Shan Dong Homemade Noodles": ["老山東牛肉家常麵店"],
  "Serenity (Zhongzheng)": ["祥和蔬食", "祥和蔬食 中正"],
  "Shin Yeh Taiwanese Delight (Nangang)": ["欣葉小聚", "欣葉小聚 南港"],
  "Shin Yeh Taiwanese Signature": ["欣葉鐘菜"],
  "Chi Chia Chuang (Changchun Road)": ["雞家莊", "雞家莊 長春店"],
  "Chung Chia Sheng Jian Bao": ["鍾家原上海生煎包"],
  "Good Friend Cold Noodles": ["好朋友涼麵"],
  "Hang Zhou Xiao Long Bao (Da'an)": ["杭州小籠湯包", "杭州小籠湯包 大安"],
  "Hsiao Cho Chih Chia": ["小酌之家"],
  "Hsiung Chi Scallion Pancake": ["雄記蔥抓餅"],
  "Inn's+ (Shuangcheng Street)": ["隱食家", "隱食家 雙城街"],
  "Xiao Ping Kitchen (Zhongshan)": ["小品雅廚"],
  "Su Lai Chuan": ["素來川"],
  "Sung Chu Yuan": ["松竹園"],
  "Talking Heads": ["湘帝御膳食堂"],
  "Tsui Feng Yuan": ["醉楓園小館"],
  "Da-Qiao-Tou Tube Rice Pudding (Yanping North Road)": ["大橋頭老牌筒仔米糕"],
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）・·.,，、!！?？\-_/&]/g, "")
    .replace(/(總店|本店|本舖|旗艦店|分店)$/g, "")
    .toLowerCase();
}

function areaFromAddress(address) {
  const match = String(address || "").match(/([^，,|\s]+區)/);
  return match ? match[1] : "";
}

function canonicalAddress(address) {
  return String(address || "")
    .replace(/臺/g, "台")
    .replace(/，台北市$/, "，台北市")
    .trim();
}

function parseMarkdownTable(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .slice(2)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5)
    .map(([name, address, phone, cuisine, award]) => {
      const mapped = GUIDE_MAP[award] || { guide: "unknown", level: award };
      return {
        name,
        aliases: BUILTIN_ALIASES[name] || [],
        city: "台北市",
        area: areaFromAddress(address),
        address: canonicalAddress(address),
        phone: phone === "官方未提供" ? "" : phone,
        cuisine,
        source: mapped.guide === "bib" ? OFFICIAL_SOURCES.bib : OFFICIAL_SOURCES.fullList,
        sourceNote: "由桌面 Michelin 台北 Markdown 表格轉換；獎項以 Michelin Guide Taiwan 2025 官方頁核對為準。",
        awards: [
          {
            guide: mapped.guide,
            ...(mapped.level ? { level: mapped.level } : {}),
            year: 2025,
            url: mapped.guide === "bib" ? OFFICIAL_SOURCES.bib : OFFICIAL_SOURCES.fullList,
          },
        ],
        reviewStatus: "needs_place_match",
        matchHints: {
          normalizedName: normalizeName(name),
          normalizedAliases: (BUILTIN_ALIASES[name] || []).map(normalizeName),
          phone: phone === "官方未提供" ? "" : phone,
          address,
        },
      };
    });
}

function existingAwardIndex(restaurants) {
  const keys = new Map();
  for (const restaurant of restaurants || []) {
    const names = [restaurant.name, ...(restaurant.aliases || [])].filter(Boolean);
    for (const name of names) {
      keys.set(`${restaurant.city || "台北市"}|${normalizeName(name)}`, restaurant);
    }
  }
  return keys;
}

function main() {
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const current = JSON.parse(fs.readFileSync(awardsPath, "utf8"));
  const rows = parseMarkdownTable(markdown);
  const existing = existingAwardIndex(current.restaurants || []);

  const enriched = rows.map((row) => {
    const matched = [row.name, ...(row.aliases || [])]
      .map((name) => existing.get(`${row.city}|${normalizeName(name)}`))
      .find(Boolean);
    return {
      ...row,
      importHint: matched
        ? {
            action: "merge",
            matchedName: matched.name,
            matchedAddress: matched.address || "",
          }
        : {
            action: "add_candidate",
          },
    };
  });

  const summary = {
    total: enriched.length,
    byAward: enriched.reduce((acc, row) => {
      const award = row.awards[0]?.level || row.awards[0]?.guide || "unknown";
      acc[award] = (acc[award] || 0) + 1;
      return acc;
    }, {}),
    mergeCandidates: enriched.filter((row) => row.importHint.action === "merge").length,
    addCandidates: enriched.filter((row) => row.importHint.action === "add_candidate").length,
    aliasProvided: enriched.filter((row) => row.aliases.length).length,
  };

  const output = {
    version: "2025-taipei-candidates",
    generatedAt: new Date().toISOString(),
    sourceFile: sourcePath,
    officialSources: OFFICIAL_SOURCES,
    policy: {
      primarySource: "Michelin Guide official pages",
      secondarySource: "Wikipedia/public pages only for aliases, never for award status",
      importMode: "candidate-first; do not overwrite live awards-taiwan.json without review",
      matchPriority: ["googlePlaceId", "phone", "city+normalizedName", "city+addressPrefix"],
    },
    summary,
    restaurants: enriched,
  };

  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

main();
