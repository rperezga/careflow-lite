import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './UsersPage';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get, post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const response = {
  users: [
    {
      id: 'u1',
      name: 'Nina Nurse',
      email: 'nina@example.com',
      role: 'staff',
      active: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

describe('UsersPage', () => {
  beforeEach(() => get.mockReset());

  it('renders users with an Add button', async () => {
    get.mockResolvedValue(response);
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nina Nurse')).toBeInTheDocument();
    expect(screen.getByText('nina@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });
});
