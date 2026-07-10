import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CareTasksPage from './CareTasksPage';

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

const tasksResponse = {
  tasks: [
    {
      id: 't1',
      patient: 'p1',
      title: 'Call patient',
      category: 'follow_up',
      priority: 'high',
      status: 'open',
      createdBy: 'u1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 100,
};
const directory = { users: [{ id: 'u1', name: 'Nina Nurse', email: 'n@x.co', role: 'staff' }] };
const patientsResponse = {
  patients: [
    {
      id: 'p1',
      firstName: 'Ana',
      lastName: 'Gomez',
      memberId: 'DEMO-1',
      status: 'active',
      riskLevel: 'low',
      createdAt: '',
      updatedAt: '',
    },
  ],
  total: 1,
  page: 1,
  limit: 100,
};

describe('CareTasksPage', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((path: string) => {
      if (path.startsWith('/care-tasks')) return Promise.resolve(tasksResponse);
      if (path.startsWith('/directory')) return Promise.resolve(directory);
      if (path.startsWith('/patients')) return Promise.resolve(patientsResponse);
      return Promise.resolve({});
    });
  });

  it('renders the board with a task and a New task button for admins', async () => {
    render(
      <MemoryRouter>
        <CareTasksPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Call patient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
  });
});
