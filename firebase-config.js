// Firebase/Auth/Admin 設定。
// B 模式：任何 Google 帳戶可登入使用；只有 adminEmails 可進入後台。
// 已啟用 Google 登入門檻；請填入 Firebase web app config 才能讓使用者登入。
window.APP_FIREBASE_CONFIG = {
  requireSignIn: true,
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
