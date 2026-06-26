// Filter definitions and precision tiers. This file is public and safe to edit.
window.RANK_FILTER_DEFS = [
  { key:"travel",  label:"交通", tier:"route", opts:[{label:"走路"}, {label:"開車"}] },
  { key:"open",    label:"營業", tier:"hard", opts:[{label:"不限"}, {label:"營業中"}] },
  { key:"meal",    label:"時段", tier:"search", opts:[{label:"早餐", query:"早餐"}, {label:"早茶", query:"早茶"}, {label:"午餐", query:"午餐"}, {label:"午茶", query:"下午茶"}, {label:"晚餐", query:"晚餐"}, {label:"消夜", query:"宵夜"}] },
  { key:"service", label:"吃法", tier:"search", opts:[{label:"單點"}, {label:"吃到飽", query:"吃到飽 自助餐 buffet 放題 all you can eat"}] },
  { key:"diet",    label:"飲食", tier:"hard", opts:[{label:"葷食"}, {label:"素食", query:"素食 蔬食"}] },
];
