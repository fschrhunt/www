import test from "node:test";
import assert from "node:assert/strict";
import { humanChallenge, isContactEmail, isHumanAnswer, tidyContactEmail } from "../src/lib/contact-rules.ts";

test("email cleanup preserves mailbox identity while fixing separator spacing", () => {
  assert.equal(tidyContactEmail("  Fischer @ GMAIL.COM  "), "Fischer@gmail.com");
  assert.equal(tidyContactEmail("first last@gmial.com"), "first last@gmial.com");
  assert.equal(tidyContactEmail("alex+work@example.com"), "alex+work@example.com");
});

test("email shape check accepts a dotted address and rejects the obviously unfinished", () => {
  for (const good of ["alex@example.com", "a.b+tag@sub.example.co.uk", "李@例え.com"]) assert.equal(isContactEmail(good), true, good);
  for (const bad of ["", "alex", "alex@", "alex@example", "alex example.com", "alex@exa mple.com"]) assert.equal(isContactEmail(bad), false, bad);
});

test("the human challenge is a solvable sum with a matching answer", () => {
  for (let i = 0; i < 50; i++) {
    const { question, answer } = humanChallenge();
    const [a, b] = question.split(" plus ").map(Number);
    assert.match(question, /^\d+ plus \d+$/);
    assert.equal(answer, a + b);
    assert.ok(answer >= 4 && answer <= 12);
  }
});

test("the human answer accepts digits or words and rejects the wrong number", () => {
  for (const yes of ["7", "seven", "it's 7!", "the answer is seven", " Seven "]) assert.equal(isHumanAnswer(yes, 7), true, yes);
  for (const no of ["8", "eight", "77", "17", "", "seventy"]) assert.equal(isHumanAnswer(no, 7), false, no);
});
