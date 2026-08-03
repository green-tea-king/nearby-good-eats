const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { assertFunctionsSecurityContract } = require("./functions-security-contract.js");

const lock = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "functions", "package-lock.json"), "utf8"));
assert.doesNotThrow(() => assertFunctionsSecurityContract(lock));

const outdated = structuredClone(lock);
outdated.packages["node_modules/firebase-functions"].version = "7.3.0";
assert.throws(() => assertFunctionsSecurityContract(outdated), /firebase-functions/);

console.log("functions security contract tests passed");
