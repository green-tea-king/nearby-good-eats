// Non-secret runtime settings. Places, Routes and photo requests use the protected Functions proxy.
// The browser key remains only for loading the interactive Google map and is referrer restricted.
window.APP_SETTINGS = {
  apiBaseUrl: "https://us-central1-nearby-good-eats.cloudfunctions.net/api",
  aiEnabled: true,
  aiDisabledReason: "",
  googleMapsApiKey: "AIzaSyBtViT280p8qtdm4PT2QUnMypdMssTV1-k",
  apiLimits: {
    externalTestMode: false,
    dailySearchLimit: 30,
    note: "每位一般使用者每日最多送出 30 次搜尋；管理員不受此限制。",
  },
  appCheckSiteKey: "6LeQC1MtAAAAADFUT00yrOctfkmj_VGUJKX-Pu_4",
  appCheckDebugToken: false,
  awardsUrl: "assets/awards-taiwan.json",
  externalSignalsUrl: "assets/external-signals.json",
  certificationBadgesUrl: "assets/certification-badges.json",
  villagesUrl: "assets/taiwan-villages.json",
};
