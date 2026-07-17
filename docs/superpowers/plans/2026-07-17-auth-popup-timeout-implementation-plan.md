# Google 登入 Popup 逾時復原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Do not delegate unless the user explicitly requests subagents.

**Goal:** Google Popup 登入等待超過 20 秒時恢復登入按鈕並顯示可操作的指引，同時保留正常成功與 Firebase 原始錯誤。

**Architecture:** 將 Promise 逾時行為放在可由 Node.js 測試的 `assets/auth-logic.js`，`index.html` 只負責呼叫 Firebase、轉換錯誤訊息與更新 UI。逾時是前端等待期限，不嘗試取消 Firebase OAuth，也不自動改用 redirect。

**Tech Stack:** 原生 JavaScript、Firebase Web Compat SDK 10.12.5、Node.js `assert` 測試腳本、GitHub Pages 靜態資源版本契約。

## Global Constraints

- 固定工作 branch：`codex/fix-auth-popup-timeout-20260717`。
- 正式版號：`2026.07.17.4`，格式維持 `YYYY.MM.DD.N`。
- Popup 忙碌狀態期限固定為 20,000 毫秒。
- 逾時錯誤代碼固定為 `auth/popup-timeout`。
- 不自動呼叫 `signInWithRedirect()`。
- 不修改 Firebase Auth、App Check、reCAPTCHA Enterprise、Functions 或 Firestore 設定。
- 不新增 API 呼叫、不自動搜尋、不加入假資料。
- 不修改或追蹤 `firebase-debug.log`。
- 不部署、不 merge、不 push；上述操作需另外取得使用者明確同意。
- 不刪除任何檔案或資料。

---

### Task 1: 建立可測試的 Promise 逾時保護

**Files:**
- Modify: `scripts/test-auth-logic.js`
- Modify: `assets/auth-logic.js`

**Interfaces:**
- Consumes: Firebase `signInWithPopup()` 回傳的 thenable／Promise 與毫秒期限。
- Produces: `withTimeout(promise, timeoutMs): Promise<unknown>`；逾時時拒絕帶有 `code = "auth/popup-timeout"` 的 `Error`。

- [ ] **Step 1: 先加入失敗測試**

將 `scripts/test-auth-logic.js` 改成非同步測試入口，完整內容如下：

