'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { validatePassword } from '@/lib/security/password-validator';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { supabase, session } = useSupabase();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorDescription = params.get('error_description');

    if (errorDescription) {
      setError(errorDescription);
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .catch((sessionError) => {
          console.error('[auth] failed to set recovery session', sessionError);
          setError('Could not validate the reset link. Please request a new one.');
        })
        .finally(() => {
          const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
          window.history.replaceState({}, document.title, cleanUrl);
        });
    } else if (hash) {
      const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [supabase]);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const passwordRules = passwordValidation.rules;
  const passwordIsValid = passwordValidation.valid;

  const canSubmit = useMemo(
    () => passwordIsValid && password === confirmPassword,
    [confirmPassword, passwordIsValid, password],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    const validationResult = validatePassword(password);
    if (!validationResult.valid) {
      setError(validationResult.issues[0]);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setStatusMessage('Password updated. Redirecting to your dashboard...');
      setTimeout(() => {
        router.replace('/dashboard');
        router.refresh();
      }, 1500);
    } catch (updateError) {
      console.error('[auth] failed to update password', updateError);
      setError('Something went wrong updating your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(45,54,125,0.65),_transparent_55%)] blur-[120px]" />
      <div className="absolute inset-0 -z-20 bg-slate-950" />

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_0_60px_rgba(30,64,175,0.25)] backdrop-blur-2xl">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
          <p className="text-sm text-slate-400">
            {session
              ? 'Enter a new password below to finish resetting your account.'
              : 'Follow the link from your email to continue resetting your password.'}
          </p>
        </div>

        <form className="space-y-4 text-left" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
            />
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            <p className="font-medium text-slate-200">Your password must:</p>
            <ul className="list-disc space-y-1 pl-5 text-left">
              <li className={passwordRules.length ? 'text-emerald-300' : undefined}>
                Use at least 12 characters.
              </li>
              <li className={passwordRules.letter ? 'text-emerald-300' : undefined}>
                Include at least one letter.
              </li>
              <li className={passwordRules.number ? 'text-emerald-300' : undefined}>
                Include at least one number.
              </li>
              <li className={passwordRules.special ? 'text-emerald-300' : undefined}>
                Include at least one special character (e.g. !@#$).
              </li>
              <li className={passwordRules.common ? 'text-emerald-300' : undefined}>
                Avoid common or easily guessed phrases.
              </li>
            </ul>
          </div>
        </div>

          <div className="space-y-2">
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-300">
              Confirm new password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              minLength={12}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
            />
          </div>

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
            disabled={isSubmitting || !session || !canSubmit}
            className="w-full rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>

        <div className="text-sm text-slate-400">
          <button
            type="button"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
            onClick={() => {
              router.replace('/login');
              router.refresh();
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}
