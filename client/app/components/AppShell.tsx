"use client";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";
import Dock from "./Dock";
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
      <Dock
        brand={{ label: "CF", href: "/projects", aria: "CreatorFlow projects" }}
        tabs={LINKS.map((l) => ({ label: l.label, href: l.href, active: path.startsWith(l.href) }))}
        note={user ? `Signed in as ${user.name}` : undefined}
        menu={user
          ? [{ label: "Sign out", onClick: () => { setOut(true); setTimeout(() => router.push("/login"), 300); } }, { label: "Home", href: "/" }]
          : [{ label: "Sign in", href: "/login" }]}
      />
      <div className="relative z-10 pb-28">{children}</div>
    </div>
  );
}
