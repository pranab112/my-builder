/**
 * Texture Service
 *
 * AI-powered texture generation and UV mapping utilities for 3D objects.
 * Uses Gemini's image generation to create PBR textures from text descriptions.
 */

import { backend } from './backend';

// Texture types for PBR workflow
export type TextureType = 'diffuse' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'height';

export interface TextureConfig {
    enabled: boolean;
    prompt: string;
    diffuseMap?: string;      // Base64 or URL
    normalMap?: string;
    roughnessMap?: string;
    metalnessMap?: string;
    aoMap?: string;           // Ambient occlusion
    repeatX: number;
    repeatY: number;
    rotation: number;         // In degrees
}

export interface TextureGenerationResult {
    success: boolean;
    diffuseMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    error?: string;
}

// Texture presets for quick selection
export const TEXTURE_PRESETS = [
    { id: 'wood_oak', label: 'Oak Wood', prompt: 'Seamless oak wood grain texture, natural brown, detailed grain pattern' },
    { id: 'wood_walnut', label: 'Walnut Wood', prompt: 'Seamless dark walnut wood texture, rich brown, fine grain' },
    { id: 'metal_steel', label: 'Brushed Steel', prompt: 'Seamless brushed stainless steel texture, metallic, subtle scratches' },
    { id: 'metal_copper', label: 'Aged Copper', prompt: 'Seamless aged copper texture with green patina, weathered' },
    { id: 'stone_marble', label: 'White Marble', prompt: 'Seamless white marble texture, grey veins, polished surface' },
    { id: 'stone_granite', label: 'Grey Granite', prompt: 'Seamless grey granite texture, speckled, natural stone' },
    { id: 'fabric_leather', label: 'Brown Leather', prompt: 'Seamless brown leather texture, natural grain, soft matte' },
    { id: 'fabric_canvas', label: 'Canvas', prompt: 'Seamless canvas fabric texture, woven pattern, natural beige' },
    { id: 'concrete', label: 'Concrete', prompt: 'Seamless concrete texture, grey, subtle cracks and imperfections' },
    { id: 'brick', label: 'Red Brick', prompt: 'Seamless red brick wall texture with mortar lines' },
    { id: 'plastic_matte', label: 'Matte Plastic', prompt: 'Seamless matte plastic texture, smooth, solid color' },
    { id: 'plastic_glossy', label: 'Glossy Plastic', prompt: 'Seamless glossy plastic texture, reflective, clean' },
    { id: 'rubber', label: 'Rubber', prompt: 'Seamless black rubber texture, slight texture, matte' },
    { id: 'gold', label: 'Gold', prompt: 'Seamless polished gold texture, highly reflective, warm tone' },
    { id: 'custom', label: 'Custom...', prompt: '' },
];

// Helper to extract text from Gemini response
const getText = (response: any): string => {
    if (!response) return "";
    if (response.text) return response.text;
    if (response.candidates?.[0]?.content?.parts) {
        return response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
    }
    return "";
};

