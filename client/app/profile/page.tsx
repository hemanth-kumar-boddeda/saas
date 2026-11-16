"use client";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLoadUserQuery } from "../../redux/features/api/apiSlice";
import { useUpdatePasswordMutation } from "../../redux/features/user/userApi";
import { errMsg, useDisconnectAccountMutation, useListAccountsQuery } from "../../redux/features/review/reviewApi";

const NAMES: Record<string, string> = { youtube: "YouTube", instagram: "Instagram" };

export default function ProfilePage() {
  const router = useRouter();
  const { data, isLoading: loadingUser, isError } = useLoadUserQuery(undefined, {});
  const user = data?.user;
  useEffect(() => { if (isError) router.replace("/login"); }, [isError, router]);
  const { data: acc } = useListAccountsQuery();
  const [disconnect] = useDisconnectAccountMutation();
  const [update, { isLoading }] = useUpdatePasswordMutation();
  const [f, setF] = useState({ oldPassword: "", newPassword: "", confirm: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return toast.error("Passwords do not match");
    try {
      await update({ oldPassword: f.oldPassword, newPassword: f.newPassword }).unwrap();
      toast.success("Password updated");
      setF({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (er) { toast.error(errMsg(er)); }
  };
  const field = (k: keyof typeof f, label: string) => (
    <label className="block text-sm">
      <span className="mb-1 block text-cf-muted">{label}</span>
      <input className="cf-input" type="password" required autoComplete={k === "oldPassword" ? "current-password" : "new-password"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <span className="cf-chip cf-rise">Account</span>
        <h1 className="cf-hero-gradient cf-rise mt-3 text-4xl font-semibold tracking-tight" style={{ "--i": 1 } as React.CSSProperties}>{loadingUser ? "Loading…" : user?.name || "Profile"}</h1>
        <p className="cf-rise mt-1 text-cf-muted" style={{ "--i": 2 } as React.CSSProperties}>{user?.email}</p>

        <section className="cf-glass cf-rise mt-8 p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <h2 className="text-lg font-semibold">Connected accounts</h2>
          <ul className="mt-3 space-y-2">
            {(acc?.accounts || []).map((a: any) => (
              <li key={a._id} className="flex items-center justify-between rounded-xl border border-cf-line bg-black/20 px-3 py-2 text-sm">
                <span>{NAMES[a.provider]}: {a.name}{a.needsReconnect && <span className="ml-2 text-amber-300">needs reconnect</span>}</span>
                <button className="cf-btn cf-btn-danger text-xs" onClick={() => disconnect(a._id)}>Disconnect</button>
              </li>
            ))}
            {acc?.accounts?.length === 0 && <li className="text-sm text-cf-muted">None yet. Connect YouTube or Instagram from an approved project&apos;s publish kit.</li>}
          </ul>
        </section>

        <form onSubmit={submit} className="cf-glass cf-rise mt-6 space-y-3 p-5" style={{ "--i": 4 } as React.CSSProperties}>
            <h2 className="text-lg font-semibold">Change password</h2>
            {field("oldPassword", "Current password")}
            {field("newPassword", "New password")}
            {field("confirm", "Confirm new password")}
            <button className="cf-btn cf-btn-primary text-sm" disabled={isLoading}>{isLoading ? "Saving…" : "Update password"}</button>
          </form>
      </main>
    </>
  );
}
