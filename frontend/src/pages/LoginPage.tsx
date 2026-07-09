import { Activity, Eye, EyeOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DEMO_DISCLAIMER } from '../lib/types';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Activity className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Careflow</h1>
        <p className="text-sm text-slate-500">Healthcare Management Portal</p>
      </div>

      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-drawer">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to Careflow</h2>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
            >
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. nurse.smith@careflow.io"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Demo environment
          </p>
          <p className="mt-1 text-sm italic text-slate-500">
            Seeded demo users can explore the internal dashboard.
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">{DEMO_DISCLAIMER}</p>
    </div>
  );
}
