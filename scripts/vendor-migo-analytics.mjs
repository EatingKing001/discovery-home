/**
 * Copy published @migo/analytics UMD into product/vendor for static Docker deploy.
 * Usage: npm install && npm run vendor:analytics
 */
import { copyFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "@migo", "analytics");
const pkgJsonPath = join(pkgDir, "package.json");
if (!existsSync(pkgJsonPath)) {
  console.error("Install first: npm install (@migo/analytics missing)");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
const src = join(pkgDir, "dist", "index.umd.js");
const destDir = join(root, "product", "vendor");
const dest = join(destDir, "migo-analytics.bundle.js");

if (!existsSync(src)) {
  console.error("Missing UMD build:", src);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Wrote", dest, `(${pkg.name}@${pkg.version})`);
