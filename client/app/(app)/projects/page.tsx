"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { errMsg, useCreateProjectMutation, useCreateSampleProjectMutation, useListProjectsQuery } from "../../../redux/features/review/reviewApi";
import { StatusBadge } from "../../components/Review/ReviewScreen";

export default function Projects() {
  const { data, isLoading, error } = useListProjectsQuery();
  const [create, { isLoading: creating }] = useCreateProjectMutation();
  const [makeSample, { isLoading: sampling }] = useCreateSampleProjectMutation();
  const router = useRouter();
  const trySample = () => makeSample().unwrap().then((r) => router.push(`/projects/${r.project._id}`)).catch((er) => toast.error(errMsg(er)));
  const [title, setTitle] = useState("");
  const projects: any[] = data?.projects || [];
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="cf-rise">
        <span className="cf-chip">Workspace</span>
        <h1 className="cf-hero-gradient mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Your projects</h1>
        <p className="mt-2 max-w-xl text-cf-muted">Upload a cut, collect timestamped feedback, approve, then publish with an AI-written kit.</p>
      </div>

      <form
        className="cf-glass cf-rise mt-8 flex flex-col gap-2 p-3 sm:flex-row"
        style={{ "--i": 1 } as React.CSSProperties}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await create({ title }).unwrap();
            setTitle("");
          } catch (er) { toast.error(errMsg(er)); }
        }}
      >
        <label htmlFor="new-project" className="sr-only">New project title</label>
        <input id="new-project" className="cf-input flex-1" placeholder="New project title, e.g. Episode 12 final cut" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="cf-btn cf-btn-primary px-5" disabled={creating || !title.trim()}>{creating ? "Creating…" : "Create project"}</button>
      </form>

      {isLoading && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading projects">
          {[0, 1, 2, 3].map((i) => <div key={i} className="cf-skeleton h-28" />)}
        </div>
      )}
      {error && (
        <div role="alert" className="cf-card mt-8 p-5">
          <p className="text-red-300">{errMsg(error)}</p>
          <Link href="/login" className="cf-btn cf-btn-secondary mt-3 text-sm">Sign in again</Link>
        </div>
      )}
      {!isLoading && !error && projects.length === 0 && (
        <div className="cf-card mt-8 p-10 text-center">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="mt-1 text-cf-muted">Create your first project above, then upload a video or paste an unlisted link. Or see the whole loop first.</p>
          <button className="cf-btn cf-btn-primary mt-4 px-5" onClick={trySample} disabled={sampling}>{sampling ? "Setting up the sample…" : "Try a sample project"}</button>
          <p className="mt-3 text-xs text-cf-muted">Two generated test clips with notes already on them. It is yours to play with.</p>
        </div>
      )}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {projects.map((p, i) => (
          <li key={p._id} className="cf-rise" style={{ "--i": i + 2 } as React.CSSProperties}>
            <Link href={`/projects/${p._id}`} className="cf-glass cf-card-hover block p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cf-violet">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug">{p.title}</h2>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-3 text-sm text-cf-muted capitalize">{p.role} · version {p.currentVersion || "—"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
