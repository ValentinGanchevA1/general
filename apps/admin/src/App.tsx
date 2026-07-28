import QueuePage from '@/pages/QueuePage';
import { AdminLayout } from '@/layout/AdminLayout';

/**
 * Admin shell. Single route for now: ID verification queue.
 * Add react-router when dashboard / more pages land.
 */
export default function App() {
  return (
    <AdminLayout>
      <QueuePage />
    </AdminLayout>
  );
}
