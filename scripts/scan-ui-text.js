const fs = require("fs");
const path = require("path");

const target = path.resolve(__dirname, "..", "index.html");
const text = fs.readFileSync(target, "utf8");
const lines = text.split(/\r?\n/);

const findings = [];
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (/\?{3,}/.test(line)) {
    findings.push({ line: i + 1, reason: "question-run", text: line.trim() });
  }
  if (/[\uFFFD]/.test(line)) {
    findings.push({ line: i + 1, reason: "replacement-char", text: line.trim() });
  }
}

const result = {
  file: target,
  total: findings.length,
  findings,
};

if (findings.length) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