```js
const assert = require("node:assert/strict");
const { loginStrategy, withTimeout } = require("../assets/auth-logic.js");

async function main() {
  assert.equal(loginStrategy({ embedded:false }), "popup");
  assert.equal(loginStrategy({ embedded:true }), "external-browser-required");

  const successValue = { ok:true };
  assert.equal(await withTimeout(Promise.resolve(successValue), 50), successValue);

  const firebaseError = Object.assign(new Error("popup blocked"), { code:"auth/popup-blocked" });
  await assert.rejects(
    withTimeout(Promise.reject(firebaseError), 50),
    error => error === firebaseError,
  );

  await assert.rejects(
    withTimeout(new Promise(() => {}), 10),
    error => error?.code === "auth/popup-timeout",
  );

  console.log("auth logic tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: 執行測試並確認 RED**

Run:

```powershell
node scripts/test-auth-logic.js
```

Expected: FAIL，原因是 `withTimeout is not a function`；不得因語法錯誤或路徑錯誤失敗。

- [ ] **Step 3: 實作最小逾時邏輯**

在 `assets/auth-logic.js` 的 factory 內加入：

```js
function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("Google sign-in popup timed out");
      error.code = "auth/popup-timeout";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout])
    .finally(() => clearTimeout(timeoutId));
}
```

並把 export 改成：

```js
return { loginStrategy, withTimeout };
```

- [ ] **Step 4: 執行測試並確認 GREEN**

Run:

```powershell
node scripts/test-auth-logic.js
```

Expected: PASS，輸出 `auth logic tests passed`，沒有未處理 Promise rejection。

- [ ] **Step 5: 檢查差異並提交純邏輯**

Run:

```powershell
git diff --check
git diff -- assets/auth-logic.js scripts/test-auth-logic.js
git add assets/auth-logic.js scripts/test-auth-logic.js
git commit -m "fix: add auth popup timeout guard"
```

Expected: commit 只包含兩個列出的檔案。

---

### Task 2: 接入登入 UI 並更新 `2026.07.17.4`

**Files:**
- Modify: `scripts/test-auth-logic.js`
- Modify: `index.html`
- Modify: `VERSION`
- Modify: `design.md`

**Interfaces:**
- Consumes: `NGE_AUTH_LOGIC.withTimeout(promise, 20000)` 與錯誤代碼 `auth/popup-timeout`。
- Produces: 20 秒後可恢復的登入按鈕、繁體中文逾時訊息，以及同步的靜態資源版本。

- [ ] **Step 1: 加入前端整合契約測試**

在 `scripts/test-auth-logic.js` 頂端新增：

```js
const fs = require("node:fs");
const path = require("node:path");
```

在 `main()` 的成功訊息之前新增：

```js
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
assert.match(
  html,
  /NGE_AUTH_LOGIC\.withTimeout\(auth\.signInWithPopup\(provider\), 20000\)/,
  "Google popup 登入必須有 20 秒逾時保護",
);
assert.match(
  html,
  /auth\/popup-timeout/,
  "登入錯誤訊息必須辨識 popup 逾時代碼",
);
assert.match(
  html,
  /登入流程已等待 20 秒。若登入視窗已開啟，請繼續完成；若未開啟，請重新點選或改用 Safari／Chrome 一般分頁。/,
  "Popup 逾時必須提供可操作的繁體中文指引",
);
```

- [ ] **Step 2: 執行整合測試並確認 RED**

Run:

```powershell
node scripts/test-auth-logic.js
```

Expected: FAIL，訊息指出 `index.html` 尚未使用 `NGE_AUTH_LOGIC.withTimeout(..., 20000)`。

- [ ] **Step 3: 接入逾時錯誤與登入呼叫**

在 `index.html` 的 `authErrorMessage(error)` 中，放在其他 popup 錯誤之前加入：

```js
if (code.includes("popup-timeout")) return "登入流程已等待 20 秒。若登入視窗已開啟，請繼續完成；若未開啟，請重新點選或改用 Safari／Chrome 一般分頁。";
```

將：

```js
await auth.signInWithPopup(provider);
```

改成：

```js
await NGE_AUTH_LOGIC.withTimeout(auth.signInWithPopup(provider), 20000);
```

保留既有 `finally { setAuthBusy(false); }`，不加入 redirect 或新的 API 呼叫。

- [ ] **Step 4: 執行登入測試並確認 GREEN**

Run:

```powershell
node scripts/test-auth-logic.js
```

Expected: PASS，輸出 `auth logic tests passed`。

- [ ] **Step 5: 先更新版本真相來源並確認版本測試會失敗**

將 `VERSION` 改為：

```text
2026.07.17.4
```

Run:

```powershell
node scripts/test-static-asset-versions.js
```

Expected: FAIL，指出 `index.html` 的核心 JS query 尚未綁定 `2026.07.17.4`。

- [ ] **Step 6: 同步所有正式版本來源**

只更新目前正式版本來源，不改寫舊設計與舊計畫中的歷史版號：

1. `index.html` 四個核心 JS query 改為 `?v=2026.07.17.4`。
2. `index.html` 的 `APP_VERSION_FALLBACK` 改為 `2026.07.17.4`。
3. `design.md` 第 3 行與快速接手摘要中的目前版本改為 `2026.07.17.4`。
4. `VERSION` 保持 `2026.07.17.4`。

- [ ] **Step 7: 執行版本與 UI 文字測試**

Run:

```powershell
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
```

Expected:

- `static asset version tests passed`
- `scan-ui-text: 0 finding(s)` 或同等零問題輸出

- [ ] **Step 8: 檢查差異並提交前端修正版本**

Run:

```powershell
git diff --check
git diff -- scripts/test-auth-logic.js index.html VERSION design.md
git add scripts/test-auth-logic.js index.html VERSION design.md
git commit -m "fix: recover stalled Google login popup"
```

Expected: commit 只包含四個列出的檔案，版本為 `2026.07.17.4`。

---

### Task 3: 完整驗證與交付檢查

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes: Tasks 1–2 的兩個實作 commits。
- Produces: 可供 review／merge 的驗證紀錄；不部署、不 push、不 merge。

- [ ] **Step 1: 執行前端與資料最低驗證矩陣**

Run:

```powershell
node scripts/test-search-logic.js
node scripts/test-auth-logic.js
node scripts/test-core-awards-enrichment.js
node scripts/test-static-asset-versions.js
node scripts/scan-ui-text.js
node scripts/validate-awards-data.js
node scripts/validate-external-signals.js
node scripts/validate-external-source-coverage.js
node scripts/test-pages-artifact.js
node scripts/test-pages-workflow-contract.js
```

Expected: 所有指令 exit code 0。任何失敗都先停止並回報，不可宣稱通過。

- [ ] **Step 2: 執行 Functions 不變性驗證**

Run:

```powershell
Push-Location functions
node test-key-utils.js
node test-summary-utils.js
node test-places-field-mask.js
node test-ai-classifier.js
npm audit --omit=dev
Pop-Location
```

Expected: Node 測試通過；`npm audit` 若有既存警告，逐項照實回報，不為消除警告更新相依套件。

- [ ] **Step 3: 執行 Git 與版本最終確認**

Run:

```powershell
git diff --check
git status --short --branch
git log -3 --oneline
Get-Content -Encoding UTF8 VERSION
```

Expected:

- branch 是 `codex/fix-auth-popup-timeout-20260717`
- `VERSION` 是 `2026.07.17.4`
- 沒有未提交的追蹤檔案差異
- 只允許既有未追蹤 `firebase-debug.log`

- [ ] **Step 4: 回報並等待後續授權**

用台灣繁體中文回報：修改檔案、兩個 commits、版本、每項驗證結果、未部署、正式 URL、App Check 403 仍未解決。明確說明 branch 可供 review，但不得自行 push、merge 或部署。
