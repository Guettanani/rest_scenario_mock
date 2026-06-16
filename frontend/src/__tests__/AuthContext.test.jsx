import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';

describe('AuthContext', () => {
  it('fournit le contexte sans crash', () => {
    render(<AuthProvider><div>Test</div></AuthProvider>);
    expect(screen.getByText(/Test/)).toBeInTheDocument();
  });
});
