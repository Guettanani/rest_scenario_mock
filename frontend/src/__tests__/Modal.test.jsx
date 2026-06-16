import React from 'react';
import { render, screen } from '@testing-library/react';
import Modal from '../components/Modal';

describe('Modal', () => {
  it('affiche le contenu du modal', () => {
    render(<Modal onClose={() => {}}>Coucou</Modal>);
    expect(screen.getByText(/Coucou/)).toBeInTheDocument();
  });
});
