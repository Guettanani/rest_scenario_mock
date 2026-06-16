import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import { AuthProvider } from '../context/AuthContext';

describe('Layout', () => {
  it('affiche le layout principal', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Layout />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Scen-IA/)).toBeInTheDocument();
  });
});
