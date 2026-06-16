import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';

describe('LoginPage', () => {
  it('affiche le formulaire de connexion', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/connexion/i)).toBeInTheDocument();
  });
});
