const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "assets", "tcf-praise-2025-candidates.json");
const reportPath = path.join(repoRoot, "assets", "tcf-praise-2025-import-report.json");
const sourceUrl = "https://www.tcf.org.tw/page/news/show.aspx?num=48";

const ROWS = [
  { name: "府城食府正宗台南料理", city: "臺南市", district: "安平區", address: "臺南市安平區華平路152號", cuisine: "台南料理", addressSourceUrl: "https://www.facebook.com/traditional.tainan.feast/?locale=zh_CN" },
  { name: "蛋小白", pendingReason: "公開資訊可確認為食品品牌，但目前未確認對應實體餐飲門市，不先當作餐廳據點匯入。" },
  { name: "南僑讚岐急凍熟麵", pendingReason: "公開資訊可確認為食品品牌，不是單一餐廳門市，暫不當作餐廳據點匯入。" },
  { name: "BBJ", pendingReason: "品牌名稱過短且公開頁面對位不足，無法安全確認縣市與地址。" },
  { name: "黑金傳奇", city: "新北市", district: "淡水區", address: "新北市淡水區公明街6號", cuisine: "黑糖飲品與伴手禮", addressSourceUrl: "https://th.openrice.com/zh/newtaipei-keelung/r-%E9%BB%91%E9%87%91%E5%82%B3%E5%A5%87%E9%BB%91%E7%B3%96%E8%96%91%E6%AF%8D%E8%8C%B6-tamsui-district-taiwanese-r137968/menus" },
  { name: "逸之牛", city: "高雄市", district: "新興區", address: "高雄市新興區中正四路46號", cuisine: "日式炸牛排與燒肉", addressSourceUrl: "https://www.facebook.com/ICHIGYU/" },
  { name: "稻香村懷舊料理", city: "雲林縣", district: "斗南鎮", address: "雲林縣斗南鎮光華路36號", cuisine: "懷舊台菜", addressSourceUrl: "https://tour.yunlin.gov.tw/main/modules/MySpace/index.php?xmlid=1037876" },
  { name: "澎富企業", pendingReason: "公開資訊可確認為食品研發與代工企業，不是單一餐廳據點，暫不當作餐廳匯入。" },
  { name: "知山田頂級燒肉", city: "桃園市", district: "桃園區", address: "桃園市桃園區大興西路三段255號", cuisine: "燒肉", addressSourceUrl: "https://www.tcf.org.tw/page/news/show.aspx?num=55" },
  { name: "福相麻辣香鍋", city: "臺南市", district: "北區", address: "臺南市北區公園南路281號", cuisine: "麻辣香鍋", addressSourceUrl: "https://www.facebook.com/fuxiang.ch/" },
  { name: "晶粵軒烤鴨餐廳", city: "桃園市", district: "桃園區", address: "桃園市桃園區南平路166號2F", cuisine: "港式烤鴨", addressSourceUrl: "https://inline.app/booking/-O7XszbGclpg_Xhl7Vle%3Ainline-live-3/-O7XszoxNL1rCp5Bklcf" },
  { name: "鴨覓烤鴨餐廳", city: "臺北市", district: "信義區", address: "臺北市信義區松智路17號B1", cuisine: "烤鴨餐廳", addressSourceUrl: "https://www.facebook.com/p/%E9%B4%A8%E8%A6%93%E7%83%A4%E9%B4%A8%E9%A4%90%E5%BB%B3-61568438303928/" },
  { name: "福樓餐廳", city: "臺南市", district: "中西區", address: "臺南市中西區永華路一段300號", cuisine: "台菜", addressSourceUrl: "https://www.facebook.com/fulou.tainan/" },
  { name: "廚房有雞 粵菜餐廳", city: "臺南市", district: "東區", address: "臺南市東區中華東路三段300號", cuisine: "粵菜", addressSourceUrl: "https://www.instagram.com/reel/DIfgKYIoBYL/" },
  { name: "田園素食", city: "臺南市", district: "歸仁區", address: "臺南市歸仁區中正北路一段168-1號", cuisine: "素食", addressSourceUrl: "https://niceclaup313.pixnet.net/blog/posts/8234767064" },
  { name: "福安專業土雞料理餐廳", city: "臺南市", district: "歸仁區", address: "臺南市歸仁區文化街一段165號", cuisine: "土雞料理", addressSourceUrl: "https://www.1989wolfe.com/2025/08/FuanChicken.html" },
  { name: "一鍋三饗", city: "新北市", district: "板橋區", address: "新北市板橋區民族路33號", cuisine: "火鍋與鐵板燒", addressSourceUrl: "https://www.facebook.com/OnePotTripleFeast/" },
  { name: "大楊梅鵝莊", city: "桃園市", district: "楊梅區", address: "桃園市楊梅區大平街42號", cuisine: "客家鵝肉", addressSourceUrl: "https://best-goose.com/about.asp" },
  { name: "趙海真私廚", city: "臺北市", district: "大安區", address: "臺北市大安區樂利路86巷6號", cuisine: "私廚中菜", addressSourceUrl: "https://www.instagram.com/reel/DP1aWgoCchn/" },
  { name: "洪毓姗（蔡家虹）手作三明治", pendingReason: "目前只確認為個人品牌名稱，缺穩定公開門市地址。" },
  { name: "聚豐園江浙美食餐廳", city: "臺北市", district: "松山區", address: "臺北市松山區民生東路三段122號", cuisine: "江浙菜", addressSourceUrl: "https://www.facebook.com/groups/Shanghaicuisine/" },
  { name: "焰遇燒肉", city: "臺南市", district: "新營區", address: "臺南市新營區新進路二段237號", cuisine: "燒肉", addressSourceUrl: "https://lyes.tw/yanyushaorou-%E7%84%B0%E9%81%87/" },
  { name: "星馬快餐", city: "臺南市", district: "善化區", address: "臺南市善化區民生路132號", cuisine: "星馬料理", addressSourceUrl: "https://shop.ichefpos.com/store/Ky8eHVS2/ordering" },
  { name: "SOL-Tainan", city: "臺南市", district: "安平區", address: "臺南市安平區新港路二段585號4樓", cuisine: "無國界料理", addressSourceUrl: "https://www.sol-restaurant.com/" },
  { name: "小樽手作珈琲", pendingReason: "同品牌至少有迪化街店與民權西路店，得獎頁未指明門市，先不縮減成單店。" },
  { name: "食代鐵板燒", city: "臺中市", district: "東區", address: "臺中市東區南京路66號3樓", cuisine: "鐵板燒", addressSourceUrl: "https://www.threads.com/%40wangying8115/post/DXWLdK5DsNF/%E5%8F%B0%E4%B8%AD%E7%AB%99%E5%89%8D%E7%BE%8E%E9%A3%9F%E9%A3%9F%E4%BB%A3%E9%90%B5%E6%9D%BF%E7%87%92-%E7%A7%80%E6%B3%B0%E7%AB%99%E5%89%8D%E5%BA%97%E9%A6%99%E7%85%8E%E9%AE%AE%E9%AD%9A%E6%8E%92%E5%A5%97%E9%A4%90%E9%99%84%E5%B0%8F%E8%8F%9C%E8%92%B8%E8%9B%8B%E6%99%82%E8%94%AC%E8%88%87%E9%BB%9E%E5%BF%83%E4%B8%80%E6%AC%A1%E6%BB%BF%E8%B6%B3%E5%93%88%E5%9B%89%E6%88%91%E6%98%AF%E7%8E%8B%E7%80%A0%E5%B8%B8%E8%A8%80%E9%81%93%E9%A3%9F%E4%BB%A3%E9%90%B5%E6%9D%BF%E7%87%92%E6%AF%8F%E4%B8%80%E5%8F%A3%E9%83%BD%E5%80%BC%E5%BE%97%E7%B4%B0%E7%B4%B0%E5%9B%9E%E5%91%B3%E8%BF%91%E6%9C%9F%E8%88%87%E8%A6%AA%E5%8F%8B%E5%89%8D%E5%BE%80%E5%8F%B0%E4%B8%AD%E8%BC%95%E6%97%85%E8%A1%8C%E6%BC%AB%E6%AD%A5%E8%87%B3%E5%8F%B0%E4%B8%AD%E5%B8%82" },
  { name: "南星鐵板燒", city: "臺南市", district: "安平區", address: "臺南市安平區府前四街12號2樓", cuisine: "鐵板燒", addressSourceUrl: "https://www.klook.com/zh-TW/activity/189943-nansei-teppanyaki/" },
  { name: "がんこ莞固和食", pendingReason: "品牌跨大直、林口、中壢、台南多店，得獎頁未指明門市。" },
  { name: "悅華軒", city: "臺北市", district: "大安區", address: "臺北市大安區復興南路一段283號2樓", cuisine: "粵菜", addressSourceUrl: "https://www.tcf.org.tw/page/news/show.aspx?num=56" },
  { name: "新方海鮮宴會館", city: "新北市", district: "五股區", address: "新北市五股區成泰路一段194-2號", cuisine: "海鮮宴會", addressSourceUrl: "https://wanlicrab.tw/features/crab-restaurants-mrt/119-wugu-dist/287-xinfang" },
  { name: "焿大王", pendingReason: "品牌多店，得獎頁未指明是政大店、大溪店或其他門市。" },
  { name: "魔法咖哩", pendingReason: "品牌多店，得獎頁未指明是台北站前店或其他門市。" },
  { name: "Q勁麵館", city: "桃園市", district: "龜山區", address: "桃園市龜山區文化一路10巷42弄35號", cuisine: "麵館", addressSourceUrl: "https://www.facebook.com/p/Q%E5%8B%81%E9%BA%B5%E9%A4%A8%E9%95%B7%E5%BA%9A%E5%BA%97-61554760757074/" },
  { name: "三個老總", pendingReason: "公開資訊主要指向酒品品牌，尚未確認對應實體餐飲據點。" },
  { name: "焦糖楓", pendingReason: "品牌多店，得獎頁未指明是通化創始店或其他門市。" },
  { name: "少點鹽健康餐盒專賣", pendingReason: "連鎖門市多且得獎頁未指明門市，先不縮減成單店。" }
];

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function awardFor(generatedAt, row) {
  const notes = [
    "主來源為台灣餐飲業聯盟 2025 美食指南點讚榜（臺灣站）名單頁。",
    `地址輔助來源：${row.addressSourceUrl}`,
  ];
  return {
    guide: "tcfpraise",
    year: 2025,
    level: "美食指南點讚榜（臺灣站）",
    awardName: "2025美食指南點讚榜（臺灣站）",
    url: sourceUrl,
    extractedAt: generatedAt,
    notes: notes.join(" ")
  };
}

