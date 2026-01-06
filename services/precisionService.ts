/**
 * Precision Service
 *
 * Provides dimension constraints, unit conversion, and precision editing
 * for 3D print-ready workflows.
 */

export type UnitSystem = 'mm' | 'inch';

export interface Dimensions {
    width: number;
    height: number;
    depth: number;
    unit: UnitSystem;
}

export interface DimensionConstraint {
    axis: 'x' | 'y' | 'z';
    value: number;
    unit: UnitSystem;
    locked: boolean;
}

// Conversion factors (base unit is meters in Three.js)
// We'll treat 1 Three.js unit = 1mm for precision workflows
const UNIT_TO_MM = {
    mm: 1,
    inch: 25.4
};

const MM_TO_UNIT = {
    mm: 1,
    inch: 1 / 25.4
};

/**
 * Convert value between unit systems
 */
export const convertUnits = (
    value: number,
    from: UnitSystem,
    to: UnitSystem
): number => {
    if (from === to) return value;

    // Convert to mm first, then to target
    const mm = value * UNIT_TO_MM[from];
    return mm * MM_TO_UNIT[to];
};

/**
 * Format dimension for display with appropriate precision
 */
export const formatDimension = (
    value: number,
    unit: UnitSystem,
    precision: number = 2
): string => {
    return `${value.toFixed(precision)} ${unit}`;
};

/**
 * Parse dimension string to number (handles units)
 */
export const parseDimension = (
    input: string,
    defaultUnit: UnitSystem = 'mm'
): { value: number; unit: UnitSystem } | null => {
    // Remove whitespace
    const cleaned = input.trim().toLowerCase();

    // Try to match number with optional unit
    const match = cleaned.match(/^([\d.]+)\s*(mm|in|inch|"|cm|m)?$/);

    if (!match) return null;

    let value = parseFloat(match[1]);
    let unit: UnitSystem = defaultUnit;

    if (match[2]) {
        switch (match[2]) {
            case 'mm':
                unit = 'mm';
                break;
            case 'in':
            case 'inch':
            case '"':
                unit = 'inch';
                break;
            case 'cm':
                value *= 10; // Convert to mm
                unit = 'mm';
                break;
            case 'm':
                value *= 1000; // Convert to mm
                unit = 'mm';
                break;
        }
    }

    return { value, unit };
};

/**
 * Calculate scale factor to achieve target dimension
 */
export const calculateScaleFactor = (
    currentDimension: number,
    targetDimension: number
): number => {
    if (currentDimension === 0) return 1;
    return targetDimension / currentDimension;
};

/**
 * Calculate new dimensions when scaling uniformly
 */
export const scaleUniformly = (
    dimensions: Dimensions,
    scaleFactor: number
): Dimensions => {
    return {
        width: dimensions.width * scaleFactor,
        height: dimensions.height * scaleFactor,
        depth: dimensions.depth * scaleFactor,
        unit: dimensions.unit
    };
};

/**
 * Calculate scale needed to fit within max dimensions (for 3D printing)
 */
export const scaleToFit = (
    dimensions: Dimensions,
    maxDimensions: Dimensions
): { scale: number; fits: boolean } => {
    // Convert max to same unit system
    const maxWidth = convertUnits(maxDimensions.width, maxDimensions.unit, dimensions.unit);
    const maxHeight = convertUnits(maxDimensions.height, maxDimensions.unit, dimensions.unit);
    const maxDepth = convertUnits(maxDimensions.depth, maxDimensions.unit, dimensions.unit);

    const scaleX = maxWidth / dimensions.width;
    const scaleY = maxHeight / dimensions.height;
    const scaleZ = maxDepth / dimensions.depth;

    const minScale = Math.min(scaleX, scaleY, scaleZ);

    return {
        scale: minScale,
        fits: minScale >= 1
    };
};

/**
 * Printer bed presets (in mm)
 */
export const PRINTER_PRESETS = {
    ender3: { name: 'Ender 3', width: 220, height: 250, depth: 220 },
    ender3v2: { name: 'Ender 3 V2', width: 220, height: 250, depth: 220 },
    prusa_mk3s: { name: 'Prusa MK3S+', width: 250, height: 210, depth: 210 },
    prusa_mini: { name: 'Prusa Mini', width: 180, height: 180, depth: 180 },
    bambu_x1: { name: 'Bambu X1', width: 256, height: 256, depth: 256 },
    bambu_p1s: { name: 'Bambu P1S', width: 256, height: 256, depth: 256 },
    bambu_a1: { name: 'Bambu A1', width: 256, height: 256, depth: 256 },
    cr10: { name: 'CR-10', width: 300, height: 400, depth: 300 },
    voron_2_4: { name: 'Voron 2.4 350', width: 350, height: 340, depth: 350 },
    custom: { name: 'Custom', width: 200, height: 200, depth: 200 }
};

/**
 * Validate dimensions against printer bed
 */
export const validateForPrinter = (
    dimensions: Dimensions,
    printerPreset: keyof typeof PRINTER_PRESETS
): {
    valid: boolean;
    warnings: string[];
    scaleSuggestion?: number;
} => {
    const printer = PRINTER_PRESETS[printerPreset];
    const warnings: string[] = [];

    // Convert dimensions to mm
    const widthMm = convertUnits(dimensions.width, dimensions.unit, 'mm');
    const heightMm = convertUnits(dimensions.height, dimensions.unit, 'mm');
    const depthMm = convertUnits(dimensions.depth, dimensions.unit, 'mm');

    let valid = true;

    if (widthMm > printer.width) {
        valid = false;
        warnings.push(`Width (${widthMm.toFixed(1)}mm) exceeds ${printer.name} bed (${printer.width}mm)`);
    }

    if (heightMm > printer.height) {
        valid = false;
        warnings.push(`Height (${heightMm.toFixed(1)}mm) exceeds ${printer.name} max height (${printer.height}mm)`);
    }

    if (depthMm > printer.depth) {
        valid = false;
        warnings.push(`Depth (${depthMm.toFixed(1)}mm) exceeds ${printer.name} bed (${printer.depth}mm)`);
    }

    // Calculate suggested scale if doesn't fit
    let scaleSuggestion: number | undefined;
    if (!valid) {
        const scaleX = printer.width / widthMm;
        const scaleY = printer.height / heightMm;
        const scaleZ = printer.depth / depthMm;
        scaleSuggestion = Math.min(scaleX, scaleY, scaleZ) * 0.95; // 5% margin
    }

    return { valid, warnings, scaleSuggestion };
};

/**
 * Round to nearest precision step
 */
export const roundToPrecision = (value: number, step: number): number => {
    return Math.round(value / step) * step;
};

/**
 * Common precision steps
 */
export const PRECISION_STEPS = {
    mm: [0.01, 0.1, 0.5, 1, 5, 10],
    inch: [0.001, 0.01, 0.0625, 0.125, 0.25, 0.5, 1] // Include fractional inches
};

/**
 * Get dimension from Three.js bounding box
 * Three.js units are treated as mm in precision mode
 */
export const getDimensionsFromBounds = (
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number },
    targetUnit: UnitSystem = 'mm'
): Dimensions => {
    const widthMm = Math.abs(max.x - min.x);
    const heightMm = Math.abs(max.y - min.y);
    const depthMm = Math.abs(max.z - min.z);

    return {
        width: convertUnits(widthMm, 'mm', targetUnit),
        height: convertUnits(heightMm, 'mm', targetUnit),
        depth: convertUnits(depthMm, 'mm', targetUnit),
        unit: targetUnit
    };
};
