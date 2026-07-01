const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "gdg-awards-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "gdg-awards-2025-import-report.json");
const sourceUrl = "https://greenmedia.today/article_detail.php?cid=7&mid=1410";

const ROWS = [
  { name: "有火鍋", city: "臺中市", district: "南屯區", address: "臺中市南屯區永春東七路629號2樓", cuisine: "火鍋", dimension: "Conscious Sourcing", category: "有機友善食材運用獎", region: "中區", addressSourceUrl: "https://www.opentable.com.tw/restaurant/profile/181448" },
  { name: "雙口呂文化廚房", city: "桃園市", district: "大溪區", address: "桃園市大溪區南興路一段277號", cuisine: "臺灣米食", dimension: "Conscious Sourcing", category: "有機友善食材運用獎", region: "北區", addressSourceUrl: "https://wem.tycg.gov.tw/News_Photo_Content.aspx?n=14934&s=1157516" },
  { name: "而今餐酒館", city: "高雄市", district: "前金區", address: "高雄市前金區自立二路53巷27號", cuisine: "餐酒館", dimension: "Conscious Sourcing", category: "有機友善食材運用獎", region: "南區", addressSourceUrl: "https://smiletaiwan.cw.com.tw/article/6256" },
  { name: "阿樂樂代 Aredetay", city: "花蓮縣", district: "光復鄉", address: "花蓮縣光復鄉富田一街56號", cuisine: "阿美族料理", dimension: "Conscious Sourcing", category: "有機友善食材運用獎", region: "東區", addressSourceUrl: "https://www.verse.com.tw/article/aredetay-in-hualien" },
  { name: "一碗食舖", city: "南投縣", district: "埔里鎮", address: "南投縣埔里鎮籃城路25號", cuisine: "蔬食定食", dimension: "Conscious Sourcing", category: "在地當季食材運用獎", region: "中區", addressSourceUrl: "https://travel.nantou.gov.tw/attractions/%E4%B8%80%E7%A2%97%E9%A3%9F%E8%88%96/" },
  { name: "小川鍋物", dimension: "Conscious Sourcing", category: "在地當季食材運用獎", region: "北區", addressSourceUrl: "https://littlerriver.com/branch/", pendingReason: "同名分店不只一處，官方得獎頁未寫明得獎分店，暫不猜測。" },
  { name: "春日廚房", city: "屏東縣", district: "春日鄉", address: "屏東縣春日鄉春日路172號", cuisine: "排灣族料理", dimension: "Conscious Sourcing", category: "在地當季食材運用獎", region: "南區", addressSourceUrl: "https://smiletaiwan.cw.com.tw/article/7725" },
  { name: "糧心聚落宜蘭店", city: "宜蘭縣", district: "員山鄉", address: "宜蘭縣員山鄉茄苳路28巷2-3號", cuisine: "友善食材料理", dimension: "Conscious Sourcing", category: "在地當季食材運用獎", region: "東區", addressSourceUrl: "https://www.instagram.com/reel/DVcmGMdkrT0/" },
  { name: "米蘭水烘焙坊", city: "臺東縣", district: "蘭嶼鄉", address: "臺東縣蘭嶼鄉朗島村朗島32之1號", cuisine: "烘焙坊", dimension: "Conscious Sourcing", category: "在地當季食材運用獎", region: "離島", addressSourceUrl: "https://twincn.com/item.aspx?no=85797204" },
  { name: "fifteen 拾吾純植西餐廳", city: "新竹縣", district: "竹北市", address: "新竹縣竹北市文興路205號", cuisine: "純植西餐", dimension: "Conscious Sourcing", category: "地球永續餐盤獎", region: "北區", addressSourceUrl: "https://www.threads.com/%40fifteen_cuisine_tw" },
  { name: "漢來蔬食", dimension: "Conscious Sourcing", category: "地球永續餐盤獎", region: "南區", addressSourceUrl: "https://www.hanshin.com.tw/%E6%BC%A2%E7%A5%9E%E5%B7%A8%E8%9B%8B/tw/Floor/5F/%E6%BC%A2%E4%BE%86%E8%94%AC%E9%A3%9F", pendingReason: "品牌分店多，得獎頁未明指分店，暫不指定單一據點。" },
  { name: "呷米 JIAMI 餐廳", city: "臺北市", district: "中正區", address: "臺北市中正區重慶南路一段47號一樓", cuisine: "永續台灣料理", dimension: "Conscious Sourcing", category: "最佳永續海洋獎", region: "北區", addressSourceUrl: "https://shop.ichefpos.com/store/Zl-5bKvm/reserve/storeInfo" },
  { name: "田媽媽長盈海味屋", city: "臺南市", district: "北門區", address: "", cuisine: "海鮮料理", dimension: "Conscious Sourcing", category: "最佳永續海洋獎", region: "南區", addressSourceUrl: "https://www.agriharvest.tw/archives/123574/", pendingReason: "已確認在臺南市北門區三寮灣，但公開摘要未帶出完整門牌，先保留空地址。" },
  { name: "不老夢想 125 號-不老食光", city: "臺中市", district: "北區", address: "臺中市北區雙十路一段125號", cuisine: "友善餐廳", dimension: "Caring Society", category: "最友善員工獎", region: "中區", addressSourceUrl: "https://www.bulao125.com/" },
  { name: "普橘島", city: "臺北市", district: "內湖區", address: "臺北市內湖區瑞湖街111號", cuisine: "企業員工餐廳", dimension: "Caring Society", category: "最友善員工獎", region: "企業組", addressSourceUrl: "https://greenmedia.today/article_detail.php?cid=10&mid=743" },
  { name: "許愿", city: "臺中市", district: "西區", address: "", cuisine: "烘焙與飯食", dimension: "Caring Society", category: "均衡飲食推廣獎", region: "中區", addressSourceUrl: "https://www.facebook.com/GreenDiningGuide/photos/%E8%A8%B1%E6%84%BF%E7%94%A8%E5%8E%9F%E8%88%87%E5%BF%83%E7%83%98%E7%84%99%E5%87%BA%E5%AE%B6%E7%9A%84%E5%91%B3%E9%81%93%E5%9C%A8%E5%8F%B0%E4%B8%AD%E8%A5%BF%E5%8D%80%E7%9A%84%E5%BA%B7%E6%A8%82%E8%A1%97%E6%9C%89%E4%B8%80%E9%96%93%E5%90%8D%E7%82%BA-%E8%A8%B1%E6%84%BF-%E7%9A%84%E7%83%98%E7%84%99%E5%9D%8A%E7%94%B1%E9%86%AB%E8%AD%B7%E8%83%8C%E6%99%AF%E7%9A%84%E6%A5%8A%E5%AA%9B%E5%A9%B7%E8%88%87%E8%A8%B1%E7%AB%A3%E7%82%BA%E5%85%B1%E5%90%8C%E5%89%B5%E7%AB%8B%E4%BB%96%E5%80%91%E5%BE%9E%E5%8F%83%E8%88%87%E7%AB%B9%E8%9C%BB%E8%9C%93%E7%B6%A0%E5%B8%82%E9%9B%86%E9%96%8B%E5%A7%8B%E6%8E%A5%E8%A7%B8%E5%88%B0%E8%A8%B1%E5%A4%9A%E5%8F%8B%E5%96%84%E8%80%95%E4%BD%9C%E7%9A%84%E5%B0%8F%E8%BE%B2%E9%80%B2%E8%80%8C%E8%90%8C/", pendingReason: "已確認在臺中市西區康樂街，但目前摘要未帶出完整門牌，先保留空地址。" },
  { name: "甘苦人魅力農店", city: "雲林縣", district: "口湖鄉", address: "雲林縣口湖鄉梧南村光明路163號", cuisine: "海鮮與在地食材料理", dimension: "Caring Society", category: "最友善社區獎", region: "中區", addressSourceUrl: "https://greenmedia.today/map_greens.php?rid=432" },
  { name: "膳馨餐飲集團", dimension: "Caring Society", category: "最友善社區獎", region: "中區", addressSourceUrl: "https://www.shan-shin.com/pages/restaurant-locations", pendingReason: "集團旗下多店共同受獎，暫不縮減成單一門市。" },
  { name: "TINA 廚房-桃園八德埤塘公園", city: "桃園市", district: "八德區", address: "", cuisine: "有機餐廳", dimension: "Thriving Environment", category: "最佳低碳實踐獎", region: "北區", addressSourceUrl: "https://www.facebook.com/GreenDiningGuide/posts/2025-%E5%9C%8B%E9%9A%9B%E7%B6%A0%E8%89%B2%E9%A4%90%E9%A3%B2%E5%B9%B4%E6%9C%83%E6%9A%A8%E9%A0%92%E7%8D%8E%E5%85%B8%E7%A6%AE-%E5%BE%97%E7%8D%8E%E5%9B%9E%E9%A1%A7%E6%9C%80%E4%BD%B3%E4%BD%8E%E7%A2%B3%E5%AF%A6%E8%B8%90%E7%8D%8E-tina%E5%BB%9A%E6%88%BF-%E6%A1%83%E5%9C%92%E5%85%AB%E5%BE%B7%E5%9F%A4%E5%A1%98%E5%85%AC%E5%9C%92%E9%88%BA%E7%B5%B1%E9%A3%9F%E5%93%81%E8%82%A1%E4%BB%BD%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8-%E9%80%8F%E9%81%8E%E6%AD%A4%E7%8D%8E%E9%A0%85%E9%BC%93%E5%8B%B5%E9%A4%90%E9%A3%B2%E6%A5%AD%E8%80%85%E9%99%8D%E4%BD%8E%E8%87%AA%E8%BA%AB%E7%9A%84%E7%92%B0%E5%A2%83%E8%A1%9D%E6%93%8A%E5%BE%9E%E6%BA%AB%E5%AE%A4/", pendingReason: "已確認在桃園市八德區埤塘公園內，但公開摘要未帶出完整門牌，先保留空地址。" },
  { name: "常不輕 dandelion", city: "臺北市", district: "北投區", address: "臺北市北投區立德路8號1樓", cuisine: "蔬食", dimension: "Thriving Environment", category: "最佳全食運用獎", region: "北區", addressSourceUrl: "https://www.instagram.com/dandelion202310/" },
  { name: "不老夢想 125 號-不老食光", city: "臺中市", district: "北區", address: "臺中市北區雙十路一段125號", cuisine: "友善餐廳", dimension: "Thriving Environment", category: "資源循環再利用獎", region: "中區", addressSourceUrl: "https://www.bulao125.com/" },
  { name: "心雕居", city: "苗栗縣", district: "苑裡鎮", address: "苗栗縣苑裡鎮出水路64號", cuisine: "在地小農餐廳", dimension: "Grand Honor Award", category: "新經濟營運獎", region: "北區", addressSourceUrl: "https://greenmedia.today/article_detail.php?cid=10&mid=354" },
  { name: "蕃薯藤 TINA 有機家族", dimension: "Grand Honor Award", category: "2025 GDG 大獎", region: "北區", addressSourceUrl: "https://www.organicyam.com.tw/blogs/%E9%96%80%E5%B8%82%E8%B3%87%E8%A8%8A", pendingReason: "品牌家族跨多門市與場域共同受獎，暫不縮減成單一門市。" },
  { name: "天然茶莊", city: "新北市", district: "汐止區", address: "新北市汐止區汐碇路380巷30號", cuisine: "茶餐與茶莊", dimension: "Grand Honor Award", category: "最有潛力新星", region: "北區", addressSourceUrl: "https://www.naturetea.com.tw/" },
  { name: "仕合廖家", city: "南投縣", district: "草屯鎮", address: "南投縣草屯鎮成功路一段202號", cuisine: "手作御食", dimension: "Grand Honor Award", category: "最有潛力新星", region: "中區", addressSourceUrl: "https://smiletaiwan.cw.com.tw/article/8285" }
];

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildRestaurant(row, generatedAt) {
  const notes = [
    `地址輔助來源：${row.addressSourceUrl}`,
    "獎項名單來源為 Green Media 2025 國際綠色餐飲年會暨頒獎典禮得獎名單。",
  ];
  if (row.pendingReason) notes.push(row.pendingReason);
  return {
    name: row.name,
    city: row.city,
    district: row.district || "",
    address: row.address || "",
    cuisine: row.cuisine || "",
    aliases: row.aliases || [],
    awards: [
      {
        guide: "gdgawards",
        year: 2025,
        level: row.category,
        category: row.category,
        dimension: row.dimension,
        region: row.region,
        url: sourceUrl,
        extractedAt: generatedAt,
        notes: notes.join(" "),
      },
    ],
    importConfidence: "high",
    matchedBy: "manual_public_source_confirmation",
  };
}

