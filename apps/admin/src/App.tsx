import { useState } from 'react';
import QueuePage from '@/pages/QueuePage';
import ContentReportsPage from '@/pages/ContentReportsPage';
import PersonalLabelsPage from '@/pages/PersonalLabelsPage';
import { AdminLayout } from '@/layout/AdminLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Admin shell. Auth gate → ID verification queue.
 * Add react-router when dashboard / more pages land.
 */
export default function App() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'verification' | 'reports' | 'personal-labels'>('verification');
  const personalLabelsEnabled = import.meta.env.VITE_PERSONAL_LABELS_UI === 'true';

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AdminLayout>
      <nav aria-label="Admin workspaces" className="flex gap-3 border-b px-4 sm:px-6 py-3">
        <button type="button" aria-current={tab === 'verification' ? 'page' : undefined}
          className={tab === 'verification' ? 'font-bold underline' : 'text-muted-foreground'}
          onClick={() => setTab('verification')}>ID Verification</button>
        <button type="button" aria-current={tab === 'reports' ? 'page' : undefined}
          className={tab === 'reports' ? 'font-bold underline' : 'text-muted-foreground'}
          onClick={() => setTab('reports')}>Safety Reports</button>
      </nav>
      {tab === 'verification' ? <QueuePage /> : tab === 'personal-labels' && personalLabelsEnabled ? <PersonalLabelsPage /> : <ContentReportsPage />}
    </AdminLayout>
  );
}
