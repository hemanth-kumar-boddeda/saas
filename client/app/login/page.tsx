"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Login from "@/app/components/Auth/Login";
import AuthShell from "@/app/components/Auth/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  return (
    <AuthShell
      heading="Welcome back"
      sub="Sign in to review, approve and publish your videos."
      footer={<>New to CreatorFlow? <Link href="/signup" className="text-cf-text underline underline-offset-4">Create an account</Link></>}
    >
      <Login onDone={() => router.push("/projects")} />
    </AuthShell>
  );
}
