/**
 * Animation Service
 *
 * Provides pre-built animation presets for 3D objects.
 * Works with Three.js and can be applied to any mesh.
 */

export type EasingFunction = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic';

export interface AnimationPreset {
    id: string;
    name: string;
    description: string;
    category: 'transform' | 'material' | 'camera' | 'special';
    icon: string;
    duration: number;  // Default duration in seconds
    loop: boolean;     // Whether animation loops
    properties: {
        type: 'rotation' | 'position' | 'scale' | 'opacity' | 'color' | 'camera';
        axis?: 'x' | 'y' | 'z' | 'all';
        from?: number | number[];
        to?: number | number[];
        amplitude?: number;
        frequency?: number;
    };
    easing: EasingFunction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const ANIMATION_PRESETS: AnimationPreset[] = [
    // ROTATION ANIMATIONS
    {
        id: 'spin-y',
        name: 'Spin (Y-Axis)',
        description: 'Continuous rotation around vertical axis',
        category: 'transform',
        icon: '🔄',
        duration: 4,
        loop: true,
        properties: { type: 'rotation', axis: 'y', from: 0, to: Math.PI * 2 },
        easing: 'linear'
    },
    {
        id: 'spin-x',
        name: 'Spin (X-Axis)',
        description: 'Rotation around horizontal axis',
        category: 'transform',
        icon: '🔃',
        duration: 4,
        loop: true,
        properties: { type: 'rotation', axis: 'x', from: 0, to: Math.PI * 2 },
        easing: 'linear'
    },
    {
        id: 'wobble',
        name: 'Wobble',
        description: 'Gentle back-and-forth rotation',
        category: 'transform',
        icon: '🎢',
        duration: 1,
        loop: true,
        properties: { type: 'rotation', axis: 'z', amplitude: 0.1, frequency: 2 },
        easing: 'easeInOut'
    },
    {
        id: 'tumble',
        name: 'Tumble',
        description: 'Random multi-axis rotation',
        category: 'transform',
        icon: '🎲',
        duration: 6,
        loop: true,
        properties: { type: 'rotation', axis: 'all', from: [0, 0, 0], to: [Math.PI * 2, Math.PI * 2, Math.PI * 2] },
        easing: 'linear'
    },

    // POSITION ANIMATIONS
    {
        id: 'bounce',
        name: 'Bounce',
        description: 'Bouncing up and down motion',
        category: 'transform',
        icon: '⬆️',
        duration: 1,
        loop: true,
        properties: { type: 'position', axis: 'y', amplitude: 0.5, frequency: 1 },
        easing: 'bounce'
    },
    {
        id: 'float',
        name: 'Float',
        description: 'Gentle floating motion',
        category: 'transform',
        icon: '☁️',
        duration: 3,
        loop: true,
        properties: { type: 'position', axis: 'y', amplitude: 0.2, frequency: 0.5 },
        easing: 'easeInOut'
    },
    {
        id: 'sway',
        name: 'Sway',
        description: 'Side-to-side swaying motion',
        category: 'transform',
        icon: '🌊',
        duration: 2,
        loop: true,
        properties: { type: 'position', axis: 'x', amplitude: 0.3, frequency: 1 },
        easing: 'easeInOut'
    },
    {
        id: 'orbit',
        name: 'Orbit',
        description: 'Circular orbit around center',
        category: 'transform',
        icon: '🌍',
        duration: 5,
        loop: true,
        properties: { type: 'position', axis: 'all', amplitude: 2, frequency: 1 },
        easing: 'linear'
    },

    // SCALE ANIMATIONS
    {
        id: 'pulse',
        name: 'Pulse',
        description: 'Rhythmic scaling pulse',
        category: 'transform',
        icon: '💗',
        duration: 1,
        loop: true,
        properties: { type: 'scale', axis: 'all', from: 1, to: 1.1 },
        easing: 'easeInOut'
    },
    {
        id: 'breathe',
        name: 'Breathe',
        description: 'Slow breathing scale animation',
        category: 'transform',
        icon: '🫁',
        duration: 4,
        loop: true,
        properties: { type: 'scale', axis: 'all', from: 0.95, to: 1.05 },
        easing: 'easeInOut'
    },
    {
        id: 'pop-in',
        name: 'Pop In',
        description: 'Scale up from zero with overshoot',
        category: 'transform',
        icon: '💥',
        duration: 0.5,
        loop: false,
        properties: { type: 'scale', axis: 'all', from: 0, to: 1 },
        easing: 'elastic'
    },
    {
        id: 'squash-stretch',
        name: 'Squash & Stretch',
        description: 'Classic cartoon squash and stretch',
        category: 'transform',
        icon: '🎭',
        duration: 1,
        loop: true,
        properties: { type: 'scale', axis: 'y', amplitude: 0.2, frequency: 2 },
        easing: 'bounce'
    },

    // MATERIAL ANIMATIONS
    {
        id: 'fade-pulse',
        name: 'Fade Pulse',
        description: 'Opacity fading in and out',
        category: 'material',
        icon: '👻',
        duration: 2,
        loop: true,
        properties: { type: 'opacity', from: 0.3, to: 1 },
        easing: 'easeInOut'
    },
    {
        id: 'color-cycle',
        name: 'Color Cycle',
        description: 'Cycle through rainbow colors',
        category: 'material',
        icon: '🌈',
        duration: 5,
        loop: true,
        properties: { type: 'color', from: [1, 0, 0], to: [0, 0, 1] },
        easing: 'linear'
    },
    {
        id: 'glow',
        name: 'Glow Effect',
        description: 'Pulsing emissive glow',
        category: 'material',
        icon: '✨',
        duration: 1.5,
        loop: true,
        properties: { type: 'opacity', amplitude: 0.5, frequency: 1 },
        easing: 'easeInOut'
    },

    // CAMERA ANIMATIONS
    {
        id: 'camera-orbit',
        name: 'Camera Orbit',
        description: '360-degree camera rotation',
        category: 'camera',
        icon: '🎥',
        duration: 10,
        loop: true,
        properties: { type: 'camera', axis: 'y', from: 0, to: Math.PI * 2 },
        easing: 'linear'
    },
    {
        id: 'camera-dolly',
        name: 'Camera Dolly',
        description: 'Camera zoom in/out',
        category: 'camera',
        icon: '🔍',
        duration: 3,
        loop: true,
        properties: { type: 'camera', axis: 'z', amplitude: 3, frequency: 0.5 },
        easing: 'easeInOut'
    },

    // SPECIAL ANIMATIONS
    {
        id: 'explode',
        name: 'Explode View',
        description: 'Parts fly outward from center',
        category: 'special',
        icon: '💫',
        duration: 2,
        loop: false,
        properties: { type: 'position', axis: 'all', amplitude: 2 },
        easing: 'easeOut'
    },
    {
        id: 'assemble',
        name: 'Assemble',
        description: 'Parts come together from outside',
        category: 'special',
        icon: '🔧',
        duration: 2,
        loop: false,
        properties: { type: 'position', axis: 'all', amplitude: 2 },
        easing: 'easeOut'
    },
    {
        id: 'shake',
        name: 'Shake',
        description: 'Rapid shaking motion',
        category: 'special',
        icon: '📳',
        duration: 0.5,
        loop: true,
        properties: { type: 'position', axis: 'all', amplitude: 0.05, frequency: 20 },
        easing: 'linear'
    }
];

// ═══════════════════════════════════════════════════════════════════════════════
// EASING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const easingFunctions: Record<EasingFunction, (t: number) => number> = {
    linear: (t) => t,
    easeIn: (t) => t * t,
    easeOut: (t) => t * (2 - t),
    easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    elastic: (t) => {
        if (t === 0 || t === 1) return t;
        const p = 0.3;
        const s = p / 4;
        return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Three.js animation code for a preset
 */
export const generateAnimationCode = (preset: AnimationPreset): string => {
    const { id, duration, loop, properties, easing } = preset;

    let code = '';

    switch (properties.type) {
        case 'rotation':
            if (properties.amplitude) {
                // Oscillating rotation
                code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const angle = Math.sin(t * Math.PI * 2 * ${properties.frequency || 1}) * ${properties.amplitude};
    mesh.rotation.${properties.axis === 'all' ? 'y' : properties.axis} = angle;
};`;
            } else {
                // Continuous rotation
                code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = ${loop ? '(time % duration) / duration' : 'Math.min(time / duration, 1)'};
    const eased = ${easing === 'linear' ? 't' : `easingFunctions['${easing}'](t)`};
    ${properties.axis === 'all'
        ? `mesh.rotation.set(eased * ${(properties.to as number[])[0]}, eased * ${(properties.to as number[])[1]}, eased * ${(properties.to as number[])[2]});`
        : `mesh.rotation.${properties.axis} = eased * ${properties.to};`
    }
};`;
            }
            break;

        case 'position':
            if (properties.amplitude) {
                if (properties.axis === 'all' && id === 'orbit') {
                    // Orbital motion
                    code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const angle = t * Math.PI * 2;
    const radius = ${properties.amplitude};
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;
};`;
                } else {
                    // Oscillating position
                    code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const offset = Math.sin(t * Math.PI * 2 * ${properties.frequency || 1}) * ${properties.amplitude};
    mesh.position.${properties.axis === 'all' ? 'y' : properties.axis} += offset * 0.016; // Delta time compensation
};`;
                }
            }
            break;

        case 'scale':
            if (properties.amplitude) {
                // Oscillating scale
                code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const scale = 1 + Math.sin(t * Math.PI * 2 * ${properties.frequency || 1}) * ${properties.amplitude};
    ${properties.axis === 'all'
        ? 'mesh.scale.setScalar(scale);'
        : `mesh.scale.${properties.axis} = scale;`
    }
};`;
            } else {
                // Scale transition
                code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = ${loop ? '(time % duration) / duration' : 'Math.min(time / duration, 1)'};
    const pingPong = ${loop} ? (t < 0.5 ? t * 2 : 2 - t * 2) : t;
    const eased = easingFunctions['${easing}'](pingPong);
    const scale = ${properties.from} + (${properties.to} - ${properties.from}) * eased;
    mesh.scale.setScalar(scale);
};`;
            }
            break;

