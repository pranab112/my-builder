
import { backend } from './backend';
import { WorkspaceMode } from '../components/AnimationMaker/types';
import { LabeledImage } from '../types';

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

// Helper to get mime type from base64 data URL
const getMimeType = (dataUrl: string): string => {
    const match = dataUrl.match(/^data:(.*);base64,/);
    return match ? match[1] : 'image/jpeg';
};

export const fixThreeJSCode = async (code: string, error: string): Promise<string> => {
    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Fix the following Three.js code which produced this runtime error: "${error}".
        
        CRITICAL RULES:
        1. Fix the specific error mentioned.
        2. DO NOT delete existing logic or features unless they are the cause of the error.
        3. Ensure the result is a COMPLETE, self-contained HTML file.
        4. Do NOT use import maps (they are pre-injected in this environment). Use standard imports provided in the original code.
        5. Ensure 'window.scene', 'window.camera', etc., are still assigned.
        
        Code to Fix:
        ${code}
        
        Return ONLY the fixed full HTML code.`,
        config: { thinkingConfig: { thinkingBudget: 2048 } }
    });
    
    let text = getText(response);
    text = text.replace(/```html/g, '').replace(/```/g, '');
    return text;
};

// --- ECOM DESIGNER: STAGE 1 (BRAND ANALYSIS) ---

export const analyzeBrandAssets = async (brandLogos: string[]): Promise<string> => {
    if (!brandLogos || brandLogos.length === 0) return "";

    const parts: any[] = [];
    brandLogos.forEach((logo, index) => {
        parts.push({
            inlineData: {
                mimeType: getMimeType(logo),
                data: logo.split(',')[1]
            }
        });
        parts.push({ text: `[OFFICIAL LOGO FILE #${index + 1}]` });
    });

    const prompt = `
    You are a Brand Compliance Officer. Analyze these official logo files.
    
    OUTPUT REQUIREMENTS:
    1. Identify the exact text content (if any).
    2. Describe the color palette (Hex codes if possible).
    3. Describe the shape geometry (Circular, Rectangular, wordmark).
    4. Note transparency or background details.
    
    Your goal is to establish the "Ground Truth" for this brand identity so it is never hallucinated later.
    `;

    parts.push({ text: prompt });

    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { role: 'user', parts: parts },
        config: { temperature: 0.1 }
    });

    return getText(response);
};

// --- ECOM DESIGNER: STAGE 2 (PRODUCT STRUCTURE MAPPING) ---

export const analyzeProductIdentity = async (images: (string | LabeledImage)[], brandAnalysisContext: string = ""): Promise<string> => {
    if (!images || images.length === 0) return "A generic product";

    const parts: any[] = [];
    let contextDescription = "Input Images Analysis:\n";

    // Add Product Images
    images.forEach((img, idx) => {
        const isLabeled = typeof img !== 'string';
        const data = isLabeled ? (img as LabeledImage).data : (img as string);
        const label = isLabeled ? (img as LabeledImage).label : 'Unknown View';
        const desc = isLabeled ? (img as LabeledImage).description : '';

        parts.push({
            inlineData: {
                mimeType: getMimeType(data),
                data: data.split(',')[1]
            }
        });
        
        const refName = `[PRODUCT REFERENCE #${idx + 1}]`;
        parts.push({ text: refName });
        contextDescription += `${refName} is a ${label}. ${desc ? `Context: ${desc}.` : ''}\n`;
    });

    // FORENSIC ANALYSIS PROMPT
    const analysisPrompt = `
    You are a forensic product analyst for a high-end CGI studio. 
    
    ${contextDescription}
    
    ${brandAnalysisContext ? `OFFICIAL BRAND GUIDELINES (Use this to identify logos on the product): \n${brandAnalysisContext}` : ''}
    
    INSTRUCTIONS:
    1. **Geometry & Material**: Describe the product's physical shape and material finish (e.g., "Matte Aluminum", "Heavy Cotton Jersey"). Rely on 'Global View' for shape and 'Close-up' for texture.
    2. **Logo Mapping**: If you see a logo on the [PRODUCT REFERENCE] that matches the OFFICIAL BRAND GUIDELINES:
       - State EXACTLY where it is located (e.g., "Centered on chest", "Bottom right corner").
       - Describe how the material affects the logo (e.g., "Embroidered", "Screen printed", "Etched").
    3. **Invariant Features**: List 3 geometric details that MUST NOT change to prevent hallucination.
    
    Output a comprehensive description starting with "A photorealistic replica of..."
    `;

    parts.push({ text: analysisPrompt });
    
    // Using gemini-3-pro-preview.
    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            role: 'user',
            parts: parts
        },
        config: {
            temperature: 0.1 // Low temp for factual accuracy
        }
    });
    
    return getText(response);
};

