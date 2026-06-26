// Filter definitions and precision tiers. This file is public and safe to edit.
window.RANK_FILTER_DEFS = [
  { key:"travel",  label:"交通", tier:"route", opts:[{label:"走路"}, {label:"開車"}] },
  { key:"open",    label:"營業", tier:"hard", opts:[{label:"不限"}, {label:"營業中"}] },
  { key:"meal",    label:"時段", tier:"search", opts:[{label:"早餐", query:"早餐 早午餐 豆漿 蛋餅"}, {label:"早茶", query:"早茶 早午餐 港式飲茶 港點"}, {label:"午餐", query:"午餐 便當 定食 簡餐 商業午餐"}, {label:"午茶", query:"下午茶 咖啡 甜點 茶屋"}, {label:"晚餐", query:"晚餐 餐酒館 火鍋 燒肉 聚餐"}, {label:"消夜", query:"宵夜 消夜 夜市 居酒屋 串燒"}] },
  { key:"service", label:"吃法", tier:"search", opts:[{label:"單點"}, {label:"吃到飽", query:"吃到飽 自助餐 buffet 放題 all you can eat 無限供應 任食"}] },
  { key:"diet",    label:"飲食", tier:"hard", opts:[{label:"葷食"}, {label:"素食", query:"素食 蔬食 vegan vegetarian 素餐 純素"}] },
];
