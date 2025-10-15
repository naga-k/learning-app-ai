import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { Session } from "@supabase/supabase-js";
import { Suspense } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SupabaseProvider } from "@/components/supabase-provider";
import { SupabaseListener } from "@/components/supabase-listener";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Course Architect",
  description: "Learn anything you want",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session: rawSession },
  } = await supabase.auth.getSession();

  const session: Session | null =
    rawSession && user ? { ...rawSession, user } : null;

  return (
    <html lang="en" className="bg-slate-950">
      <head>
        <Script
          src="https://t.contentsquare.net/uxa/d8ddc464e76de.js"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
        <SupabaseProvider initialSession={session}>
          <SupabaseListener />
          <div className="relative flex min-h-screen flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)] blur-3xl" />
              <div
                className="absolute inset-0 opacity-40 mix-blend-screen"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)",
                  backgroundSize: "42px 42px",
                  maskImage:
                    "radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, transparent 70%)",
                  WebkitMaskImage:
                    "radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, transparent 70%)",
                }}
              />
            </div>

            <main className="relative flex min-h-screen flex-col">
              <Suspense fallback={null}>{children}</Suspense>
            </main>
          </div>
          <Analytics />
        </SupabaseProvider>
      </body>
    </html>
  );
}
