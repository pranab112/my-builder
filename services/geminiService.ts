
import { Type } from "@google/genai"; // Keep for Type definitions only
import { AspectRatio, ImageResolution } from "../types";
import { backend } from "./backend";
import { WorkspaceMode } from "../components/AnimationMaker/types";

export interface CategorySuggestion {
  title: string;
  description: string;
}

interface ModeConfig {
  name: string;
  scale: string;
  units: string;
  geometryRules: string;
  materialDefaults: string;
  specialFeatures: string;
  qualityFocus: string;
  exportPriority: string[];
}

const MODE_AI_CONFIG: Record<WorkspaceMode, ModeConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // ORIGINAL 4 MODES
  // ═══════════════════════════════════════════════════════════════

  maker: {
    name: "3D Printing / Maker",
    scale: "Real-world physical scale (typically 50-300mm)",
    units: "millimeters (mm)",
    geometryRules: `
      - MANDATORY: Geometry must be MANIFOLD (watertight, no holes, no self-intersecting faces)
      - MANDATORY: Minimum wall thickness of 1.2mm for FDM, 0.8mm for SLA
      - MANDATORY: No zero-thickness planes or single-face geometry
      - Avoid overhangs greater than 45° without supports
      - Use chamfers/fillets on sharp edges (minimum 0.5mm radius)
      - Ensure flat bottom surface for bed adhesion
      - Check for inverted normals (use geometry.computeVertexNormals())
    `,
    materialDefaults: `
      new THREE.MeshStandardMaterial({
        color: 0xe0e0e0,
        roughness: 0.6,
        metalness: 0.1,
        flatShading: false,
        side: THREE.FrontSide  // NOT DoubleSide for manifold check
      })
    `,
    specialFeatures: `
      - Add GUI sliders for physical dimensions (width_mm, height_mm, depth_mm)
      - Include "wall_thickness" parameter
      - Add "printer_tolerance" parameter (default 0.2mm)
      - Generate mounting holes with proper clearance (M3 = 3.2mm hole)
    `,
    qualityFocus: "Printability, structural integrity, assembly fit",
    exportPriority: ["STL", "OBJ", "3MF"]
  },

  designer: {
    name: "Product Design / Industrial Design",
    scale: "Real product scale (varies by product type)",
    units: "millimeters (mm) for small products, centimeters for furniture",
    geometryRules: `
      - Focus on AESTHETIC quality over printability
      - Use smooth, organic curves (high segment counts)
      - Apply generous fillets and chamfers for premium look
      - Create subtle surface details (embossed logos, texture zones)
      - Use beveled edges for visual interest
      - Consider parting lines and manufacturing seams
    `,
    materialDefaults: `
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.15,
        metalness: 0.0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        reflectivity: 0.5
      })
    `,
    specialFeatures: `
      - Add CMF controls (Color picker, Metalness slider, Roughness slider)
      - Include "corner_radius" for fillet control
      - Add "surface_finish" dropdown (matte, gloss, satin, soft-touch)
      - Support multiple material zones on single model
    `,
    qualityFocus: "Visual appeal, photorealism, brand aesthetics",
    exportPriority: ["GLTF", "GLB", "OBJ"]
  },

  engineer: {
    name: "Engineering / CAD / Mechanical",
    scale: "Precise real-world dimensions",
    units: "millimeters (mm) with 0.01mm precision",
    geometryRules: `
      - CRITICAL: Exact dimensional accuracy
      - Use precise geometric primitives (not organic shapes)
      - Include proper tolerances for fits:
        * Clearance fit: +0.2mm
        * Transition fit: +0.05mm
        * Press fit: -0.05mm
      - Create proper threads using helical geometry or boolean cuts
      - Include chamfers on all edges (0.5mm x 45°)
      - Design for assembly (alignment features, snap-fits)
    `,
    materialDefaults: `
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.4,
        metalness: 0.6,
        flatShading: false
      })
    `,
    specialFeatures: `
      - ALL dimensions as GUI parameters with 0.1mm step
      - Include "tolerance" parameter
      - Add "thread_pitch" for threaded features
      - Show dimension labels in 3D space (CSS2DRenderer)
      - Include assembly exploded view toggle
    `,
    qualityFocus: "Dimensional accuracy, functional fits, assembly",
    exportPriority: ["STEP", "STL", "OBJ"]
  },

  game_dev: {
    name: "Game Development / Real-time 3D",
    scale: "Game units (typically 1 unit = 1 meter)",
    units: "units (generic game units)",
    geometryRules: `
      - CRITICAL: Optimize for real-time rendering
      - LOW POLY: Use minimum vertices needed
        * Simple props: 100-500 triangles
        * Characters: 2,000-10,000 triangles
        * Hero assets: up to 50,000 triangles
      - Use flat shading or baked normals instead of geometry detail
      - Avoid n-gons, use only triangles/quads
      - Create clean UV unwraps for texturing
      - Design modular pieces that can be reused
    `,
    materialDefaults: `
      new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.0,
        flatShading: true  // Low-poly aesthetic
      })
    `,
    specialFeatures: `
      - Add "lod_level" parameter (0=high, 1=medium, 2=low)
      - Include triangle count display
      - Add "segments" controls for geometry reduction
      - Support for generating collision mesh (simplified)
      - Include pivot point adjustment
    `,
    qualityFocus: "Performance, low triangle count, clean topology",
    exportPriority: ["GLTF", "GLB", "FBX"]
  },

  // ═══════════════════════════════════════════════════════════════
  // HIGH-VALUE ADDITIONS
  // ═══════════════════════════════════════════════════════════════

  architect: {
    name: "Architecture / Interior Design",
    scale: "Building scale (meters)",
    units: "meters (m) and centimeters (cm)",
    geometryRules: `
      - Use REAL BUILDING SCALE:
        * Wall height: 2.4m - 3.0m standard
        * Door: 2.1m x 0.9m
        * Window: variable, typically 1.2m x 1.5m
        * Furniture to human scale
      - Create proper wall thickness (150mm - 300mm)
      - Include floor plates and ceiling planes
      - Design with structural logic (columns, beams)
      - Use modular grid system (typically 1.2m or 600mm modules)
    `,
    materialDefaults: `
      // Walls
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 })
      // Floor
      new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6 })
      // Glass
      new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.3,
        transmission: 0.9,
        roughness: 0.0
      })
    `,
    specialFeatures: `
      - Add "floor_count" parameter
      - Include "room_width", "room_depth", "ceiling_height"
      - Add "wall_thickness" control
      - Include window/door placement parameters
      - Support for floor plan view (orthographic top-down)
      - Add sunlight angle control for shadow studies
    `,
    qualityFocus: "Spatial accuracy, realistic proportions, lighting studies",
    exportPriority: ["GLTF", "OBJ", "FBX"]
  },

  animator: {
    name: "Animation / VFX / Motion Graphics",
    scale: "Scene-relative (flexible)",
    units: "arbitrary units",
    geometryRules: `
      - Design for DEFORMATION and MOVEMENT
      - Create proper joint hierarchies (THREE.Bone, THREE.Skeleton)
      - Use enough geometry for smooth bending
      - Separate movable parts into distinct meshes
      - Consider silhouette readability
      - Design with squash/stretch in mind
    `,
    materialDefaults: `
      new THREE.MeshToonMaterial({
        color: 0xff6b6b,
        gradientMap: threeToneGradient
      })
      // OR for realistic:
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.0,
        envMapIntensity: 1.0
      })
    `,
    specialFeatures: `
      - Add "animation_speed" parameter
      - Include keyframe timeline controls
      - Add "bounce_amplitude", "rotation_speed" parameters
      - Support for morph targets
      - Include particle system controls
      - Add camera animation path controls
    `,
    qualityFocus: "Deformability, visual appeal, performance",
    exportPriority: ["GLTF", "GLB", "FBX"]
  },

  jewelry: {
    name: "Jewelry Design",
    scale: "MICRO scale (millimeters)",
    units: "millimeters (mm) with 0.01mm precision",
    geometryRules: `
      - MICRO SCALE: Rings are 16-22mm diameter, pendants 10-40mm
      - HIGH DETAIL: Use high segment counts (64+ for circles)
      - Create proper gem settings:
        * Prong settings (4 or 6 prongs)
        * Bezel settings (metal rim)
        * Pavé settings (small stones in pattern)
      - Include proper ring sizing (US sizes 4-13)
      - Design for casting (no undercuts, proper draft angles)
      - Wall thickness minimum 0.8mm for precious metals
    `,
    materialDefaults: `
      // Gold
      new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        roughness: 0.1,
        metalness: 1.0,
        reflectivity: 1.0
      })
      // Silver
      new THREE.MeshPhysicalMaterial({
        color: 0xc0c0c0,
        roughness: 0.15,
        metalness: 1.0
      })
      // Gemstone
      new THREE.MeshPhysicalMaterial({
        color: 0xff0000,
        transmission: 0.95,
        roughness: 0.0,
        ior: 2.4,  // Diamond IOR
        thickness: 2
      })
    `,
    specialFeatures: `
      - Add "ring_size_us" parameter (converts to mm diameter)
      - Include "band_width", "band_thickness"
      - Add "gem_carat" parameter (calculates size)
      - Add "metal_type" dropdown (gold, silver, platinum, rose gold)
      - Include "gem_type" dropdown (diamond, ruby, emerald, sapphire)
      - Show weight estimate in grams
    `,
    qualityFocus: "Micro-detail, gem brilliance, castability",
    exportPriority: ["STL", "OBJ", "3DM"]
  },

  medical: {
    name: "Medical / Scientific / Anatomical",
    scale: "Anatomical scale (varies)",
    units: "millimeters (mm) for implants, centimeters for organs",
    geometryRules: `
      - ANATOMICAL ACCURACY is critical
      - Create organic, smooth surfaces (high poly for curves)
      - Ensure MANIFOLD geometry for 3D printing prosthetics
      - Use proper anatomical proportions
      - Include surface texture for tissue types
      - Design with biocompatibility in mind (smooth surfaces, no sharp edges)
    `,
    materialDefaults: `
      // Bone
      new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.8 })
      // Soft tissue
      new THREE.MeshStandardMaterial({
        color: 0xffcccb,
        roughness: 0.6,
        transparent: true,
        opacity: 0.9
      })
      // Implant/Metal
      new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.2,
        metalness: 0.9
      })
    `,
    specialFeatures: `
      - Add "scale_factor" for patient-specific sizing
      - Include "wall_thickness" for hollow models
      - Add "section_plane" for cross-section views
      - Include transparency toggle for layered viewing
      - Add measurement tools (distance, angle)
      - Support for DICOM-based scaling
    `,
    qualityFocus: "Anatomical accuracy, printability, educational clarity",
    exportPriority: ["STL", "OBJ", "PLY"]
  },

  ecommerce: {
    name: "E-commerce / Product Visualization",
    scale: "Real product scale",
    units: "centimeters (cm) for display",
    geometryRules: `
      - Optimize for WEB VIEWING (balance quality vs file size)
      - Target 10,000 - 50,000 triangles
      - Create clean, appealing silhouettes
      - Include subtle surface details visible in renders
      - Design for 360° viewing (good from all angles)
      - Ensure no visual artifacts at any rotation
    `,
    materialDefaults: `
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.2
      })
    `,
    specialFeatures: `
      - Add "turntable_speed" parameter
      - Include "camera_distance" control
      - Add "background_color" picker
      - Include "product_color" variant switcher
      - Add "hotspot" markers for feature callouts
      - Support for AR preview mode
      - Include "zoom_limits" for viewer constraints
    `,
    qualityFocus: "Visual appeal, web performance, interactivity",
    exportPriority: ["GLTF", "GLB", "USDZ"]
  },

  // ═══════════════════════════════════════════════════════════════
  // NICHE MODES
  // ═══════════════════════════════════════════════════════════════

  sculptor: {
    name: "Digital Sculpture / Fine Art",
    scale: "Artistic scale (flexible)",
    units: "arbitrary units",
    geometryRules: `
      - HIGH POLY is acceptable for artistic detail
      - Focus on organic, flowing forms
      - Create smooth surface transitions
      - Use subdivision-ready topology
      - Consider sculptural composition and negative space
      - Design for multiple viewing angles
    `,
    materialDefaults: `
      // Clay/Bronze look
      new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.7,
        metalness: 0.3
      })
      // Marble look
      new THREE.MeshPhysicalMaterial({
        color: 0xfafafa,
        roughness: 0.3,
        metalness: 0.0,
        sheen: 0.5
      })
    `,
    specialFeatures: `
      - Add "subdivision_level" parameter
      - Include "material_preset" dropdown (clay, bronze, marble, wood)
      - Add "base/pedestal" toggle
      - Include dramatic lighting presets
      - Support for matcap materials
    `,
    qualityFocus: "Artistic expression, surface quality, form",
    exportPriority: ["OBJ", "STL", "ZBR"]
  },

  automotive: {
    name: "Automotive / Vehicle Design",
    scale: "Real vehicle scale (meters)",
    units: "meters (m) and millimeters for details",
    geometryRules: `
      - Use NURBS-like smooth surfaces (high segment counts)
      - Create proper panel gaps (3-5mm typical)
      - Include shut lines and body panel divisions
      - Design aerodynamic forms
      - Use Class-A surface quality for body panels
      - Include wheel wells, door handles, trim details
    `,
    materialDefaults: `
      // Car paint
      new THREE.MeshPhysicalMaterial({
        color: 0xff0000,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        reflectivity: 1.0
      })
      // Chrome
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.0,
        metalness: 1.0
      })
      // Glass
      new THREE.MeshPhysicalMaterial({
        color: 0x222222,
        transmission: 0.9,
        roughness: 0.0,
        thickness: 5
      })
    `,
    specialFeatures: `
      - Add "body_color" picker with metallic presets
      - Include "wheel_size" parameter (inches)
      - Add "ground_clearance" control
      - Include "panel_gap" adjustment
      - Add environment reflection intensity
      - Support for wheel rotation animation
    `,
    qualityFocus: "Surface quality, reflections, aerodynamic form",
    exportPriority: ["GLTF", "OBJ", "FBX"]
  },

  fashion: {
    name: "Fashion / Apparel / Textile",
    scale: "Human body scale",
    units: "centimeters (cm)",
    geometryRules: `
      - Design for FABRIC SIMULATION appearance
      - Create natural draping and folds
      - Use cloth-like topology (quad-based for simulation)
      - Include seam lines and stitching details
      - Consider garment construction (panels, darts)
      - Design flat pattern-ready geometry
    `,
    materialDefaults: `
      // Fabric
      new THREE.MeshStandardMaterial({
        color: 0x4a90d9,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide
      })
      // Silk
      new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        roughness: 0.3,
        metalness: 0.1,
        sheen: 1.0,
        sheenColor: new THREE.Color(0xffffff)
      })
    `,
    specialFeatures: `
      - Add "fabric_type" dropdown (cotton, silk, denim, leather)
      - Include "body_size" parameter (XS-XXL)
      - Add "drape_intensity" control
      - Include seam visibility toggle
      - Support for pattern/print texture
      - Add mannequin/body toggle
    `,
    qualityFocus: "Fabric appearance, natural draping, pattern accuracy",
    exportPriority: ["OBJ", "GLTF", "FBX"]
  },

  education: {
    name: "Education / Learning / Tutorial",
    scale: "Conceptual (flexible)",
    units: "simplified units",
    geometryRules: `
      - SIMPLIFY complex forms for clarity
      - Use clear, distinct shapes
      - Create exploded views for assembly understanding
      - Use color coding for different parts
      - Include labels and annotations
      - Design for step-by-step assembly visualization
    `,
    materialDefaults: `
      // Use distinct colors for parts
      new THREE.MeshStandardMaterial({
        color: 0x4CAF50,  // Green
        roughness: 0.5,
        metalness: 0.0
      })
      // Semi-transparent for internal views
      new THREE.MeshStandardMaterial({
        color: 0x2196F3,
        transparent: true,
        opacity: 0.5
      })
    `,
    specialFeatures: `
      - Add "explode_distance" parameter for assembly view
      - Include "step_number" for assembly sequence
      - Add "highlight_part" selector
      - Include "show_labels" toggle
      - Add "transparency" slider for see-through
      - Support for animation between assembly steps
      - Include "quiz_mode" with part identification
    `,
    qualityFocus: "Clarity, educational value, step-by-step understanding",
    exportPriority: ["GLTF", "GLB", "HTML"]
  }
};

