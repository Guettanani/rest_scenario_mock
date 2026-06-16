import React from 'react';
import { render, screen } from '@testing-library/react';
import QrCodeLoader from '../components/QrCodeLoader';

describe('QrCodeLoader', () => {
  it('affiche le loader de QR code', () => {
    render(<QrCodeLoader src="test.png" duration={1000} pixelSize={8} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
