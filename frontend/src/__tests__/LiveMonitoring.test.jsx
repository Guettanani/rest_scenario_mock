import React from 'react';
import { render, screen } from '@testing-library/react';
import LiveMonitoring from '../components/LiveMonitoring';

describe('LiveMonitoring', () => {
  it('rend sans crash', () => {
    render(<LiveMonitoring />);
  });
});