export const analyzeProductIdentity = async (base64Images: string[]): Promise<string> => {
  const parts: any[] = [{ text: "Analyze these images and describe the product's physical appearance, material, color, and key features in detail. Focus on visual identity." }];
  
  for (const img of base64Images) {
    const clean = img.split(',')[1] || img;
    parts.push({ inlineData: { mimeType: 'image/png', data: clean } });
  }

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: { thinkingConfig: { thinkingBudget: 2048 } }
  });

  return response.text || "Product analysis failed.";
};

export const generateSceneDescription = async (base64Images: string[], productIdentity: string, userHint?: string): Promise<string> => {
  const prompt = `
    You are a professional product photographer and set designer.
    PRODUCT IDENTITY: ${productIdentity}
    USER HINT: ${userHint || "None provided. Create a suitable professional setting."}

    Task: Describe a scene composition, lighting, and background that perfectly complements this product. 
    The scene should be photorealistic and highlight the product's features.
    Keep the description concise but evocative.
  `;
  
  const parts: any[] = [{ text: prompt }];
  for (const img of base64Images) {
    const clean = img.split(',')[1] || img;
    parts.push({ inlineData: { mimeType: 'image/png', data: clean } });
  }

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: { thinkingConfig: { thinkingBudget: 2048 } }
  });

  return response.text || "Scene description failed.";
};

