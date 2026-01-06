/**
 * CAD Export Service
 *
 * Provides export functionality for CAD formats.
 * Note: True STEP/IGES export requires specialized libraries.
 * This service provides:
 * - STEP-like text format for primitives
 * - DXF export (2D projections)
 * - OBJ with enhanced precision
 * - PLY format (point cloud compatible)
 */

export type CADFormat = 'step' | 'iges' | 'dxf' | 'obj-cad' | 'ply';

export interface CADExportOptions {
    format: CADFormat;
    precision: number;      // Decimal places
    units: 'mm' | 'inch';
    includeMetadata: boolean;
    projection?: '2d-xy' | '2d-xz' | '2d-yz' | '3d';  // For DXF
}

export interface ExportResult {
    success: boolean;
    data?: string | Blob;
    filename?: string;
    error?: string;
    format: CADFormat;
    metadata?: {
        vertexCount: number;
        faceCount: number;
        boundingBox: { min: number[], max: number[] };
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP FILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate STEP file header
 */
const generateSTEPHeader = (filename: string): string => {
    const timestamp = new Date().toISOString().split('T')[0];
    return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ProShot 3D Builder Export'),'2;1');
FILE_NAME('${filename}','${timestamp}',('ProShot'),('3D Builder'),'ProShot CAD Export','ProShot 3D Builder','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
`;
};

/**
 * Generate STEP file footer
 */
const generateSTEPFooter = (): string => {
    return `ENDSEC;
END-ISO-10303-21;
`;
};

/**
 * Convert mesh to STEP format (simplified)
 * Note: This creates a basic STEP representation suitable for import into CAD software
 */
export const generateSTEP = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): string => {
    const precision = options.precision || 6;
    const scale = options.units === 'inch' ? 1 / 25.4 : 1;

    let step = generateSTEPHeader('model.step');
    let entityId = 1;

    // Application context
    step += `#${entityId++}=APPLICATION_CONTEXT('automotive design');\n`;
    step += `#${entityId++}=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#1);\n`;
    step += `#${entityId++}=PRODUCT_CONTEXT('',#1,'mechanical');\n`;
    step += `#${entityId++}=PRODUCT('Part1','ProShot Export Part','',(#3));\n`;
    step += `#${entityId++}=PRODUCT_DEFINITION_FORMATION('','',#4);\n`;
    step += `#${entityId++}=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');\n`;
    step += `#${entityId++}=PRODUCT_DEFINITION('design','',#5,#6);\n`;

    // Geometric representation context
    step += `#${entityId++}=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${entityId}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${entityId + 1},#${entityId + 2},#${entityId + 3}))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'));\n`;
    entityId++;
    step += `#${entityId++}=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#${entityId + 1},'distance_accuracy_value','confusion accuracy');\n`;
    step += `#${entityId++}=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));\n`;
    step += `#${entityId++}=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));\n`;
    step += `#${entityId++}=(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT());\n`;

    // Axis placement for the coordinate system
    step += `#${entityId++}=CARTESIAN_POINT('Origin',(0.,0.,0.));\n`;
    const originId = entityId - 1;
    step += `#${entityId++}=DIRECTION('Z',(0.,0.,1.));\n`;
    const zDirId = entityId - 1;
    step += `#${entityId++}=DIRECTION('X',(1.,0.,0.));\n`;
    const xDirId = entityId - 1;
    step += `#${entityId++}=AXIS2_PLACEMENT_3D('',#${originId},#${zDirId},#${xDirId});\n`;

    // Create vertices as cartesian points
    const pointIds: number[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const x = (vertices[i] * scale).toFixed(precision);
        const y = (vertices[i + 1] * scale).toFixed(precision);
        const z = (vertices[i + 2] * scale).toFixed(precision);
        step += `#${entityId}=CARTESIAN_POINT('',(${x},${y},${z}));\n`;
        pointIds.push(entityId++);
    }

    // Create face geometry (simplified as triangular faces)
    const faceIds: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
        const p1 = pointIds[indices[i]];
        const p2 = pointIds[indices[i + 1]];
        const p3 = pointIds[indices[i + 2]];

        // Polyline for edge
        step += `#${entityId}=POLYLINE('',(#${p1},#${p2},#${p3},#${p1}));\n`;
        const polylineId = entityId++;

        // Trimmed curve (edge)
        step += `#${entityId}=EDGE_CURVE('',#${p1},#${p1},#${polylineId},.T.);\n`;
        faceIds.push(entityId++);
    }

    step += generateSTEPFooter();
    return step;
};

// ═══════════════════════════════════════════════════════════════════════════════
// IGES FILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate IGES file
 */
export const generateIGES = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): string => {
    const precision = options.precision || 6;
    const scale = options.units === 'inch' ? 1 / 25.4 : 1;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

    // IGES has specific line format: 80 chars with section identifier at position 73
    let startSection = '';
    let globalSection = '';
    let directorySection = '';
    let parameterSection = '';

    // Start Section
    startSection += formatIGESLine('ProShot 3D Builder IGES Export', 'S', 1);
    startSection += formatIGESLine('Generated: ' + new Date().toISOString(), 'S', 2);

    // Global Section
    const globalParams = [
        '1H,',              // Parameter delimiter
        '1H;',              // Record delimiter
        '11HProShot.igs',   // Sending system ID
        '19HProShot 3D Builder', // Filename
        '7HProShot',        // Preprocessor version
        '32',               // Integer bits
        '38',               // Single precision magnitude
        '6',                // Single precision significance
        '308',              // Double precision magnitude
        '15',               // Double precision significance
        '11HProShot.igs',   // Product ID
        '1.0',              // Model space scale
        '6',                // Units flag (6=mm)
        '2HMM',             // Units name
        '1',                // Max line weight gradations
        '0.0',              // Width of max line weight
        timestamp,          // Date and time
        '1.0E-06',          // Min resolution
        '0.0',              // Approximate max coordinate
        '7HUnknown',        // Author name
        '7HProShot',        // Organization
        '11',               // IGES version
        '0',                // Drafting standard
        timestamp + ';'     // Date
    ].join(',');

    globalSection += formatIGESLine(globalParams, 'G', 1);

    // Directory and Parameter sections for vertices as points
    let paramLine = 1;
    let dirLine = 1;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = (vertices[i] * scale).toFixed(precision);
        const y = (vertices[i + 1] * scale).toFixed(precision);
        const z = (vertices[i + 2] * scale).toFixed(precision);

        // Type 116 = Point entity
        directorySection += formatIGESDirectory(116, paramLine, 1, 0, 0, 0, 0, 0, 0, dirLine++);
        directorySection += formatIGESDirectory(0, 0, 0, 1, 0, 0, 0, 0, 0, dirLine++);

        parameterSection += formatIGESLine(`116,${x},${y},${z};`, 'P', paramLine++);
    }

