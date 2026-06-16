import React from 'react';
import { render, screen } from '@testing-library/react';
import DatabaseModelCanvas from '../components/DatabaseModelCanvas';

describe('DatabaseModelCanvas', () => {
  it('rend sans crash', () => {
    render(<DatabaseModelCanvas />);
  });
});
