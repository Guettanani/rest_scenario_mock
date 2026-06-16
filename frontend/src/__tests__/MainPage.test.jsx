import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MainPage from '../pages/MainPage';
import { AuthProvider } from '../context/AuthContext';

describe('MainPage', () => {
  it('affiche le titre de la page', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <MainPage />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Paramétrer un scénario/i)).toBeInTheDocument();
  });
});
