import { render, screen } from '@testing-library/react';
import discoveryService from '../services/discoveryService';

describe('discoveryService', () => {
  it('est défini', () => {
    expect(discoveryService).toBeDefined();
  });
});
