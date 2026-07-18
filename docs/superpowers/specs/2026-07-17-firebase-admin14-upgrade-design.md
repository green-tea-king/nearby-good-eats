# Firebase Admin 14 受控升級設計

日期：2026-07-17

## 目標

在不更換 Firebase 專案、Functions 名稱、region、Node.js runtime、模組系統或部署平台的前提下，將 Functions 相依套件升級至 Firebase Admin SDK 14，移除已淘汰的 namespace 呼叫，並用可重現測試確認 Auth、App Check、Firestore 與第二代 HTTP Functions 的既有契約不變。

本次目標版本：

- `firebase-admin`: `14.2.0`
- `firebase-functions`: `7.3.0`
- Node.js: 維持 `22`
- module system: 維持 CommonJS
- 應用程式版本：實作完成時更新為 `2026.07.17.7`

正式 Firebase project 固定為 `nearby-good-eats`。本設計不建立新 Firebase project、不更名 `api`／`photo` Functions、不變更 Secret、Firestore Rules 或 API 成本策略。

## 現況與必要性

目前 `functions/index.js` 使用 Admin SDK 舊式 namespace：

- `admin.initializeApp()`
- `admin.auth()`
- `admin.appCheck()`
- `admin.firestore()`
- `admin.firestore.FieldValue`

Firebase Admin SDK 14 已移除 namespace 支援，因此不能只更新套件版本。`firebase-functions 7.2.5` 的 peer dependency 也未接受 Admin 14；必須同步升級至 `7.3.0`。

目前 `npm audit --omit=dev` 回報 8 個 moderate，來源為間接相依 `uuid 9.0.1`。實際依賴呼叫點只使用不受該公告影響的 `uuid.v4()`，所以不視為需要停站的緊急漏洞；仍應受控升級，並在新鎖檔產生後重新稽核。不得為追求零警告而使用未驗證的跨 major `overrides`。

## 方案比較

### 方案 A：直接執行強制修復

執行 `npm audit fix --force`，讓 npm 自動升級 Admin SDK。

缺點：不會改寫 namespace API，Functions 可能在載入時失敗；相依變更範圍也不容易 review。此方案不採用。

### 方案 B：同一工作 branch 內分階段升級（採用）

先新增契約測試，確認舊 namespace 會被拒絕；再將程式改為 modular API，於現有 Admin 13 下驗證；最後同步升級 Admin 14.2.0、Functions 7.3.0 與鎖檔，重跑完整驗證。

優點：每一步都有明確失敗與通過訊號，可區分「API 改寫問題」和「套件升級問題」，diff 集中且能安全 review。

### 方案 C：完全延後升級

等待所有間接套件都不再觸發 audit 後才升級。

缺點：會繼續依賴 Admin 13 舊 namespace，延後必要遷移，而且上游 Storage 相依何時完全消除警告並無確定日期。此方案只在實作發現無法安全載入或測試時作為暫停策略，不作首選。

## 程式設計

只修改 `functions/index.js` 的 Admin SDK 初始化與服務取得方式：

```js
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
```

既有呼叫改為：

- `admin.auth().verifyIdToken(token)` → `getAuth().verifyIdToken(token)`
- `admin.appCheck().verifyToken(token)` → `getAppCheck().verifyToken(token)`
- `admin.firestore.FieldValue.serverTimestamp()` → `FieldValue.serverTimestamp()`

不修改驗證順序、HTTP status、quota transaction、Firestore collection、事件欄位、CORS、Secret、timeout、memory 或 region。

## 相依與資料流

請求資料流維持不變：

```text
瀏覽器
  -> Authorization: Firebase ID token
  -> X-Firebase-AppCheck
  -> Functions v2 onRequest
  -> getAuth().verifyIdToken()
  -> getAppCheck().verifyToken()
  -> Firestore quota transaction / apiEvents
  -> Google API 或 Vertex AI
  -> 原格式 HTTP response
```

Admin 14 會把 Firestore 間接相依從 7.x 升到 8.x。Firestore 8 的公開 breaking changes 主要涉及最低 Node.js 18 與 TypeScript 寫入型別；本專案使用 JavaScript 與 Node.js 22。仍需以 transaction、document write 與 `FieldValue.serverTimestamp()` 契約測試確認實際行為。

