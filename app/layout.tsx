import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-950">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
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
            {children}
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
