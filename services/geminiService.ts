
import { backend } from './backend';
import { WorkspaceMode } from '../components/AnimationMaker/types';
import { debug } from './debugService';

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

// AI Output Validation and Cleaning
interface ValidationResult {
    isValid: boolean;
    cleanedCode: string;
    warnings: string[];
    errors: string[];
}

const validateAndCleanCode = (code: string): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Step 1: Clean markdown artifacts
    let cleaned = code
        .replace(/```javascript\n?/gi, '')
        .replace(/```js\n?/gi, '')
        .replace(/```html\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

    // Step 2: Check for dangerous patterns
    const dangerousPatterns = [
        { pattern: /\beval\s*\(/gi, message: 'eval() is not allowed' },
        { pattern: /\bnew\s+Function\s*\(/gi, message: 'new Function() is not allowed' },
        { pattern: /\bdocument\.write\s*\(/gi, message: 'document.write() is not allowed' },
        { pattern: /fetch\s*\(\s*['"`]http/gi, message: 'External fetch requests are not allowed' },
        { pattern: /XMLHttpRequest/gi, message: 'XMLHttpRequest is not allowed' },
        { pattern: /\.innerHTML\s*=/gi, message: 'innerHTML assignment is discouraged' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(cleaned)) {
            warnings.push(message);
        }
    }

    // Step 3: Check for HTML artifacts that shouldn't be there
    if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html')) {
        warnings.push('AI returned HTML structure when pure JS was expected. Attempting to extract JS code.');

        // Try to extract JS from script tags
        const scriptMatch = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatch) {
            // Extract content from script tags
            const jsCode = scriptMatch
                .map(s => s.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, ''))
                .join('\n');
            cleaned = jsCode.trim();
        }
    }

    // Step 4: Check for import statements (not allowed in our environment)
    if (/^\s*import\s+/m.test(cleaned)) {
        warnings.push('Import statements detected - these are handled by the environment. Removing them.');
        cleaned = cleaned.replace(/^\s*import\s+.*?[;\n]/gm, '// [REMOVED IMPORT]\n');
    }

    // Step 5: Check for scene/camera/renderer creation (not allowed)
    if (/new\s+THREE\.Scene\s*\(/gi.test(cleaned)) {
        warnings.push('Scene creation detected - using existing window.scene instead.');
        cleaned = cleaned.replace(/const\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/gi, '// Using window.scene instead');
        cleaned = cleaned.replace(/let\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/gi, '// Using window.scene instead');
        cleaned = cleaned.replace(/var\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/gi, '// Using window.scene instead');
    }

    if (/new\s+THREE\.(WebGLRenderer|PerspectiveCamera)\s*\(/gi.test(cleaned)) {
        warnings.push('Renderer/Camera creation detected - using existing window.renderer/camera instead.');
    }

    // Step 6: Replace bare 'scene.' with 'window.scene.'
    cleaned = cleaned.replace(/(?<!window\.)scene\.add\(/g, 'window.scene.add(');

    // Step 7: Basic syntax check (try to parse as a function body)
    try {
        // Wrap in function to check if it's valid JS
        new Function(cleaned);
    } catch (e: any) {
        errors.push(`Syntax error in generated code: ${e.message}`);
    }

    // Log warnings/errors
    if (warnings.length > 0) {
        console.warn('[AI Validation Warnings]', warnings);
    }
    if (errors.length > 0) {
        console.error('[AI Validation Errors]', errors);
    }

    return {
        isValid: errors.length === 0,
        cleanedCode: cleaned,
        warnings,
        errors
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

export const generateAnimationCode = async (
    prompt: string,
    existingCode: string | undefined,
    imageToUse: string | undefined,
    category: string,
    workspaceMode: WorkspaceMode
): Promise<string> => {

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

    const textContent = `User Prompt: ${prompt}.
        ${existingCode ? `Existing Code (Update this): \n${existingCode}` : ''}`;

    // Debug: Log API call
    debug.generationAPICall('gemini-3-pro-preview', systemPrompt.length, textContent.length);

    try {
        // Build content with image if provided
        let contents: any;
        if (imageToUse) {
            // Extract base64 data from data URL
            const base64Data = imageToUse.split(',')[1];
            const mimeType = imageToUse.split(';')[0].split(':')[1] || 'image/jpeg';

            contents = {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    },
                    { text: textContent + `

IMAGE ANALYSIS INSTRUCTIONS:
1. Analyze the reference image for geometric shapes and proportions
2. Identify structural elements, colors, and textures
3. Create Three.js meshes that represent the image accurately

OUTPUT REQUIREMENTS (same as above):
- Return ONLY pure JavaScript code
- NO HTML, NO imports, NO scene creation
- Use window.scene.add() to add objects
- Add GUI controls for key parameters
- Name each mesh descriptively` }
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

        return validation.cleanedCode;
    } catch (error: any) {
        debug.generationAPIResponse(0, true);
        throw error;
    }
};