export const generateEcommerceImage = async (
  base64Images: string[], 
  productIdentity: string, 
  sceneDescription: string, 
  angleInstruction: string, 
  aspectRatio: AspectRatio, 
  resolution: ImageResolution
): Promise<string> => {
  const prompt = `
    Create a professional e-commerce product shot.
    PRODUCT: ${productIdentity}
    SCENE: ${sceneDescription}
    ANGLE/COMPOSITION: ${angleInstruction}
    
    Ensure the product looks exactly like the reference images provided.
    High fidelity, photorealistic, 8k resolution.
  `;
  
  const parts: any[] = [{ text: prompt }];
  
  for (const img of base64Images) {
     const clean = img.split(',')[1] || img;
     parts.push({ inlineData: { mimeType: 'image/png', data: clean } });
  }

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
        imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: resolution
        }
    }
  });

  const candidates = response.candidates;
  if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
          }
      }
  }
  
  throw new Error("No image generated");
};

export const suggestProjectCategories = async (description: string): Promise<CategorySuggestion[]> => {
  const prompt = `
    Analyze this project description: "${description}"
    Suggest 3 suitable categories/strategies for creating this in a 3D workspace.
    Return JSON format: { "suggestions": [{ "title": "Category Name", "description": "Why this fits" }] }
  `;

  const response = await backend.ai.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" }
  });

  try {
      const json = JSON.parse(response.text);
      return json.suggestions || [];
  } catch (e) {
      return [{ title: "General", description: "Default category" }];
  }
};

