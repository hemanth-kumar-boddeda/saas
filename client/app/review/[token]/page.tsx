"use client";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import ReviewScreen from "../../components/Review/ReviewScreen";
import { errMsg, useEnterLinkMutation } from "../../../redux/features/review/reviewApi";

const field = "cf-input";

export default function GuestPage() {
  const token = String(useParams()?.token ?? "");
  const [enter, { isLoading }] = useEnterLinkMutation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    // Resume an existing guest session for this tab.
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(`guest:${token}`) || "null");
      if (saved?.projectId) {
        window.sessionStorage.setItem("guestToken", saved.guestToken);
        setProjectId(saved.projectId);
      }
    } catch {}
  }, [token]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="dark cf-root relative min-h-screen bg-cf-bg font-cf text-cf-text">
      <div className="cf-aurora" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
  if (projectId) return <Shell><ReviewScreen projectId={projectId} guest /></Shell>;
  return (
    <Shell><main className="flex min-h-screen items-center justify-center p-4">
      <form
        className="cf-glass cf-rise w-full max-w-sm space-y-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const r = await enter({ token, name, password: password || undefined }).unwrap();
            window.sessionStorage.setItem("guestToken", r.guestToken);
            window.sessionStorage.setItem(`guest:${token}`, JSON.stringify({ guestToken: r.guestToken, projectId: r.projectId }));
            setProjectId(r.projectId);
          } catch (er) { setError(errMsg(er)); }
        }}
      >
        <span className="cf-chip">Guest review</span>
        <h1 className="cf-hero-gradient text-2xl font-semibold">Review a video</h1>
        <p className="text-sm text-cf-muted">No account needed. Your name appears on your comments.</p>
        <input className={field} placeholder="Your name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={field} type="password" placeholder="Password (if the owner set one)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button className="cf-btn cf-btn-primary w-full text-sm" disabled={isLoading || !name.trim()}>Open review</button>
      </form>
    </main></Shell>
  );
}
