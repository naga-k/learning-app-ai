'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useSupabase } from '@/components/supabase-provider';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthForm() {
  const { supabase } = useSupabase();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const buttonLabel = useMemo(
    () => (mode === 'sign-in' ? 'Sign in' : 'Create account'),
    [mode],
  );

  const toggleModeLabel = useMemo(
    () => (mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'),
    [mode],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setStatusMessage(null);
      setLoading(true);

      try {
        if (mode === 'sign-in') {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          router.push('/');
          router.refresh();
        } else {
          if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
          }
          const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });
          if (signUpError) throw signUpError;
          if (data?.session) {
            router.push('/');
            router.refresh();
          } else {
            setStatusMessage('Check your email to confirm your account.');
          }
        }
      } catch (authError) {
        setError(
          authError instanceof Error
            ? authError.message
            : 'Unable to process your request. Try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [confirmPassword, email, mode, password, router, supabase],
  );

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_0_60px_rgba(30,64,175,0.25)] backdrop-blur-2xl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-slate-400">
          {mode === 'sign-in'
            ? 'Sign in to continue designing personalized learning paths.'
            : 'Create an account to save your courses and chat sessions.'}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
          />
        </div>

        {mode === 'sign-up' && (
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {statusMessage && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {statusMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Please wait…' : buttonLabel}
        </button>
      </form>

      <div className="text-center text-sm text-slate-400">
        <span>{toggleModeLabel}</span>{' '}
        <button
          type="button"
          className="font-semibold text-indigo-400 hover:text-indigo-300"
          onClick={() => {
            setMode((current) => {
              const nextMode = current === 'sign-in' ? 'sign-up' : 'sign-in';
              setError(null);
              setStatusMessage(null);
              setLoading(false);
              setConfirmPassword('');
              return nextMode;
            });
          }}
        >
          {mode === 'sign-in' ? 'Create one' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
