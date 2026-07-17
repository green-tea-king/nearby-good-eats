# Git 來源收斂與 GitHub Pages Actions 發布設計

## 目標

在不更換 repository、Firebase 專案、GitHub Pages site 或正式網址的前提下，讓 GitHub `main` 成為完整原始碼真相來源，並改由 GitHub Actions 只發布明確允許的靜態 artifact。完成後，任何維護者從 `green-tea-king/nearby-good-eats` clone `main` 都能取得完整前端、Firebase Functions、Firestore Rules、測試、規範與部署工具；GitHub Pages 仍只提供網站需要的檔案。

固定識別資訊：

- Repository：`green-tea-king/nearby-good-eats`
- Default branch：`main`
- Pages URL：`https://green-tea-king.github.io/nearby-good-eats/`
- Firebase project：`nearby-good-eats`
- 目前正式版本：`2026.07.17.2`
- 本次流程變更目標版本：`2026.07.17.3`
- 目前遠端 deployment commit：`fe2c6ccf69ae1e1c66b0717385069617cad8f49d`
- 目前工作 branch：`codex/deploy-local-primary-20260716`

## 現況與根因

目前 GitHub Pages 設定為 `build_type: legacy`，發布來源是 `main /`。`scripts/deploy-github-contents.ps1` 只把內建 allowlist 的 69 個檔案寫入遠端 `main`，並直接以 Git Data API 建立 blob、tree、commit 與 ref 更新。腳本不移動本機 HEAD，因此每次成功部署後，本機 branch 與遠端 `main` 必然再次分岔。

部署 `2026.07.17.2` 後的已驗證落差為：

- `HEAD...origin/main`：本機獨有 14 commits、遠端獨有 1 commit。
- 忽略 CRLF/LF 後有 26 個真實檔案差異。
- 遠端缺少 21 個本機維護、測試與設計檔案。
- 遠端 `AGENTS.md`、`firestore.rules`、`functions/index.js`、`functions/package.json`、`functions/package-lock.json` 仍是舊版。
- 遠端 Functions 原始碼仍標示 Node.js 20；本機與已部署 Firebase Functions 是 Node.js 22。
- 正式站關鍵檔案與本機內容相同；`assets/external-signals.json` 只有行尾差異。

這不是正式站內容錯誤，而是 `main` 同時被當成「完整來源 branch」和「精簡部署快照」造成的責任衝突。

## 已選方案

採用「完整 `main` + GitHub Actions Pages artifact」：

```text
本機完整專案
    ↓ 正常 commit / branch / PR
GitHub main：保存完整來源
    ↓ Actions 讀取單一發布清單
Pages artifact：只含靜態網站檔案
    ↓
原 GitHub Pages site 與 URL
```

不採用以下方案：

- 維持 legacy `main /` 並讓 `main` 繼續只保存部署快照：無法讓 GitHub clone 取得完整專案，部署後仍會分岔。
- 把完整 repo 直接交給 legacy Pages 發布：會把 Functions、Rules、測試與維護文件納入網站發布範圍。
- 建立第二個長期 source branch：增加雙 branch 同步責任，不符合單一真相來源目標。

## 檔案與責任邊界

### 單一發布清單

新增 `scripts/pages-files.json`，以 JSON array 保存目前 69 個正式發布相對路徑。第一階段必須逐項等同 `scripts/deploy-github-contents.ps1` 現有 `$Files`，不得趁切換流程新增、刪除或重新分類網站檔案。

所有 artifact builder、測試、workflow 與相容部署入口都只能讀這份 manifest，不得各自維護第二份 allowlist。

Manifest 規則：

- 只接受 repository root 的相對路徑。
- 禁止絕對路徑、`..`、空字串、重複項目與目錄項目。
- 每個項目都必須存在且是一般檔案。
- 必須包含 `index.html`、`admin.html`、`.nojekyll`、`VERSION`、四個核心 JS、正式資料與既有 smoke／資料工具。
- 禁止 `functions/`、`.git/`、`.github/`、`docs/`、`experiment/`、`.env`、log、service-account JSON、credential、token 或任何未追蹤檔案。

