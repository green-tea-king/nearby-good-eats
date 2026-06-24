// Firebase/Auth/Admin 設定。
// B 模式：任何 Google 帳戶可登入使用；只有 adminEmails 可進入後台。
// 已啟用 Google 登入門檻；請填入 Firebase web app config 才能讓使用者登入。
window.APP_FIREBASE_CONFIG = {
  requireSignIn: true,
  logUsage: true,
  adminEmails: [
    "rh.taipei@gmail.com",
  ],
  firebase: {
    apiKey: "AIzaSyAHbI6-BXMvchcZaXw1x1ZTbvT0D5F47f4",
    authDomain: "nearby-good-eats.firebaseapp.com",
    projectId: "nearby-good-eats",
    storageBucket: "nearby-good-eats.firebasestorage.app",
    messagingSenderId: "558275102407",
    appId: "1:558275102407:web:55ee8cfad859bc8561e0e2",
    measurementId: "G-GM94G0GBEY",
  },
};
