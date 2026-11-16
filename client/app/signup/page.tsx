"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SignUp from "@/app/components/Auth/SignUp";
import Verification from "@/app/components/Auth/Verification";
import AuthShell from "@/app/components/Auth/AuthShell";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verification">("form");
  return (
    <AuthShell
      heading={step === "form" ? "Create your account" : "Verify your email"}
      sub={step === "form" ? "Start reviewing videos with your team in minutes." : "We sent a 4 digit code to your email. It expires in 5 minutes."}
      footer={<>Already have an account? <Link href="/login" className="text-cf-text underline underline-offset-4">Sign in</Link></>}
    >
      {step === "form" ? <SignUp onRegistered={() => setStep("verification")} /> : <Verification onVerified={() => router.push("/login")} />}
    </AuthShell>
  );
}
