"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthForm, type AuthMode } from "./auth-form";

export function AuthPageContent() {
  const [mode, setMode] = useState<AuthMode>("sign-in");

  const heroHeading = useMemo(
    () =>
      mode === "sign-in"
        ? "Sign in to Course Architect"
        : "Create an account for Course Architect",
    [mode],
  );

  const heroDescription = useMemo(
    () =>
      mode === "sign-in"
        ? "Your personalized learning plans are stored securely. Log in to keep iterating on them."
        : "Set up your profile to start crafting personalized learning paths tailored to your goals.",
    [mode],
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(45,54,125,0.65),_transparent_55%)] blur-[120px]" />
      <div className="absolute inset-0 -z-20 bg-slate-950" />

      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-white">{heroHeading}</h1>
          <p className="text-sm text-slate-400">{heroDescription}</p>
        </div>

        <AuthForm onModeChange={setMode} initialMode="sign-in" />

        <footer className="text-xs text-slate-500">
          <span className="mr-2">Need help?</span>
          <Link href="mailto:hello@diffstudio.com" className="underline underline-offset-4">
            Contact support
          </Link>
        </footer>
      </div>
    </div>
  );
}
