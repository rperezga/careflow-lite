import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge color="red">High</Badge>);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
