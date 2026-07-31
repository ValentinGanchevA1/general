import QueuePage from '@/pages/QueuePage';
import { AdminLayout } from '@/layout/AdminLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Admin shell. Auth gate → ID verification queue.
 * Add react-router when dashboard / more pages land.
 */
export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AdminLayout>
      <QueuePage />
    </AdminLayout>
  );
}