export const generateSceneDescription = async (base64Images: (string | LabeledImage)[], identity: string, intent: string): Promise<string> => {
    // For scene description, we mostly care about the "Global View" to understand scale/context
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Product Identity: ${identity}.
        User Intent: ${intent}.
        
        Create a detailed scene description for a high-end, lifestyle product photograph.
        Avoid generic "studio backgrounds". Instead, describe a realistic environment with natural lighting, texture, and depth.
        Focus on "Golden Hour", "Soft Sunlight", "Real world textures (wood, concrete, fabric)".
        Keep it concise but evocative (approx 50 words).`
    });
    return getText(response);
};

// --- ECOM DESIGNER: STAGE 3 (GENERATION) ---

export const generateEcommerceImage = async (
    images: (string | LabeledImage)[], 
    identity: string, 
    scenePrompt: string, 
    angle: string,
    aspectRatio: string,
    resolution: string,
    brandLogos?: string[]
): Promise<string> => {
    if (!images || images.length === 0) throw new Error("No source images provided");

    const inputParts: any[] = [];
    let imageContext = "REFERENCE IMAGE MANIFEST:\n";

    // Map all uploaded images to parts with correct mime types
    images.forEach((img, idx) => {
        const isLabeled = typeof img !== 'string';
        const data = isLabeled ? (img as LabeledImage).data : (img as string);
        const label = isLabeled ? (img as LabeledImage).label : 'Reference';
        const desc = isLabeled ? (img as LabeledImage).description : '';

        inputParts.push({
            inlineData: {
                mimeType: getMimeType(data),
                data: data.split(',')[1]
            }
        });
        
        const refTag = `[REF_${idx+1}]`;
        inputParts.push({ text: refTag });
        imageContext += `${refTag}: ${label} - ${desc || "Standard view"}.\n`;
    });
    
    // Add multiple logos to generation context
    if (brandLogos && brandLogos.length > 0) {
        brandLogos.forEach((logo, index) => {
            inputParts.push({
                inlineData: {
                    mimeType: getMimeType(logo),
                    data: logo.split(',')[1]
                }
            });
            inputParts.push({ text: `[LOGO_OPTION_${index + 1}]` });
        });
        inputParts.push({ text: "INSTRUCTION: Use the provided [LOGO_OPTION_X] assets for branding." });
    }

    const fullPrompt = `
    ROLE: Virtual Product Photographer.
    TASK: Place the EXACT product from the reference images into a new environment.
    
    ${imageContext}
    
    PRODUCT DNA (Verified):
    ${identity}
    
    CRITICAL BRANDING RULES (ZERO TOLERANCE):
    1. **Logo Substitution**: If the product description mentions a logo location, you MUST overlay the provided [LOGO_OPTION_X] at that exact position.
    2. **Pixel Fidelity**: Do NOT try to generate the text or logo graphics yourself. Use the visual information from [LOGO_OPTION_X] as a texture map. The text spelling and font must match [LOGO_OPTION_X] perfectly.
    3. **Transparency**: [LOGO_OPTION_X] has a transparent background. Composite it cleanly onto the product surface (fabric/metal/plastic) affecting only the lighting/shading, not the logo shape.
    
    CRITICAL GEOMETRY RULES:
    1. **Shape Preservation**: The product's silhouette must match [Global View] references exactly. Do not hallucinate new buttons, seams, or changes in aspect ratio.
    2. **Material Accuracy**: Ensure the material defined in PRODUCT DNA (e.g. Cotton, Aluminum) is rendered with physically correct roughness and reflections.
    
    SCENE SETTING:
    ${scenePrompt}
    
    CAMERA ANGLE:
    ${angle}

    PHOTOGRAPHIC STYLE:
    Shot on Phase One XF IQ4 (150MP). Sharp focus on the product. Natural depth of field. Commercial lighting.
    `;

    // Using gemini-3-pro-image-preview for maximum quality.
    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                ...inputParts,
                { text: fullPrompt }
            ]
        },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : '1:1',
                imageSize: resolution === '4K' ? '4K' : '2K'
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
    
    const systemPrompt = `You are an expert Three.js developer building a parametric 3D modeling tool.
    Mode: ${workspaceMode} (${category}).
    
    Your goal: Generate a script that constructs a 3D scene/model based on the user prompt.
    
    CRITICAL ENVIRONMENT DETAILS:
    1. The environment has a pre-loaded 'window.scene', 'window.camera', 'window.renderer', 'window.controls'.
    2. DO NOT create scene/camera/renderer. Use the existing global variables.
    3. You must create meshes/lights and add them to 'window.scene'.
    4. If the user asks for a specific shape, use Three.js geometries or CSG.
    5. If 'imageToUse' is provided, load it as a texture.
    6. Expose key parameters (like dimensions, colors) to the GUI using: 
       'new window.GUI().add(object, "prop", min, max)'.
    
    Return ONLY the code inside the script tag (or just the JS logic if updating).
    Actually, return full HTML structure but assume the driver script is injected by the host. 
    However, for simplicity in this system, provide the FULL HTML including your logic in a <script type="module">.
    The host will inject the necessary import maps and driver setup code. You focus on the logic that runs AFTER init.
    
    Use 'window.scene.add(mesh)' to show objects.
    `;

    const response = await backend.ai.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `User Prompt: ${prompt}.
        ${existingCode ? `Existing Code (Update this): \n${existingCode}` : ''}
        ${imageToUse ? 'Has Reference Image: Yes' : ''}`,
        config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingBudget: 4096 }
        }
    });

    let text = getText(response);
    return text.replace(/```html/g, '').replace(/```/g, '');
};