    // Terminate section
    const terminateSection = formatIGESLine(
        `S      2G      1D${String(dirLine - 1).padStart(7)}P${String(paramLine - 1).padStart(7)}`,
        'T', 1
    );

    return startSection + globalSection + directorySection + parameterSection + terminateSection;
};

/**
 * Format IGES line to 80 characters with section identifier
 */
const formatIGESLine = (content: string, section: string, lineNum: number): string => {
    const numStr = String(lineNum).padStart(7);
    const padded = content.padEnd(72);
    return padded.slice(0, 72) + section + numStr + '\n';
};

/**
 * Format IGES directory entry
 */
const formatIGESDirectory = (
    type: number, param: number, structure: number,
    lineFontPattern: number, level: number, view: number,
    transformMatrix: number, labelDisplay: number,
    status: number, lineNum: number
): string => {
    const fields = [
        String(type).padStart(8),
        String(param).padStart(8),
        String(structure).padStart(8),
        String(lineFontPattern).padStart(8),
        String(level).padStart(8),
        String(view).padStart(8),
        String(transformMatrix).padStart(8),
        String(labelDisplay).padStart(8),
        String(status).padStart(8)
    ].join('');
    return fields.slice(0, 72) + 'D' + String(lineNum).padStart(7) + '\n';
};

