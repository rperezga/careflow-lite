import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, login, logout: vi.fn() }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => login.mockReset());

  it('renders the fields and the synthetic-data disclaimer', () => {
    renderLogin();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText(/not HIPAA-compliant/i)).toBeInTheDocument();
  });

  it('submits the entered credentials', async () => {
    login.mockResolvedValueOnce(undefined);
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin@example.com', 'secret123'));
  });

  it('shows an error when login fails', async () => {
    login.mockRejectedValueOnce(new Error('nope'));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
