"use client";

import localFont from "next/font/local";
import { ContactReview } from "./contact-review";
import { suggestContactSubject } from "@/lib/contact-subject";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { suggestContactEmail, tidyContactEmail, readContactName, contactAside, correctedName, replyToAside, type ChatMemory, type ContactStep as Step } from "@/lib/contact-rules";
const handwriting = localFont({ src: "../app/fonts/benji-script.woff", variable: "--font-contact-annotation", display: "swap" });

type Message = { from: "fischer" | "visitor"; text: string };
const welcome: Message = { from: "fischer", text: "hey, glad you’re here :)" };
const introduction: Message[] = [
  { from: "fischer", text: "let’s put together a little note." },
  { from: "fischer", text: "first, what should I call you?" },
];

/** A guided contact conversation with a reviewed draft sent through the server. */
export function ContactConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(true);
  const [typing, setTyping] = useState(true);
  const [error, setError] = useState("");
  const [questionedName, setQuestionedName] = useState("");
  const [questionedEmail, setQuestionedEmail] = useState("");
  const [suggestedEmail, setSuggestedEmail] = useState("");
  const [asideMessage, setAsideMessage] = useState("");
  const memory = useRef<ChatMemory>({});
  const keptEmailDomains = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);
  const replyGeneration = useRef(0);
  const busyRef = useRef(true);
  const pendingReplies = useRef<{ replies: Message[]; next: Step } | null>({
    replies: [welcome, ...introduction], next: "name",
  });
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  /** Deliver one cancellable reply sequence, recording unsent bubbles for effect restarts. */
  const queueReplies = useCallback((replies: Message[], next: Step, firstDelay = 650) => {
    window.clearTimeout(timer.current);
    const generation = ++replyGeneration.current;
    pendingReplies.current = { replies, next };
    busyRef.current = true;
    setBusy(true);
    setTyping(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function deliver(index: number) {
      timer.current = window.setTimeout(() => {
        if (generation !== replyGeneration.current) return;
        pendingReplies.current = index + 1 < replies.length ? { replies: replies.slice(index + 1), next } : null;
        setMessages(current => [...current, replies[index]]);
        setTyping(false);
        if (index === replies.length - 1) {
          setStep(next);
          busyRef.current = false;
          setBusy(false);
          return;
        }
        timer.current = window.setTimeout(() => {
          if (generation !== replyGeneration.current) return;
          setTyping(true);
          deliver(index + 1);
        }, reduced ? 0 : 350);
      }, reduced ? 0 : index === 0 ? firstDelay : 500 + replies[index].text.length * 8);
    }
    deliver(0);
  }, []);

  useEffect(() => {
    // Refresh may rerun effects while preserving the transcript; resume only unsent replies.
    const generationCounter = replyGeneration;
    const pending = pendingReplies.current;
    if (pending) queueReplies(pending.replies, pending.next, 900);
    return () => {
      window.clearTimeout(timer.current);
      generationCounter.current++;
    };
  }, [queueReplies]);

  useEffect(() => {
    const container = thread.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    if (!busy && step !== "review" && window.matchMedia("(min-width: 640px)").matches) {
      (step === "message" ? textarea.current : input.current)?.focus();
    }
  }, [messages, busy, step, typing]);

  useEffect(() => {
    /** Focus the current reply field without stealing slash input or browser shortcuts. */
    function focusReply(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.defaultPrevented || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || busy || step === "review") return;
      const active = document.activeElement;
      if (active instanceof HTMLElement &&
        (active.matches("input, textarea, select") || active.isContentEditable)) return;
      const field = step === "message" ? textarea.current : input.current;
      if (!field || field.disabled) return;
      event.preventDefault();
      field.focus();
    }
    window.addEventListener("keydown", focusReply);
    return () => window.removeEventListener("keydown", focusReply);
  }, [busy, step]);

  /** Advance the form only after validating the current reply. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || step === "review") return;
    const answer = value.trim();
    if (!answer) {
      setError(step === "message" ? "Write a little something first." : "Pop your answer in below.");
      return;
    }
    if (/^(?:start over|restart|reset)[.!]?$/i.test(answer)) { startOver(); return; }
    busyRef.current = true;
    setError("");
    setAsideMessage("");
    setSuggestedEmail("");
    setMessages(current => [...current, { from: "visitor", text: answer }]);
    setValue("");
    setBusy(true);
    setTyping(true);
    if (/^(?:back|go back)[.!]?$/i.test(answer)) {
      goBack();
      return;
    }
    const correction = correctedName(answer);
    if (step !== "name" && correction) {
      const result = readContactName(correction);
      if (result.name !== undefined) {
        setName(result.name);
        queueReplies([{ from: "fischer", text: `got it, ${result.name}. name updated. everything else is still here.` }], step);
      } else {
        queueReplies([{ from: "fischer", text: "I didn't catch the new name. try 'call me Alex', with your name in place of Alex." }], step);
      }
      return;
    }
    const topic = contactAside(answer);
    if (topic) {
      const response = replyToAside(topic, memory.current, step);
      memory.current = response.memory;
      if (step === "name") setQuestionedName(answer);
      if (step === "email") setQuestionedEmail(answer);
      if (step === "message") setAsideMessage(answer);
      queueReplies([{ from: "fischer", text: response.text }], step);
      return;
    }
    let reply: string;
    let next: Step;
    if (step === "name") {
      const result = readContactName(answer);
      if (result.reply !== undefined) {
        setQuestionedName(answer);
        queueReplies([{ from: "fischer", text: result.reply }], "name");
        return;
      }
      setQuestionedName("");
      setName(result.name);
      reply = `nice to meet you, ${result.name}. what's a good email to reach you at?`;
      next = "email";
    } else if (step === "email") {
      const address = tidyContactEmail(answer);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        setQuestionedEmail(answer);
        queueReplies([{ from: "fischer", text: "that email looks a little unfinished. try something like you@example.com. preferably yours." }], "email");
        return;
      }
      const suggestion = suggestContactEmail(address);
      if (suggestion && !keptEmailDomains.current.has(address.split("@")[1])) {
        setQuestionedEmail(address);
        setSuggestedEmail(suggestion);
        queueReplies([{ from: "fischer", text: `did you mean ${suggestion}? that domain looks like it lost a small fight with the keyboard.` }], "email");
        return;
      }
      setQuestionedEmail("");
      setEmail(address);
      reply = "and what’s on your mind? take as much room as you need.";
      next = "message";
    } else {
      setNote(answer);
      setSubject(suggestContactSubject(answer));
      reply = "please look this over and edit anything you need before sending.";
      next = "review";
    }
    queueReplies([{ from: "fischer", text: reply }], next);
  }

  /** Revisit the previous answer, keeping the other draft fields intact. */
  function goBack() {
    const previous: Step = step === "review" ? "message" : step === "message" ? "email" : "name";
    setQuestionedName("");
    setQuestionedEmail("");
    setAsideMessage("");
    setSuggestedEmail("");
    setError("");
    setBusy(true);
    setTyping(true);
    setValue(previous === "name" ? name : previous === "email" ? email : note);
    queueReplies([{ from: "fischer", text: step === "name" ? "this is the beginning. very economical tour. what should I call you?" : `sure. let's revisit your ${previous}.` }], previous);
  }

  /** Preserve a message that happened to match one of the small-talk rules. */
  function useAsideAsMessage() {
    if (busyRef.current || !asideMessage) return;
    setNote(asideMessage);
    setSubject(suggestContactSubject(asideMessage));
    setAsideMessage("");
    setSuggestedEmail("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "please look this over and edit anything you need before sending." }], "review");
  }

  /** Let visitors overrule a name guess without repeating or defending their name. */
  function useQuestionedName() {
    if (busyRef.current || !questionedName || step !== "name") return;
    setName(questionedName);
    setQuestionedName("");
    setValue("");
    setError("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "fair enough. you know your name better than a form does. what's a good email to reach you at?" }], "email");
  }

  /** Apply a domain correction only after the visitor chooses it. */
  function useSuggestedEmail() {
    if (busyRef.current || step !== "email" || !suggestedEmail) return;
    setEmail(suggestedEmail);
    setMessages(current => [...current, { from: "visitor", text: `Use ${suggestedEmail}` }]);
    setSuggestedEmail("");
    setQuestionedEmail("");
    setValue("");
    setError("");
    queueReplies([{ from: "fischer", text: "fixed. what's on your mind?" }], "message");
  }

  /** Use the visitor's chosen address verbatim in the draft after an explicit override. */
  function useQuestionedEmail() {
    if (busyRef.current || !questionedEmail || step !== "email") return;
    if (suggestedEmail) keptEmailDomains.current.add(questionedEmail.split("@")[1]);
    setEmail(questionedEmail);
    setSuggestedEmail("");
    setQuestionedEmail("");
    setValue("");
    setError("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "alright, I'll use it as written. what's on your mind?" }], "message");
  }

  /** Enter sends a message; Shift+Enter keeps a newline, including during IME composition. */
  function messageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      form.current?.requestSubmit();
    }
  }

  /** Clear the draft and replay the greeting with the same message pacing. */
  function startOver() {
    window.clearTimeout(timer.current);
    setMessages([]);
    setStep("name");
    setValue("");
    setName("");
    setEmail("");
    setNote("");
    setSubject("");
    setBusy(true);
    setTyping(true);
    setError("");
    setQuestionedName("");
    setQuestionedEmail("");
    setAsideMessage("");
    setSuggestedEmail("");
    memory.current = {};
    keptEmailDomains.current.clear();
    queueReplies([welcome, ...introduction], "name", 900);
  }

  const placeholder = step === "name" ? "your name" : step === "email" ? "your email" : "your message";

  const overrideAnswer = step === "name" ? questionedName : step === "email" ? questionedEmail : step === "message" ? asideMessage : "";
  const overrideIndex = !busy && overrideAnswer ? messages.findLastIndex(message => message.from === "visitor" && message.text === overrideAnswer) : -1;

  return <>
    <div className={`conversation-thread ${handwriting.variable}`} ref={thread} role="log" aria-label="Your contact note" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`message-row message-${message.from}`} data-override={index === overrideIndex}>
        <div className="message-bubble"><span className="sr-only">{message.from === "visitor" ? "You: " : "Fischer’s contact form: "}</span>{message.text}</div>
        {index === overrideIndex && !suggestedEmail && <button
        className="contact-override" type="button"
        onClick={step === "name" ? useQuestionedName : step === "email" ? useQuestionedEmail : useAsideAsMessage}>
        <svg width="12" height="34" viewBox="0 0 12 34" fill="none" aria-hidden="true">
          <path pathLength="1" d="M10 2c-3 .5-5 .4-8 1 3 8-1 20 1 28 2 .7 4.5 .2 7 .4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>use that as my {step}</span>
      </button>}
      </div>)}
      {typing && <div className="typing-bubble" role="status" aria-label="Next question is coming"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>}
    </div>

    <div className={`conversation-bottom ${handwriting.variable}`}>
      {suggestedEmail && step === "email" && !busy && <div className="contact-suggestions contact-email-suggestions" aria-label="Email correction">
        <button type="button" onClick={useSuggestedEmail}>Use {suggestedEmail}</button>
        <button type="button" onClick={useQuestionedEmail}>Keep what I typed</button>
      </div>}
      {overrideIndex !== -1 && !suggestedEmail && <div className="contact-suggestions" aria-label="Suggested reply">
        <button type="button" onClick={step === "name" ? useQuestionedName : step === "email" ? useQuestionedEmail : useAsideAsMessage}>Use that as my {step}<span aria-hidden="true">↗</span></button>
      </div>}
      {step === "review" ? <ContactReview name={name} email={email} subject={subject} note={note}
        setName={setName} setEmail={setEmail} setSubject={setSubject} setNote={setNote}
        startOver={startOver} /> : <form ref={form} className="conversation-composer" onSubmit={submit} noValidate>
        {step === "message" ? <textarea ref={textarea} aria-label="Your message" spellCheck aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} placeholder={placeholder} value={value} maxLength={2000} rows={1} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} onKeyDown={messageKeyDown} /> :
          <input ref={input} aria-label={step === "name" ? "Your name" : "Your email"} aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} type="text" inputMode="text" autoComplete={step === "email" ? "email" : "given-name"} enterKeyHint="send" placeholder={placeholder} value={value} maxLength={step === "name" ? 80 : 254} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} />}
        <button className="reply-send" type="submit" aria-label="Send reply" disabled={busy || !value.trim()}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>}
      {error && <p className="reply-error" id="reply-error" role="alert">{error}</p>}
    </div>
  </>;
}
