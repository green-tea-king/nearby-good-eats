const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
    /手機 Safari／Chrome 使用彈出式登入；LINE、Facebook、Instagram 等內建瀏覽器請改用 Safari／Chrome 一般分頁開啟。/,
    "登入卡片說明必須符合內建瀏覽器外開策略",
  );
  assert.doesNotMatch(
    html,
    /內建瀏覽器才改用跳轉登入/,
    "登入卡片不得宣稱內建瀏覽器會自動 redirect",
  );
  assert.match(
    html,
    /登入流程已等待 20 秒。若登入視窗已開啟，請繼續完成；若未開啟，請重新點選或改用 Safari／Chrome 一般分頁。/,
    "Popup 逾時必須提供可操作的繁體中文指引",
  );

  console.log("auth logic tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