export const enhanceUserPrompt = async (prompt: string, category: string, workspaceMode: string): Promise<string> => {
    const fullPrompt = `
      Enhance this user prompt for a 3D generative model.
      User Prompt: "${prompt}"
      Category: ${category}
      Workspace Mode: ${workspaceMode}
      
      Make it more descriptive, adding details about geometry, features, and style suitable for the selected mode.
      Keep it under 50 words.
    `;
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: fullPrompt }] }
    });
    return response.text || prompt;
};

export const enhanceScenePrompt = async (prompt: string): Promise<string> => {
    const fullPrompt = `
      Enhance this prompt for a creative 3D scene generation (Three.js).
      User Prompt: "${prompt}"
      
      Add details about lighting, atmosphere, colors, and motion.
      Keep it under 50 words.
    `;
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: fullPrompt }] }
    });
    return response.text || prompt;
};

export const enhanceCinematicPrompt = async (prompt: string): Promise<string> => {
    const fullPrompt = `
      Enhance this prompt for a cinematic movie scene generation.
      User Prompt: "${prompt}"
      
      Focus on camera movement, action description, and emotional tone.
      Keep it under 50 words.
    `;
    const response = await backend.ai.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: fullPrompt }] }
    });
    return response.text || prompt;
};

export const generateAnimationCode = async (
  prompt: string, 
  previousCode?: string, 
  imageBase64?: string, 
  category?: string, 
  workspaceMode: WorkspaceMode = 'designer'
): Promise<string> => {

  // Get mode-specific configuration
  const modeConfig = MODE_AI_CONFIG[workspaceMode];

  const isPrintable = ['maker', 'medical', 'jewelry'].includes(workspaceMode) ||
                      category?.toLowerCase().includes('print');

  const mindset = `
    ROLE: You are a ${modeConfig.name} Specialist & Parametric Designer.

    ═══════════════════════════════════════════════════════════════
    WORKSPACE MODE: ${workspaceMode.toUpperCase()} - ${modeConfig.name}
    ═══════════════════════════════════════════════════════════════

    SCALE & UNITS:
    - Working Scale: ${modeConfig.scale}
    - Unit System: ${modeConfig.units}

    GEOMETRY REQUIREMENTS:
    ${modeConfig.geometryRules}

    DEFAULT MATERIAL:
    ${modeConfig.materialDefaults}

    MODE-SPECIFIC FEATURES TO INCLUDE:
    ${modeConfig.specialFeatures}

    QUALITY FOCUS: ${modeConfig.qualityFocus}
    PREFERRED EXPORT FORMATS: ${modeConfig.exportPriority.join(', ')}

    ═══════════════════════════════════════════════════════════════

    CORE PHILOSOPHY: **Form is Configurable**.
    You do NOT create static sculptures. You create **Smart Objects** driven by variables.

    YOUR GOAL:
    Generate clean, constructive THREE.js code optimized for ${modeConfig.name}.
    Crucially, you must expose PHYSICAL DIMENSIONS to the GUI so the user can TWEAK the design.

    VISUAL STYLE:
    - Follow the material defaults specified above for this mode.
    - **EDGES**: Add \`THREE.EdgesGeometry\` + \`THREE.LineSegments\` for technical modes (maker, engineer, architect).
    - Background: Dark Technical Grid (#111827).
  `;

  const commonRequirements = `
    CRITICAL TECHNICAL REQUIREMENTS FOR THE HTML OUTPUT:
    1. **IMPORT MAP (LATEST STABLE)**:
       <script type="importmap">
         {
           "imports": {
             "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
             "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/",
             "three-bvh-csg": "https://unpkg.com/three-bvh-csg@0.0.16/build/index.module.js"
           }
         }
       </script>

    2. **MODULE SCRIPT**:
       - Import THREE, OrbitControls.
       - Import { TransformControls } from 'three/addons/controls/TransformControls.js'.
       - Import { STLExporter } from 'three/addons/exporters/STLExporter.js';
       - Import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
       - Import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
       - Import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'; // ADDED USDZ
       - Import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'; 
       - Import GUI from 'three/addons/libs/lil-gui.module.min.js'.
       - Import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
       - Import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'; // ADDED FOR MESH REPAIR
       - Import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
       - Import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
       - **BOOLEAN OPERATIONS**: Import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

    3. **CAD SCENE SETUP**:
       - Renderer: \`antialias: true, localClippingEnabled: true\`.
       - Scene: Background \`new THREE.Color(0x111827)\`.
       - **Grid**: \`const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222); scene.add(grid);\`
       - **Axes**: \`const axes = new THREE.AxesHelper(2); scene.add(axes);\`
       - Camera: Perspective, FOV 45, Position (8, 8, 8).

    4. **LIGHTING (FUNCTIONAL)**:
       - Ambient: Intensity 0.7.
       - Directional (Headlight): Follows camera or fixed at (10, 10, 10). Intensity 1.0.

    5. **PARAMETRIC GUI (MANDATORY)**:
       - Create a \`params\` object with mode-appropriate parameters.
       - Create a \`regenerate()\` function.
       - Add GUI sliders based on the MODE-SPECIFIC FEATURES listed above.

    6. **DEBUGGING HOOKS (CRITICAL)**:
       - At the end, expose: window.scene, window.camera, window.renderer, window.controls, window.exportMesh

    7. **NO BLACK SCREENS**:
       - Verify renderer.setSize, camera position, body margin:0

    8. **BOOLEAN OPERATIONS STRATEGY (CRITICAL)**:
       - When the user asks to "cut", "subtract", "combine", "union", "intersect" or "hole":
       - Use 'three-bvh-csg'.
       - Convert meshes to \`Brush\`: \`const brushA = new Brush(geometryA, materialA);\`
       - Ensure matrices are updated: \`brushA.updateMatrixWorld();\`
       - Perform operation: \`const result = new Evaluator().evaluate(brushA, brushB, SUBTRACTION);\`.
       - \`result\` is a Mesh. Add it to scene.
       
    9. **ASSEMBLY & HIERARCHY**:
       - If creating multiple parts, use \`const group = new THREE.Group()\` to hold them.
       - Name your meshes clearly: \`mesh.name = "UpperArm"\`.
       - This allows the Selection Manager to identify parts.
  `;

  const modeSpecificRules = `
    *** ${modeConfig.name.toUpperCase()} SPECIFIC CONSTRUCTION RULES ***:

    ${modeConfig.geometryRules}

    PARAMETERS TO EXPOSE IN GUI:
    ${modeConfig.specialFeatures}

    ${isPrintable ? `
    *** PRINTABILITY REQUIREMENTS ***:
    - Ensure geometry is MANIFOLD (watertight)
    - No zero-thickness surfaces
    - Minimum wall thickness as specified
    - Use THREE.FrontSide for materials (not DoubleSide)
    ` : ''}

    ${workspaceMode === 'game_dev' ? `
    *** GAME OPTIMIZATION REQUIREMENTS ***:
    - Keep triangle count LOW (display count in GUI)
    - Use flatShading: true for low-poly aesthetic
    - Create clean, quad-based topology
    ` : ''}

    ${workspaceMode === 'jewelry' ? `
    *** JEWELRY PRECISION REQUIREMENTS ***:
    - Use 64+ segments for all circular geometry
    - Ring sizes: US 4 = 14.9mm, US 7 = 17.3mm, US 10 = 19.8mm
    - Gem sizes: 1 carat round = 6.5mm diameter
    ` : ''}

    ${workspaceMode === 'architect' ? `
    *** ARCHITECTURAL SCALE REQUIREMENTS ***:
    - Standard door: 2100mm x 900mm
    - Standard ceiling: 2400mm - 3000mm
    - Wall thickness: 150mm - 300mm
    - Use meters for main dimensions
    ` : ''}

    ${workspaceMode === 'automotive' ? `
    *** AUTOMOTIVE SURFACE REQUIREMENTS ***:
    - Use high segment counts for smooth body panels
    - Panel gaps should be 3-5mm
    - Use clearcoat material for paint
    ` : ''}
  `;

  let fullPrompt = "";

  if (previousCode) {
    fullPrompt = `
      ${mindset}

      CONTEXT: You are modifying an existing ${modeConfig.name} model.

      EXISTING CODE:
      ${previousCode}

      USER REQUEST FOR UPDATE: "${prompt}"
      ${imageBase64 ? "NOTE: User provided a reference image. Adjust geometry to match." : ""}

      TASK:
      1. Analyze the EXISTING CODE.
      2. Modify the code to satisfy the USER REQUEST.
      3. **PRESERVE PARAMETERS**: Add new Sliders to the GUI as needed.
      4. **MAINTAIN MODE STANDARDS**: Keep all ${workspaceMode} mode requirements.

      ${commonRequirements}
      ${modeSpecificRules}

      OUTPUT FORMAT:
      - Return ONLY the raw string of the HTML file, starting with <!DOCTYPE html>.
    `;
  } else {
    fullPrompt = `
      ${mindset}

      TASK: Create a self-contained HTML file that renders a Configurable 3D Model.
      MODE: ${workspaceMode} (${modeConfig.name})

      ${imageBase64 ? `
        **REVERSE ENGINEERING TASK**:
        1. Analyze the image GEOMETRY.
        2. Create a PARAMETRIC version optimized for ${modeConfig.name}.
        3. Apply ${workspaceMode} mode standards for scale, materials, and features.

        ${prompt ? `**ADDITIONAL INSTRUCTIONS**: "${prompt}"` : ""}
      ` : `User Request: "${prompt}"`}

      ${commonRequirements}
      ${modeSpecificRules}

      OUTPUT FORMAT:
      - Return ONLY the raw string of the HTML file, starting with <!DOCTYPE html>.
    `;
  }

  const parts: any[] = [{ text: fullPrompt }];

  if (imageBase64) {
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
      parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
  }

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
        thinkingConfig: { thinkingBudget: 16384 }
    }
  });

  let text = response.text || "";
  text = text.replace(/```html/g, '').replace(/```/g, '');
  const docTypeMatch = text.match(/<!DOCTYPE html>/i);
  const htmlTagMatch = text.match(/<html/i);

  if (docTypeMatch && docTypeMatch.index !== undefined) {
      return text.substring(docTypeMatch.index);
  } else if (htmlTagMatch && htmlTagMatch.index !== undefined) {
      return '<!DOCTYPE html>\n' + text.substring(htmlTagMatch.index);
  }

  return text.trim();
};

