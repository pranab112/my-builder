
export type MaterialType = 'pla' | 'petg' | 'abs' | 'tpu';

export interface FilamentCostResult {
  weight: number;
  cost: number;
}

/**
 * Calculates the estimated weight and cost of a 3D print based on bounding box and material.
 * @param width Width in cm (or relative units converted to cm)
 * @param height Height in cm
 * @param depth Depth in cm
 * @param materialType Material density type
 * @param infillPercentage Percentage of infill (0-100)
 * @param costPerKg Cost of filament per kg (default $20)
 */
export const calculateFilamentCost = (
  width: number,
  height: number,
  depth: number,
  materialType: MaterialType,
  infillPercentage: number,
  costPerKg: number = 20
): FilamentCostResult => {
  // Volume in cubic cm (assuming input is relevant scale, usually imported as units)
  // In a real app, unit conversion logic would happen here.
  const volCm3 = width * height * depth;
  
  const densities: Record<MaterialType, number> = { 
    pla: 1.24, 
    petg: 1.27, 
    abs: 1.04, 
    tpu: 1.21 
  };
  
  const density = densities[materialType] || 1.24;
  
  // Approximation: Solid volume based on infill
  // A perfect solid is 100%. 
  const solidVolume = volCm3 * (infillPercentage / 100);
  
  const weight = solidVolume * density; // grams
  const cost = (weight / 1000) * costPerKg; // dollars
  
  return { weight, cost };
};
