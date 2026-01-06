/**
 * Base Mesh Service
 *
 * Provides pre-built base mesh templates for character and object creation.
 * These serve as starting points for modeling various entities.
 */

export interface BaseMeshPreset {
    id: string;
    name: string;
    description: string;
    category: 'character' | 'creature' | 'vehicle' | 'furniture' | 'organic' | 'mechanical';
    subcategory: string;
    icon: string;
    complexity: 'low' | 'medium' | 'high';
    polyCount: string;
    tags: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE MESH PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const BASE_MESH_PRESETS: BaseMeshPreset[] = [
    // CHARACTER - HUMANOID
    {
        id: 'human-male-base',
        name: 'Human Male Base',
        description: 'Standard male humanoid base mesh with good topology for sculpting',
        category: 'character',
        subcategory: 'humanoid',
        icon: '🧍‍♂️',
        complexity: 'medium',
        polyCount: '~5K',
        tags: ['human', 'male', 'body', 'character']
    },
    {
        id: 'human-female-base',
        name: 'Human Female Base',
        description: 'Standard female humanoid base mesh with animation-ready topology',
        category: 'character',
        subcategory: 'humanoid',
        icon: '🧍‍♀️',
        complexity: 'medium',
        polyCount: '~5K',
        tags: ['human', 'female', 'body', 'character']
    },
    {
        id: 'human-head',
        name: 'Human Head',
        description: 'Detailed head base mesh for portrait sculpting',
        category: 'character',
        subcategory: 'humanoid',
        icon: '🗣️',
        complexity: 'high',
        polyCount: '~8K',
        tags: ['head', 'face', 'portrait', 'sculpt']
    },
    {
        id: 'human-hand',
        name: 'Human Hand',
        description: 'Anatomically correct hand base for detailed work',
        category: 'character',
        subcategory: 'humanoid',
        icon: '✋',
        complexity: 'high',
        polyCount: '~3K',
        tags: ['hand', 'fingers', 'anatomy']
    },
    {
        id: 'chibi-body',
        name: 'Chibi Body',
        description: 'Stylized chibi/cute character base',
        category: 'character',
        subcategory: 'stylized',
        icon: '🎎',
        complexity: 'low',
        polyCount: '~2K',
        tags: ['chibi', 'anime', 'stylized', 'cute']
    },
    {
        id: 'blockout-mannequin',
        name: 'Mannequin Blockout',
        description: 'Simple blockout for quick character posing',
        category: 'character',
        subcategory: 'blockout',
        icon: '🤖',
        complexity: 'low',
        polyCount: '~500',
        tags: ['mannequin', 'blockout', 'posing', 'simple']
    },

    // CREATURES
    {
        id: 'quadruped-base',
        name: 'Quadruped Base',
        description: 'Four-legged creature base (dog/cat scale)',
        category: 'creature',
        subcategory: 'quadruped',
        icon: '🐕',
        complexity: 'medium',
        polyCount: '~4K',
        tags: ['quadruped', 'animal', 'four-legged']
    },
    {
        id: 'dragon-base',
        name: 'Dragon Base',
        description: 'Winged dragon base with proper wing topology',
        category: 'creature',
        subcategory: 'fantasy',
        icon: '🐉',
        complexity: 'high',
        polyCount: '~8K',
        tags: ['dragon', 'fantasy', 'wings', 'creature']
    },
    {
        id: 'bird-base',
        name: 'Bird Base',
        description: 'Generic bird base with wing structure',
        category: 'creature',
        subcategory: 'avian',
        icon: '🦅',
        complexity: 'medium',
        polyCount: '~3K',
        tags: ['bird', 'wings', 'avian', 'flying']
    },
    {
        id: 'fish-base',
        name: 'Fish Base',
        description: 'Streamlined fish base with fin topology',
        category: 'creature',
        subcategory: 'aquatic',
        icon: '🐟',
        complexity: 'low',
        polyCount: '~2K',
        tags: ['fish', 'aquatic', 'sea', 'marine']
    },
    {
        id: 'insect-base',
        name: 'Insect Base',
        description: 'Six-legged insect base with segmented body',
        category: 'creature',
        subcategory: 'insect',
        icon: '🐜',
        complexity: 'medium',
        polyCount: '~3K',
        tags: ['insect', 'bug', 'six-legged', 'segmented']
    },

    // VEHICLES
    {
        id: 'car-body',
        name: 'Sedan Body',
        description: 'Basic sedan car body for automotive modeling',
        category: 'vehicle',
        subcategory: 'car',
        icon: '🚗',
        complexity: 'medium',
        polyCount: '~4K',
        tags: ['car', 'sedan', 'vehicle', 'automotive']
    },
    {
        id: 'motorcycle-base',
        name: 'Motorcycle Base',
        description: 'Sport motorcycle base with wheel structure',
        category: 'vehicle',
        subcategory: 'motorcycle',
        icon: '🏍️',
        complexity: 'medium',
        polyCount: '~5K',
        tags: ['motorcycle', 'bike', 'vehicle']
    },
    {
        id: 'spaceship-base',
        name: 'Spaceship Base',
        description: 'Sci-fi spaceship hull for space vehicles',
        category: 'vehicle',
        subcategory: 'spacecraft',
        icon: '🚀',
        complexity: 'medium',
        polyCount: '~4K',
        tags: ['spaceship', 'sci-fi', 'spacecraft', 'space']
    },

    // FURNITURE
    {
        id: 'chair-base',
        name: 'Office Chair',
        description: 'Standard office chair base',
        category: 'furniture',
        subcategory: 'seating',
        icon: '🪑',
        complexity: 'low',
        polyCount: '~1K',
        tags: ['chair', 'office', 'furniture', 'seating']
    },
    {
        id: 'table-base',
        name: 'Table Base',
        description: 'Simple table with adjustable proportions',
        category: 'furniture',
        subcategory: 'table',
        icon: '🪵',
        complexity: 'low',
        polyCount: '~500',
        tags: ['table', 'desk', 'furniture']
    },
    {
        id: 'sofa-base',
        name: 'Sofa Base',
        description: 'Three-seat sofa with cushion topology',
        category: 'furniture',
        subcategory: 'seating',
        icon: '🛋️',
        complexity: 'medium',
        polyCount: '~2K',
        tags: ['sofa', 'couch', 'furniture', 'seating']
    },

    // ORGANIC
    {
        id: 'tree-base',
        name: 'Tree Base',
        description: 'Deciduous tree with branch structure',
        category: 'organic',
        subcategory: 'vegetation',
        icon: '🌳',
        complexity: 'medium',
        polyCount: '~3K',
        tags: ['tree', 'vegetation', 'nature', 'organic']
    },
    {
        id: 'rock-base',
        name: 'Rock Formation',
        description: 'Organic rock cluster for environments',
        category: 'organic',
        subcategory: 'mineral',
        icon: '🪨',
        complexity: 'low',
        polyCount: '~1K',
        tags: ['rock', 'stone', 'environment', 'nature']
    },
    {
        id: 'flower-base',
        name: 'Flower Base',
        description: 'Generic flower with petal structure',
        category: 'organic',
        subcategory: 'vegetation',
        icon: '🌸',
        complexity: 'medium',
        polyCount: '~2K',
        tags: ['flower', 'plant', 'vegetation', 'nature']
    },

    // MECHANICAL
    {
        id: 'gear-set',
        name: 'Gear Set',
        description: 'Interlocking gear system',
        category: 'mechanical',
        subcategory: 'parts',
        icon: '⚙️',
        complexity: 'medium',
        polyCount: '~2K',
        tags: ['gear', 'cog', 'mechanical', 'machine']
    },
    {
        id: 'robot-arm',
        name: 'Robot Arm',
        description: 'Articulated robotic arm with joints',
        category: 'mechanical',
        subcategory: 'robot',
        icon: '🦾',
        complexity: 'medium',
        polyCount: '~3K',
        tags: ['robot', 'arm', 'mechanical', 'articulated']
    },
    {
        id: 'mech-suit',
        name: 'Mech Suit Base',
        description: 'Powered exoskeleton/mech base',
        category: 'mechanical',
        subcategory: 'robot',
        icon: '🤖',
        complexity: 'high',
        polyCount: '~10K',
        tags: ['mech', 'robot', 'exoskeleton', 'armor']
    }
];

// ═══════════════════════════════════════════════════════════════════════════════
// THREE.JS CODE GENERATORS FOR BASE MESHES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Three.js code for creating a base mesh
 */
export const generateBaseMeshCode = (presetId: string): string => {
    const preset = BASE_MESH_PRESETS.find(p => p.id === presetId);
    if (!preset) return '';

    // Map preset IDs to Three.js geometry generation code
    const codeGenerators: Record<string, string> = {
        'human-male-base': generateHumanoidCode('male'),
        'human-female-base': generateHumanoidCode('female'),
        'human-head': generateHeadCode(),
        'human-hand': generateHandCode(),
        'chibi-body': generateChibiCode(),
        'blockout-mannequin': generateMannequinCode(),
        'quadruped-base': generateQuadrupedCode(),
        'dragon-base': generateDragonCode(),
        'bird-base': generateBirdCode(),
        'fish-base': generateFishCode(),
        'insect-base': generateInsectCode(),
        'car-body': generateCarCode(),
        'motorcycle-base': generateMotorcycleCode(),
        'spaceship-base': generateSpaceshipCode(),
        'chair-base': generateChairCode(),
        'table-base': generateTableCode(),
        'sofa-base': generateSofaCode(),
        'tree-base': generateTreeCode(),
        'rock-base': generateRockCode(),
        'flower-base': generateFlowerCode(),
        'gear-set': generateGearCode(),
        'robot-arm': generateRobotArmCode(),
        'mech-suit': generateMechCode()
    };

    return codeGenerators[presetId] || generateDefaultCode(preset.name);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CODE GENERATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const generateHumanoidCode = (type: 'male' | 'female'): string => {
    const scale = type === 'male' ? 1.0 : 0.95;
    const shoulderWidth = type === 'male' ? 0.45 : 0.38;
    const hipWidth = type === 'male' ? 0.35 : 0.4;

    return `
// ${type === 'male' ? 'Male' : 'Female'} Humanoid Base Mesh
const humanoid = new THREE.Group();
humanoid.name = '${type}_humanoid';

// Material
const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.7,
    metalness: 0.1
});

// Torso
const torsoGeo = new THREE.CylinderGeometry(${shoulderWidth}, ${hipWidth}, 0.65, 12);
const torso = new THREE.Mesh(torsoGeo, skinMat);
torso.position.y = 1.1;
torso.name = 'torso';
humanoid.add(torso);

// Head
const headGeo = new THREE.SphereGeometry(0.12, 16, 12);
const head = new THREE.Mesh(headGeo, skinMat);
head.position.y = 1.65;
head.scale.set(1, 1.2, 1);
head.name = 'head';
humanoid.add(head);

// Neck
const neckGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8);
const neck = new THREE.Mesh(neckGeo, skinMat);
neck.position.y = 1.5;
neck.name = 'neck';
humanoid.add(neck);

// Arms
[-1, 1].forEach((side, i) => {
    // Upper arm
    const upperArmGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.32, 8);
    const upperArm = new THREE.Mesh(upperArmGeo, skinMat);
    upperArm.position.set(side * ${shoulderWidth + 0.08}, 1.3, 0);
    upperArm.rotation.z = side * 0.1;
    upperArm.name = side > 0 ? 'upper_arm_R' : 'upper_arm_L';
    humanoid.add(upperArm);

    // Lower arm
    const lowerArmGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.28, 8);
    const lowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
    lowerArm.position.set(side * ${shoulderWidth + 0.1}, 0.98, 0);
    lowerArm.name = side > 0 ? 'lower_arm_R' : 'lower_arm_L';
    humanoid.add(lowerArm);

    // Hand
    const handGeo = new THREE.BoxGeometry(0.06, 0.1, 0.03);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(side * ${shoulderWidth + 0.1}, 0.8, 0);
    hand.name = side > 0 ? 'hand_R' : 'hand_L';
    humanoid.add(hand);
});

// Legs
[-1, 1].forEach((side, i) => {
    // Upper leg
    const upperLegGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.45, 10);
    const upperLeg = new THREE.Mesh(upperLegGeo, skinMat);
    upperLeg.position.set(side * 0.12, 0.55, 0);
    upperLeg.name = side > 0 ? 'upper_leg_R' : 'upper_leg_L';
    humanoid.add(upperLeg);

    // Lower leg
    const lowerLegGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.42, 10);
    const lowerLeg = new THREE.Mesh(lowerLegGeo, skinMat);
    lowerLeg.position.set(side * 0.12, 0.12, 0);
    lowerLeg.name = side > 0 ? 'lower_leg_R' : 'lower_leg_L';
    humanoid.add(lowerLeg);

    // Foot
    const footGeo = new THREE.BoxGeometry(0.08, 0.05, 0.15);
    const foot = new THREE.Mesh(footGeo, skinMat);
    foot.position.set(side * 0.12, -0.1, 0.03);
    foot.name = side > 0 ? 'foot_R' : 'foot_L';
    humanoid.add(foot);
});

humanoid.scale.setScalar(${scale});
scene.add(humanoid);
`;
};

const generateHeadCode = (): string => `
// Human Head Base Mesh
const head = new THREE.Group();
head.name = 'head_base';

const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.6
});

// Main skull shape
const skullGeo = new THREE.SphereGeometry(0.5, 24, 18);
const skull = new THREE.Mesh(skullGeo, skinMat);
skull.scale.set(0.85, 1, 0.9);
skull.name = 'skull';
head.add(skull);

// Jaw
const jawGeo = new THREE.BoxGeometry(0.4, 0.2, 0.35);
const jaw = new THREE.Mesh(jawGeo, skinMat);
jaw.position.set(0, -0.35, 0.1);
jaw.name = 'jaw';
head.add(jaw);

// Nose bridge
const noseGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
const nose = new THREE.Mesh(noseGeo, skinMat);
nose.position.set(0, -0.1, 0.45);
nose.rotation.x = Math.PI / 2;
nose.name = 'nose';
head.add(nose);

// Eye sockets (concave)
[-1, 1].forEach(side => {
    const eyeSocketGeo = new THREE.SphereGeometry(0.08, 12, 8);
    const eyeSocket = new THREE.Mesh(eyeSocketGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    eyeSocket.position.set(side * 0.15, 0.05, 0.35);
    eyeSocket.name = side > 0 ? 'eye_socket_R' : 'eye_socket_L';
    head.add(eyeSocket);
});

// Ears
[-1, 1].forEach(side => {
    const earGeo = new THREE.TorusGeometry(0.08, 0.03, 6, 12, Math.PI);
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * 0.42, 0, 0);
    ear.rotation.y = side * Math.PI / 2;
    ear.name = side > 0 ? 'ear_R' : 'ear_L';
    head.add(ear);
});

scene.add(head);
`;

const generateHandCode = (): string => `
// Human Hand Base Mesh
const hand = new THREE.Group();
hand.name = 'hand_base';

const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a574,
    roughness: 0.6
});

// Palm
const palmGeo = new THREE.BoxGeometry(0.4, 0.5, 0.15);
const palm = new THREE.Mesh(palmGeo, skinMat);
palm.name = 'palm';
hand.add(palm);

// Fingers
const fingerLengths = [0.28, 0.35, 0.38, 0.35, 0.3]; // thumb to pinky
const fingerX = [-0.18, -0.09, 0, 0.09, 0.17];

fingerLengths.forEach((len, i) => {
    const fingerGroup = new THREE.Group();
    fingerGroup.name = ['thumb', 'index', 'middle', 'ring', 'pinky'][i];

    // Three phalanges per finger
    [0.4, 0.3, 0.3].forEach((segLen, j) => {
        const segGeo = new THREE.CylinderGeometry(0.025, 0.028, len * segLen, 6);
        const seg = new THREE.Mesh(segGeo, skinMat);
        seg.position.y = (j * len * segLen) + (len * segLen / 2);
        seg.name = \`phalange_\${j}\`;
        fingerGroup.add(seg);
    });

    fingerGroup.position.set(fingerX[i], 0.25 + len/2, 0);
    if (i === 0) { // Thumb
        fingerGroup.position.set(-0.22, 0.1, 0.05);
        fingerGroup.rotation.z = 0.8;
    }
    hand.add(fingerGroup);
});

hand.rotation.x = -Math.PI / 2;
scene.add(hand);
`;

const generateChibiCode = (): string => `
// Chibi Character Base
const chibi = new THREE.Group();
chibi.name = 'chibi_base';

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffd5b8, roughness: 0.5 });

// Large head (chibi proportion)
const headGeo = new THREE.SphereGeometry(0.35, 16, 12);
const head = new THREE.Mesh(headGeo, bodyMat);
head.position.y = 0.8;
head.scale.set(1, 1.1, 0.95);
head.name = 'head';
chibi.add(head);

// Eyes (large anime style)
[-1, 1].forEach(side => {
    const eyeGeo = new THREE.SphereGeometry(0.08, 12, 8);
    const eye = new THREE.Mesh(eyeGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
    eye.position.set(side * 0.12, 0.82, 0.28);
    chibi.add(eye);

    // Eye highlight
    const highlightGeo = new THREE.SphereGeometry(0.02, 8, 6);
    const highlight = new THREE.Mesh(highlightGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff }));
    highlight.position.set(side * 0.1, 0.85, 0.34);
    chibi.add(highlight);
});

// Small body
const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.25, 8, 12);
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.35;
body.name = 'body';
chibi.add(body);

// Stubby arms
[-1, 1].forEach(side => {
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.15, 6, 8);
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.set(side * 0.22, 0.35, 0);
    arm.rotation.z = side * 0.3;
    chibi.add(arm);
});

// Stubby legs
[-1, 1].forEach(side => {
    const legGeo = new THREE.CapsuleGeometry(0.06, 0.12, 6, 8);
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(side * 0.08, 0.08, 0);
    chibi.add(leg);
});

scene.add(chibi);
`;

const generateMannequinCode = (): string => `
// Blockout Mannequin
const mannequin = new THREE.Group();
mannequin.name = 'mannequin';

const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });

// Simple torso block
const torsoGeo = new THREE.BoxGeometry(0.4, 0.6, 0.2);
const torso = new THREE.Mesh(torsoGeo, mat);
torso.position.y = 1.1;
mannequin.add(torso);

// Head sphere
const headGeo = new THREE.SphereGeometry(0.1, 12, 8);
const head = new THREE.Mesh(headGeo, mat);
head.position.y = 1.55;
mannequin.add(head);

// Arm blocks
[-1, 1].forEach(side => {
    const armGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.set(side * 0.28, 1.1, 0);
    mannequin.add(arm);
});

// Leg blocks
[-1, 1].forEach(side => {
    const legGeo = new THREE.BoxGeometry(0.12, 0.8, 0.12);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(side * 0.1, 0.4, 0);
    mannequin.add(leg);
});

scene.add(mannequin);
`;

const generateQuadrupedCode = (): string => `
// Quadruped Base (Dog/Cat scale)
const quadruped = new THREE.Group();
quadruped.name = 'quadruped_base';

const furMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 });

// Body
const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.5, 12, 16);
const body = new THREE.Mesh(bodyGeo, furMat);
body.rotation.z = Math.PI / 2;
body.position.y = 0.35;
body.name = 'body';
quadruped.add(body);

// Head
const headGeo = new THREE.BoxGeometry(0.2, 0.18, 0.25);
const head = new THREE.Mesh(headGeo, furMat);
head.position.set(0.4, 0.4, 0);
head.name = 'head';
quadruped.add(head);

// Snout
const snoutGeo = new THREE.ConeGeometry(0.06, 0.15, 6);
const snout = new THREE.Mesh(snoutGeo, furMat);
snout.rotation.z = -Math.PI / 2;
snout.position.set(0.55, 0.38, 0);
quadruped.add(snout);

// Ears
[-1, 1].forEach(side => {
    const earGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
    const ear = new THREE.Mesh(earGeo, furMat);
    ear.position.set(0.35, 0.52, side * 0.08);
    quadruped.add(ear);
});

// Legs
[[-0.22, 1], [0.22, 1], [-0.22, -1], [0.22, -1]].forEach(([x, front]) => {
    const legGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.3, 8);
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.set(x, 0.15, front * 0.05);
    quadruped.add(leg);
});

// Tail
const tailGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.25, 6);
const tail = new THREE.Mesh(tailGeo, furMat);
tail.position.set(-0.38, 0.4, 0);
tail.rotation.z = -0.5;
quadruped.add(tail);

scene.add(quadruped);
`;

// Continue with simpler implementations for remaining presets
const generateDragonCode = (): string => generateCreatureCode('dragon', 0xaa6666, true);
const generateBirdCode = (): string => generateCreatureCode('bird', 0x666699, true);
const generateFishCode = (): string => generateCreatureCode('fish', 0x6699aa, false);
const generateInsectCode = (): string => generateCreatureCode('insect', 0x336633, false);

const generateCreatureCode = (type: string, color: number, hasWings: boolean): string => `
// ${type.charAt(0).toUpperCase() + type.slice(1)} Base
const creature = new THREE.Group();
creature.name = '${type}_base';

const mat = new THREE.MeshStandardMaterial({ color: 0x${color.toString(16)}, roughness: 0.6 });

// Body
const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.6, 12, 16);
const body = new THREE.Mesh(bodyGeo, mat);
body.rotation.z = Math.PI / 2;
body.position.y = 0.4;
creature.add(body);

// Head
const headGeo = new THREE.SphereGeometry(0.15, 12, 10);
const head = new THREE.Mesh(headGeo, mat);
head.position.set(0.5, 0.45, 0);
head.scale.set(1.2, 1, 0.9);
creature.add(head);

${hasWings ? `
// Wings
[-1, 1].forEach(side => {
    const wingGeo = new THREE.PlaneGeometry(0.6, 0.3, 4, 2);
    const wing = new THREE.Mesh(wingGeo, mat);
    wing.position.set(0, 0.55, side * 0.25);
    wing.rotation.x = side * 0.3;
    wing.rotation.y = side * 0.5;
    creature.add(wing);
});
` : ''}

// Tail
const tailGeo = new THREE.ConeGeometry(0.08, 0.4, 6);
const tail = new THREE.Mesh(tailGeo, mat);
tail.rotation.z = Math.PI / 2;
tail.position.set(-0.55, 0.35, 0);
creature.add(tail);

scene.add(creature);
`;

const generateCarCode = (): string => `
// Sedan Car Body
const car = new THREE.Group();
car.name = 'car_base';

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.8, roughness: 0.3 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.7 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

// Main body
const bodyGeo = new THREE.BoxGeometry(1.8, 0.4, 0.7);
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.35;
car.add(body);

// Cabin
const cabinGeo = new THREE.BoxGeometry(0.9, 0.35, 0.65);
const cabin = new THREE.Mesh(cabinGeo, glassMat);
cabin.position.set(0.1, 0.7, 0);
car.add(cabin);

// Hood slope
const hoodGeo = new THREE.BoxGeometry(0.5, 0.15, 0.68);
const hood = new THREE.Mesh(hoodGeo, bodyMat);
hood.position.set(0.6, 0.48, 0);
hood.rotation.z = -0.15;
car.add(hood);

// Wheels
[[-0.55, -0.35], [-0.55, 0.35], [0.55, -0.35], [0.55, 0.35]].forEach(([x, z]) => {
    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.15, z);
    car.add(wheel);
});

scene.add(car);
`;

const generateMotorcycleCode = (): string => generateVehicleCode('motorcycle');
const generateSpaceshipCode = (): string => generateVehicleCode('spaceship');

const generateVehicleCode = (type: string): string => `
// ${type.charAt(0).toUpperCase() + type.slice(1)} Base
const vehicle = new THREE.Group();
vehicle.name = '${type}_base';

const mat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.7, roughness: 0.4 });

// Main body
const bodyGeo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
const body = new THREE.Mesh(bodyGeo, mat);
body.position.y = 0.3;
vehicle.add(body);

// Details
const detailGeo = new THREE.ConeGeometry(0.15, 0.4, 6);
const detail = new THREE.Mesh(detailGeo, mat);
detail.rotation.z = -Math.PI / 2;
detail.position.set(0.6, 0.3, 0);
vehicle.add(detail);

scene.add(vehicle);
`;

const generateChairCode = (): string => `
// Office Chair
const chair = new THREE.Group();
chair.name = 'chair_base';

const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.6 });

// Seat
const seatGeo = new THREE.BoxGeometry(0.45, 0.08, 0.45);
const seat = new THREE.Mesh(seatGeo, cushionMat);
seat.position.y = 0.5;
chair.add(seat);

// Back
const backGeo = new THREE.BoxGeometry(0.42, 0.5, 0.08);
const back = new THREE.Mesh(backGeo, cushionMat);
back.position.set(0, 0.8, -0.2);
back.rotation.x = 0.1;
chair.add(back);

// Base stem
const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
const stem = new THREE.Mesh(stemGeo, mat);
stem.position.y = 0.28;
chair.add(stem);

// Base star (5 legs)
for (let i = 0; i < 5; i++) {
    const legGeo = new THREE.BoxGeometry(0.25, 0.03, 0.04);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.y = 0.08;
    leg.rotation.y = (i / 5) * Math.PI * 2;
    leg.position.x = Math.cos((i / 5) * Math.PI * 2) * 0.12;
    leg.position.z = Math.sin((i / 5) * Math.PI * 2) * 0.12;
    chair.add(leg);
}

scene.add(chair);
`;

const generateTableCode = (): string => `
// Simple Table
const table = new THREE.Group();
table.name = 'table_base';

const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });

// Top
const topGeo = new THREE.BoxGeometry(1.2, 0.05, 0.7);
const top = new THREE.Mesh(topGeo, woodMat);
top.position.y = 0.75;
table.add(top);

// Legs
[[-0.5, -0.25], [-0.5, 0.25], [0.5, -0.25], [0.5, 0.25]].forEach(([x, z]) => {
    const legGeo = new THREE.BoxGeometry(0.06, 0.72, 0.06);
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, 0.36, z);
    table.add(leg);
});

scene.add(table);
`;

const generateSofaCode = (): string => `
// Sofa Base
const sofa = new THREE.Group();
sofa.name = 'sofa_base';

const fabricMat = new THREE.MeshStandardMaterial({ color: 0x6B5B95, roughness: 0.8 });

// Base
const baseGeo = new THREE.BoxGeometry(2, 0.2, 0.85);
const base = new THREE.Mesh(baseGeo, fabricMat);
base.position.y = 0.2;
sofa.add(base);

// Cushions
for (let i = -1; i <= 1; i++) {
    const cushionGeo = new THREE.BoxGeometry(0.6, 0.2, 0.5);
    const cushion = new THREE.Mesh(cushionGeo, fabricMat);
    cushion.position.set(i * 0.65, 0.4, 0.1);
    sofa.add(cushion);
}

// Back
const backGeo = new THREE.BoxGeometry(2, 0.5, 0.15);
const back = new THREE.Mesh(backGeo, fabricMat);
back.position.set(0, 0.55, -0.35);
sofa.add(back);

// Arms
[-1, 1].forEach(side => {
    const armGeo = new THREE.BoxGeometry(0.15, 0.35, 0.7);
    const arm = new THREE.Mesh(armGeo, fabricMat);
    arm.position.set(side * 0.95, 0.4, 0);
    sofa.add(arm);
});

scene.add(sofa);
`;

const generateTreeCode = (): string => `
// Tree Base
const tree = new THREE.Group();
tree.name = 'tree_base';

const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7 });

// Trunk
const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8);
const trunk = new THREE.Mesh(trunkGeo, barkMat);
trunk.position.y = 0.6;
tree.add(trunk);

// Foliage layers
[0.5, 0.35, 0.2].forEach((radius, i) => {
    const foliageGeo = new THREE.SphereGeometry(radius, 12, 8);
    const foliage = new THREE.Mesh(foliageGeo, leafMat);
    foliage.position.y = 1.3 + i * 0.25;
    foliage.scale.y = 0.7;
    tree.add(foliage);
});

scene.add(tree);
`;

const generateRockCode = (): string => `
// Rock Formation
const rocks = new THREE.Group();
rocks.name = 'rock_base';

const rockMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.95 });

// Main rock
const mainGeo = new THREE.DodecahedronGeometry(0.4, 1);
const main = new THREE.Mesh(mainGeo, rockMat);
main.position.y = 0.3;
main.rotation.set(0.3, 0.5, 0.2);
rocks.add(main);

// Smaller rocks
[[-0.4, 0.15], [0.35, 0.12], [0.1, 0.1]].forEach(([x, size]) => {
    const rockGeo = new THREE.DodecahedronGeometry(size, 0);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, size, Math.random() * 0.3 - 0.15);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rocks.add(rock);
});

scene.add(rocks);
`;

const generateFlowerCode = (): string => `
// Flower Base
const flower = new THREE.Group();
flower.name = 'flower_base';

const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7 });
const petalMat = new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.5 });
const centerMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6 });

// Stem
const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.5, 6);
const stem = new THREE.Mesh(stemGeo, stemMat);
stem.position.y = 0.25;
flower.add(stem);

// Center
const centerGeo = new THREE.SphereGeometry(0.06, 12, 8);
const center = new THREE.Mesh(centerGeo, centerMat);
center.position.y = 0.52;
center.scale.y = 0.6;
flower.add(center);

// Petals
for (let i = 0; i < 8; i++) {
    const petalGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const petal = new THREE.Mesh(petalGeo, petalMat);
    const angle = (i / 8) * Math.PI * 2;
    petal.position.set(
        Math.cos(angle) * 0.1,
        0.52,
        Math.sin(angle) * 0.1
    );
    petal.scale.set(1.5, 0.3, 1);
    flower.add(petal);
}

// Leaves
[-1, 1].forEach(side => {
    const leafGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const leaf = new THREE.Mesh(leafGeo, stemMat);
    leaf.position.set(side * 0.08, 0.2, 0);
    leaf.scale.set(2, 0.3, 1);
    leaf.rotation.z = side * 0.5;
    flower.add(leaf);
});

scene.add(flower);
`;

const generateGearCode = (): string => `
// Gear Set
const gearSet = new THREE.Group();
gearSet.name = 'gear_set';

const metalMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.9, roughness: 0.3 });

// Create gear with teeth
function createGear(radius, teeth, thickness) {
    const gear = new THREE.Group();

    // Hub
    const hubGeo = new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, thickness, 16);
    const hub = new THREE.Mesh(hubGeo, metalMat);
    hub.rotation.x = Math.PI / 2;
    gear.add(hub);

    // Teeth
    for (let i = 0; i < teeth; i++) {
        const toothGeo = new THREE.BoxGeometry(radius * 0.15, thickness, radius * 0.2);
        const tooth = new THREE.Mesh(toothGeo, metalMat);
        const angle = (i / teeth) * Math.PI * 2;
        tooth.position.set(
            Math.cos(angle) * radius * 0.85,
            0,
            Math.sin(angle) * radius * 0.85
        );
        tooth.rotation.y = angle;
        gear.add(tooth);
    }

    return gear;
}

// Main gear
const mainGear = createGear(0.3, 16, 0.08);
mainGear.position.set(0, 0.5, 0);
gearSet.add(mainGear);

// Secondary gear
const smallGear = createGear(0.15, 10, 0.08);
smallGear.position.set(0.4, 0.5, 0);
gearSet.add(smallGear);

scene.add(gearSet);
`;

const generateRobotArmCode = (): string => `
// Robot Arm
const arm = new THREE.Group();
arm.name = 'robot_arm';

const metalMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8, roughness: 0.4 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0x666677, metalness: 0.7, roughness: 0.5 });

// Base
const baseGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.1, 16);
const base = new THREE.Mesh(baseGeo, metalMat);
base.position.y = 0.05;
arm.add(base);

// Segments and joints
const segments = [
    { length: 0.4, radius: 0.06 },
    { length: 0.35, radius: 0.05 },
    { length: 0.25, radius: 0.04 }
];

let currentY = 0.1;
segments.forEach((seg, i) => {
    // Joint
    const jointGeo = new THREE.SphereGeometry(seg.radius * 1.5, 12, 8);
    const joint = new THREE.Mesh(jointGeo, jointMat);
    joint.position.y = currentY;
    arm.add(joint);

    // Segment
    const segGeo = new THREE.CylinderGeometry(seg.radius, seg.radius * 1.1, seg.length, 8);
    const segment = new THREE.Mesh(segGeo, metalMat);
    segment.position.y = currentY + seg.length / 2;
    arm.add(segment);

    currentY += seg.length;
});

// End effector (gripper)
const gripperBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), metalMat);
gripperBase.position.y = currentY + 0.025;
arm.add(gripperBase);

scene.add(arm);
`;

const generateMechCode = (): string => `
// Mech Suit Base
const mech = new THREE.Group();
mech.name = 'mech_suit';

const armorMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.4 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.6, roughness: 0.5 });

// Torso (chest plate)
const torsoGeo = new THREE.BoxGeometry(0.8, 0.7, 0.5);
const torso = new THREE.Mesh(torsoGeo, armorMat);
torso.position.y = 1.2;
mech.add(torso);

// Cockpit/head area
const headGeo = new THREE.BoxGeometry(0.4, 0.3, 0.35);
const head = new THREE.Mesh(headGeo, armorMat);
head.position.y = 1.7;
mech.add(head);

// Visor
const visorGeo = new THREE.BoxGeometry(0.35, 0.1, 0.05);
const visor = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x446688 }));
visor.position.set(0, 1.7, 0.2);
mech.add(visor);

// Shoulders
[-1, 1].forEach(side => {
    const shoulderGeo = new THREE.BoxGeometry(0.35, 0.25, 0.3);
    const shoulder = new THREE.Mesh(shoulderGeo, armorMat);
    shoulder.position.set(side * 0.55, 1.4, 0);
    mech.add(shoulder);
});

// Arms
[-1, 1].forEach(side => {
    const upperArmGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const upperArm = new THREE.Mesh(upperArmGeo, darkMat);
    upperArm.position.set(side * 0.6, 1.0, 0);
    mech.add(upperArm);

    const lowerArmGeo = new THREE.BoxGeometry(0.18, 0.35, 0.18);
    const lowerArm = new THREE.Mesh(lowerArmGeo, armorMat);
    lowerArm.position.set(side * 0.6, 0.6, 0);
    mech.add(lowerArm);
});

// Legs
[-1, 1].forEach(side => {
    // Hip
    const hipGeo = new THREE.BoxGeometry(0.25, 0.2, 0.25);
    const hip = new THREE.Mesh(hipGeo, darkMat);
    hip.position.set(side * 0.25, 0.75, 0);
    mech.add(hip);

    // Upper leg
    const upperLegGeo = new THREE.BoxGeometry(0.25, 0.45, 0.25);
    const upperLeg = new THREE.Mesh(upperLegGeo, armorMat);
    upperLeg.position.set(side * 0.25, 0.4, 0);
    mech.add(upperLeg);

    // Lower leg
    const lowerLegGeo = new THREE.BoxGeometry(0.22, 0.4, 0.22);
    const lowerLeg = new THREE.Mesh(lowerLegGeo, armorMat);
    lowerLeg.position.set(side * 0.25, 0.0, 0);
    mech.add(lowerLeg);

    // Foot
    const footGeo = new THREE.BoxGeometry(0.25, 0.1, 0.35);
    const foot = new THREE.Mesh(footGeo, darkMat);
    foot.position.set(side * 0.25, -0.15, 0.05);
    mech.add(foot);
});

scene.add(mech);
`;

const generateDefaultCode = (name: string): string => `
// ${name} Base
const mesh = new THREE.Group();
mesh.name = '${name.toLowerCase().replace(/\\s+/g, '_')}';

const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });

const geo = new THREE.BoxGeometry(1, 1, 1);
const box = new THREE.Mesh(geo, mat);
box.position.y = 0.5;
mesh.add(box);

scene.add(mesh);
`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get presets by category
 */
export const getPresetsByCategory = (category: BaseMeshPreset['category']): BaseMeshPreset[] => {
    return BASE_MESH_PRESETS.filter(p => p.category === category);
};

/**
 * Search presets by tag or name
 */
export const searchPresets = (query: string): BaseMeshPreset[] => {
    const q = query.toLowerCase();
    return BASE_MESH_PRESETS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        p.description.toLowerCase().includes(q)
    );
};

/**
 * Get preset by ID
 */
export const getPresetById = (id: string): BaseMeshPreset | undefined => {
    return BASE_MESH_PRESETS.find(p => p.id === id);
};
