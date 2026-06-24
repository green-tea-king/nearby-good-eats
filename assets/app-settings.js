// Non-secret runtime settings. This static Pages build uses a browser Google Maps key.
// Keep it HTTP-referrer restricted in Google Cloud; move back to apiBaseUrl proxy later if abuse appears.
window.APP_SETTINGS = {
  apiBaseUrl: "",
  googleMapsApiKey: "AIzaSyDjO79KBBzCxFx_Xc2aK4umJULdQCefPDY",
  // Fill after registering the Web app in Firebase App Check. Empty keeps App Check optional on the proxy.
  appCheckSiteKey: "",
  appCheckDebugToken: false,
  awardsUrl: "assets/awards-taiwan.json",
  certificationBadgesUrl: "assets/certification-badges.json",
  villagesUrl: "assets/taiwan-villages.json",
};
