import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get, post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Ada Admin', email: 'a@b.co', role: 'admin' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const summary = {
  generatedAt: new Date().toISOString(),
  patients: {
    total: 42,
    byRisk: { low: 20, medium: 15, high: 7 },
    byStatus: { active: 40, inactive: 2 },
  },
  tasks: {
    total: 30,
    byStatus: { open: 12, in_progress: 6, blocked: 2, done: 8, cancelled: 2 },
    byPriority: { urgent: 4, high: 6, medium: 12, low: 8 },
    overdue: 5,
    unassigned: 3,
  },
  recentActivity: [
    {
      id: 'a1',
      action: 'patient.create',
      entityType: 'patient',
      summary: 'Created patient DEMO-10023',
      actor: 'u1',
      createdAt: new Date().toISOString(),
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => get.mockReset());

  it('renders aggregated stats and recent activity', async () => {
    get.mockResolvedValueOnce(summary);
    renderDashboard();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Overdue tasks')).toBeInTheDocument();
    expect(screen.getByText('Created patient DEMO-10023')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    get.mockRejectedValueOnce(new Error('boom'));
    renderDashboard();
    expect(await screen.findByText(/could not load the dashboard/i)).toBeInTheDocument();
  });
});
