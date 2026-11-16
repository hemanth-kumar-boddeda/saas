"use client";
import React, { useEffect, useRef, useState } from "react";

export const MAX_VOICE = 180; // seconds, matches the server limit
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const mediaUrl = (u: string) => new URL(u, process.env.NEXT_PUBLIC_SERVER_URL).href;

/** Player for a stored voice note. */
export function VoicePlayer({ url, seconds, transcript, transcriptStatus }: { url: string; seconds?: number; transcript?: string; transcriptStatus?: string }) {
  return (
    <div className="mt-1">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="cf-badge border-cf-violet/40 bg-cf-violet/10 text-violet-200">Voice{seconds ? ` ${mmss(seconds)}` : ""}</span>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls preload="none" src={mediaUrl(url)} className="h-8 w-full max-w-[260px]" aria-label="Voice note" />
    </div>
    {transcript && <p className="mt-1 text-xs italic text-cf-muted whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="transcript">“{transcript}”</p>}
    {transcriptStatus === "pending" && <p className="mt-1 text-xs text-cf-muted">Transcribing…</p>}
    </div>
  );
}

/**
 * Record, review, then send. Nothing leaves the browser until the user presses Send.
 * onStart lets the parent pause the video so the speaker can talk over the exact frame.
 */
export default function VoiceRecorder({ onSend, onStart, sending, label = "Record voice note" }: {
  onSend: (blob: Blob) => Promise<void>; onStart?: () => void; sending?: boolean; label?: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<any>(null);
  const stream = useRef<MediaStream | null>(null);

  const cleanup = () => { clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { cleanup(); if (url) URL.revokeObjectURL(url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setError("Voice notes are not supported in this browser. Use a recent Chrome, Edge, Safari or Firefox.");
    try {
      onStart?.();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      rec.current = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
      chunks.current = [];
      rec.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.current.onstop = () => {
        const b = new Blob(chunks.current, { type: rec.current?.mimeType || "audio/webm" });
        setBlob(b); setUrl(URL.createObjectURL(b)); setState("recorded"); cleanup();
      };
      rec.current.start();
      setSecs(0); setState("recording");
      timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_VOICE) rec.current?.stop(); return s + 1; }), 1000);
    } catch (e: any) {
      cleanup();
      setError(e?.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in the browser address bar and try again." : "Could not start the microphone.");
    }
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  const discard = () => { if (url) URL.revokeObjectURL(url); setBlob(null); setUrl(""); setState("idle"); setSecs(0); };
  const send = async () => { if (blob) { await onSend(blob); discard(); } };

  return (
    <div className="space-y-2">
      {state === "idle" && <button type="button" className="cf-btn cf-btn-secondary w-full text-sm" onClick={start}>🎙 {label}</button>}
      {state === "recording" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2" role="status">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" aria-hidden="true" />
          <span className="font-mono text-sm">{mmss(secs)} / {mmss(MAX_VOICE)}</span>
          <button type="button" className="cf-btn cf-btn-danger ml-auto text-sm" onClick={stop}>Stop</button>
        </div>
      )}
      {state === "recorded" && (
        <div className="space-y-2 rounded-xl border border-cf-line bg-black/20 p-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={url} className="h-9 w-full" aria-label="Your recording" />
          <div className="flex gap-2">
            <button type="button" className="cf-btn cf-btn-primary flex-1 text-sm" disabled={sending} onClick={send}>{sending ? "Sending…" : "Send voice note"}</button>
            <button type="button" className="cf-btn cf-btn-secondary text-sm" disabled={sending} onClick={discard}>Discard</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
