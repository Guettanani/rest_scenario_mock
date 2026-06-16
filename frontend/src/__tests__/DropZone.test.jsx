import React from 'react';
import { render, screen } from '@testing-library/react';
import DropZone from '../components/DropZone';

describe('DropZone', () => {
  it('affiche le titre d\'import', () => {
    render(<DropZone onDrop={() => {}} type="source" acceptedTypes={{}} title="Importer" description="desc" />);
    expect(screen.getByText(/Importer/)).toBeInTheDocument();
  });
});