// ═══════════════════════════════════════════════════════════════════════════════
// DXF FILE GENERATION (2D)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate DXF file (2D projection)
 */
export const generateDXF = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): string => {
    const precision = options.precision || 4;
    const scale = options.units === 'inch' ? 1 / 25.4 : 1;
    const projection = options.projection || '2d-xy';

    let dxf = '';

    // Header section
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1015\n';  // AutoCAD 2000 format
    dxf += '9\n$INSUNITS\n70\n4\n';      // 4 = millimeters
    dxf += '0\nENDSEC\n';

    // Tables section (layer definition)
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n1\n';
    dxf += '0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    // Entities section
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Project 3D edges to 2D
    const getProjectedCoords = (x: number, y: number, z: number): [number, number] => {
        switch (projection) {
            case '2d-xy': return [x, y];
            case '2d-xz': return [x, z];
            case '2d-yz': return [y, z];
            default: return [x, y];
        }
    };

    // Draw edges as lines
    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const points = [
            getProjectedCoords(vertices[i0] * scale, vertices[i0 + 1] * scale, vertices[i0 + 2] * scale),
            getProjectedCoords(vertices[i1] * scale, vertices[i1 + 1] * scale, vertices[i1 + 2] * scale),
            getProjectedCoords(vertices[i2] * scale, vertices[i2 + 1] * scale, vertices[i2 + 2] * scale)
        ];

        // Draw triangle edges
        for (let j = 0; j < 3; j++) {
            const p1 = points[j];
            const p2 = points[(j + 1) % 3];

            dxf += '0\nLINE\n8\n0\n';  // Layer 0
            dxf += `10\n${p1[0].toFixed(precision)}\n`;
            dxf += `20\n${p1[1].toFixed(precision)}\n`;
            dxf += `30\n0\n`;
            dxf += `11\n${p2[0].toFixed(precision)}\n`;
            dxf += `21\n${p2[1].toFixed(precision)}\n`;
            dxf += `31\n0\n`;
        }
    }

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLY FILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate PLY file (ASCII)
 */
