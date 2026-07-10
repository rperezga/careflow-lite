import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientsPage from './PatientsPage';

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

const response = {
  patients: [
    {
      id: 'p1',
      firstName: 'Ana',
      lastName: 'Gomez',
      memberId: 'DEMO-10023',
      status: 'active',
      riskLevel: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsPage />
    </MemoryRouter>,
  );
}

describe('PatientsPage', () => {
  beforeEach(() => get.mockReset());

  it('renders patients from the API with an Add button for admins', async () => {
    get.mockResolvedValue(response);
    renderPage();
    expect(await screen.findByText('Ana Gomez')).toBeInTheDocument();
    expect(screen.getByText('DEMO-10023')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add patient/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no matches', async () => {
    get.mockResolvedValue({ patients: [], total: 0, page: 1, limit: 10 });
    renderPage();
    expect(await screen.findByText(/no patients match your filters/i)).toBeInTheDocument();
  });
});
