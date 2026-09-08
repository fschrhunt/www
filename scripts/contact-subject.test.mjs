import test from "node:test";
import assert from "node:assert/strict";
import { suggestContactSubject } from "../src/lib/contact-subject.ts";

test("subjects identify the topic and product without repeating the opening sentence", () => {
  assert.equal(suggestContactSubject("Hey Fischer, Flip crashes when I switch windows."), "Bug report for Flip");
  assert.equal(suggestContactSubject("I have a question about Diffuse."), "A question about Diffuse");
  assert.equal(suggestContactSubject("Could you add another theme for 𝑒?"), "Feature idea for 𝑒");
  assert.equal(suggestContactSubject("Your contact form doesn’t work on my phone."), "A website bug report");
});

test("collaboration requests are not mistaken for feature suggestions", () => {
  assert.equal(suggestContactSubject("I would love to work together on a project."), "A potential collaboration");
});

test("personal and unfamiliar topics get a short fallback instead of a copied sentence", () => {
  assert.equal(suggestContactSubject("I wanted to tell you about something that happened to me yesterday. ".repeat(10)), "A note for Fischer");
  assert.equal(suggestContactSubject(""), "A note for Fischer");
  assert.equal(suggestContactSubject("A small thank-you. The rest of my note."), "A note of thanks");
  assert.equal(suggestContactSubject("Reach me at flip@example.com or https://example.com/bug."), "A note for Fischer");
});

test("generated subjects stay between three and five words across supported topics", () => {
  for (const topic of ["a bug", "a suggestion", "a question", "feedback", "thanks", "a story"]) {
    for (const context of ["", " about Flip", " about the website"]) {
      const subject = suggestContactSubject(topic + context);
      const words = subject.split(/\s+/).length;
      assert.ok(words >= 3 && words <= 5, subject);
    }
  }
});


test("subjects use the product in the request rather than the first product mentioned", () => {
  assert.equal(suggestContactSubject("I love Flip. Diffuse crashes on launch."), "Bug report for Diffuse");
  assert.equal(suggestContactSubject("I use Flip. Your contact form is broken."), "A website bug report");
  assert.equal(suggestContactSubject("Flip and Diffuse both crash."), "A software bug report");
});

test("explicit requests outrank greetings, thanks, and incidental questions", () => {
  assert.equal(suggestContactSubject("How are you? Could you add keyboard shortcuts to Flip? Thanks!"), "Feature idea for Flip");
  assert.equal(suggestContactSubject("Thanks for Flip. We are hiring and would like you to join our team."), "A potential job opportunity");
  assert.equal(suggestContactSubject("This is not a bug report. Could you add themes to Diffuse?"), "Feature idea for Diffuse");
  assert.equal(suggestContactSubject("Flip is not broken. I have some feedback."), "Some feedback on Flip");
});
