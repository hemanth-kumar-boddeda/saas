"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Login from "@/app/components/Auth/Login";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="dark min-h-screen bg-cf-bg font-cf text-cf-text">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
        <Link href="/" className="title-2 mb-8 block text-cf-text">
          CreatorFlow
        </Link>
        <div className="cf-card p-6">
          <Login
            title="Sign in to CreatorFlow"
            setRoute={(route) =>
              router.push(route === "Sign-Up" ? "/signup" : "/login")
            }
            setOpen={() => router.push("/videos")}
          />
        </div>
        <p className="body-2 mt-6 text-center text-cf-muted">
          New to CreatorFlow?{" "}
          <Link
            href="/signup"
            className="text-cf-text underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
