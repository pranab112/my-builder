/**
 * Multi-View Image Analysis Service
 *
 * Analyzes multiple reference images to:
 * - Classify view angles (front, side, top, isometric)
 * - Extract geometry hints from combined views
 * - Estimate 3D dimensions from 2D projections
 * - Provide structured context for AI code generation
 */

import { backend } from './backend';

export type ViewAngle = 'front' | 'side' | 'top' | 'back' | 'isometric' | 'detail' | 'unknown';

export interface ViewAnalysis {
  index: number;
  angle: ViewAngle;
  confidence: number;  // 0-1
  features: string[];
  estimatedDimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
}

export interface MultiViewAnalysisResult {
  views: ViewAnalysis[];
  geometryHint: string;
  suggestedApproach: string;
  symmetries: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  keyFeatures: string[];
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

// Helper to parse JSON from text
const parseJSON = (text: string): any => {
    try {
        // Try to extract JSON from markdown code blocks
        const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/```\n?([\s\S]*?)\n?```/);
        const jsonStr = match ? match[1] : text;
        return JSON.parse(jsonStr.trim());
    } catch (e) {
        console.error("[MultiViewAnalysis] JSON parse error:", e);
        return null;
    }
};

/**
 * Analyze multiple images to classify views and extract geometry hints
 */
export const analyzeMultipleViews = async (images: string[]): Promise<MultiViewAnalysisResult | null> => {
    if (!images || images.length === 0) {
        return null;
    }

    // For single image, return simplified analysis
    if (images.length === 1) {
        return {
            views: [{
                index: 0,
                angle: 'unknown',
                confidence: 0.5,
                features: ['single view - limited depth information']
            }],
            geometryHint: 'Use standard geometries (Box, Cylinder, Sphere) and infer depth from visible proportions',
            suggestedApproach: 'Start with basic shape and refine based on visible features',
            symmetries: [],
            estimatedComplexity: 'moderate',
            keyFeatures: []
        };
    }

    try {
        // Build image parts for API call
        const imageParts = images.map((image) => {
            const base64Data = image.split(',')[1];
            const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
            return {
                inlineData: {
                    mimeType,
                    data: base64Data
                }
            };
        });

        const analysisPrompt = `You are analyzing ${images.length} reference images of the SAME 3D object from different angles.

TASK: Classify each image and provide 3D reconstruction guidance.

RESPONSE FORMAT (JSON only, no other text):
{
  "views": [
    {
      "index": 0,
      "angle": "front|side|top|back|isometric|detail|unknown",
      "confidence": 0.0-1.0,
      "features": ["list", "of", "visible", "features"],
      "estimatedDimensions": { "width": 100, "height": 150 }
    }
  ],
  "geometryHint": "Recommend specific Three.js geometries to use (e.g., 'Use LatheGeometry for the cylindrical body, BoxGeometry for the base')",
  "suggestedApproach": "Brief description of how to approach building this in 3D",
  "symmetries": ["bilateral", "radial", "none"],
  "estimatedComplexity": "simple|moderate|complex",
  "keyFeatures": ["main_feature_1", "main_feature_2"]
}

RULES:
1. Analyze ALL images together to understand the complete 3D shape
2. Front view shows width and height
3. Side view shows depth and height
4. Top view shows width and depth
5. Isometric shows all three dimensions but foreshortened
6. Look for symmetries that simplify modeling
7. Suggest specific Three.js geometry types`;

        const response = await backend.ai.generateContent({
            model: 'gemini-2.5-flash-latest',  // Use fast model for analysis
            contents: {
                role: 'user',
                parts: [
                    ...imageParts,
                    { text: analysisPrompt }
                ]
            },
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = getText(response);
        const result = parseJSON(text);

        if (result && result.views) {
            console.log('[MultiViewAnalysis] Analysis complete:', {
                viewCount: result.views.length,
                complexity: result.estimatedComplexity,
                geometryHint: result.geometryHint
            });
            return result as MultiViewAnalysisResult;
        }

        return null;
    } catch (error) {
        console.error('[MultiViewAnalysis] Analysis failed:', error);
        return null;
    }
};

/**
 * Build context string for AI prompt injection based on multi-view analysis
 */
export const buildMultiViewContext = (analysis: MultiViewAnalysisResult): string => {
    if (!analysis) return '';

    let context = '\n\n═══════════════════════════════════════════════════════════════════════════════\n';
    context += 'MULTI-VIEW ANALYSIS RESULTS (Use this to build accurate 3D):\n';
    context += '═══════════════════════════════════════════════════════════════════════════════\n';

    // View breakdown
    context += '\nVIEW CLASSIFICATION:\n';
    analysis.views.forEach((view, i) => {
        context += `  Image ${i + 1}: ${view.angle.toUpperCase()} view (${Math.round(view.confidence * 100)}% confidence)\n`;
        if (view.features.length > 0) {
            context += `    Features: ${view.features.join(', ')}\n`;
        }
    });

    // Geometry recommendation
    context += `\nRECOMMENDED GEOMETRY APPROACH:\n`;
    context += `  ${analysis.geometryHint}\n`;

    // Symmetries
    if (analysis.symmetries.length > 0) {
        context += `\nSYMMETRIES DETECTED: ${analysis.symmetries.join(', ')}\n`;
        context += `  → Use symmetry to simplify modeling (e.g., LatheGeometry for radial symmetry)\n`;
    }

    // Key features
    if (analysis.keyFeatures.length > 0) {
        context += `\nKEY FEATURES TO MODEL:\n`;
        analysis.keyFeatures.forEach(f => {
            context += `  - ${f}\n`;
        });
    }

    // Complexity guidance
    context += `\nCOMPLEXITY: ${analysis.estimatedComplexity.toUpperCase()}\n`;
    if (analysis.estimatedComplexity === 'simple') {
        context += `  → Use 2-3 basic geometries combined\n`;
    } else if (analysis.estimatedComplexity === 'moderate') {
        context += `  → Use 4-6 geometries with CSG operations if needed\n`;
    } else {
        context += `  → Consider using BufferGeometry for complex shapes\n`;
    }

    context += '\n═══════════════════════════════════════════════════════════════════════════════\n';

    return context;
};

/**
 * Quick check if images appear to show the same object from different angles
 */
export const validateMultiViewConsistency = async (images: string[]): Promise<{
    isConsistent: boolean;
    warning?: string;
}> => {
    if (images.length <= 1) {
        return { isConsistent: true };
    }

    // For now, we'll trust the user's input
    // A more sophisticated version could use vision AI to verify consistency
    return {
        isConsistent: true,
        warning: images.length > 4
            ? 'Many images provided - AI will analyze the first 4 for best performance'
            : undefined
    };
};
