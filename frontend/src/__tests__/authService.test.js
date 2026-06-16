import { render, screen } from '@testing-library/react';
import authService from '../services/authService';

describe('authService', () => {
  it('est défini', () => {
    expect(authService).toBeDefined();
  });
});