### Artifact builder

新增 `scripts/build-pages-artifact.js`：

- 讀取 `scripts/pages-files.json`。
- 接受明確 output directory 參數。
- output 必須位於 CI runner temporary directory 或本機系統 temporary directory，不得在專案內建立第二份專案或搬移原檔。
- 建立乾淨 output 後，依 manifest 保留相對路徑複製檔案。
- 拒絕 output 等於 repository root、位於任何來源檔內或無法證明安全的路徑。
- 複製後比對來源與 artifact 的 SHA-256。
- 輸出機器可讀摘要：manifest count、copied count、entry file、version、output path。

Artifact 是 CI／測試暫存產物，不加入 Git，也不作為新的工作位置。

### Artifact 與 workflow 測試

新增 `scripts/test-pages-artifact.js`，至少驗證：

- Manifest 恰好等同切換前 69 個 allowlist 項目。
- 路徑唯一、合法且檔案存在。
- 必要檔案存在，禁止路徑不存在。
- Artifact 只含 manifest 檔案，數量與內容 hash 完全一致。
- `index.html` 位於 artifact 頂層。
- `VERSION`、`APP_VERSION_FALLBACK` 與四個核心 JS query 一致。
- `functions/index.js`、`firestore.rules`、`AGENTS.md`、`firebase-debug.log` 不在 artifact。
- 任一非法路徑、缺檔、重複項目、hash 不符或額外檔案都使測試 exit 1。

新增 workflow contract 檢查，確認 Pages workflow 的 trigger、permissions、artifact path、deploy condition 與 action 版本均符合本設計，且原部署腳本不再包含 Git Data API write endpoints。

### GitHub Pages workflow

新增 `.github/workflows/deploy-pages.yml`，責任如下：

- `pull_request`：checkout、執行 manifest／artifact 測試、建立 artifact；不得執行 Pages deploy。
- `push` 到 `main`：完整 build，然後部署 Pages artifact。
- `workflow_dispatch`：接受可選 `reason` 供日誌記錄；build 與 deploy job 都必須以 `github.ref == 'refs/heads/main'` 阻擋其他 ref 的手動發布。
- `workflow_run`：當 `Update external social signals` 成功完成時，checkout 最新 `main` 並重新部署，補足 `GITHUB_TOKEN` 所建立 commit 不會再觸發一般 workflow 的限制。

Build job：

- `contents: read`。
- checkout source commit。
- 使用 Node.js 22。
- 執行 `scripts/test-pages-artifact.js`。
- 把 artifact 建到 runner temporary directory。
- 使用 GitHub Pages configure 與 upload artifact actions。

Deploy job：

- PR 時永遠不執行。
- 只有 `main` push、`refs/heads/main` 的合法 manual dispatch 或成功的指定 `workflow_run` 可執行。
- `permissions` 僅包含 `contents: read`、`pages: write`、`id-token: write`。
- `environment` 固定為 `github-pages`，URL 使用 deployment step output。
- 使用 GitHub 官方 `actions/deploy-pages` 發布既有 Pages site。

實作前必須再以 GitHub 官方文件確認 action major versions。設計時官方範例為 `actions/checkout@v6`、`actions/configure-pages@v5`、`actions/upload-pages-artifact@v4`、`actions/deploy-pages@v4`。

官方參考：

- `https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site`
- `https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`

### 原部署腳本相容入口

保留 `scripts/deploy-github-contents.ps1`，不刪除或改名。其正常行為改為：

1. 驗證 `gh` 登入、owner、repo、branch 與 default branch。
2. 要求目標只能是既有 `green-tea-king/nearby-good-eats` 的 `main`。
3. 驗證遠端 `main` 版本與本機版本，不直接建立 commit。
4. 以 `gh workflow run deploy-pages.yml --ref main` 觸發 manual workflow，將既有 `Message` 值傳入 `reason`。
5. 找到對應 workflow run、等待完成、回報 run URL、source SHA、Pages URL 與結果。