export const generateCreativeSceneCode = async (prompt: string, previousCode?: string, style: string = 'standard', hasProductImage: boolean = false): Promise<string> => {
  const styleInstructions: Record<string, string> = {
    'standard': `
      - Style: Balanced, Neutral Lighting.
      - Tech: THREE.MeshStandardMaterial.
      - **CRITICAL**: Use 'RGBELoader' to load an HDRI from 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr' (or similar).
      - Set \`scene.environment\` and \`scene.background\` to the HDRI.
    `,
    'cyberpunk': `
      - Style: Cyberpunk, Neon, Dark, Rainy.
      - Tech: Background Color #000510. Use THREE.FogExp2(0x000510, 0.02).
      - Lighting: High intensity PointLights (Pink #ff00ff, Cyan #00ffff).
      - Materials: High Metalness (0.8), Low Roughness (0.2).
      - **POST-PROCESSING**: You MUST implement 'EffectComposer' with 'UnrealBloomPass' (strength 1.5, radius 0.4, threshold 0).
    `,
    'toon': `
      - Style: Cel Shaded / Toon.
      - Tech: Use THREE.MeshToonMaterial with a gradient map or hard steps.
      - Edges: MUST use THREE.EdgesGeometry + LineSegments with black color to create outlines on all objects.
      - Lighting: Strong DirectionalLight for hard shadows.
    `,
    'lowpoly': `
      - Style: Low Poly, Flat Shaded.
      - Tech: Use THREE.MeshStandardMaterial with flatShading: true.
      - Geometry: Use low segment counts (e.g. SphereGeometry(1, 6, 6)).
      - Colors: Vibrant pastel palette.
      - Lighting: Soft AmbientLight + DirectionalLight.
    `,
    'photoreal': `
      - Style: High Fidelity, Cinematic.
      - Tech: THREE.MeshPhysicalMaterial (clearcoat: 1.0, transmission: 0.5 for glass).
      - **HDRI MANDATORY**: Load 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr'.
      - **POST-PROCESSING**: Use 'UnrealBloomPass' (strength 0.3) for subtle glow.
      - Shadows: Renderer.shadowMap.type = THREE.PCFSoftShadowMap.
    `
  };

  const selectedStyleInstruction = styleInstructions[style] || styleInstructions['standard'];

  const productInstruction = hasProductImage ? `
    *** PRODUCT IMAGE INTEGRATION (CRITICAL) ***
    1. The user has provided a product image. A global variable \`window.PRODUCT_IMAGE_URL\` is available in the browser context.
    2. You MUST create a dedicated 'Hero Mesh' to display this product.
    3. Use: \`const productTexture = new THREE.TextureLoader().load(window.PRODUCT_IMAGE_URL);\`. 
    4. Geometry: Use a \`THREE.PlaneGeometry(3, 3)\`.
    5. Material: \`new THREE.MeshStandardMaterial({ map: productTexture, transparent: true, side: THREE.DoubleSide })\`.
    6. Position: Place this mesh at the CENTER (0, 1.5, 0) of the scene.
    7. **Action**: Build the rest of the environment (lights, particles, floor, floating objects) AROUND this product mesh.
  ` : '';

  const mindset = `
    ROLE: You are a Creative 3D Artist and Game Developer using Three.js.
    
    GOAL: Create a self-contained HTML/JS file that renders a **LIVELY, ANIMATED 3D SCENE**.
    
    VISUAL STYLE INSTRUCTION:
    ${selectedStyleInstruction}
    
    ${productInstruction}
    
    PHILOSOPHY:
    - **No Static Objects**: Everything must move, breathe, rotate, or float. 
    - **Procedural Creation**: Build characters/environments from primitives (Box, Sphere, Cylinder). Do NOT try to load external models (GLTF/OBJ) unless they are from a standard CDN like three.js examples, but prefer procedural generation to ensure it works.
    
    USER REQUEST: "${prompt}"
    
    TECHNICAL REQUIREMENTS:
    1. **Import Map**: Use the standard Three.js import map.
       Imports: 
       - "three": "https://unpkg.com/three@0.170.0/build/three.module.js"
       - "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
    
    2. **Scene Setup**:
       - Renderer: antialias: true, shadowMap.enabled: true, toneMapping: THREE.ACESFilmicToneMapping.
       - **FULLSCREEN CANVAS**: The canvas must fill the window.
       - \`renderer.setSize(window.innerWidth, window.innerHeight)\`.
       - \`document.body.appendChild(renderer.domElement)\`.
       - CSS: \`<style>body{margin:0;overflow:hidden;background:#000;}</style>\`.
       - Handle \`window.addEventListener('resize', ...)\` to update camera aspect and renderer size.
    
    3. **Post-Processing (If requested by style)**:
       - Import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
       - Import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
       - Import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
       - Setup composer and render it in the loop instead of renderer.render.
       
    4. **HDRI (If requested by style)**:
       - Import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
       - Load the HDRI url provided in the style.
       - Set \`scene.environment = texture\`.
    
    5. **Animation Loop**:
       - Use \`requestAnimationFrame\`.
       - You MUST animate objects in the loop (Math.sin/cos).
    
    6. **Character/Object Construction**:
       - Group primitives into hierarchies (e.g., const robot = new THREE.Group()).
       
    7. **NO BLACK SCREEN**:
       - Ensure \`camera.position.z = 5\` (or suitable distance).
       - Ensure \`camera.lookAt(0,0,0)\`.
       - Add a default \`THREE.AmbientLight(0xffffff, 1)\` immediately to ensure visibility if HDRI fails.
       - Add \`THREE.GridHelper(20, 20, 0x444444, 0x222222)\` to visualize the floor.
    
    OUTPUT FORMAT:
    - Return ONLY the raw string of the HTML file.
  `;

  let fullPrompt = "";

  if (previousCode) {
    fullPrompt = `
      ${mindset}
      CONTEXT: You are iterating on an existing artistic scene.
      EXISTING CODE:
      ${previousCode}
      
      UPDATE INSTRUCTION: "${prompt}"
      
      Keep the existing animation logic but apply the requested changes and maintain the visual style (${style}).
    `;
  } else {
    fullPrompt = `
      ${mindset}
      TASK: Create a new immersive 3D world based on the request.
    `;
  }

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: fullPrompt }] },
    config: {
        thinkingConfig: { thinkingBudget: 4096 } 
    }
  });

  const text = response.text || "";
  const htmlMatch = text.match(/(<!DOCTYPE html>[\s\S]*<\/html>)|(<html[\s\S]*<\/html>)/i);
  return htmlMatch ? htmlMatch[0] : text.replace(/```html/g, '').replace(/```/g, '').trim();
};

