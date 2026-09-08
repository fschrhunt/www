"use client";

import { ContactReview } from "./contact-review";
import { suggestContactSubject } from "@/lib/contact-subject";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { parseContactName, suggestContactEmail, tidyContactEmail } from "@/lib/contact-rules";

type Step = "name" | "email" | "message" | "review";
type Message = { from: "fischer" | "visitor"; text: string };
const welcome: Message = { from: "fischer", text: "hey, glad you’re here :)" };
const introduction: Message[] = [
  { from: "fischer", text: "let’s put together a little note." },
  { from: "fischer", text: "first, enter your name below." },
];

/** Collect three explicit fields in a chat layout, then let the visitor review and send the draft. */
export function ContactConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const questionedName = useRef("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(true);
  const [typing, setTyping] = useState(true);
  const [error, setError] = useState("");
  const [questionedEmail, setQuestionedEmail] = useState("");
  const [suggestedEmail, setSuggestedEmail] = useState("");
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

  /** Update the next field immediately; deliver cancellable replies before enabling it or opening review. */
  const queueReplies = useCallback((replies: Message[], next: Step, firstDelay = 650) => {
    window.clearTimeout(timer.current);
    const generation = ++replyGeneration.current;
    pendingReplies.current = { replies, next };
    if (next !== "review") setStep(next);
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
    busyRef.current = true;
    setError("");
    setSuggestedEmail("");
    setMessages(current => [...current, { from: "visitor", text: answer }]);
    setValue("");
    setBusy(true);
    setTyping(true);
    let reply: string;
    let next: Step;
    if (step === "name") {
      const parsedName = parseContactName(answer);
      if (parsedName === null && questionedName.current !== answer) {
        questionedName.current = answer;
        queueReplies([{ from: "fischer", text: "what name should I use? if that was your name, enter it again." }], "name");
        return;
      }
      setName(parsedName ?? answer);
      questionedName.current = "";
      setValue(email);
      reply = "thanks. what's a good email to reach you at?";
      next = "email";
    } else if (step === "email") {
      const address = tidyContactEmail(answer);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        setQuestionedEmail(answer);
        queueReplies([{ from: "fischer", text: "please enter a valid email address, like you@example.com." }], "email");
        return;
      }
      const suggestion = suggestContactEmail(address);
      if (suggestion && !keptEmailDomains.current.has(address.split("@")[1])) {
        setQuestionedEmail(address);
        setSuggestedEmail(suggestion);
        queueReplies([{ from: "fischer", text: `did you mean ${suggestion}? you can use the suggestion or keep what you typed.` }], "email");
        return;
      }
      setQuestionedEmail("");
      setEmail(address);
      setValue(note);
      reply = "what would you like to say? write your message below.";
      next = "message";
    } else {
      setNote(answer);
      setSubject(suggestContactSubject(answer));
      reply = "please look this over and edit anything you need before sending.";
      next = "review";
    }
    queueReplies([{ from: "fischer", text: reply }], next);
  }

  /** Apply a domain correction only after the visitor chooses it. */
  function useSuggestedEmail() {
    if (busyRef.current || step !== "email" || !suggestedEmail) return;
    setEmail(suggestedEmail);
    setMessages(current => [...current, { from: "visitor", text: `Use ${suggestedEmail}` }]);
    setSuggestedEmail("");
    setQuestionedEmail("");
    setValue(note);
    setError("");
    queueReplies([{ from: "fischer", text: "thanks. write your message below." }], "message");
  }

  /** Use the visitor's chosen address verbatim in the draft after an explicit override. */
  function useQuestionedEmail() {
    if (busyRef.current || !questionedEmail || step !== "email") return;
    if (suggestedEmail) keptEmailDomains.current.add(questionedEmail.split("@")[1]);
    setEmail(questionedEmail);
    setSuggestedEmail("");
    setQuestionedEmail("");
    setValue(note);
    setError("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "thanks. write your message below." }], "message");
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
    questionedName.current = "";
    setEmail("");
    setNote("");
    setSubject("");
    setBusy(true);
    setTyping(true);
    setError("");
    setQuestionedEmail("");
    setSuggestedEmail("");
    keptEmailDomains.current.clear();
    queueReplies([welcome, ...introduction], "name", 900);
  }

  const placeholder = step === "name" ? "your name" : step === "email" ? "you@example.com" : "your message";

  return <>
    <div className="conversation-thread" ref={thread} role="log" aria-label="Your contact note" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`message-row message-${message.from}`}>
        <div className="message-bubble"><span className="sr-only">{message.from === "visitor" ? "You: " : "Fischer’s contact form: "}</span>{message.text}</div>
      </div>)}
      {typing && <div className="typing-bubble" role="status" aria-label="Next question is coming"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>}
    </div>

    <div className="conversation-bottom">
      {suggestedEmail && step === "email" && !busy && <div className="contact-suggestions contact-email-suggestions" aria-label="Email correction">
        <button type="button" onClick={useSuggestedEmail}>Use {suggestedEmail}</button>
        <button type="button" onClick={useQuestionedEmail}>Keep what I typed</button>
      </div>}
      {step === "review" ? <ContactReview name={name} email={email} subject={subject} note={note}
        setName={setName} setEmail={setEmail} setSubject={setSubject} setNote={setNote}
        startOver={startOver} /> : <form ref={form} className="conversation-composer" onSubmit={submit} noValidate>
        {step === "message" ? <textarea id="contact-reply" ref={textarea} aria-label="Your message" spellCheck aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} placeholder={placeholder} value={value} maxLength={2000} rows={1} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} onKeyDown={messageKeyDown} /> :
          <input id="contact-reply" ref={input} aria-label={step === "name" ? "Your name" : "Your email"} aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} type="text" inputMode={step === "email" ? "email" : "text"} autoComplete={step === "email" ? "email" : "name"} spellCheck={false} enterKeyHint="send" placeholder={placeholder} value={value} maxLength={step === "name" ? 80 : 254} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} />}
        <button className="reply-send" type="submit" aria-label="Send reply" disabled={busy || !value.trim()}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>}
      {error && <p className="reply-error" id="reply-error" role="alert">{error}</p>}
    </div>
  </>;
}
