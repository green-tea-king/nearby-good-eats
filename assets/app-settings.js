// Non-secret runtime settings. Keep API secrets on a backend/proxy; this file is public.
window.APP_SETTINGS = {
  // Fill apiBaseUrl after Firebase project is upgraded to Blaze and Functions are deployed.
  apiBaseUrl: "",
  // Temporary fallback for the static GitHub Pages app. Restrict this key by HTTP referrer and API scope.
  googleMapsApiKey: "AIzaSyDjO79KBBzCxFx_Xc2aK4umJULdQCefPDY",
  awardsUrl: "assets/awards-taiwan.json",
  certificationBadgesUrl: "assets/certification-badges.json",
  villagesUrl: "assets/taiwan-villages.json",
};
