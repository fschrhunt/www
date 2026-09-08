import test from "node:test";
import assert from "node:assert/strict";
import { parseContactName, suggestContactEmail, tidyContactEmail } from "../src/lib/contact-rules.ts";

test("email cleanup preserves mailbox identity while fixing separator spacing", () => {
  assert.equal(tidyContactEmail("  Fischer @ GMAIL.COM  "), "Fischer@gmail.com");
  assert.equal(tidyContactEmail("first last@gmial.com"), "first last@gmial.com");
  assert.equal(tidyContactEmail("alex+work@example.com"), "alex+work@example.com");
});


test("domain suggestions correct known typos without guessing mailbox or custom domains", () => {
  assert.equal(suggestContactEmail("Alex+work@GMIAL.COM"), "Alex+work@gmail.com");
  assert.equal(suggestContactEmail("alex@outlok.com"), "alex@outlook.com");
  assert.equal(suggestContactEmail("alex@gmail.ocm"), "alex@gmail.com");
  for (const email of ["alex@gmail.com", "alex@company.com", "alex@gmail.co", "hello buddy", "a b@gmial.com"]) assert.equal(suggestContactEmail(email), undefined);
});


test("provider suggestions handle single edits and swaps without correcting real suffixes or custom domains", () => {
  for (const typo of ["gmaill", "gmaol", "gmal", "gmial", "gamil"]) assert.equal(suggestContactEmail(`Alex+tag@${typo}.com`), "Alex+tag@gmail.com");
  assert.equal(suggestContactEmail("alex@protonmial.com"), "alex@protonmail.com");
  for (const domain of ["gmail.co", "gmail.net", "yahoo.co.uk", "my.gmail.com", "example.com", "gmaoll.com", "mail.com", "xn--gmail-test.com"]) assert.equal(suggestContactEmail(`alex@${domain}`), undefined, domain);
});


test("explicit introductions preserve the complete name and chosen case", () => {
  for (const [input, name] of [
    ["The names fischer", "fischer"],
    ["the name’s fischer", "fischer"],
    ["Hi, my name is Mary Jane", "Mary Jane"],
    ["my name's Jean-Luc", "Jean-Luc"],
    ["call me O’Neill", "O’Neill"],
    ["you can call me 李", "李"],
  ]) assert.equal(parseContactName(input), name, input);
});

test("bare names retain script, punctuation, spacing, numbers, and single letters", () => {
  for (const name of ["fischer", "李", "محمد", "Q", "O’Neill", "Jean-Luc", "Mary  Jane", "J. R. Smith", "de la Cruz", "Blue Moon", "123", "Hiếu", "e\u0301"])
    assert.equal(parseContactName(`  ${name}  `), name, name);
});

test("conversation and unfinished introductions ask for clarification without guessing a name", () => {
  for (const input of ["", "hello", "how are you?", "I'm looking for Fischer", "I want to contact Fischer", "my name is", "call me", "my name is Alex and I need help", "alex@example.com", "https://example.com", "Alex\nplease help"])
    assert.equal(parseContactName(input), null, input);
});
