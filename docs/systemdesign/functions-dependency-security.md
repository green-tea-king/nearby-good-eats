# Functions 相依安全狀態

更新日期：2026-08-03

`functions/package-lock.json` 已更新到既有 semver 範圍可取得的版本，包括 `firebase-functions` 7.3.2、`@google-cloud/firestore` 8.7.0、`google-gax` 5.0.8 與 `brace-expansion` 2.1.4。

截至本次驗證，`npm audit --omit=dev` 回報 0 個 high、7 個 moderate。這些結果都在 Firebase Admin 的轉接相依鏈上；可用修補仍會提出不相容的 Firebase major 降版，不能直接套用 `--force`。

每次更新 Functions 相依後必須：

```powershell
Push-Location functions
npm audit --omit=dev
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
node test-source-discovery-load.js
Pop-Location
```

另執行 `node scripts/test-functions-security-contract.js`，確保 lockfile 不會退回本次確認過的最低相容版本。這是版本退步防線，不會把尚未由上游修補的 audit 警告誤標為已解決。

若 npm 或 Firebase 上游提供不涉及降級的修補版本，先在獨立 branch 更新 lockfile、於本機暫存副本完成乾淨安裝與上述測試，再評估部署。