export const generatePLY = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): string => {
    const precision = options.precision || 6;
    const scale = options.units === 'inch' ? 1 / 25.4 : 1;

    const vertexCount = vertices.length / 3;
    const faceCount = indices.length / 3;

    let ply = 'ply\n';
    ply += 'format ascii 1.0\n';
    ply += `comment ProShot 3D Builder Export\n`;
    ply += `comment Generated: ${new Date().toISOString()}\n`;
    ply += `element vertex ${vertexCount}\n`;
    ply += 'property float x\n';
    ply += 'property float y\n';
    ply += 'property float z\n';
    ply += `element face ${faceCount}\n`;
    ply += 'property list uchar int vertex_indices\n';
    ply += 'end_header\n';

    // Vertices
    for (let i = 0; i < vertices.length; i += 3) {
        const x = (vertices[i] * scale).toFixed(precision);
        const y = (vertices[i + 1] * scale).toFixed(precision);
        const z = (vertices[i + 2] * scale).toFixed(precision);
        ply += `${x} ${y} ${z}\n`;
    }

    // Faces
    for (let i = 0; i < indices.length; i += 3) {
        ply += `3 ${indices[i]} ${indices[i + 1]} ${indices[i + 2]}\n`;
    }

    return ply;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED OBJ EXPORT (CAD precision)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate OBJ with CAD-level precision
 */
export const generateOBJCAD = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): string => {
    const precision = options.precision || 8;
    const scale = options.units === 'inch' ? 1 / 25.4 : 1;

    let obj = '# ProShot 3D Builder CAD Export\n';
    obj += `# Generated: ${new Date().toISOString()}\n`;
    obj += `# Units: ${options.units}\n`;
    obj += `# Precision: ${precision} decimal places\n\n`;

    // Vertices with high precision
    for (let i = 0; i < vertices.length; i += 3) {
        const x = (vertices[i] * scale).toFixed(precision);
        const y = (vertices[i + 1] * scale).toFixed(precision);
        const z = (vertices[i + 2] * scale).toFixed(precision);
        obj += `v ${x} ${y} ${z}\n`;
    }

    obj += '\n# Faces\n';

    // Faces (OBJ uses 1-based indexing)
    for (let i = 0; i < indices.length; i += 3) {
        obj += `f ${indices[i] + 1} ${indices[i + 1] + 1} ${indices[i + 2] + 1}\n`;
    }

    return obj;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export mesh to CAD format
 */
export const exportToCAD = (
    vertices: Float32Array,
    indices: Uint32Array | Uint16Array,
    options: CADExportOptions
): ExportResult => {
    try {
        let data: string;
        let extension: string;

        switch (options.format) {
            case 'step':
                data = generateSTEP(vertices, indices, options);
                extension = 'step';
                break;
            case 'iges':
                data = generateIGES(vertices, indices, options);
                extension = 'igs';
                break;
            case 'dxf':
                data = generateDXF(vertices, indices, options);
                extension = 'dxf';
                break;
            case 'ply':
                data = generatePLY(vertices, indices, options);
                extension = 'ply';
                break;
            case 'obj-cad':
            default:
                data = generateOBJCAD(vertices, indices, options);
                extension = 'obj';
                break;
        }

        // Calculate bounding box
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < vertices.length; i += 3) {
            minX = Math.min(minX, vertices[i]);
            minY = Math.min(minY, vertices[i + 1]);
            minZ = Math.min(minZ, vertices[i + 2]);
            maxX = Math.max(maxX, vertices[i]);
            maxY = Math.max(maxY, vertices[i + 1]);
            maxZ = Math.max(maxZ, vertices[i + 2]);
        }

        return {
            success: true,
            data,
            filename: `model.${extension}`,
            format: options.format,
            metadata: {
                vertexCount: vertices.length / 3,
                faceCount: indices.length / 3,
                boundingBox: {
                    min: [minX, minY, minZ],
                    max: [maxX, maxY, maxZ]
                }
            }
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            format: options.format
        };
    }
};

/**
 * Get available CAD export formats
 */
export const CAD_FORMATS = [
    {
        id: 'step',
        name: 'STEP',
        extension: '.step',
        description: 'Standard for Exchange of Product Data - CAD industry standard',
        compatibility: 'SolidWorks, Fusion 360, FreeCAD, AutoCAD',
        icon: '📐'
    },
    {
        id: 'iges',
        name: 'IGES',
        extension: '.igs',
        description: 'Initial Graphics Exchange Specification - Legacy CAD format',
        compatibility: 'Most CAD software, CNC machines',
        icon: '📏'
    },
    {
        id: 'dxf',
        name: 'DXF',
        extension: '.dxf',
        description: '2D Drawing Exchange Format - AutoCAD compatible',
        compatibility: 'AutoCAD, laser cutters, CNC routers',
        icon: '✏️'
    },
    {
        id: 'obj-cad',
        name: 'OBJ (CAD)',
        extension: '.obj',
        description: 'High-precision OBJ with CAD-level accuracy',
        compatibility: 'Blender, Maya, most 3D software',
        icon: '🔷'
    },
    {
        id: 'ply',
        name: 'PLY',
        extension: '.ply',
        description: 'Polygon File Format - Point cloud compatible',
        compatibility: '3D scanners, scientific visualization',
        icon: '☁️'
    }
];