腳本不得再呼叫 Git Data API 的 blob、tree、commit 或 ref write endpoints，不得直接修改遠端 `main`，也不得保留隱藏或預設啟用的 legacy write 模式。

## Git 歷史安全收斂

目前本機 branch 必須先包含遠端 deployment commit，才能推送可稽核的完整來源 PR。這是一般 merge，不是內容覆蓋。

在取得使用者明確 merge 同意後：

1. `git fetch --prune origin`，重新確認 `origin/main` 仍是預期 commit。
2. 以唯讀 merge 預檢確認沒有不可解衝突。
3. 執行 `git merge --no-ff --no-commit origin/main`，停在提交前。
4. 必須確認：
   - `git diff --name-only --diff-filter=U` 為空。
   - staged deletion 為空。
   - 已知 21 個本機檔案仍存在且仍被 Git 追蹤。
   - `functions/package.json` 仍是 Node.js 22。
   - `VERSION` 與正式站關鍵內容不倒退。
   - `firebase-debug.log` 仍未追蹤。
5. 任一條件失敗，立即中止 merge，不建立 commit。
6. 全部通過才建立只負責接起歷史的 merge commit；此 merge 不改產品功能，因此不另升版。

這一步不 push、不建立 PR、不修改 Pages 設定。Recovery branch `codex/workspace-recovery-20260716` 與 commit `0670033` 保持不動。

## 公開來源與 Secret 安全

Repository 是 public。完整來源進入 `main` 前必須檢查目前 tree 與 `origin/main..HEAD` 的全部 patch，至少涵蓋：

- Google／Firebase／GitHub API key 格式。
- OAuth token、PAT、service-account private key。
- `.env`、credential、Secret Manager value、App Check secret。
- `firebase-debug.log`、本機 cache、暫存 JSON、CLI 登入資料。

只有 Secret 名稱、公開 Firebase Web config、公開 App Check site key 與受 referrer／API 限制的 browser key可依既有規則留在 source。任何疑似 secret 都先停止 push，確認或輪替後再繼續。

## Pages 切換順序

所有程式與本機測試完成後，外部寫入仍分為獨立確認點：

1. **Push／PR 確認**：取得同意才 push 目前工作 branch 並建立 PR。PR 只 build／驗證，不部署。
2. **PR review**：確認完整來源增加／更新，不含未授權刪除；確認 secret scan、artifact、完整測試通過。
3. **Cutover 確認**：取得同意後才進入 Pages 切換窗口。
4. 記錄切換前 Pages API 設定、live version、正式 URL、`origin/main` SHA 與最後成功 workflow run。
5. 把 Pages Source 從 legacy `main /` 改為 GitHub Actions。
6. 立即 merge 已通過 review 的 PR；不得 force merge、rebase 或改寫歷史。
7. `main` push 觸發 Pages workflow，監看 build 與 deploy。
8. workflow 成功後執行 live smoke 與瀏覽器人工驗收。

切換 source 與 merge 是兩個外部變更，執行前都必須有明確使用者同意。切換窗口可能有短暫服務風險，必須持續監看，不可在 workflow 未完成時宣稱成功。

## 回復設計

### Merge 前失敗

若 Pages Source 已切到 Actions，但 PR 尚未 merge或 workflow 無法啟動：

- 把 Pages Source 改回已記錄的 legacy `main /`。
- 確認 `fe2c6cc` 對應網站重新 built／available。
- 執行 `smoke-live-site.ps1 -ExpectedVersion 2026.07.17.2`。

### Merge 後 workflow 失敗

若完整來源已進 `main`，但 Actions artifact 無法部署：

- 暫時把 Pages Source 改回 legacy `main /`，以 `main` 根目錄的已驗證靜態檔案恢復服務。
- 立即執行 live smoke。
- 這只作緊急備援，因完整 repo 內容會同時位於 legacy Pages 發布範圍；修正 workflow 後必須重新切回 Actions。

### 已部署內容錯誤

