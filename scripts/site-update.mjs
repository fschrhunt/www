/** Stamp the public update date, or validate it against a PR's base commit. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const record = "src/site-updated.json";

/** Website changes require a valid, newer UTC timestamp; documentation alone does not. */
export function checkSiteUpdate(files, previous, current, now = Date.now()) {
  const websiteChanged = files.some(file => /^(src\/|public\/|next\.config\.|package(?:-lock)?\.json$|tsconfig\.json$)/.test(file));
  if (!websiteChanged) return;

  const timestamp = Date.parse(current?.updatedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== current.updatedAt) {
    throw new Error("Invalid site update timestamp. Run npm run site:stamp.");
  }
  if (timestamp > now + 60_000) throw new Error("The site update timestamp is in the future.");
  if (previous && !(timestamp > Date.parse(previous.updatedAt))) {
    throw new Error("Website changes need a newer update timestamp. Run npm run site:stamp and include src/site-updated.json.");
  }
}

if (process.argv[2] === "stamp") {
  writeFileSync(record, `${JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`Updated ${record}`);
}

if (process.argv[2] === "check") {
  const base = process.env.SITE_BASE_SHA || process.argv[3];
  if (!base) throw new Error("Provide the PR base commit: npm run site:check -- origin/main");
  execFileSync("git", ["rev-parse", "--verify", `${base}^{commit}`], { stdio: "pipe" });
  const files = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split("\n");
  const existed = execFileSync("git", ["ls-tree", "--name-only", base, "--", record], { encoding: "utf8" }).trim();
  const previous = existed ? JSON.parse(execFileSync("git", ["show", `${base}:${record}`], { encoding: "utf8" })) : null;
  const current = JSON.parse(readFileSync(record, "utf8"));
  checkSiteUpdate(files, previous, current);
  console.log("Site update timestamp is valid.");
}
