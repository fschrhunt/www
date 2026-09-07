"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type Step = "name" | "email" | "message" | "review";
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
    if (step === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
      setError("That email doesn’t look quite right. Try it again?");
      return;
    }
    setError("");
    setMessages(current => [...current, { from: "visitor", text: answer }]);
    setValue("");
    setBusy(true);
    setTyping(true);
    let reply: string;
    let next: Step;
    if (step === "name") {
      setName(answer);
      reply = `nice to meet you, ${answer}. what’s a good email to reach you at?`;
      next = "email";
    } else if (step === "email") {
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

  return <>
    <div className="conversation-thread" ref={thread} role="log" aria-label="Your contact note" aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <div key={index} className={`message-row message-${message.from}`}>
        <div className="message-bubble"><span className="sr-only">{message.from === "visitor" ? "You: " : "Fischer’s contact form: "}</span>{message.text}</div>
      </div>)}
      {typing && <div className="typing-bubble" role="status" aria-label="Next question is coming"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div>}
    </div>

    <div className="conversation-bottom">
      {step === "review" ? <div className="contact-handoff">
        <p>Open your email app to review and send it.</p>
        <a href={draft} className="email-draft-button">Open email draft <span aria-hidden="true">↗</span></a>
        <div className="handoff-options"><button onClick={copyNote} type="button">{copied ? "Copied" : "Copy note"}</button><button onClick={startOver} type="button">Start over</button></div>
        <span className="sr-only" role="status">{copied ? "Note copied to clipboard." : ""}</span>
      </div> : <form ref={form} className="conversation-composer" onSubmit={submit} noValidate>
        {step === "message" ? <textarea ref={textarea} aria-label="Your message" aria-describedby={error ? "reply-error" : "reply-hint"} aria-invalid={Boolean(error)} placeholder={placeholder} value={value} maxLength={2000} rows={1} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} onKeyDown={messageKeyDown} /> :
          <input ref={input} aria-label={step === "name" ? "Your name" : "Your email"} aria-describedby={error ? "reply-error" : undefined} aria-invalid={Boolean(error)} type={step === "email" ? "email" : "text"} autoComplete={step === "email" ? "email" : "given-name"} enterKeyHint="send" placeholder={placeholder} value={value} maxLength={step === "name" ? 80 : 254} disabled={busy} onChange={event => { setValue(event.target.value); setError(""); }} />}
        <button className="reply-send" type="submit" aria-label="Send reply" disabled={busy || !value.trim()}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </form>}
      {error && <p className="reply-error" id="reply-error" role="alert">{error}</p>}
      <p className="conversation-footnote" id="reply-hint">{step === "message" ? "Enter to reply · Shift + Enter for a new line" : step === "review" ? "Nothing is sent until you send the email." : "A little conversation before the email."}{step !== "review" && <span className="focus-shortcut"> · / to focus</span>}</p>
    </div>
  </>;
}
