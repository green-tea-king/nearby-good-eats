# 正式站回歸驗收清單

每次 GitHub Pages 部署完成後，先執行：

```powershell
.\scripts\smoke-live-site.ps1 -ExpectedVersion (Get-Content -Encoding UTF8 VERSION).Trim()
```

再以 Chrome 實測下列項目；每一項都要在部署後當輪確認，不能以舊測試代替。

1. 首次開啟不自動搜尋，且版本短號與 `VERSION` 相符。
2. Google 登入後，輸入關鍵字不跳焦點；只按「套用」才發出搜尋。
3. 地區模式搜尋顯示 3 家，交通模式會清除地區條件。
4. 走路與開車各搜尋一次，確認交通模式標示與路線時間相符。
5. 「下一組」在同一候選池顯示不重複的 3 家。
6. 分享連結可用 `?place=<GooglePlaceId>` 開啟指定餐廳。
7. 詳情照片展開後才載入，點照片可開啟燈箱。
8. 管理員後台可讀取 API 事件、錯誤率、配額與估算成本。

驗收時記錄：部署 commit、版本、時間、使用的 Chrome 環境，以及任何未執行項目與原因。