## 錯誤處理

Admin 14 重整 Firebase error class，但本專案目前不依賴 Admin error class 或精確 error code；Auth、App Check 與 Firestore 錯誤主要由既有 `catch` 流程轉成 HTTP 錯誤或記錄訊息。

升級不得：

- 把驗證失敗改成成功或空結果。
- 把 Auth／App Check 錯誤內容直接洩漏給前端。
- 放寬 `REQUIRE_APP_CHECK` 或停用 quota。
- 把 Firestore 寫入失敗偽裝成正常搜尋結果。

## 測試設計

新增 `functions/test-admin-sdk-contract.js`，至少驗證：

1. `functions/index.js` 不再載入 `require("firebase-admin")` 舊 namespace。
2. 明確載入 `firebase-admin/app`、`auth`、`app-check`、`firestore` modular entry points。
3. 使用 `initializeApp`、`getAuth`、`getAppCheck`、`getFirestore`、`FieldValue`。
4. 不再出現 `admin.auth()`、`admin.appCheck()`、`admin.firestore()` 或 `admin.firestore.FieldValue`。
5. modular entry points 在實際安裝套件下可由 CommonJS 載入。

TDD 順序：先加入測試並確認它因現有 namespace 程式失敗，再做最小程式改寫使其通過。完成套件升級後，重新安裝鎖檔並再次執行同一測試。

Functions 範圍驗證：

```powershell
node functions/test-admin-sdk-contract.js
node functions/test-key-utils.js
node functions/test-summary-utils.js
node functions/test-places-field-mask.js
node functions/test-ai-classifier.js
node --check functions/index.js
node --check functions/ai-classifier.js

Push-Location functions
npm audit --omit=dev
Pop-Location
```

正式 merge 前仍執行 `AGENTS.md` 完整最低驗證矩陣與 `git diff --check`。若本機 Emulator 可用，再確認未登入 request 仍被拒絕；有效 Google 登入、App Check 與真實 Firestore transaction 需在部署前後依原站流程人工驗收。

## 版本與文件

實作完成時更新：

- `VERSION` → `2026.07.17.7`
- `design.md` 的版本與維護紀錄
- `index.html` 四個核心靜態 JS query version 與 fallback version

本次不改前端功能，但仍依專案規則同步靜態版本引用，避免正式站版本來源不一致。

## Audit 判定

升級後重新執行 `npm audit --omit=dev`，將結果分成：

1. 已由 Firestore／google-gax 升級消除的項目。
2. 仍由未使用的 Storage optional dependency 帶入的項目。
3. 專案實際可達的呼叫路徑。

若仍有警告，不使用 `--force` 或跨 major override。只有上游相依提供正式相容版本、或能以現有測試證明安全的正常升級，才進一步處理。

## 部署與回滾

本實作階段不部署。測試、commit、push、PR、merge 與正式 Functions 部署各自保留既有核准閘門。

部署前記錄：

- 原本 `origin/main` commit。
- 預計部署 commit 與版本。
- `nearby-good-eats` 專案中的 `api`／`photo` 目前 runtime、region 與狀態。
- 現有 Secret 與 env 名稱；不得輸出 Secret 值。

正式部署只使用原本專案：

```powershell
$env:CI='1'
npx firebase-tools deploy --project nearby-good-eats --only "functions:api,functions:photo"
```

若部署後 Auth、App Check、Firestore 或載入失敗，從部署前已驗證 commit 建立新的回滾 commit／branch，重新部署舊版 Functions。禁止 hard reset、force push、改寫歷史或刪除資料。

## 完成條件

- 所有舊 Admin namespace 呼叫已移除。
- Admin 14.2.0 與 Functions 7.3.0 peer dependency 相容。
- Node.js 22、CommonJS、Functions 名稱、region 與 runtime options 不變。
- 新契約測試有完整 RED／GREEN 證據。
- Functions 單元測試、語法檢查與專案最低驗證矩陣通過。
- 新版 audit 結果已如實回報；不以強制 override 隱藏警告。
- 版本更新為 `2026.07.17.7`。
- 沒有建立新 Firebase project、沒有更換部署平台、沒有刪除檔案或資料。
- 未經另外確認不部署、不 merge。
