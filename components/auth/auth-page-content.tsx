"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { AuthForm, type AuthMode } from "./auth-form";

export function AuthPageContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const initialAuthMode: AuthMode = viewParam === "sign-up" ? "sign-up" : "sign-in";

  const [mode, setMode] = useState<AuthMode>(initialAuthMode);

  useEffect(() => {
    setMode(initialAuthMode);
  }, [initialAuthMode]);

  const heroHeading = useMemo(
    () => {
      if (mode === "sign-in") return "Sign in to Course Architect";
      if (mode === "sign-up") return "Create an account for Course Architect";
      return "Reset your Course Architect password";
    },
    [mode],
  );

  const heroDescription = useMemo(
    () => {
      if (mode === "sign-in") {
        return "Your personalized learning plans are stored securely. Log in to keep iterating on them.";
      }
      if (mode === "sign-up") {
        return "Set up your profile to start crafting personalized learning paths tailored to your goals.";
      }
      return "Enter the email tied to your account and we’ll send you a secure link to choose a new password.";
    },
    [mode],
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground transition-colors sm:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.25),_transparent_55%)] blur-[120px] dark:bg-[radial-gradient(circle_at_top,_rgba(45,54,125,0.65),_transparent_55%)]" />
      <div className="absolute inset-0 -z-20 bg-background transition-colors dark:bg-slate-950" />

      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-foreground dark:text-white">{heroHeading}</h1>
          <p className="text-sm text-muted-foreground">{heroDescription}</p>
        </div>

        <AuthForm 
          onModeChange={setMode} 
          initialMode={initialAuthMode}
          key={initialAuthMode}
        />

        <footer className="text-xs text-muted-foreground">
          <span className="mr-2">Need help?</span>
          <Link href="mailto:hello@diffstudio.com" className="underline underline-offset-4">
            Contact support
          </Link>
        </footer>
      </div>
    </div>
  );
}
