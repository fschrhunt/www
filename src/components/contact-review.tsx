"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string; email: string; subject: string; note: string;
  setName: (value: string) => void; setEmail: (value: string) => void;
  setSubject: (value: string) => void; setNote: (value: string) => void;
  startOver: () => void;
};

/** An original, quiet upward swoosh, synthesized only after an explicit successful send. */
function playHandoffSound(audio: AudioContext | null) {
  if (!audio) return;
  try {
    const noise = audio.createBuffer(1, audio.sampleRate * 0.32, audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    source.buffer = noise;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    const gain = audio.createGain();
    const now = audio.currentTime;
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.onended = () => { void audio.close(); };
    source.start();
  } catch {
    // Audio support never determines whether the note can be sent.
  }
}

/** Review a preserved draft above the composer; the arrow sends it through the contact endpoint. */
export function ContactReview(props: Props) {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const submissionId = useRef<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const handingOff = useRef(false);
  // A field no real visitor sees or tabs to; automated form-fillers tend to complete it.
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const modal = dialog.current;
    const sheet = card.current;
    if (!open || !modal || !sheet) return;
    modal.showModal();
    modal.focus({ preventScroll: true });
    const destination = sheet.getBoundingClientRect();
    const origin = trigger.current?.getBoundingClientRect();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rise = (origin?.bottom ?? innerHeight - 24) - destination.bottom;
    const animation = sheet.animate([
      { opacity: 0, transform: `translateY(${rise + 40}px) scale(.94)`, transformOrigin: "bottom center" },
      { opacity: 1, transform: "translateY(0) scale(1)", transformOrigin: "bottom center" },
    ], { duration: reduced ? 0 : 380, easing: "cubic-bezier(.16,1,.3,1)" });
    return () => { animation.cancel(); modal.close(); };
  }, [open]);

  useEffect(() => {
    if (handedOff) trigger.current?.focus({ preventScroll: true });
  }, [handedOff]);

  /** Close the sheet without discarding edits, then return focus to its composer control. */
  function dismiss() {
    if (handingOff.current) return;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }

  /** Keep the draft on failure and animate departure only after Resend accepts the email. */
  async function handoff() {
    if (handingOff.current) return;
    handingOff.current = true;
    setSending(true);
    setError("");
    let audio: AudioContext | null = null;
    try { audio = new AudioContext(); void audio.resume().catch(() => {}); } catch { /* Sending works without audio. */ }
    submissionId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: props.name, email: props.email, subject: props.subject, note: props.note, id: submissionId.current, company: honeypot.current?.value ?? "" }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.sent !== true) throw new Error(result.error || "That didn't send. Please try again.");
    } catch (error) {
      setError(error instanceof Error && error.name === "Error" ? error.message : "I couldn't confirm the send. Your note is still here. Please try again.");
      void audio?.close();
      setSending(false);
      handingOff.current = false;
      return;
    }
    setSending(false);
    setLeaving(true);
    playHandoffSound(audio);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      await card.current?.animate([
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: `translateY(-${innerHeight + 100}px) scale(.96)`, opacity: 0 },
      ], { duration: reduced ? 0 : 440, easing: "cubic-bezier(.6,0,.85,.35)", fill: "forwards" }).finished;
    } catch { /* Unmount cancels the departure. */ }
    setHandedOff(true);
    dialog.current?.close();
    setOpen(false);
    setLeaving(false);
    handingOff.current = false;
    trigger.current?.focus();
  }

  return <>
    <div className="contact-draft-return">
      {handedOff && <p role="status">sent. thanks for writing :)</p>}
      {!handedOff && <button ref={trigger} type="button" onClick={() => setOpen(true)}>Review your note <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      {handedOff && <button ref={trigger} className="contact-start-over" type="button" onClick={props.startOver}>Start over</button>}
    </div>
    <dialog ref={dialog} className="contact-review-modal" tabIndex={-1} aria-label="Review your note" data-leaving={leaving}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="contact-review-frame">
        <header className="contact-review-heading">
          <p className="message-bubble">please look this over and edit anything you need before sending.</p>
        </header>
        <div ref={card} className="contact-review-sheet">
        <div className="contact-review-scroll" inert={leaving || sending}>
          <div className="contact-letter-address"><span>To</span><span>Fischer <span className="contact-letter-muted">· fschrhunt@gmail.com</span></span></div>
          <div className="contact-letter-address contact-sender-address"><span>From</span><div className="contact-review-sender">
            <label><span>Name</span><input aria-label="Your name for this email" autoComplete="name" value={props.name} maxLength={80} onChange={event => props.setName(event.target.value)} /></label>
            <label><span>Email</span><input aria-label="Your reply email" type="email" autoComplete="email" inputMode="email" value={props.email} maxLength={254} onChange={event => props.setEmail(event.target.value)} /></label>
          </div></div>
          <label className="contact-subject"><span>Subject</span><input aria-label="Email subject" value={props.subject} maxLength={120} onChange={event => props.setSubject(event.target.value)} /></label>
          <textarea className="contact-letter-body" aria-label="Email message" spellCheck value={props.note} maxLength={2000} onChange={event => props.setNote(event.target.value)} />
          <div className="contact-honeypot" aria-hidden="true"><label>Company<input ref={honeypot} type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
        </div>
        {error && <p className="contact-send-error" role="alert">{error}</p>}
        <footer className="contact-review-actions">
          {sending && <span role="status">sending…</span>}
          <button className="reply-send" type="button" aria-label="Send note" disabled={sending || leaving} onClick={() => void handoff()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </footer>
        </div>
      </div>
    </dialog>
  </>;
}
