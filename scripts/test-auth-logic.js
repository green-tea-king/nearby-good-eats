const assert = require("node:assert/strict");
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

  console.log("auth logic tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
