// Non-secret runtime settings. This static Pages build uses a browser Google Maps key.
// Keep it HTTP-referrer restricted in Google Cloud; move back to apiBaseUrl proxy later if abuse appears.
window.APP_SETTINGS = {
  apiBaseUrl: "",
  googleMapsApiKey: "AIzaSyBtViT280p8qtdm4PT2QUnMypdMssTV1-k",
  apiLimits: {
    externalTestMode: false,
    dailySearchLimit: 30,
    note: "每位一般使用者每日最多送出 30 次搜尋；管理員不受此限制。",
  },
  // Fill after registering the Web app in Firebase App Check. Empty keeps App Check optional on the proxy.
  appCheckSiteKey: "",
  appCheckDebugToken: false,
  awardsUrl: "assets/awards-taiwan.json",
  externalSignalsUrl: "assets/external-signals.json",
  certificationBadgesUrl: "assets/certification-badges.json",
  villagesUrl: "assets/taiwan-villages.json",
};