export const generateCinematicScene = async (prompt: string, duration: number, sceneNumber: number, previousSceneDescription?: string): Promise<string> => {
  const mindset = `
    ROLE: You are a Virtual Cinematographer and 3D Director.
    TASK: Create a self-contained HTML/Three.js scene that plays a SPECIFIC ACTION for exactly ${duration} SECONDS.
    
    SCENE CONTEXT:
    - Scene Number: ${sceneNumber}
    - Duration: ${duration} seconds
    - User Script: "${prompt}"
    ${previousSceneDescription ? `- Context from previous scene: ${previousSceneDescription}` : ''}
    
    CRITICAL CINEMATOGRAPHY RULES:
    1. **Dynamic Camera**: The camera MUST move.
       - Implement a 'CinematicCamera' logic in the animation loop.
       - Use 'Math.lerp' or sine waves to move the camera smoothly (Dolly, Pan, Truck, or Orbit).
       - LookAt: Ensure the camera stays focused on the subject.
    
    2. **ACTORS & CHARACTERS**:
       - If the user asks for characters (robot, person, creature), you MUST build them procedurally using \`THREE.Group\`.
       - Use Primitives: Sphere (Head), Box/Cylinder (Body), Capsules (Limbs).
       - **ANIMATION**: You MUST animate their limbs (rotation.x = Math.sin(time)) to show life (walking, waving, breathing).
       - Do NOT create static statues unless requested.
    
    3. **Animation Timing**:
       - The animation should loop seamlessly or resolve within ${duration} seconds.
       - Use \`Date.now()\` or \`clock.getElapsedTime()\` to drive animation speed suitable for the duration.
    
    4. **Visual Style**:
       - Use cinematic lighting (Key, Fill, Rim).
       - Use \`THREE.Fog\` to create depth.
       - Use \`THREE.MeshStandardMaterial\` for realism.
    
    TECHNICAL BOILERPLATE:
    - Use standard Three.js imports (module based).
    - Setup Scene, Camera, Renderer (antialias: true).
    - **FULLSCREEN CANVAS**: Canvas must be 100vw/100vh. Handle resize.
    - \`document.body.appendChild(renderer.domElement)\`.
    - CSS: \`<style>body{margin:0;overflow:hidden;background:#000;}</style>\`.
    - **NO ORBIT CONTROLS**: The camera movement must be PROCEDURAL/SCRIPTED by you (the director), not user controlled.
    - **NO BLACK SCREEN**: Ensure Lights are present and Camera is looking at (0,0,0).
    
    OUTPUT FORMAT:
    - Return ONLY the raw string of the HTML file.
  `;

  const response = await backend.ai.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: mindset }] },
    config: {
        thinkingConfig: { thinkingBudget: 4096 } 
    }
  });

  const text = response.text || "";
  const htmlMatch = text.match(/(<!DOCTYPE html>[\s\S]*<\/html>)|(<html[\s\S]*<\/html>)/i);
  return htmlMatch ? htmlMatch[0] : text.replace(/```html/g, '').replace(/```/g, '').trim();
};

