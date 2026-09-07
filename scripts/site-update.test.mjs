/** Protect the merge gate, including multiple updates on the same calendar day. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSiteUpdate } from "./site-update.mjs";

const previous = { updatedAt: "2026-09-07T10:00:00.000Z" };
const current = { updatedAt: "2026-09-07T11:00:00.000Z" };
const now = Date.parse("2026-09-07T12:00:00.000Z");

test("website, assets, and dependency changes cannot keep the old timestamp", () => {
  for (const file of ["src/app/page.tsx", "public/portrait.png", "package-lock.json", "next.config.ts", "tsconfig.json"]) {
    assert.throws(() => checkSiteUpdate([file], previous, previous, now), /newer update timestamp/);
  }
});

test("a later timestamp works on the same day, including the first update record", () => {
  assert.doesNotThrow(() => checkSiteUpdate(["src/app/page.tsx"], previous, current, now));
  assert.doesNotThrow(() => checkSiteUpdate(["src/app/page.tsx"], null, current, now));
});

test("invalid, older, and future timestamps cannot pass", () => {
  for (const updatedAt of ["yesterday", "2026-09-07", "2026-09-07T09:00:00.000Z", "2026-09-08T11:00:00.000Z"]) {
    assert.throws(() => checkSiteUpdate(["src/app/page.tsx"], previous, { updatedAt }, now));
  }
});

test("documentation-only changes do not require a date bump", () => {
  assert.doesNotThrow(() => checkSiteUpdate(["README", "docs/architecture.md", ".agents/site.md"], previous, previous, now));
});
