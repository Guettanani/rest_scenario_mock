import { render, screen } from '@testing-library/react';
import monitoringService from '../services/monitoringService';

describe('monitoringService', () => {
  it('est défini', () => {
    expect(monitoringService).toBeDefined();
  });
});
