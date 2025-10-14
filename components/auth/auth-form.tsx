'use client';

import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { validatePassword } from '@/lib/security/password-validator';

export type AuthMode = 'sign-in' | 'sign-up' | 'recover';

type AuthFormProps = {
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
};

const syncServerAuth = async (session: Session | null) => {
  if (!session) return;
  try {
    await fetch('/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ event: 'SIGNED_IN', session }),
    });
  } catch (callbackError) {
    console.error('[auth] failed to sync session', callbackError);
  }
};

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
    <path
      fill="#EA4335"
      d="M20.64 12.205c0-.64-.057-1.252-.164-1.838H12v3.476h4.844a4.135 4.135 0 0 1-1.797 2.715v2.258h2.908c1.702-1.568 2.685-3.875 2.685-6.61z"
    />
    <path
      fill="#34A853"
      d="M12 21c2.43 0 4.47-.805 5.96-2.194l-2.908-2.258c-.805.54-1.837.86-3.052.86-2.349 0-4.337-1.586-5.048-3.72H3.94v2.332A8.998 8.998 0 0 0 12 21z"
    />
    <path
      fill="#FBBC05"
      d="M6.952 13.687a5.41 5.41 0 0 1-.282-1.687c0-.586.103-1.147.282-1.687V7.981H3.94A8.998 8.998 0 0 0 3 12c0 1.42.338 2.763.94 4.019z"
    />
    <path
      fill="#4285F4"
      d="M12 6.58c1.32 0 2.505.454 3.438 1.343l2.58-2.58C16.464 3.992 14.43 3 12 3a8.998 8.998 0 0 0-8.06 4.981l3.012 2.332C7.663 8.166 9.651 6.58 12 6.58z"
    />
  </svg>
);

export function AuthForm({ initialMode = 'sign-in', onModeChange }: AuthFormProps) {
  const { supabase } = useSupabase();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeAction, setActiveAction] = useState<'password' | 'google' | 'recovery' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isPasswordLoading = activeAction === 'password';
  const isGoogleLoading = activeAction === 'google';
  const isRecoveryLoading = activeAction === 'recovery';
  const isBusy = activeAction !== null;

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const passwordValidation = useMemo(() => {
    if (mode !== 'sign-up') return null;
    return validatePassword(password);
  }, [mode, password]);
  const passwordRules = passwordValidation?.rules;

  const heading = useMemo(
    () => {
      if (mode === 'sign-in') return 'Welcome back';
      if (mode === 'sign-up') return 'Create your account';
      return 'Reset your password';
    },
    [mode],
  );

  const buttonLabel = useMemo(
    () => {
      if (mode === 'sign-in') return 'Sign in';
      if (mode === 'sign-up') return 'Create account';
      return 'Send reset link';
    },
    [mode],
  );

  const toggleModeLabel = useMemo(
    () => {
      if (mode === 'sign-in') return "Don't have an account?";
      if (mode === 'sign-up') return 'Already have an account?';
      return 'Remembered your password?';
    },
    [mode],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setStatusMessage(null);

      if (mode === 'recover') {
        setActiveAction('recovery');
        try {
          if (!email) {
            setError('Please enter your email address.');
            return;
          }
          const redirectTo =
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/update-password`
              : undefined;
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
          });
          if (resetError) throw resetError;
          setStatusMessage('If that email exists, you will receive a reset link shortly.');
        } catch (resetError) {
          console.error('[auth] failed to trigger password recovery', resetError);
          setStatusMessage('If that email exists, you will receive a reset link shortly.');
        } finally {
          setActiveAction(null);
        }
        return;
      }

      setActiveAction('password');

      try {
        if (mode === 'sign-in') {
          const {
            data: signInData,
            error: signInError,
          } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          await syncServerAuth(signInData?.session ?? null);
          router.replace('/dashboard');
          router.refresh();
        } else {
          if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setActiveAction(null);
            return;
          }

          const validationResult = validatePassword(password);
          if (!validationResult.valid) {
            setError(validationResult.issues[0]);
            setActiveAction(null);
            return;
          }

          const emailRedirectTo =
            typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

          const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo,
            },
          });
          if (signUpError) throw signUpError;
          if (data?.session) {
            await syncServerAuth(data.session);
            router.replace('/dashboard');
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
        setActiveAction(null);
      }
    },
    [confirmPassword, email, mode, password, router, supabase],
  );

  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    setStatusMessage('Redirecting to Google...');
    setActiveAction('google');

    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (oauthError) throw oauthError;
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (authError) {
      console.error('[auth] failed to start Google sign-in', authError);
      setStatusMessage(null);
      setError(
        authError instanceof Error
          ? authError.message
          : 'Unable to start Google sign-in. Try again.',
      );
    } finally {
      setActiveAction(null);
    }
  }, [supabase]);

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-[0_0_60px_rgba(30,64,175,0.25)] backdrop-blur-2xl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-slate-400">
          {mode === 'sign-in'
            ? 'Sign in to continue designing personalized learning paths.'
            : mode === 'sign-up'
              ? 'Create an account to save your courses and chat sessions.'
              : "If your email is associated to an account, you'll receive a secure reset link."}
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

        {mode !== 'recover' && (
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              minLength={mode === 'sign-up' ? 12 : 6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/50"
            />
            {mode === 'sign-up' && passwordRules && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 text-left">
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
            )}
          </div>
        )}

        {mode === 'sign-up' && (
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              minLength={12}
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

        {mode === 'sign-in' && (
          <div className="text-right text-sm">
            <button
              type="button"
              className="font-semibold text-indigo-400 hover:text-indigo-300"
              onClick={() => {
                setMode('recover');
                setError(null);
                setStatusMessage(null);
                setPassword('');
                setConfirmPassword('');
                setActiveAction(null);
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPasswordLoading || isRecoveryLoading ? 'Please wait...' : buttonLabel}
          </button>

          {mode !== 'recover' && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleLoading ? (
                'Connecting to Google...'
              ) : (
                <>
                  <GoogleIcon className="h-4 w-4" />
                  Continue with Google
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {mode !== 'recover' ? (
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
                setActiveAction(null);
                setConfirmPassword('');
                return nextMode;
              });
            }}
          >
            {mode === 'sign-in' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      ) : (
        <div className="text-center text-sm text-slate-400">
          <span>{toggleModeLabel}</span>{' '}
          <button
            type="button"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
            onClick={() => {
              setMode('sign-in');
              setError(null);
              setStatusMessage(null);
              setActiveAction(null);
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Sign in
          </button>
        </div>
      )}
    </div>
  );
}
