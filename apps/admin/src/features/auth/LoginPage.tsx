import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from './useAuth';
import { Loader2, Shield } from 'lucide-react';

export function LoginPage() {
  const { login, isLoggingIn, loginError, clearLoginError } = useAuth();
  const [email, setEmail] = useState('admin@g88.local');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearLoginError();
    try {
      await login({ email: email.trim(), password });
    } catch {
      // error surfaced via loginError
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-muted border">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">G88 Admin</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with an account listed in backend{' '}
            <code className="text-xs">ADMIN_USER_IDS</code>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-6 space-y-4 shadow-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {loginError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {loginError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          API: {import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}
        </p>
      </div>
    </div>
  );
}
