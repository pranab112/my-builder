
import { backend } from './backend';
import { WorkspaceMode } from '../components/AnimationMaker/types';
import { debug } from './debugService';
import { successTracking } from './successTrackingService';
import { analyzeMultipleViews, buildMultiViewContext } from './multiViewAnalysisService';
import { buildSceneContext, buildSceneContextForPrompt, type SceneObject } from './sceneContextService';

// Types
export interface CategorySuggestion {
  title: string;
  description: string;
}

// Helper to extract text from response
const getText = (response: any): string => {
    if (!response) return "";
    if (response.text) return response.text;
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        return response.candidates[0].content.parts.map((p: any) => p.text).join('');
    }
    return "";
};

// Helper to extract JSON
const getJSON = (text: string): any => {
    try {
        const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
        const jsonStr = match ? match[1] : text;
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI OUTPUT VALIDATION AND SECURITY
// Comprehensive validation for AI-generated Three.js code
// ═══════════════════════════════════════════════════════════════════════════════

// Export for use in store and UI
export interface ValidationResult {
    isValid: boolean;
    cleanedCode: string;
    warnings: string[];
    errors: string[];
    stats: {
        originalLength: number;
        cleanedLength: number;
        linesOfCode: number;
        complexity: 'low' | 'medium' | 'high';
    };
}

// Generation result with validation
export interface GenerationResult {
    code: string;
    validation: ValidationResult;
}

// Security patterns that are dangerous or not allowed
const SECURITY_PATTERNS = [
    // Code execution
    { pattern: /\beval\s*\(/gi, message: 'eval() is blocked - potential code injection', severity: 'error' as const },
    { pattern: /\bnew\s+Function\s*\(/gi, message: 'new Function() is blocked - potential code injection', severity: 'error' as const },
    { pattern: /\bsetTimeout\s*\(\s*['"`]/gi, message: 'setTimeout with string is blocked', severity: 'error' as const },
    { pattern: /\bsetInterval\s*\(\s*['"`]/gi, message: 'setInterval with string is blocked', severity: 'error' as const },

    // DOM manipulation
    { pattern: /\bdocument\.write\s*\(/gi, message: 'document.write() is blocked', severity: 'error' as const },
    { pattern: /\.innerHTML\s*=/gi, message: 'innerHTML assignment is risky - use textContent', severity: 'warning' as const },
    { pattern: /\.outerHTML\s*=/gi, message: 'outerHTML assignment is blocked', severity: 'error' as const },
    { pattern: /document\.createElement\s*\(\s*['"`]script/gi, message: 'Dynamic script creation is blocked', severity: 'error' as const },

    // Network requests
    { pattern: /fetch\s*\(\s*['"`]http/gi, message: 'External HTTP requests are blocked', severity: 'error' as const },
    { pattern: /\bXMLHttpRequest\b/gi, message: 'XMLHttpRequest is blocked', severity: 'error' as const },
    { pattern: /\bWebSocket\s*\(/gi, message: 'WebSocket connections are blocked', severity: 'error' as const },
    { pattern: /\bimportScripts\s*\(/gi, message: 'importScripts is blocked', severity: 'error' as const },

    // Storage/cookies
    { pattern: /\blocalStorage\b/gi, message: 'localStorage access is blocked', severity: 'warning' as const },
    { pattern: /\bsessionStorage\b/gi, message: 'sessionStorage access is blocked', severity: 'warning' as const },
    { pattern: /\bdocument\.cookie\b/gi, message: 'Cookie access is blocked', severity: 'error' as const },

    // Window manipulation
    { pattern: /\bwindow\.open\s*\(/gi, message: 'window.open() is blocked', severity: 'error' as const },
    { pattern: /\bwindow\.location\s*=/gi, message: 'Redirect attempts are blocked', severity: 'error' as const },
    { pattern: /\blocation\.href\s*=/gi, message: 'Redirect attempts are blocked', severity: 'error' as const },
    { pattern: /\bhistory\.(pushState|replaceState)\s*\(/gi, message: 'History manipulation is blocked', severity: 'warning' as const },
];

// Patterns that indicate potential infinite loops or resource bombs
const RESOURCE_PATTERNS = [
    { pattern: /while\s*\(\s*true\s*\)/gi, message: 'Infinite while(true) loop detected', severity: 'error' as const },
    { pattern: /while\s*\(\s*1\s*\)/gi, message: 'Infinite while(1) loop detected', severity: 'error' as const },
    { pattern: /for\s*\(\s*;\s*;\s*\)/gi, message: 'Infinite for(;;) loop detected', severity: 'error' as const },
    { pattern: /for\s*\(\s*;;\s*\)/gi, message: 'Infinite for loop detected', severity: 'error' as const },
    { pattern: /new\s+Array\s*\(\s*\d{7,}\s*\)/gi, message: 'Large array allocation detected (potential memory bomb)', severity: 'error' as const },
    { pattern: /\.fill\s*\([^)]*\)\s*\.map/gi, message: 'Potentially expensive array operation', severity: 'warning' as const },
    { pattern: /requestAnimationFrame\s*\([^)]*requestAnimationFrame/gi, message: 'Nested requestAnimationFrame detected', severity: 'warning' as const },
];

// Three.js deprecated or problematic APIs
const THREEJS_PATTERNS = [
    // Deprecated APIs (Three.js r150+)
    { pattern: /\.computeFaceNormals\s*\(/gi, message: 'computeFaceNormals() is deprecated - use computeVertexNormals()', severity: 'warning' as const },
    { pattern: /THREE\.Geometry\b/gi, message: 'THREE.Geometry is deprecated - use THREE.BufferGeometry', severity: 'warning' as const },
    { pattern: /THREE\.Face3\b/gi, message: 'THREE.Face3 is deprecated', severity: 'warning' as const },
    { pattern: /\.computeCentroids\s*\(/gi, message: 'computeCentroids() is deprecated', severity: 'warning' as const },
    { pattern: /THREE\.ImageUtils\b/gi, message: 'THREE.ImageUtils is deprecated - use THREE.TextureLoader', severity: 'warning' as const },
    { pattern: /THREE\.FontLoader\b/gi, message: 'FontLoader moved to examples/jsm/loaders/', severity: 'info' as const },

    // Performance warnings
    { pattern: /new\s+THREE\.\w+Geometry\s*\([^)]*,\s*\d{3,}\s*,/gi, message: 'High segment count may impact performance', severity: 'warning' as const },
    { pattern: /\.clone\s*\(\s*\)\s*\.clone\s*\(/gi, message: 'Multiple clone() calls - consider refactoring', severity: 'warning' as const },

    // Common mistakes
    { pattern: /scene\.add\s*\(\s*geometry\s*\)/gi, message: 'Adding geometry directly - use Mesh(geometry, material)', severity: 'error' as const },
    { pattern: /new\s+THREE\.MeshBasicMaterial\s*\(\s*\)/gi, message: 'MeshBasicMaterial with no options - object will be black', severity: 'warning' as const },
];

// Environment-specific patterns (things our driver handles)
const ENVIRONMENT_PATTERNS = [
    { pattern: /^\s*import\s+/m, message: 'Import statements are handled by environment', shouldRemove: true },
    { pattern: /^\s*export\s+/m, message: 'Export statements are not needed', shouldRemove: true },
    { pattern: /new\s+THREE\.Scene\s*\(/gi, message: 'Scene is provided - use window.scene', shouldReplace: true },
    { pattern: /new\s+THREE\.WebGLRenderer\s*\(/gi, message: 'Renderer is provided - use window.renderer', shouldReplace: true },
    { pattern: /new\s+THREE\.PerspectiveCamera\s*\(/gi, message: 'Camera is provided - use window.camera', shouldReplace: true },
    { pattern: /new\s+OrbitControls\s*\(/gi, message: 'Controls are provided - use window.controls', shouldReplace: true },
];

const validateAndCleanCode = (code: string): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const originalLength = code.length;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Clean markdown artifacts
    // ═══════════════════════════════════════════════════════════════════════════
    let cleaned = code
        .replace(/```javascript\n?/gi, '')
        .replace(/```typescript\n?/gi, '')
        .replace(/```js\n?/gi, '')
        .replace(/```ts\n?/gi, '')
        .replace(/```html\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Extract JS from HTML if AI ignored instructions
    // ═══════════════════════════════════════════════════════════════════════════
    if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html') || cleaned.includes('<head')) {
        warnings.push('AI returned HTML structure when pure JS was expected - extracting JS code');

        const scriptMatches = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches && scriptMatches.length > 0) {
            const jsCode = scriptMatches
                .map(s => s.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, ''))
                .filter(s => s.trim().length > 0)
                .join('\n\n');
            if (jsCode.trim().length > 0) {
                cleaned = jsCode.trim();
            }
        }

        // Remove any remaining HTML tags
        cleaned = cleaned
            .replace(/<\/?html[^>]*>/gi, '')
            .replace(/<\/?head[^>]*>/gi, '')
            .replace(/<\/?body[^>]*>/gi, '')
            .replace(/<\/?style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<!DOCTYPE[^>]*>/gi, '')
            .trim();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Security validation
    // ═══════════════════════════════════════════════════════════════════════════
    for (const { pattern, message, severity } of SECURITY_PATTERNS) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(cleaned)) {
            if (severity === 'error') {
                errors.push(`🔒 SECURITY: ${message}`);
            } else {
                warnings.push(`⚠️ Security: ${message}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Resource/Performance validation
    // ═══════════════════════════════════════════════════════════════════════════
    for (const { pattern, message, severity } of RESOURCE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(cleaned)) {
            if (severity === 'error') {
                errors.push(`💥 RESOURCE: ${message}`);
                // Try to fix infinite loops by adding break condition
                cleaned = cleaned.replace(/while\s*\(\s*true\s*\)/gi, 'while(false /* BLOCKED: infinite loop */)');
                cleaned = cleaned.replace(/while\s*\(\s*1\s*\)/gi, 'while(false /* BLOCKED: infinite loop */)');
                cleaned = cleaned.replace(/for\s*\(\s*;\s*;\s*\)/gi, 'for(;false;) /* BLOCKED: infinite loop */');
            } else {
                warnings.push(`⚡ Performance: ${message}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Three.js API validation
    // ═══════════════════════════════════════════════════════════════════════════
    for (const { pattern, message, severity } of THREEJS_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(cleaned)) {
            if (severity === 'error') {
                errors.push(`🎨 Three.js: ${message}`);
            } else if (severity === 'warning') {
                warnings.push(`🎨 Three.js: ${message}`);
            }
            // Info level is logged but not added to warnings
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Environment compatibility - Fix common issues
    // ═══════════════════════════════════════════════════════════════════════════

    // Remove import statements
    if (/^\s*import\s+/m.test(cleaned)) {
        warnings.push('📦 Removed import statements (handled by environment)');
        cleaned = cleaned.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*\n?/gm, '');
        cleaned = cleaned.replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*\n?/gm, '');
    }

    // Remove export statements
    if (/^\s*export\s+/m.test(cleaned)) {
        warnings.push('📦 Removed export statements (not needed)');
        cleaned = cleaned.replace(/^\s*export\s+(default\s+)?/gm, '');
    }

    // Fix scene/camera/renderer references
    const sceneCreationPattern = /(const|let|var)\s+(scene)\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/gi;
    if (sceneCreationPattern.test(cleaned)) {
        warnings.push('🔧 Replaced scene creation with window.scene reference');
        cleaned = cleaned.replace(sceneCreationPattern, 'const scene = window.scene; // Using existing scene');
    }

    const rendererCreationPattern = /(const|let|var)\s+(renderer)\s*=\s*new\s+THREE\.WebGLRenderer\s*\([^)]*\)\s*;?/gi;
    if (rendererCreationPattern.test(cleaned)) {
        warnings.push('🔧 Replaced renderer creation with window.renderer reference');
        cleaned = cleaned.replace(rendererCreationPattern, 'const renderer = window.renderer; // Using existing renderer');
    }

    const cameraCreationPattern = /(const|let|var)\s+(camera)\s*=\s*new\s+THREE\.PerspectiveCamera\s*\([^)]*\)\s*;?/gi;
    if (cameraCreationPattern.test(cleaned)) {
        warnings.push('🔧 Replaced camera creation with window.camera reference');
        cleaned = cleaned.replace(cameraCreationPattern, 'const camera = window.camera; // Using existing camera');
    }

    // Fix bare scene.add() calls (not window.scene.add())
    // Use negative lookbehind to avoid matching window.scene.add
    cleaned = cleaned.replace(/(?<!window\.)(?<!this\.)scene\.add\s*\(/g, 'window.scene.add(');
    cleaned = cleaned.replace(/(?<!window\.)(?<!this\.)scene\.remove\s*\(/g, 'window.scene.remove(');

    // Fix render loop removal (we have our own)
    cleaned = cleaned.replace(/function\s+animate\s*\(\s*\)\s*\{[\s\S]*?requestAnimationFrame\s*\(\s*animate\s*\)[\s\S]*?\}/gi,
        '// [REMOVED] Render loop - using environment render loop');

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 7: Code structure validation
    // ═══════════════════════════════════════════════════════════════════════════

    // Check for balanced braces
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        warnings.push(`⚠️ Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for balanced parentheses
    const openParens = (cleaned.match(/\(/g) || []).length;
    const closeParens = (cleaned.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        warnings.push(`⚠️ Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 8: Syntax validation
    // ═══════════════════════════════════════════════════════════════════════════
    try {
        // Try to parse as a function body
        new Function(cleaned);
    } catch (e: any) {
        const errorMsg = e.message || 'Unknown syntax error';
        errors.push(`❌ Syntax Error: ${errorMsg}`);

        // Try to provide more helpful error info
        const lineMatch = errorMsg.match(/line\s*(\d+)/i);
        if (lineMatch) {
            const lineNum = parseInt(lineMatch[1], 10);
            const lines = cleaned.split('\n');
            if (lineNum > 0 && lineNum <= lines.length) {
                errors.push(`   Line ${lineNum}: ${lines[lineNum - 1].trim().substring(0, 50)}...`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 9: Calculate stats
    // ═══════════════════════════════════════════════════════════════════════════
    const linesOfCode = cleaned.split('\n').filter(l => l.trim().length > 0).length;
    let complexity: 'low' | 'medium' | 'high' = 'low';

    // Simple complexity heuristic
    const nestedLoops = (cleaned.match(/for\s*\([^)]*\)\s*\{[^}]*for\s*\(/g) || []).length;
    const callbacks = (cleaned.match(/=>\s*\{/g) || []).length;
    const conditionals = (cleaned.match(/if\s*\(/g) || []).length;

    const complexityScore = nestedLoops * 3 + callbacks + conditionals;
    if (complexityScore > 10) complexity = 'high';
    else if (complexityScore > 5) complexity = 'medium';

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGGING
    // ═══════════════════════════════════════════════════════════════════════════
    if (warnings.length > 0) {
        console.warn('[AI Validation] Warnings:', warnings);
    }
    if (errors.length > 0) {
        console.error('[AI Validation] Errors:', errors);
    }
    console.log(`[AI Validation] Stats: ${linesOfCode} lines, complexity: ${complexity}`);

    return {
        isValid: errors.length === 0,
        cleanedCode: cleaned,
        warnings,
        errors,
        stats: {
            originalLength,
            cleanedLength: cleaned.length,
            linesOfCode,
            complexity
        }
    };
};

export const fixThreeJSCode = async (code: string, error: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Fix the following Three.js code which produced this runtime error: "${error}".

CRITICAL RULES:
1. Fix the specific error mentioned
2. DO NOT delete existing logic unless it causes the error
3. Return ONLY pure JavaScript code (no HTML, no imports)
4. The environment provides: THREE, window.scene, window.camera, window.renderer, window.controls
5. Use window.scene.add() to add objects

Code to Fix:
${code}

Return ONLY the fixed JavaScript code.`,
        config: { thinkingConfig: { thinkingBudget: 2048 } }
    });

    let text = getText(response);

    // Validate and clean the output
    const validation = validateAndCleanCode(text);
    return validation.cleanedCode;
};

// Ecom Designer

export const analyzeProductIdentity = async (base64Images: string[]): Promise<string> => {
    // Only use first image for analysis to save tokens/bandwidth if multiple
    if (!base64Images || base64Images.length === 0) return "A generic product";

    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Images[0].split(',')[1]
        }
    };
    
    const response = await backend.ai.generateContent({
        model: 'gemini-2.5-flash-latest',
        contents: {
            role: 'user',
            parts: [
                imagePart,
                { text: "Analyze this product image. Describe its physical appearance, material, color, and key identifiable features in 2 sentences." }
            ]
        }
    });
    
    return getText(response);
};

export const generateSceneDescription = async (base64Images: string[], identity: string, intent: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Product Identity: ${identity}.
        User Intent: ${intent}.
        
        Create a detailed scene description for a professional product photoshoot. 
        Describe the lighting, background, props, and atmosphere. 
        Keep it concise but descriptive (approx 50 words).`
    });
    return getText(response);
};

export const generateEcommerceImage = async (
    base64Images: string[], 
    identity: string, 
    scenePrompt: string, 
    angle: string,
    aspectRatio: string,
    resolution: string
): Promise<string> => {
    if (!base64Images || base64Images.length === 0) throw new Error("No source images provided");

    // Use gemini-3-pro-image-preview for high quality
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Images[0].split(',')[1]
        }
    };
    
    const fullPrompt = `Professional product photography. 
    Product: ${identity}.
    Scene: ${scenePrompt}.
    Camera Angle: ${angle}.
    Ensure high fidelity, photorealistic lighting, and correct perspective.`;

    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                imagePart,
                { text: fullPrompt }
            ]
        },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : '1:1',
            }
        }
    });

    // Extract image
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image generated by AI.");
};


// Motion Studio

export const enhanceScenePrompt = async (prompt: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Enhance this 3D scene description for a generative Three.js script. Make it more descriptive about lighting, motion, and visual style: "${prompt}"`
    });
    return getText(response);
};

export const generateCreativeSceneCode = async (prompt: string, existingCode?: string, style: string = 'standard', hasImage: boolean = false): Promise<string> => {
    let systemPrompt = `You are a Three.js expert. Generate a single HTML file containing a Three.js scene.
    Style: ${style}.
    Requirements:
    1. Use standard CDN links for Three.js (unpkg or esm.sh).
    2. Include lighting, camera, and a renderer.
    3. If 'hasImage' is true, use 'window.PRODUCT_IMAGE_URL' as a texture on a central object.
    4. Make it animated and visually interesting.
    5. Handle window resize.
    6. Return ONLY the HTML code.
    `;
    
    if (existingCode) {
        systemPrompt += `\nUpdate the existing code based on the user request. Keep the structure.`;
    }

    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `User Prompt: ${prompt}.
        ${existingCode ? `Existing Code: \n${existingCode}` : ''}`,
        config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingBudget: 4096 }
        }
    });

    let text = getText(response);
    return text.replace(/```html/g, '').replace(/```/g, '');
};

// Movie Maker

export const enhanceCinematicPrompt = async (prompt: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Convert this simple direction into a cinematic shot description (camera movement, lighting, focal length): "${prompt}"`
    });
    return getText(response);
};

export const generateCinematicScene = async (prompt: string, duration: number, sceneNumber: number, prevScenePrompt?: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate Three.js code for Scene #${sceneNumber}.
        Description: ${prompt}.
        Duration: ${duration} seconds.
        ${prevScenePrompt ? `Previous Scene Context: ${prevScenePrompt}` : ''}
        
        Requirements:
        1. Self-contained HTML with Three.js.
        2. Cinematic camera animation matching the description.
        3. High quality lighting/shadows.
        4. Return ONLY HTML.`,
        config: { thinkingConfig: { thinkingBudget: 2048 } }
    });
    
    let text = getText(response);
    return text.replace(/```html/g, '').replace(/```/g, '');
};


// Animation Maker (3D Builder)

export const suggestProjectCategories = async (desc: string): Promise<CategorySuggestion[]> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest 3 categories for a 3D project described as: "${desc}". Return JSON array with 'title' and 'description'.`,
        config: { responseMimeType: 'application/json' }
    });
    
    const text = getText(response);
    const result = getJSON(text);
    return Array.isArray(result) ? result : [{ title: 'General', description: 'General 3D Project' }];
};

export const enhanceUserPrompt = async (prompt: string, category: string, mode: WorkspaceMode): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Enhance this 3D modeling prompt for a ${mode} workflow in category ${category}: "${prompt}". Make it precise and technical.`
    });
    return getText(response);
};

// Scene graph data for context awareness
export interface SceneGraphItem {
    id: string;
    name: string;
    type: string;
    visible: boolean;
    selected: boolean;
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
}

export const generateAnimationCode = async (
    prompt: string,
    existingCode: string | undefined,
    imagesToUse: string[],  // Changed: now accepts array of images for multi-view analysis
    category: string,
    workspaceMode: WorkspaceMode,
    sceneGraph?: SceneGraphItem[]  // NEW: Scene context for spatial awareness
): Promise<GenerationResult> => {

    const systemPrompt = `You are an expert Three.js developer. Generate ONLY JavaScript code for a 3D modeling tool.

MODE: ${workspaceMode} (${category})

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════
Return ONLY pure JavaScript code. NO HTML tags, NO imports, NO scene/camera/renderer creation.
Your code will be automatically wrapped and executed in a pre-configured Three.js environment.

WRONG OUTPUT (will break):
\`\`\`
<!DOCTYPE html>
<html>
<script type="module">
import * as THREE from 'three';
const scene = new THREE.Scene();
\`\`\`

CORRECT OUTPUT:
\`\`\`
// Create geometry and material
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({ color: 0x6366f1 });
const cube = new THREE.Mesh(geometry, material);
cube.name = "MyCube";
cube.position.y = 1;
window.scene.add(cube);
\`\`\`

═══════════════════════════════════════════════════════════════════════════════
AVAILABLE GLOBALS (already initialized, DO NOT recreate):
═══════════════════════════════════════════════════════════════════════════════
- THREE              → Full Three.js library (THREE.BoxGeometry, THREE.Mesh, etc.)
- window.scene       → THREE.Scene instance (add objects here)
- window.camera      → THREE.PerspectiveCamera (positioned at 5,5,5)
- window.renderer    → THREE.WebGLRenderer (shadows enabled)
- window.controls    → OrbitControls instance
- window.GUI         → GUI class for parameter controls

═══════════════════════════════════════════════════════════════════════════════
ADDING OBJECTS TO SCENE:
═══════════════════════════════════════════════════════════════════════════════
Always use: window.scene.add(yourMesh)
Always set: mesh.name = "DescriptiveName"

═══════════════════════════════════════════════════════════════════════════════
GUI CONTROLS (optional but recommended):
═══════════════════════════════════════════════════════════════════════════════
const params = { width: 2, height: 2, color: 0x6366f1 };
const gui = new window.GUI();
gui.add(params, 'width', 0.1, 10).name('Width').onChange(updateMesh);
gui.add(params, 'height', 0.1, 10).name('Height').onChange(updateMesh);
gui.addColor(params, 'color').name('Color').onChange(updateMesh);

═══════════════════════════════════════════════════════════════════════════════
MATERIALS (use MeshStandardMaterial for best results):
═══════════════════════════════════════════════════════════════════════════════
const material = new THREE.MeshStandardMaterial({
  color: 0x6366f1,
  roughness: 0.4,
  metalness: 0.1
});

═══════════════════════════════════════════════════════════════════════════════
REMEMBER:
═══════════════════════════════════════════════════════════════════════════════
1. Output ONLY JavaScript - no HTML, no imports, no module syntax
2. Use window.scene.add() to add objects
3. Always name your meshes with mesh.name = "..."
4. Position objects above the grid (y > 0) so they're visible
5. Use MeshStandardMaterial for objects (lighting is pre-configured)
`;

    // Inject learning context from previous successful generations
    const learningContext = successTracking.buildContextForPrompt();

    // Perform multi-view analysis if multiple images provided
    let multiViewContext = '';
    if (imagesToUse && imagesToUse.length > 1) {
        console.log(`[AI Generation] Analyzing ${imagesToUse.length} images for multi-view context...`);
        try {
            const multiViewAnalysis = await analyzeMultipleViews(imagesToUse);
            if (multiViewAnalysis) {
                multiViewContext = buildMultiViewContext(multiViewAnalysis);
                console.log('[AI Generation] Multi-view analysis complete:', {
                    views: multiViewAnalysis.views.length,
                    complexity: multiViewAnalysis.estimatedComplexity
                });
            }
        } catch (error) {
            console.warn('[AI Generation] Multi-view analysis failed, proceeding without:', error);
        }
    }

    // Build scene context for spatial awareness (avoid overlaps, maintain consistency)
    let sceneContext = '';
    if (sceneGraph && sceneGraph.length > 0) {
        console.log(`[AI Generation] Building scene context from ${sceneGraph.length} objects...`);
        try {
            const context = buildSceneContext(sceneGraph);
            if (context) {
                sceneContext = buildSceneContextForPrompt(context);
                console.log('[AI Generation] Scene context built:', {
                    objectCount: context.totalObjectCount,
                    suggestedPlacement: context.suggestedPlacement.reason
                });
            }
        } catch (error) {
            console.warn('[AI Generation] Scene context build failed, proceeding without:', error);
        }
    }

    const textContent = `User Prompt: ${prompt}.
        ${existingCode ? `Existing Code (Update this): \n${existingCode}` : ''}${learningContext}${multiViewContext}${sceneContext}`;

    // Debug: Log API call
    debug.generationAPICall('gemini-3-pro-preview', systemPrompt.length, textContent.length);

    try {
        // Build content with images if provided (supports multiple images for multi-view analysis)
        let contents: any;
        if (imagesToUse && imagesToUse.length > 0) {
            // Build parts array with all images
            const imageParts = imagesToUse.map((image, index) => {
                const base64Data = image.split(',')[1];
                const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
                return {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                };
            });

            // Construct multi-image analysis instructions
            const imageCount = imagesToUse.length;
            const multiImageInstructions = imageCount > 1
                ? `
MULTI-VIEW IMAGE ANALYSIS (${imageCount} images provided):
1. Analyze ALL ${imageCount} reference images together - they show the SAME object from different angles
2. Use multiple views to understand the complete 3D structure:
   - Compare front/back views for depth estimation
   - Use side views for width and profile shapes
   - Top/bottom views reveal hidden geometry
3. Cross-reference details between images to ensure accuracy
4. Resolve ambiguities by comparing corresponding features across views
5. Build a coherent 3D model that matches ALL provided views`
                : `
SINGLE IMAGE ANALYSIS:
1. Analyze the reference image for geometric shapes and proportions
2. Identify structural elements, colors, and textures
3. Infer hidden/back geometry based on visible structure`;

            contents = {
                role: 'user',
                parts: [
                    ...imageParts,  // All images first
                    { text: textContent + `

${multiImageInstructions}

3D RECONSTRUCTION REQUIREMENTS:
- Extract accurate proportions from the reference image(s)
- Identify primary shapes (boxes, cylinders, spheres, etc.)
- Note colors, materials, and surface properties
- Create Three.js meshes that represent the object accurately

OUTPUT REQUIREMENTS (same as above):
- Return ONLY pure JavaScript code
- NO HTML, NO imports, NO scene creation
- Use window.scene.add() to add objects
- Add GUI controls for key parameters (dimensions, colors)
- Name each mesh descriptively based on what it represents` }
                ]
            };
        } else {
            contents = textContent;
        }

        const response = await backend.ai.generateContent({
            model: 'gemini-3-pro-preview',  // Best model for image analysis and 3D generation
            contents: contents,
            config: {
                systemInstruction: systemPrompt,
                // Gemini 3 uses thinking_level instead of thinkingBudget
                thinkingConfig: { thinkingLevel: 'high' }
            }
        });

        let text = getText(response);

        // Validate and clean the AI output
        const validation = validateAndCleanCode(text);

        // Debug: Log API response
        debug.generationAPIResponse(validation.cleanedCode.length, false);

        // Log validation results for debugging
        if (validation.warnings.length > 0) {
            console.log('[AI Code Validation] Warnings:', validation.warnings);
        }

        if (!validation.isValid) {
            console.error('[AI Code Validation] Errors:', validation.errors);
            // Still return the cleaned code, let the iframe handle runtime errors
        }

        // Return both code and validation for UI display
        return {
            code: validation.cleanedCode,
            validation: validation
        };
    } catch (error: any) {
        debug.generationAPIResponse(0, true);
        throw error;
    }
};
