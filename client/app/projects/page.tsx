"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { errMsg, useCreateProjectMutation, useListProjectsQuery } from "../../redux/features/review/reviewApi";
import { StatusBadge } from "../components/Review/ReviewScreen";

export default function Projects() {
  const { data, isLoading, error } = useListProjectsQuery();
  const [create, { isLoading: creating }] = useCreateProjectMutation();
  const [title, setTitle] = useState("");
  const projects: any[] = data?.projects || [];
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-semibold mb-4">Projects</h1>
      <form
        className="flex gap-2 mb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await create({ title }).unwrap();
            setTitle("");
          } catch (er) { toast.error(errMsg(er)); }
        }}
      >
        <input
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          placeholder="New project title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
        />
        <button className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm disabled:opacity-50" disabled={creating || !title.trim()}>Create</button>
      </form>
      {isLoading && <p className="text-gray-500">Loading projects…</p>}
      {error && <p className="text-red-600">{errMsg(error)} Are you logged in?</p>}
      {!isLoading && !error && projects.length === 0 && <p className="text-gray-500">No projects yet. Create one to start a review.</p>}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p._id}>
            <Link href={`/projects/${p._id}`} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span>{p.title} <span className="text-xs text-gray-500">({p.role}, v{p.currentVersion})</span></span>
              <StatusBadge status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
