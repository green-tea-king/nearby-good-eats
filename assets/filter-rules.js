// Filter definitions and precision tiers. This file is public and safe to edit.
window.RANK_FILTER_DEFS = [
  {
    key: "travel",
    label: "交通",
    tier: "route",
    opts: [{ label: "走路" }, { label: "開車" }],
  },
  {
    key: "open",
    label: "營業",
    tier: "hard",
    opts: [{ label: "不限" }, { label: "營業中" }],
  },
  {
    key: "meal",
    label: "時段",
    tier: "search",
    opts: [
      { label: "早餐", query: "早餐 早午餐 餐廳 推薦" },
      { label: "午餐", query: "午餐 餐廳 美食 推薦" },
      { label: "下午茶", query: "咖啡 甜點 下午茶 店" },
      { label: "晚餐", query: "晚餐 餐廳 美食 推薦" },
      { label: "宵夜", query: "宵夜 餐廳 小吃 燒烤 火鍋" },
      { label: "聚餐", query: "聚餐 餐廳 合菜 包廂 推薦" },
    ],
  },
  {
    key: "service",
    label: "形式",
    tier: "search",
    opts: [
      { label: "單點" },
      { label: "吃到飽", query: "吃到飽 buffet all you can eat 餐廳" },
    ],
  },
  {
    key: "diet",
    label: "飲食",
    tier: "hard",
    opts: [{ label: "不限" }, { label: "素食", query: "素食 vegan vegetarian 餐廳" }],
  },
  {
    key: "award",
    label: "評鑑（可複選）",
    tier: "static",
    opts: [
      { label: "不限" },
      { label: "米其林三星", guide: "michelin", level: "三星" },
      { label: "米其林二星", guide: "michelin", level: "二星" },
      { label: "米其林一星", guide: "michelin", level: "一星" },
      { label: "米其林星", guide: "michelin" },
      { label: "米其林入選", guide: "michelin_selected" },
      { label: "必比登", guide: "bib" },
      { label: "500盤", guide: "500plate" },
      { label: "500碗", guide: "500bowl" },
      { label: "500甜", guide: "500sweet" },
    ],
  },
];
