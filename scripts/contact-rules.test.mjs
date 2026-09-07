import test from "node:test";
import assert from "node:assert/strict";
import { readContactName, contactAside, correctedName, replyToAside } from "../src/lib/contact-rules.ts";

test("messages, greetings and addresses invite another name reply", () => {
  for (const input of ["Hello, how are you doing", "hey!", "Are you an AI?", "https://example.com", "me@example.com", "Can you build a website?", "12345"]) {
    assert.equal(typeof readContactName(input).reply, "string", input);
  }
});

test("single names, international names and nicknames remain accepted", () => {
  for (const name of ["李明", "محمد", "José", "Anne-Marie", "O’Connor", "X Æ A-12", "J", "hunter42", "Mary Jane Watson", "Hiếu"]) {
    assert.equal(readContactName(name).name, name);
  }
});

test("conversational introductions extract the name without changing its spelling", () => {
  for (const input of ["my name is José", "I'm José", "call me José", "hey, my name is José"]) {
    assert.equal(readContactName(input).name, "José");
  }
});

test("everyday small talk gets a specific response before the generic question rule", () => {
  const generic = readContactName("Can you solve this?").reply;
  const day = readContactName("How's your day?").reply;
  assert.notEqual(day, generic);
  assert.equal(readContactName("How’s your day?").reply, day);
  assert.equal(readContactName("How was your day?").reply, day);
  const activities = readContactName("What did you do today?").reply;
  assert.notEqual(activities, generic);
  assert.notEqual(activities, day);
  assert.equal(readContactName("What have you been doing today?").reply, activities);
});


test("topic memory varies replies and does not repeat the pending prompt every turn", () => {
  const topic = contactAside("How's your day?");
  const first = replyToAside(topic, {}, "email");
  const second = replyToAside(topic, first.memory, "email");
  assert.notEqual(first.text, second.text);
  assert.match(first.text, /email/);
  assert.doesNotMatch(second.text, /email/);
  assert.equal(second.memory.day, 2);
  assert.equal(replyToAside(topic, {}, "name").memory.day, 1);
});

test("small talk works independently of the pending step and leaves real messages alone", () => {
  assert.equal(contactAside("Why do you need my email?").key, "email-purpose");
  assert.equal(contactAside("Hey, how are you doing?").key, "wellbeing");
  assert.equal(contactAside("How's your day? I wanted to discuss my project."), undefined);
  assert.equal(contactAside("I am building a site. What are you doing today?"), undefined);
});

test("explicit name corrections preserve the supplied name", () => {
  assert.equal(correctedName("Actually, call me Alex"), "Alex");
  assert.equal(correctedName("change my name to 李明"), "李明");
  assert.equal(correctedName("My project is called Alex"), undefined);
});