function main() {
  const generatedAt = new Date().toISOString();
  const restaurants = [];
  const needsCityReview = [];

  for (const row of ROWS) {
    if (row.city) {
      restaurants.push({
        name: row.name,
        city: row.city,
        district: row.district || "",
        address: row.address || "",
        cuisine: row.cuisine || "",
        aliases: [],
        awards: [awardFor(generatedAt, row)],
        importConfidence: "high",
        matchedBy: "manual_public_source_confirmation"
      });
      continue;
    }
    needsCityReview.push({
      name: row.name,
      reason: row.pendingReason || "city_not_in_source_and_no_unique_existing_match",
      sourceUrl
    });
  }

  const payload = {
    version: "tcf-praise-2025-candidates",
    generatedAt,
    sourceUrl,
    policy: {
      runtimeExternalLookup: false,
      importMode: "manual_public_source_confirmation",
      noCityGuess: true,
      notes: [
        "主來源改採可公開讀取的台灣餐飲業聯盟名單頁 num=48；原先 num=48&lang=TW 已 404。",
        "該名單頁文字宣稱 32 家，但實際列出 36 個品牌名稱；此差異保留在備註，不自行刪減名單。",
        "多分店品牌、企業品牌或未能安全對位門市者保留在 needsCityReview，不猜測單店。"
      ]
    },
    restaurants,
    needsCityReview
  };

  const report = {
    generatedAt,
    sourceUrl,
    sourceRows: ROWS.length,
    candidates: restaurants.length,
    needsCityReview: needsCityReview.length,
    errors: []
  };

  writeJson(outPath, payload);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main();
