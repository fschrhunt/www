import test from "node:test";
import assert from "node:assert/strict";
import { suggestContactSubject } from "../src/lib/contact-subject.ts";

test("suggests a subject from the topic and product", () => {
  assert.equal(suggestContactSubject("Hey Fischer, Flip crashes when I switch windows."), "Flip: bug report");
  assert.equal(suggestContactSubject("I have a question about Diffuse."), "Diffuse: a question");
});

test("unknown topics use a bounded first line without changing the message", () => {
  assert.equal(suggestContactSubject("A small thank-you. The rest of my note."), "A small thank-you");
  assert.ok(suggestContactSubject("A long message ".repeat(30)).length <= 72);
  assert.equal(suggestContactSubject(""), "A note for Fischer");
});
