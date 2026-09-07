"use client";

import localFont from "next/font/local";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { readContactName, contactAside, correctedName, replyToAside, type ChatMemory, type ContactStep as Step } from "@/lib/contact-rules";
const handwriting = localFont({ src: "../app/fonts/benji-script.woff", variable: "--font-contact-annotation", display: "swap" });

type Message = { from: "fischer" | "visitor"; text: string };
const welcome: Message = { from: "fischer", text: "hey, glad you’re here :)" };
const introduction: Message[] = [
  { from: "fischer", text: "let’s put together a little note." },
  { from: "fischer", text: "first, what should I call you?" },
];

/** A guided contact form presented as a conversation, with an explicit email-draft handoff. */
export function ContactConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("name");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(true);
  const [typing, setTyping] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [questionedName, setQuestionedName] = useState("");
  const [questionedEmail, setQuestionedEmail] = useState("");
  const [asideMessage, setAsideMessage] = useState("");
  const memory = useRef<ChatMemory>({});
  const timer = useRef<number | undefined>(undefined);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);

  /** Deliver each bubble after typing, with a short reading pause between replies. */
  const queueReplies = useCallback((replies: Message[], next: Step, firstDelay = 650) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function deliver(index: number) {
      timer.current = window.setTimeout(() => {
        setMessages(current => [...current, replies[index]]);
        setTyping(false);
        if (index === replies.length - 1) {
          setStep(next);
          setBusy(false);
          return;
        }
        timer.current = window.setTimeout(() => {
          setTyping(true);
          deliver(index + 1);
        }, reduced ? 0 : 350);
      }, reduced ? 0 : index === 0 ? firstDelay : 500 + replies[index].text.length * 8);
    }
    deliver(0);
  }, []);

  useEffect(() => {
    queueReplies([welcome, ...introduction], "name", 900);
    return () => window.clearTimeout(timer.current);
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
    if (busy || step === "review") return;
    const answer = value.trim();
    if (!answer) {
      setError(step === "message" ? "Write a little something first." : "Pop your answer in below.");
      return;
    }
    if (/^(?:start over|restart|reset)[.!]?$/i.test(answer)) { startOver(); return; }
    setError("");
    setAsideMessage("");
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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
        setQuestionedEmail(answer);
        queueReplies([{ from: "fischer", text: "that email looks a little unfinished. try something like you@example.com. preferably yours." }], "email");
        return;
      }
      setQuestionedEmail("");
      setEmail(answer);
      reply = "and what’s on your mind? take as much room as you need.";
      next = "message";
    } else {
      setNote(answer);
      reply = "all set. your note is ready to go.";
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
    setCopied(false);
    setError("");
    setBusy(true);
    setTyping(true);
    setValue(previous === "name" ? name : previous === "email" ? email : note);
    queueReplies([{ from: "fischer", text: step === "name" ? "this is the beginning. very economical tour. what should I call you?" : `sure. let's revisit your ${previous}.` }], previous);
  }

  /** Preserve a message that happened to match one of the small-talk rules. */
  function useAsideAsMessage() {
    if (busy || !asideMessage) return;
    setNote(asideMessage);
    setAsideMessage("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "got it. that's the note. ready for your email app." }], "review");
  }

  /** Let visitors overrule a name guess without repeating or defending their name. */
  function useQuestionedName() {
    if (busy || !questionedName || step !== "name") return;
    setName(questionedName);
    setQuestionedName("");
    setValue("");
    setError("");
    setBusy(true);
    setTyping(true);
    queueReplies([{ from: "fischer", text: "fair enough. you know your name better than a form does. what's a good email to reach you at?" }], "email");
  }

  /** Use the visitor's chosen address verbatim in the draft after an explicit override. */
  function useQuestionedEmail() {
    if (busy || !questionedEmail || step !== "email") return;
    setEmail(questionedEmail);
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
    setBusy(true);
    setTyping(true);
    setError("");
    setCopied(false);
    setQuestionedName("");
    setQuestionedEmail("");
    setAsideMessage("");
    memory.current = {};
    queueReplies([welcome, ...introduction], "name", 900);
  }

  const body = `${note}\n\n${name}\n${email}`;
  const draft = `mailto:fschrhunt@gmail.com?subject=${encodeURIComponent(`A note from ${name}`)}&body=${encodeURIComponent(body)}`;
  const placeholder = step === "name" ? "your name" : step === "email" ? "your email" : "your message";

  /** Copy the complete note as a fallback when the visitor does not use a local mail app. */
  async function copyNote() {
    try {
      await navigator.clipboard.writeText(`To: fschrhunt@gmail.com\nSubject: A note from ${name}\n\n${body}`);
      setCopied(true);
      setError("");
    } catch {
      setError("Couldn’t copy it. You can select your message above, or open the email draft.");
    }
  }

  const overrideAnswer = step === "name" ? questionedName : step === "email" ? questionedEmail : step === "message" ? asideMessage : "";
  const overrideIndex = !busy && overrideAnswer ? messages.findLastIndex(message => message.from === "visitor" && message.text === overrideAnswer) : -1;

  return <>
    <div className={`conversation-thread ${handwriting.variable}`} ref={thread} role="log" aria-label="Your contact note" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`message-row message-${message.from}`} data-override={index === overrideIndex}>
        <div className="message-bubble"><span className="sr-only">{message.from === "visitor" ? "You: " : "Fischer’s contact form: "}</span>{message.text}</div>
        {index === overrideIndex && <button
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
      {step === "review" ? <div className="contact-handoff">
        <p>Open your email app to review and send it.</p>
        <a href={draft} className="email-draft-button">Open email draft <span aria-hidden="true">↗</span></a>
        <div className="handoff-options"><button onClick={copyNote} type="button">{copied ? "Copied" : "Copy note"}</button><button onClick={goBack} type="button">Back</button><button onClick={startOver} type="button">Start over</button></div>
        <span className="sr-only" role="status">{copied ? "Note copied to clipboard." : ""}</span>
      </div> : <form ref={form} className="conversation-composer" onSubmit={submit} noValidate>
        {step === "message" ? <textarea ref={textarea} aria-label="Your message" aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} placeholder={placeholder} value={value} maxLength={2000} rows={1} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} onKeyDown={messageKeyDown} /> :
          <input ref={input} aria-label={step === "name" ? "Your name" : "Your email"} aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} type="text" inputMode="text" autoComplete={step === "email" ? "email" : "given-name"} enterKeyHint="send" placeholder={placeholder} value={value} maxLength={step === "name" ? 80 : 254} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} />}
        <button className="reply-send" type="submit" aria-label="Send reply" disabled={busy || !value.trim()}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>}
      {error && <p className="reply-error" id="reply-error" role="alert">{error}</p>}
    </div>
  </>;
}
