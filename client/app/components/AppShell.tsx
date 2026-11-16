"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";
import { useLoadUserQuery } from "../../redux/features/api/apiSlice";
import { useSelector } from "react-redux";
import { useLogOutQuery } from "../../redux/features/auth/authApi";

const LINKS = [{ label: "Projects", href: "/projects" }, { label: "Profile", href: "/profile" }];

/** Dark app chrome for signed-in screens: aurora backdrop + floating glass nav. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "";
  const router = useRouter();
  const { data } = useLoadUserQuery(undefined, {});
  const [out, setOut] = useState(false);
  useLogOutQuery(undefined, { skip: !out });
  const authUser = useSelector((st: any) => st.auth.user);
  const user = authUser || data?.user;

  return (
    <div className="dark cf-root relative min-h-screen bg-cf-bg font-cf text-cf-text">
      <div className="cf-aurora" aria-hidden="true" />
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <nav aria-label="App" className="cf-glass mx-auto flex max-w-7xl items-center gap-2 !rounded-full px-3 py-2">
          <Link href="/projects" className="flex items-center gap-2 rounded-full px-2 py-1" aria-label="CreatorFlow projects">
            <span aria-hidden="true" className="block h-6 w-6 rounded-md bg-cf-violet" />
            <span className="hidden font-semibold sm:inline">CreatorFlow</span>
          </Link>
          <div className="ml-2 flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={path.startsWith(l.href) ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-300 ${path.startsWith(l.href) ? "bg-white/10 text-cf-text" : "text-cf-muted hover:text-cf-text"}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user && <span className="hidden text-sm text-cf-muted md:inline">{user.name}</span>}
            {user ? (
              <button className="cf-btn cf-btn-secondary text-sm" onClick={() => { setOut(true); setTimeout(() => router.push("/login"), 300); }}>
                Sign out
              </button>
            ) : (
              <Link href="/login" className="cf-btn cf-btn-primary text-sm">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
