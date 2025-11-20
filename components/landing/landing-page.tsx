"use client";

import Link from "next/link";
import { BookOpen, Brain, Sparkles, Target, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground transition-colors sm:px-6">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.25),_transparent_55%)] blur-[120px] dark:bg-[radial-gradient(circle_at_top,_rgba(45,54,125,0.65),_transparent_55%)]" />
      <div className="absolute inset-0 -z-20 bg-background transition-colors dark:bg-slate-950" />

      <div className="flex w-full max-w-6xl flex-col items-center gap-16 text-center">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/80 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors dark:border-white/10 dark:bg-white/[0.05]">
            <Sparkles className="size-4 text-indigo-400" />
            <span>AI-Powered Learning Platform</span>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight text-foreground dark:text-white sm:text-6xl md:text-7xl">
            Master Anything with
            <br />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-500">
              Course Architect
            </span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Create personalized learning paths tailored to your goals. Let AI guide you through structured courses designed just for you.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/login">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
                <Brain className="size-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle>AI-Powered Courses</CardTitle>
              <CardDescription>
                Intelligent course generation tailored to your learning style and goals
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/50">
                <Target className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Personalized Paths</CardTitle>
              <CardDescription>
                Custom learning journeys designed around your objectives and experience level
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                <Zap className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>Interactive Learning</CardTitle>
              <CardDescription>
                Engage with AI-assisted chat to deepen understanding and clarify concepts
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/50">
                <BookOpen className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Structured Content</CardTitle>
              <CardDescription>
                Well-organized modules and lessons that build upon each other progressively
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/50">
                <Sparkles className="size-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle>Continuous Updates</CardTitle>
              <CardDescription>
                Your learning plans evolve with you as you progress through your journey
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
            <CardHeader>
              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-950/50">
                <Target className="size-6 text-pink-600 dark:text-pink-400" />
              </div>
              <CardTitle>Track Progress</CardTitle>
              <CardDescription>
                Monitor your learning journey with detailed insights and milestones
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="flex w-full flex-col items-center gap-6 rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-12">
          <h2 className="text-3xl font-bold text-foreground dark:text-white sm:text-4xl">
            Ready to Start Learning?
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Join thousands of learners who are achieving their goals with AI-powered personalized courses.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link href="/login">
              Create Your Free Account
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
