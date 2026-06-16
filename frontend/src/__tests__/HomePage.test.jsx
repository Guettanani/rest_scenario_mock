import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';

describe('HomePage', () => {
  it('affiche la page d\'accueil', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Scen-IA/i).length).toBeGreaterThan(0);
  });
});
