"use client";
import React, { useState } from "react";
import { toast } from "react-toastify";
import {
  errMsg, useConnectAccountMutation, useDisconnectAccountMutation, useListAccountsQuery, useListPublicationsQuery, usePublishMutation,
} from "../../../redux/features/review/reviewApi";

const btn = "px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50";
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const ghost = `${btn} border border-gray-300 dark:border-gray-600`;
const input = "rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm";
const NAMES: Record<string, string> = { youtube: "YouTube", instagram: "Instagram" };

export default function Publish({ projectId }: { projectId: string }) {
  const { data } = useListAccountsQuery();
  const { data: pubs } = useListPublicationsQuery(projectId, { pollingInterval: 5000 });
  const [connect] = useConnectAccountMutation();
  const [disconnect] = useDisconnectAccountMutation();
  const [publish, { isLoading }] = usePublishMutation();
  const accounts: any[] = data?.accounts || [];
  const [accountId, setAccountId] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [when, setWhen] = useState("");
  const acc = accounts.find((a) => a._id === accountId) || accounts[0];

  const go = async (provider: string) => {
    try {
      const r = await connect(provider).unwrap();
      window.location.href = r.url;
    } catch (e) { toast.error(errMsg(e)); }
  };
  const submit = async () => {
    if (!acc) return;
    try {
      await publish({ id: projectId, body: {
        provider: acc.provider, accountId: acc._id, ...(when ? { scheduledAt: new Date(when).toISOString() } : {}),
        ...(acc.provider === "youtube" ? { privacy } : {}),
      } }).unwrap();
      toast.success(when ? "Scheduled" : "Publishing started");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 className="font-medium mb-1">Publish</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Publishes exactly what is saved above. Instagram needs a professional account linked to a Facebook Page (Meta test mode: testers only).
        Publishing sends the original video to the platform. Results are not guaranteed.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {["youtube", "instagram"].map((p) => <button key={p} className={ghost} onClick={() => go(p)}>Connect {NAMES[p]}</button>)}
      </div>
      {accounts.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-center">
          <select aria-label="Account" className={input} value={acc?._id || ""} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a._id} value={a._id}>{NAMES[a.provider]}: {a.name}{a.needsReconnect ? " (reconnect)" : ""}</option>)}
          </select>
          {acc?.provider === "youtube" && (
            <select aria-label="Privacy" className={input} value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
              <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
            </select>
          )}
          <input aria-label="Schedule (optional)" type="datetime-local" className={input} value={when} onChange={(e) => setWhen(e.target.value)} />
          <button className={primary} disabled={isLoading || acc?.needsReconnect} onClick={submit}>{when ? "Schedule" : "Publish now"}</button>
        </div>
      )}
      {acc && <button className="text-xs underline mt-2" onClick={() => disconnect(acc._id)}>Disconnect {acc.name}</button>}
      <ul className="mt-3 space-y-1 text-sm">
        {(pubs?.publications || []).map((p: any) => (
          <li key={p._id}>
            {NAMES[p.provider]} · {p.status}{p.scheduledAt ? ` for ${new Date(p.scheduledAt).toLocaleString()}` : ""}
            {p.url && <> · <a className="underline" href={p.url} target="_blank" rel="noreferrer noopener">open</a></>}
            {p.error && <span className="text-red-600"> · {p.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
