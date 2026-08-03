const minimumVersions = {
  "node_modules/firebase-functions": "7.3.2",
  "node_modules/@google-cloud/firestore": "8.7.0",
  "node_modules/google-gax": "5.0.8",
  "node_modules/brace-expansion": "2.1.4"
};

function compareVersions(actual, minimum) {
  const toParts = (value) => String(value).split(".").map((part) => Number(part.replace(/\D.*$/, "")) || 0);
  const a = toParts(actual);
  const b = toParts(minimum);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function assertFunctionsSecurityContract(lock) {
  for (const [packagePath, minimum] of Object.entries(minimumVersions)) {
    const actual = lock?.packages?.[packagePath]?.version;
    if (!actual || compareVersions(actual, minimum) < 0) {
      throw new Error(`${packagePath.replace("node_modules/", "")} must be at least ${minimum}; actual=${actual || "missing"}`);
    }
  }
}

module.exports = { assertFunctionsSecurityContract };
