# Google 登入 Popup 逾時復原設計

日期：2026-07-17
目標版本：`2026.07.17.4`

## 問題與目標

目前前端按下「使用 Google 登入」後會直接等待 Firebase `signInWithPopup()`。如果瀏覽器沒有開出登入視窗，而且 Promise 也沒有成功或失敗，登入按鈕會永久停在「登入中...」。

本次目標是讓登入流程最多維持 20 秒的忙碌狀態。超過時間後恢復登入按鈕並提供明確操作指引，避免使用者只能重新整理頁面。

## 範圍

本次包含：

1. 在 `assets/auth-logic.js` 提供可由 Node.js 測試的 Promise 逾時包裝。
2. Popup 登入等待 20 秒後產生固定錯誤代碼 `auth/popup-timeout`。
3. `index.html` 顯示逾時指引並恢復登入按鈕。
4. 測試正常成功、Firebase 原始錯誤及逾時三種結果。
5. 更新 `VERSION`、畫面短版號與核心靜態資源版本參數為 `2026.07.17.4`。

本次不包含：

1. 不自動切換 `signInWithRedirect()`。
2. 不修改 Firebase Auth、App Check、reCAPTCHA Enterprise 或 Functions 設定。
3. 不關閉或降低 App Check 保護。
4. 不處理 App Check 403 的平台風險分數或配額問題。
5. 不部署；部署需另行取得使用者確認。

## 方案選擇

採用「20 秒軟性逾時，不自動 redirect」。

沒有採用自動 redirect，因為 GitHub Pages 與 `firebaseapp.com` 是不同網域，現代瀏覽器的第三方儲存限制可能使 redirect 登入無法正確取回結果。沒有採用只擴充內建瀏覽器名單，因為無法涵蓋未知 WebView 或其他 Promise 永久 pending 的環境。

## 模組責任

### `assets/auth-logic.js`

新增 `withTimeout(promise, timeoutMs)`：

- 原 Promise 在期限內成功時，回傳原結果。
- 原 Promise 在期限內失敗時，保留並拋出原錯誤。
- 超過期限時，拋出 `Error`，其 `code` 固定為 `auth/popup-timeout`。
- 逾時只結束前端等待，不宣稱能取消 Firebase 內部已開始的 OAuth 工作。
- 原 Promise 逾時後若稍後完成，不產生未處理的 Promise rejection。

既有 `loginStrategy()` 保持不變，已知 LINE、Facebook、Instagram 等內建瀏覽器仍使用「複製網址並提示外開」策略。

### `index.html`

將直接等待：

```js
await auth.signInWithPopup(provider);
```

改為透過 `NGE_AUTH_LOGIC.withTimeout()` 等待 20 秒。

`authErrorMessage()` 新增 `auth/popup-timeout` 訊息：

> 登入流程已等待 20 秒。若登入視窗已開啟，請繼續完成；若未開啟，請重新點選或改用 Safari／Chrome 一般分頁。

既有 `finally` 繼續統一呼叫 `setAuthBusy(false)`，因此成功、Firebase 錯誤與逾時都會恢復按鈕。若原 Popup 在逾時後仍成功，既有 `onAuthStateChanged` 仍會完成登入、清除錯誤並進入 App。

## 狀態流程

```text
使用者按 Google 登入
  -> 清除舊錯誤並停用按鈕
  -> 已知內建瀏覽器：複製網址、提示外開、恢復按鈕
  -> 一般瀏覽器：啟動 signInWithPopup
       -> 20 秒內成功：等待 onAuthStateChanged 進入 App
       -> 20 秒內失敗：顯示 Firebase 對應錯誤
       -> 20 秒仍 pending：顯示逾時指引並恢復按鈕
```

App Check 仍在 Firebase 初始化時獨立啟用。本次不把 App Check 403 誤顯示成 Google 登入逾時。

## 測試設計

`scripts/test-auth-logic.js` 增加以下契約：

1. `withTimeout(Promise.resolve(value), ...)` 回傳原值。
2. `withTimeout(Promise.reject(error), ...)` 保留同一個 Firebase 錯誤。
3. 永不結束的 Promise 在期限後以 `auth/popup-timeout` 失敗。
4. 既有一般瀏覽器與內建瀏覽器策略測試繼續通過。

測試採先失敗、再實作的 TDD 流程。實作完成後至少執行：

```powershell
node scripts/test-auth-logic.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
git diff --check
```

若準備正式部署，依 `AGENTS.md` 執行完整最低驗證矩陣與瀏覽器人工驗收，並另外取得部署同意。

## 風險與處理

- 使用者可能已開啟 Popup，但選擇帳號超過 20 秒：逾時訊息會明確告知「若視窗已開啟，請繼續完成」，後續成功仍由 Auth 狀態事件接手。
- 使用者逾時後再次點擊：Firebase 可能取消前一次 Popup，既有錯誤處理必須顯示可重試訊息，不能讓按鈕再次永久停用。
- App Check 仍可能在特定瀏覽器回傳 403：這不在本次範圍，完成登入逾時修正不代表搜尋 API 已在該瀏覽器可用。

## 驗收條件

1. Popup Promise 永久 pending 時，20 秒後登入按鈕恢復。
2. 畫面顯示可理解的逾時與外開指引。
3. Popup 在期限內成功或失敗時保持 Firebase 原有結果。
4. 已知內建瀏覽器外開提示行為不變。
5. 不新增 redirect、自動搜尋或額外 Google API 呼叫。
6. 版本與核心靜態資源版本參數同步為 `2026.07.17.4`。
