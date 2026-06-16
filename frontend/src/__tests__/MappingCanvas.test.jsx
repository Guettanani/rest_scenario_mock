import React from 'react';
import { render, screen } from '@testing-library/react';
import MappingCanvas from '../components/MappingCanvas';

describe('MappingCanvas', () => {
  it('rend sans crash', () => {
    render(<MappingCanvas />);
  });
});
