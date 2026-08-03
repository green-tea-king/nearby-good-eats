# Google Cloud Billing 對照流程

後台的 `apiEvents.estimatedCostUsd` 是控管趨勢的估算，不是 Google Cloud 帳單真值。本專案提供 `scripts/billing-reconciliation.js` 對照已正規化的帳務資料與後台 API 事件。

1. 在 Google Cloud Billing 匯出或查詢本專案期間帳務，整理成 JSON 陣列；每筆至少有 `service` 與 USD `cost`。
2. 從管理員後台匯出同一期間的 API 事件，保留 `action` 與 `estimatedCostUsd`。
3. 執行：

```powershell
node scripts/billing-reconciliation.js --billing .\billing-normalized.json --events .\admin-api-events.json
```

輸出會依 service／action 名稱彙總。名稱不同時必須先在匯出前人工對照，不能把不相同的服務名稱當作零差異。

啟用 Billing export、建立 BigQuery dataset、設定預算或通知是 Google Cloud 的外部權限／費用設定；本地工具不會自動建立這些資源，需由專案管理員明確授權後執行。
