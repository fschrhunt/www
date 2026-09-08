import assert from "node:assert/strict";
import test from "node:test";
import { parseContent } from "../src/lib/content.ts";

const metadata = '---\ntitle: "A note"\ndate: "2026-09-07"\n---\n\n';

test("reading time counts prose rather than component attributes and link destinations", () => {
  const source = metadata + 'import { Album } from "./album";\n\n' +
    `<Album label="${"ignored ".repeat(300)}" />\n\n` +
    "word ".repeat(199) + "[last](https://example.com/a/long/address)";
  assert.equal(parseContent("a-note.mdx", source).readingTime, "1 min read");
  assert.equal(parseContent("a-note.md", metadata + "word ".repeat(201)).readingTime, "2 min read");
});

test("invalid calendar dates fail with an actionable filename", () => {
  assert.throws(() => parseContent("a-note.md", metadata.replace("2026-09-07", "2026-02-30")),
    /a-note.md: date must be a valid YYYY-MM-DD date/);
});

test("missing title fails instead of publishing an unnamed note", () => {
  assert.throws(() => parseContent("a-note.md", metadata.replace('title: "A note"\n', "")),
    /a-note.md: title must be a nonempty quoted string/);
});

test("an optional index label is read as a string and rejects non-strings", () => {
  assert.equal(parseContent("a-note.md", metadata.replace('date: "2026-09-07"\n', 'date: "2026-09-07"\nindexLabel: "a note"\n')).indexLabel, "a note");
  assert.throws(() => parseContent("a-note.md", metadata.replace('date: "2026-09-07"\n', 'date: "2026-09-07"\nindexLabel: 5\n')),
    /a-note.md: indexLabel must be a string/);
});
