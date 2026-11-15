"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReviewScreen from "../../components/Review/ReviewScreen";
import { errMsg, useEnterLinkMutation } from "../../../redux/features/review/reviewApi";

const field = "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm";

export default function GuestPage() {
  const { token } = useParams<{ token: string }>();
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

  if (projectId) return <ReviewScreen projectId={projectId} guest />;
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <form
        className="w-full max-w-sm space-y-3"
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
        <h1 className="text-xl font-semibold">Review a video</h1>
        <p className="text-sm text-gray-500">No account needed. Your name appears on your comments.</p>
        <input className={field} placeholder="Your name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={field} type="password" placeholder="Password (if the owner set one)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50" disabled={isLoading || !name.trim()}>Open review</button>
      </form>
    </main>
  );
}
