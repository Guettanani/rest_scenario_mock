import React from 'react';
import { render, screen } from '@testing-library/react';
import KeepAliveOutlet from '../components/KeepAliveOutlet';

describe('KeepAliveOutlet', () => {
  it('rend sans crash', () => {
    render(<KeepAliveOutlet />);
    // Pas d'assertion spécifique car ce composant dépend du router
  });
});
