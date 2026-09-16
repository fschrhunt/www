/**
 * Pull request previews: each PR gets its own Worker on workers.dev, built
 * from the PR's commit, and one comment that is edited in place rather than
 * reposted. Cloudflare does not issue preview URLs for Workers that define a
 * Durable Object, so a separate Worker per PR stands in for them.
 *
 * Previews get none of production's secrets or domains, so their contact
 * forms cannot send mail. They do get their own Durable Object storage.
 *
 *   node scripts/pr-preview.mjs deploy   after `npm run build`
 *   node scripts/pr-preview.mjs failed   when the build or deploy failed
 *   node scripts/pr-preview.mjs remove   when the pull request closes
 *
 * Environment: PREVIEW_WORKER (production Worker name), PREVIEW_LINKS (JSON
 * list of [label, path]), PR, SHA, RUN_URL, GITHUB_REPOSITORY, GITHUB_TOKEN,
 * CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SUBDOMAIN = "intuitum.workers.dev";
const MARKER = "<!-- pr-preview -->";
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const pr = env("PR");
const worker = `${env("PREVIEW_WORKER")}-pr-${pr}`;
const origin = `https://${worker}.${SUBDOMAIN}`;
const wrangler = (...args) =>
  execFileSync("npx", ["wrangler", ...args], { stdio: "inherit" });

/** Create or edit this PR's single preview comment. */
async function comment(body) {
  const api = `https://api.github.com/repos/${env("GITHUB_REPOSITORY")}`;
  const headers = {
    authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    accept: "application/vnd.github+json",
    "user-agent": "pr-preview",
  };
  const list = await fetch(`${api}/issues/${pr}/comments?per_page=100`, {
    headers,
  });
  if (!list.ok) throw new Error(`listing comments: ${list.status}`);
  const existing = (await list.json()).find((c) => c.body?.startsWith(MARKER));
  const url = existing
    ? `${api}/issues/comments/${existing.id}`
    : `${api}/issues/${pr}/comments`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify({ body: `${MARKER}\n${body}` }),
  });
  if (!response.ok) throw new Error(`writing comment: ${response.status}`);
}

const sha = () => env("SHA").slice(0, 7);
const commit = () =>
  `[\`${sha()}\`](https://github.com/${env("GITHUB_REPOSITORY")}/commit/${env("SHA")})`;
const when = () =>
  new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";

const command = process.argv[2];
if (command === "deploy") {
  // The build's Worker config, minus production's domains and the session store
  // Astro would otherwise provision anew for every preview Worker.
  const config = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
  delete config.routes;
  config.kv_namespaces = (config.kv_namespaces ?? []).filter((kv) => kv.id);
  if (config.previews) delete config.previews.kv_namespaces;
  config.name = worker;
  config.workers_dev = true;
  writeFileSync("dist/server/wrangler.preview.json", JSON.stringify(config));
  wrangler("deploy", "--config", "dist/server/wrangler.preview.json");
  const links = JSON.parse(env("PREVIEW_LINKS"))
    .map(
      ([label, path]) =>
        `| ${label} | [${worker}.${SUBDOMAIN}${path === "/" ? "" : path}](${origin}${path}) |`,
    )
    .join("\n");
  await comment(
    [
      `**Preview ready** for ${commit()}`,
      "",
      "| Page | Preview |",
      "| --- | --- |",
      links,
      "",
      `<sub>Updated ${when()} · [build log](${env("RUN_URL")}) · Contact forms don't send from previews. This preview is deleted when the pull request closes.</sub>`,
    ].join("\n"),
  );
} else if (command === "failed") {
  await comment(
    `**Preview failed** for ${commit()}. See the [build log](${env("RUN_URL")}).\n\n<sub>Updated ${when()}</sub>`,
  );
} else if (command === "remove") {
  try {
    wrangler("delete", "--name", worker, "--force");
  } catch {
    console.log(`${worker} was already gone`);
  }
  await comment(
    `**Preview removed.** The pull request closed, so \`${worker}\` was deleted.`,
  );
} else {
  throw new Error("usage: node scripts/pr-preview.mjs deploy|failed|remove");
}
