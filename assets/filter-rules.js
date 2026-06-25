// Filter definitions and precision tiers. This file is public and safe to edit.
window.RANK_FILTER_DEFS = [
  { key:"travel",  label:"交通", tier:"route", opts:[{label:"走路"}, {label:"開車"}] },
  { key:"open",    label:"營業", tier:"hard", opts:[{label:"不限"}, {label:"營業中"}] },
  { key:"meal",    label:"時段", tier:"search", opts:[{label:"早餐", query:"早餐"}, {label:"早茶", query:"早茶"}, {label:"午餐", query:"午餐"}, {label:"午茶", query:"下午茶"}, {label:"晚餐", query:"晚餐"}, {label:"消夜", query:"宵夜"}] },
  { key:"service", label:"吃法", tier:"search", opts:[{label:"單點"}, {label:"吃到飽", query:"吃到飽 自助餐 buffet 放題 all you can eat"}] },
  { key:"occasion",label:"情境", tier:"search", opts:[{label:"聚餐", query:"聚餐 適合團體 可訂位"}, {label:"獨享", query:"一個人 用餐"}] },
  { key:"type",    label:"型態", tier:"search", opts:[{label:"正餐", query:"餐廳"}, {label:"小吃", query:"小吃"}] },
  { key:"diet",    label:"飲食", tier:"hard", opts:[{label:"葷食"}, {label:"素食", query:"素食 蔬食"}] },
  { key:"style",   label:"風格", tier:"search", opts:[{label:"傳統", query:"老店 傳統"}, {label:"現代", query:"現代 創意"}] },
];
