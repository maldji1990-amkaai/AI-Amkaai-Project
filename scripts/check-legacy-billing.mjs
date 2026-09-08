import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbidden = [
  /fetch\(["']\/api\/upgrade["']/,
  /fetch\(["']\/api\/abandoned["']/,
];
const roots = ["app", "components", "lib"];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(full);
  }
}
roots.forEach(r => walk(path.join(root, r)));
const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const re of forbidden) if (re.test(text)) violations.push(`${file}: ${re}`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Legacy billing reference check passed (${files.length} source files scanned).`);