export const fixThreeJSCode = async (brokenCode: string, errorMessage: string): Promise<string> => {
  const prompt = `
    You are a Three.js Debugger.
    
    THE SITUATION:
    The following Three.js HTML/JS code (Version 0.170.0) is crashing the browser or throwing a runtime error.
    
    ERROR MESSAGE: "${errorMessage}"
    
    BROKEN CODE:
    ${brokenCode}
    
    TASK:
    1. Analyze the error message and the code.
    2. Fix the bug.
    3. Ensure 'OrbitControls' is properly imported and instantiated (this is a common error).
    4. Ensure no absolute paths are used for textures unless they are standard CDNs.
    5. **BLACK SCREEN FIX**: If the error implies context loss or no render, ensure \`renderer.setSize\`, \`camera.aspect\`, and \`renderer.render(scene, camera)\` are correct.
    6. **SPECIFIC FIXES**:
       - If error is "shape.close is not a function", replace with \`shape.closePath()\`.
    
    OUTPUT:
    Return ONLY the corrected, full HTML string.
  `;

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: { parts: [{ text: prompt }] },
      config: {
          thinkingConfig: { thinkingBudget: 2048 } 
      }
    });
    
    const text = response.text || "";
    const htmlMatch = text.match(/(<!DOCTYPE html>[\s\S]*<\/html>)|(<html[\s\S]*<\/html>)/i);
    return htmlMatch ? htmlMatch[0] : text.replace(/```html/g, '').replace(/```/g, '').trim();
  } catch (e) {
    console.error("Auto-fix failed", e);
    return brokenCode; 
  }
};
