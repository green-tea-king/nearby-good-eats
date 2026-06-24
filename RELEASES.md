# Release Workflow

每一版更新完成後都要做兩件事：

1. 更新 `VERSION`，採用 `YYYY.MM.DD.N` 格式。
2. 執行 `scripts/export-release.ps1`，把當前版本輸出到桌面。

桌面輸出位置：

```text
%USERPROFILE%\Desktop\nearby-good-eats-releases\nearby-good-eats-v<VERSION>
%USERPROFILE%\Desktop\nearby-good-eats-releases\nearby-good-eats-v<VERSION>.zip
```

輸出內容包含：

- `index.html`
- `admin.html`
- `awards-taipei.json`
- `firebase-config.js`
- `firebase.json`
- `firestore.rules`
- `functions/`（不含 node_modules）
- `assets/`
- `VERSION`
- `release-manifest.json`
