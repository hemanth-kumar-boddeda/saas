"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SignUp from "@/app/components/Auth/SignUp";
import Verification from "@/app/components/Auth/Verification";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verification">("form");

  return (
    <div className="dark min-h-screen bg-cf-bg font-cf text-cf-text">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
        <Link href="/" className="title-2 mb-8 block text-cf-text">
          CreatorFlow
        </Link>
        <div className="cf-card p-6">
          {step === "verification" ? (
            <Verification setRoute={() => router.push("/login")} />
          ) : (
            <SignUp
              title="Create your CreatorFlow account"
              setRoute={(route) => {
                if (route === "Verification") {
                  setStep("verification");
                  return;
                }
                router.push("/login");
              }}
              setOpen={() => router.push("/videos")}
            />
          )}
        </div>
        <p className="body-2 mt-6 text-center text-cf-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-cf-text underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
