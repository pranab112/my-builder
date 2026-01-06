/**
 * Scene Context Service
 *
 * Captures the current Three.js scene state to:
 * - Inform AI about existing objects
 * - Prevent overlap/collision in new generations
 * - Maintain material consistency
 * - Enable intelligent spatial placement
 */

export interface SceneObject {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  visible: boolean;
  geometry?: {
    type: string;
    parameters?: Record<string, number>;
  };
  material?: {
    type: string;
    color?: string;
    metalness?: number;
    roughness?: number;
  };
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

export interface SceneContext {
  objects: SceneObject[];
  totalObjectCount: number;
  occupiedVolume: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  dominantMaterial?: {
    color: string;
    metalness: number;
    roughness: number;
  };
  suggestedPlacement: {
    position: { x: number; y: number; z: number };
    reason: string;
  };
}

/**
 * Build scene context from scene graph data
 */
export const buildSceneContext = (
  sceneGraph: Array<{
    id: string;
    name: string;
    type: string;
    visible: boolean;
    selected: boolean;
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
  }>
): SceneContext | null => {
  // Filter out non-mesh objects (lights, cameras, helpers)
  const meshObjects = sceneGraph.filter(obj =>
    obj.type === 'Mesh' || obj.type === 'Group' || obj.type.includes('Mesh')
  );

  if (meshObjects.length === 0) {
    return null;  // No scene context if no objects
  }

  // Build object list
  const objects: SceneObject[] = meshObjects.map(obj => ({
    id: obj.id,
    name: obj.name || 'Unnamed',
    type: obj.type,
    position: obj.position || { x: 0, y: 0, z: 0 },
    scale: obj.scale || { x: 1, y: 1, z: 1 },
    visible: obj.visible
  }));

  // Calculate occupied volume (bounding box of all objects)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  objects.forEach(obj => {
    // Estimate bounds based on position (rough estimate without actual geometry)
    const estimatedSize = 2;  // Default size estimate
    minX = Math.min(minX, obj.position.x - estimatedSize * obj.scale.x);
    minY = Math.min(minY, obj.position.y - estimatedSize * obj.scale.y);
    minZ = Math.min(minZ, obj.position.z - estimatedSize * obj.scale.z);
    maxX = Math.max(maxX, obj.position.x + estimatedSize * obj.scale.x);
    maxY = Math.max(maxY, obj.position.y + estimatedSize * obj.scale.y);
    maxZ = Math.max(maxZ, obj.position.z + estimatedSize * obj.scale.z);
  });

  // Calculate suggested placement for new object
  const suggestedPlacement = calculateSuggestedPlacement(objects, { minX, minY, minZ, maxX, maxY, maxZ });

  return {
    objects,
    totalObjectCount: objects.length,
    occupiedVolume: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    },
    suggestedPlacement
  };
};

/**
 * Calculate suggested placement for a new object to avoid overlap
 */
const calculateSuggestedPlacement = (
  objects: SceneObject[],
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
): { position: { x: number; y: number; z: number }; reason: string } => {
  if (objects.length === 0) {
    return {
      position: { x: 0, y: 1, z: 0 },
      reason: 'Center of scene (empty scene)'
    };
  }

  // Try positions around the existing objects
  const candidatePositions = [
    { x: bounds.maxX + 3, y: 1, z: 0, reason: 'Right of existing objects' },
    { x: bounds.minX - 3, y: 1, z: 0, reason: 'Left of existing objects' },
    { x: 0, y: 1, z: bounds.maxZ + 3, reason: 'In front of existing objects' },
    { x: 0, y: 1, z: bounds.minZ - 3, reason: 'Behind existing objects' },
    { x: 0, y: bounds.maxY + 2, z: 0, reason: 'Above existing objects' }
  ];

  // Find position with most clearance
  let bestPosition = candidatePositions[0];
  let bestDistance = 0;

  candidatePositions.forEach(candidate => {
    const minDist = objects.reduce((min, obj) => {
      const dist = Math.sqrt(
        Math.pow(candidate.x - obj.position.x, 2) +
        Math.pow(candidate.y - obj.position.y, 2) +
        Math.pow(candidate.z - obj.position.z, 2)
      );
      return Math.min(min, dist);
    }, Infinity);

    if (minDist > bestDistance) {
      bestDistance = minDist;
      bestPosition = candidate;
    }
  });

  return {
    position: { x: bestPosition.x, y: bestPosition.y, z: bestPosition.z },
    reason: bestPosition.reason
  };
};

/**
 * Build context string for AI prompt injection
 */
export const buildSceneContextForPrompt = (context: SceneContext | null): string => {
  if (!context || context.totalObjectCount === 0) {
    return '';  // No context to inject
  }

  let prompt = '\n\n═══════════════════════════════════════════════════════════════════════════════\n';
  prompt += 'CURRENT SCENE STATE (Modify/extend this - DO NOT recreate from scratch):\n';
  prompt += '═══════════════════════════════════════════════════════════════════════════════\n';

  // List existing objects
  prompt += `\nEXISTING OBJECTS (${context.totalObjectCount}):\n`;
  context.objects.forEach((obj, i) => {
    prompt += `  ${i + 1}. "${obj.name}" (${obj.type})\n`;
    prompt += `     Position: (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})\n`;
    if (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1) {
      prompt += `     Scale: (${obj.scale.x.toFixed(1)}, ${obj.scale.y.toFixed(1)}, ${obj.scale.z.toFixed(1)})\n`;
    }
  });

  // Occupied volume
  prompt += `\nOCCUPIED SPACE:\n`;
  prompt += `  X: ${context.occupiedVolume.min.x.toFixed(1)} to ${context.occupiedVolume.max.x.toFixed(1)}\n`;
  prompt += `  Y: ${context.occupiedVolume.min.y.toFixed(1)} to ${context.occupiedVolume.max.y.toFixed(1)}\n`;
  prompt += `  Z: ${context.occupiedVolume.min.z.toFixed(1)} to ${context.occupiedVolume.max.z.toFixed(1)}\n`;

  // Suggested placement
  prompt += `\nSUGGESTED PLACEMENT FOR NEW OBJECT:\n`;
  prompt += `  Position: (${context.suggestedPlacement.position.x.toFixed(1)}, ${context.suggestedPlacement.position.y.toFixed(1)}, ${context.suggestedPlacement.position.z.toFixed(1)})\n`;
  prompt += `  Reason: ${context.suggestedPlacement.reason}\n`;

  // Guidelines
  prompt += `\nGUIDELINES:\n`;
  prompt += `  - DO NOT recreate existing objects - they're already in the scene\n`;
  prompt += `  - Place new objects to avoid overlap with existing ones\n`;
  prompt += `  - Maintain consistent scale with existing objects\n`;
  prompt += `  - Use compatible materials for visual consistency\n`;

  prompt += '\n═══════════════════════════════════════════════════════════════════════════════\n';

  return prompt;
};
