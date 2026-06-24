// Firebase/Auth/Admin 設定。
// B 模式：任何 Google 帳戶可登入使用；只有 adminEmails 可進入後台。
// 填入 Firebase web app config 後，將 requireSignIn 改為 true 才會啟用登入門檻。
window.APP_FIREBASE_CONFIG = {
  requireSignIn: false,
  logUsage: true,
  adminEmails: [
    // "your-admin@gmail.com"
  ],
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
  },
};