// Helper to extract image from Gemini response
const getImage = (response: any): string | null => {
    if (response?.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
};

/**
 * Generate a seamless texture from a text prompt using AI
 */
export const generateTexture = async (
    prompt: string,
    options: {
        size?: '512' | '1024' | '2048';
        style?: 'photorealistic' | 'stylized' | 'cartoon';
        seamless?: boolean;
    } = {}
): Promise<TextureGenerationResult> => {
    const { size = '1024', style = 'photorealistic', seamless = true } = options;

    const fullPrompt = `Generate a ${seamless ? 'seamless tileable' : ''} ${style} texture for 3D modeling.

TEXTURE DESCRIPTION: ${prompt}

REQUIREMENTS:
- Square ${size}x${size} pixel image
- ${seamless ? 'MUST be seamless/tileable (edges wrap perfectly)' : 'Standard texture'}
- Suitable for PBR material workflow
- Top-down view, no perspective
- Even lighting, no harsh shadows
- High detail, realistic surface properties

OUTPUT: A single texture image, nothing else.`;

    try {
        console.log('[TextureService] Generating texture:', prompt);

        const response = await backend.ai.generateContent({
            model: 'gemini-2.0-flash-exp',  // Image generation capable model
            contents: fullPrompt,
            config: {
                responseModalities: ['image', 'text'],
            }
        });

        const imageData = getImage(response);

        if (imageData) {
            console.log('[TextureService] Texture generated successfully');
            return {
                success: true,
                diffuseMap: imageData
            };
        }

        // Fallback: Try with imagen model if available
        console.warn('[TextureService] No image in response, trying alternative...');

        return {
            success: false,
            error: 'Failed to generate texture image. The AI model may not support image generation.'
        };

    } catch (error: any) {
        console.error('[TextureService] Generation failed:', error);
        return {
            success: false,
            error: error.message || 'Texture generation failed'
        };
    }
};

/**
 * Generate a normal map from a diffuse texture
 * Uses AI to analyze the diffuse and create a matching normal map
 */
export const generateNormalMap = async (diffuseMap: string): Promise<string | null> => {
    try {
        const base64Data = diffuseMap.split(',')[1];
        const mimeType = diffuseMap.split(';')[0].split(':')[1] || 'image/png';

        const response = await backend.ai.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    },
                    {
                        text: `Convert this diffuse texture into a normal map for 3D rendering.

REQUIREMENTS:
- Output a normal map (RGB where R=X, G=Y, B=Z normals)
- Purple/blue dominant color (flat = 128,128,255)
- Bumps and indentations should be visible
- Same resolution as input
- Seamless if the input is seamless

OUTPUT: Only the normal map image, nothing else.`
                    }
                ]
            },
            config: {
                responseModalities: ['image', 'text'],
            }
        });

        return getImage(response);
    } catch (error) {
        console.error('[TextureService] Normal map generation failed:', error);
        return null;
    }
};

/**
 * Generate a complete PBR texture set from a single prompt
 */
export const generatePBRTextureSet = async (
    prompt: string,
    options: {
        includeNormal?: boolean;
        includeRoughness?: boolean;
        includeMetalness?: boolean;
    } = {}
): Promise<TextureGenerationResult> => {
    const { includeNormal = true, includeRoughness = false, includeMetalness = false } = options;

    // First, generate the diffuse map
    const diffuseResult = await generateTexture(prompt);

    if (!diffuseResult.success || !diffuseResult.diffuseMap) {
        return diffuseResult;
    }

    const result: TextureGenerationResult = {
        success: true,
        diffuseMap: diffuseResult.diffuseMap
    };

    // Generate normal map if requested
    if (includeNormal && diffuseResult.diffuseMap) {
        const normalMap = await generateNormalMap(diffuseResult.diffuseMap);
        if (normalMap) {
            result.normalMap = normalMap;
        }
    }

    // Note: Roughness and metalness maps would require more sophisticated generation
    // For now, we'll rely on the base material properties

    return result;
};

/**
 * Apply box UV projection to a geometry
 * This is a client-side calculation that provides UV coordinates for box-shaped objects
 */
export const calculateBoxUV = (vertices: Float32Array, bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
}): Float32Array => {
    const uvs = new Float32Array((vertices.length / 3) * 2);

    const sizeX = bounds.max.x - bounds.min.x || 1;
    const sizeY = bounds.max.y - bounds.min.y || 1;
    const sizeZ = bounds.max.z - bounds.min.z || 1;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];

        // Simple box projection - map based on dominant axis
        const uvIndex = (i / 3) * 2;

        // Normalize coordinates to 0-1 range
        uvs[uvIndex] = (x - bounds.min.x) / sizeX;
        uvs[uvIndex + 1] = (y - bounds.min.y) / sizeY;
    }

    return uvs;
};

/**
 * Default texture configuration
 */
export const getDefaultTextureConfig = (): TextureConfig => ({
    enabled: false,
    prompt: '',
    repeatX: 1,
    repeatY: 1,
    rotation: 0
});

/**
 * Validate a texture config
 */
export const validateTextureConfig = (config: Partial<TextureConfig>): TextureConfig => {
    return {
        enabled: config.enabled ?? false,
        prompt: config.prompt ?? '',
        diffuseMap: config.diffuseMap,
        normalMap: config.normalMap,
        roughnessMap: config.roughnessMap,
        metalnessMap: config.metalnessMap,
        aoMap: config.aoMap,
        repeatX: Math.max(0.1, config.repeatX ?? 1),
        repeatY: Math.max(0.1, config.repeatY ?? 1),
        rotation: config.rotation ?? 0
    };
};