- 以一般 revert commit 或新的修正 commit恢復最後已驗證內容。
- 由 Actions 重新發布，不 force push、不 hard reset、不刪除歷史。
- 回復後仍要驗證版本、asset query、登入、搜尋、分享、照片與後台。

任何回復都不刪除 branch、Pages site、Firebase project、Functions、Firestore collection、檔案或資料。

## 版本與文件同步

這是正式部署流程變更，實作 release 固定為 `2026.07.17.3`，同步更新：

- `VERSION`
- `index.html` 的 `APP_VERSION_FALLBACK`
- `index.html` 四個核心 JS query
- `design.md` 文件版本、目前正式版本與部署流程
- `AGENTS.md` 的正式部署前後檢查與 Git 流程

`project-rules.md` 只有在產品契約需要變更時才修改；本次不改搜尋、資料、API、UI 或成本規則。

## 驗證矩陣

### 本機與 PR

- `node scripts/test-pages-artifact.js`
- `node scripts/test-search-logic.js`
- `node scripts/test-auth-logic.js`
- `node scripts/test-core-awards-enrichment.js`
- `node scripts/test-static-asset-versions.js`
- `node scripts/scan-ui-text.js`
- `node scripts/validate-awards-data.js`
- `node scripts/validate-external-signals.js`
- `node scripts/validate-external-source-coverage.js`
- Functions：key、summary、field mask、AI classifier tests。
- `npm audit --omit=dev`，如實記錄風險，不執行破壞性 `--force`。
- JavaScript、PowerShell 與 workflow syntax／contract checks。
- `git diff --check`。
- current tree 與本機獨有 commits secret scan。

### 正式站

- Pages API 顯示 `build_type: workflow`。
- Workflow source SHA 等於核准的 `main` commit。
- Workflow build、upload、deploy jobs 全部 success。
- 正式 URL 不變且版本為 `2026.07.17.3`。
- `scripts/smoke-live-site.ps1 -ExpectedVersion 2026.07.17.3` 通過。
- `/functions/index.js`、`/firestore.rules`、`/AGENTS.md`、`/firebase-debug.log` 無法由 Pages artifact取得。
- Chrome 人工驗收：首次進站無搜尋、Google 登入、按套用才搜尋、3 家、下一組不重複、分享、詳情照片、後台統計。
- Firebase Functions 與 Firestore Rules 不因 Pages migration 重新部署。

### Git

- GitHub `main` clone 可取得完整 project。
- `functions/`、Rules、測試、規範與部署工具都是核准版本。
- 本機歷史包含 `fe2c6cc`，沒有刪除已知本機檔案。
- `main` 不再由 Git Data API deployment script直接改寫。
- 每次 Pages deployment 都能追到 source commit、workflow run 與 live version。

## 永久維護流程

完成 migration 後固定流程為：

```text
讀 AGENTS / project-rules / design
→ fetch origin
→ 建工作 branch
→ 修改與測試
→ 更新 VERSION 與版本來源
→ push branch
→ PR build / review
→ merge main
→ Actions 自動發布 Pages artifact
→ live smoke 與人工驗收
```

`Update external social signals` workflow 仍可更新 `main` 的正式資料；Pages workflow透過 `workflow_run` 在其成功完成後重新發布最新 `main`。所有維護者開始工作前仍必須 fetch 遠端，不可假設本機 branch 是最新來源。

## 完成條件

- `main` 是完整原始碼真相來源。
- Pages 由 Actions artifact發布，同一 repository、site 與 URL。
- Artifact 初次切換與既有 69-file allowlist 等價。
- 正式站為 `2026.07.17.3`，smoke 與人工關鍵流程通過。
- 遠端 Functions source 是 Node.js 22，並包含 helper、tests、Rules 與規範。
- 原部署腳本不再有 Git Data API write path。
- 零檔案刪除、零資料刪除、零 history rewrite、零 force push。
- `firebase-debug.log` 保持未追蹤且不進 artifact／Git。
- 任何未完成的登入／手機人工驗收、audit 風險或切換限制都明確回報。
