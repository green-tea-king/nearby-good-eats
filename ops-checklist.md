# nearby-good-eats 止血與穩定檢查

## 部署前

1. `node scripts/scan-ui-text.js`
2. `git status --short`
3. 確認只提交產品檔案，例如 `index.html`、`VERSION`、必要 assets

## 部署後

1. `node scripts/smoke-check.js`
2. 確認 `VERSION` 與本機一致
3. 確認首頁至少包含：
   - `先選條件，再按右下角「套用」開始查詢 Google 真資料。`
   - `不滿意這組結果？快速再找一組`
4. 手機端看到舊畫面時，用 `?v=<VERSION>` 重新開啟

## 工作樹規則

- `tmp/`、`scripts/__pycache__/` 不進版控
- awards 批次產物與中間報表不進正式前端部署範圍
- 若要新增資料整理腳本，優先放 `scripts/`，並確認 `.gitignore` 是否需要一起更新
