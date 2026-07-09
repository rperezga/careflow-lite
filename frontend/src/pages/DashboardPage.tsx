import { useAuth } from '../auth/AuthContext';
import { ComingSoon, PageHeader } from './PagePlaceholder';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.name ?? ''}.`} />
      <ComingSoon issue="#9" />
    </div>
  );
}
