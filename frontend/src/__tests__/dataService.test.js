import { render, screen } from '@testing-library/react';
import dataService from '../services/dataService';

describe('dataService', () => {
  it('est défini', () => {
    expect(dataService).toBeDefined();
  });
});