        case 'opacity':
            code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (mesh, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const pingPong = t < 0.5 ? t * 2 : 2 - t * 2;
    const eased = easingFunctions['${easing}'](pingPong);
    const opacity = ${properties.from || 0.3} + (${properties.to || 1} - ${properties.from || 0.3}) * eased;
    if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = opacity;
    }
};`;
            break;

        case 'camera':
            code = `
// ${preset.name} Animation
const ${id.replace(/-/g, '_')}_animate = (camera, time, duration = ${duration}) => {
    const t = (time % duration) / duration;
    const angle = t * Math.PI * 2;
    const radius = camera.position.length();
    camera.position.x = Math.cos(angle) * radius;
    camera.position.z = Math.sin(angle) * radius;
    camera.lookAt(0, 0, 0);
};`;
            break;
    }

    return code;
};

/**
 * Get presets by category
 */
export const getPresetsByCategory = (category: AnimationPreset['category']): AnimationPreset[] => {
    return ANIMATION_PRESETS.filter(p => p.category === category);
};

/**
 * Get preset by ID
 */
export const getPresetById = (id: string): AnimationPreset | undefined => {
    return ANIMATION_PRESETS.find(p => p.id === id);
};

/**
 * Animation state interface for runtime
 */
export interface AnimationState {
    presetId: string;
    startTime: number;
    duration: number;
    loop: boolean;
    speed: number;
    paused: boolean;
}

/**
 * Create animation state from preset
 */
export const createAnimationState = (presetId: string, speed: number = 1): AnimationState | null => {
    const preset = getPresetById(presetId);
    if (!preset) return null;

    return {
        presetId,
        startTime: Date.now(),
        duration: preset.duration * 1000, // Convert to ms
        loop: preset.loop,
        speed,
        paused: false
    };
};
