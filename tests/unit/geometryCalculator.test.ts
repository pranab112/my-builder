import { describe, it, expect } from 'vitest';
import { calculateFilamentCost } from '../../services/geometryCalculator';

describe('calculateFilamentCost', () => {
  it('should calculate weight correctly for PLA at 100% infill', () => {
    // 10cm cube = 1000 cm3
    // Density PLA = 1.24 g/cm3
    // Weight = 1240g
    const result = calculateFilamentCost(10, 10, 10, 'pla', 100);
    expect(result.weight).toBeCloseTo(1240);
  });

  it('should calculate cost correctly', () => {
    // Weight 1240g = 1.24kg
    // Cost $20/kg => $24.8
    const result = calculateFilamentCost(10, 10, 10, 'pla', 100, 20);
    expect(result.cost).toBeCloseTo(24.8);
  });

  it('should account for infill percentage', () => {
    // 1000 cm3 * 20% infill = 200 cm3 solid
    // 200 * 1.24 = 248g
    const result = calculateFilamentCost(10, 10, 10, 'pla', 20);
    expect(result.weight).toBeCloseTo(248);
  });

  it('should handle different materials (ABS)', () => {
    // Density ABS = 1.04 g/cm3
    // 1000 * 1.04 = 1040g
    const result = calculateFilamentCost(10, 10, 10, 'abs', 100);
    expect(result.weight).toBeCloseTo(1040);
  });
});
