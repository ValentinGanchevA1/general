import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { LogOut } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Minimal shell. Sidebar can land later; queue is full-width for review speed.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold tracking-tight truncate">G88 Admin</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              ID verification
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            {user && (
              <span className="text-xs text-muted-foreground truncate max-w-[40vw]">
                {user.email}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => void logout()}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