function buildNeedsReview(row) {
  return {
    name: row.name,
    region: row.region,
    dimension: row.dimension,
    category: row.category,
    categoryEn: row.dimension,
    reason: row.pendingReason || "city_not_in_source_and_no_unique_existing_match",
    sourceUrl: row.addressSourceUrl,
  };
}

function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = [];
  const needsCityReview = [];

  for (const row of ROWS) {
    if (row.city) restaurants.push(buildRestaurant(row, generatedAt));
    else needsCityReview.push(buildNeedsReview(row));
  }

  const payload = {
    version: "gdg-awards-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "manual_public_source_confirmation",
      noRegionToCityGuess: true,
      notes: [
        "以 Green Media 2025 GDG 得獎名單為主來源，逐筆用公開可存取頁面補城市、行政區、地址與菜系。",
        "品牌多分店或集團共同受獎者不猜測單一門市，保留在 needsCityReview。",
        "所有列入 restaurants 的資料都至少確認到縣市，缺完整門牌者會保留空地址並在備註說明。"
      ]
    },
    restaurants,
    needsCityReview
  };

  const categoryCounts = {};
  for (const row of restaurants) {
    const key = row.awards[0].category;
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  }

  const report = {
    generatedAt,
    sourceUrl,
    sourceRows: ROWS.length,
    candidates: restaurants.length,
    needsCityReview: needsCityReview.length,
    categoryCounts,
    errors: []
  };

  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
