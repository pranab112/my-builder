
import { Type } from "@google/genai"; // Keep for Type definitions only
import { AspectRatio, ImageResolution } from "../types";
import { backend } from "./backend";

export interface CategorySuggestion {
  title: string;
  description: string;
}

export const analyzeProductIdentity = async (base64Images: string[]): Promise<string> => {
  const systemPrompt = `
    You are a Geometric Product Analyst with a specialization in CMF (Color, Material, Finish).
    
    TASK: Analyze the reference images to create a strict "Surface Map" for a 3D reconstruction.
    
    OUTPUT THE FOLLOWING CRITICAL DATA:
    
    1. **COLOR PALETTE (ACCURACY MODE)**:
       - **Primary Color**: Describe the exact shade (e.g., "Midnight Blue", "Safety Orange", "Chartreuse"). Provide estimated Hex Codes if clear.
       - **Accent Colors**: List secondary colors found on buttons, logos, or trim.
       - **Color Consistency**: Does the color shift in light? (Iridescent, gradient, solid).
       
    2. **MATERIAL & TEXTURE**:
       - **Surface Finish**: Is it Matte, Glossy, Satin, Metallic, Brushed, Fabric, Grainy plastic?
       - **Reflectivity**: How does light interact? (High specular highlights, diffuse soft absorption, subsurface scattering).
       - **Transparency**: Is any part opaque, translucent, or transparent glass?

    3. **LOGO GEOMETRY & SCALE (MATH)**:
       - **Placement**: Exactly which face is the logo on? (e.g. "Front Face Only", "Wraps around").
       - **Logo Width Ratio**: Estimate the width of the logo/text compared to the width of the product itself.
       - **Vertical Position**: Where does it sit?
       
    4. **NEGATIVE SPACE (RESTRICTED ZONES)**:
       - List every part of the product surface that is **BLANK**. 
       - This is used to BLOCK the AI from adding random logos to these areas.
       
    5. **TYPOGRAPHY & CONTENT**:
       - Transcribe the text exactly. Case-sensitive.

    Output a structured "Surface Map".
  `;

  const parts: any[] = [{ text: systemPrompt }];
  
  base64Images.forEach((img) => {
    const cleanBase64 = img.split(',')[1] || img;
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
  });

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text || "A generic product.";
  } catch (error) {
    console.warn("Product analysis failed", error);
    return "The product shown in the reference images.";
  }
};

export const generateSceneDescription = async (
  base64Images: string[],
  productIdentity: string,
  userHint?: string
): Promise<string> => {
  const systemInstruction = `
    You are a Creative Director. Define a SINGLE, CONSISTENT studio environment.
    
    PRODUCT CONTEXT: ${productIdentity}
    
    TASK:
    - Design a scene that complements the product's specific COLOR PALETTE and MATERIALS.
    - If the product is matte, consider contrast lighting. If glossy, consider softbox reflections.
    - Ensure the background color does not clash with the primary product color.
    
    Output ONE descriptive paragraph.
  `;

  const parts: any[] = [
    { text: userHint ? `USER REQUEST: "${userHint}"\n\nDesign the scene based on this request + the product identity.` : `Design the perfect commercial scene for this product.` }
  ];

  base64Images.forEach((img) => {
    const cleanBase64 = img.split(',')[1] || img;
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
  });

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { 
        systemInstruction,
        thinkingConfig: { thinkingBudget: 1024 } 
      }
    });
    return response.text || "A professional studio setting.";
  } catch (error) {
    return userHint || "A professional studio setting.";
  }
};

export const generateEcommerceImage = async (
  base64Images: string[],
  productIdentity: string,
  sceneDescription: string,
  angleInstruction: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution = '1K'
): Promise<string> => {
  const systemPrompt = `
    You are a 3D Product Photographer.
    
    CRITICAL INSTRUCTION - COLOR & MATERIAL FIDELITY:
    - READ the "Surface Map" below carefully.
    - You must STRICTLY reproduce the **Primary Color**, **Material Finish**, and **Textures** defined in the Surface Map.
    - Do NOT hallucinate new colors on the product.
    - If the product is described as "Matte Black", do not make it glossy. If it is "Metallic Silver", ensure it reflects.
    
    INPUT: 
    - REFERENCE IMAGES (Visual Truth)
    - SURFACE MAP (Textual Truth): ${productIdentity}
    - SCENE: ${sceneDescription}
    - ANGLE: ${angleInstruction}
    
    GENERATE: A photorealistic commercial shot.
  `;

  const parts: any[] = [{ text: systemPrompt }];

  base64Images.forEach((img) => {
    const cleanBase64 = img.split(',')[1] || img;
    parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
  });

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-pro-image-preview', // Upgraded to Pro for imageSize support
      contents: { parts },
      config: { 
        imageConfig: { 
          aspectRatio: aspectRatio,
          imageSize: resolution // Supports '1K', '2K', '4K'
        } 
      },
    });

    // The backend proxy serializes the response.candidates structure
    const responseParts = response.candidates?.[0]?.content?.parts;
    let generatedImageBase64 = '';

    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!generatedImageBase64) throw new Error("No image generated.");
    return `data:image/png;base64,${generatedImageBase64}`;

  } catch (error: any) {
    console.error("Gemini Image Gen Error:", error);
    throw new Error(error.message || "Generation failed.");
  }
};

export const suggestProjectCategories = async (description: string): Promise<CategorySuggestion[]> => {
  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `User wants to build: "${description}". 
      Suggest 3 distinct, professional Product Categories suitable for parametric design/selling.
      
      Requirements:
      1. Provide a Title (e.g. "Parametric Furniture").
      2. Provide a Description (e.g. "Focus on joinery and adjustable scale for different room sizes.").
      
      Examples: "Customizable Planter", "Modular Organizer", "Mechanical Part".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    });

    const suggestions = JSON.parse(response.text.trim());
    
    return [
      {
        title: "Parametric Design (Configurable)",
        description: "Best for sales. A smart model with adjustable dimensions (width, height, curves) that customers can personalize."
      },
      ...suggestions
    ];
  } catch (e) {
    console.error(e);
    return [
      { title: "Parametric Design (Configurable)", description: "Best for sales. A smart model with adjustable dimensions." },
      { title: "3D Printable Part", description: "Optimized for FDM/SLA printing with correct tolerances and manifold geometry." },
      { title: "Architectural Model", description: "Scale model focus with attention to structural aesthetics." },
      { title: "Functional Prototype", description: "Engineering-grade mechanical assembly for testing fit and form." }
    ];
  }
};

export const enhanceUserPrompt = async (originalPrompt: string, category: string): Promise<string> => {
  if (!originalPrompt.trim()) return "";

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a Technical 3D Prompt Engineer.
      CONTEXT: The user is building a "${category}" 3D model in Three.js.
      USER INPUT: "${originalPrompt}"
      
      TASK: Rewrite the user's input into a highly detailed, descriptive technical prompt.
      - FOCUS on Parametric variables: "Allow adjustment of radius", "Variable height", "Configurable number of segments".
      - Specify geometric operations (e.g. "extrude profile", "chamfer edges").
      `,
    });
    return response.text.trim();
  } catch (e) {
    return originalPrompt;
  }
};

export const enhanceScenePrompt = async (originalPrompt: string): Promise<string> => {
  if (!originalPrompt.trim()) return "";

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Creative 3D Director.
      CONTEXT: The user is building an animated 3D scene in Three.js (Motion Studio).
      USER INPUT: "${originalPrompt}"
      
      TASK: Rewrite the user's input into a vivid, technically detailed creative prompt.
      - FOCUS on: Atmosphere, Lighting types (Hemisphere, Spotlights), Animation logic (walking, floating, rotating), and Particle effects.
      - Suggest specific colors and moods.
      - Make it sound like a high-end generative art description.
      `,
    });
    return response.text.trim();
  } catch (e) {
    return originalPrompt;
  }
};

export const enhanceCinematicPrompt = async (originalPrompt: string): Promise<string> => {
  if (!originalPrompt.trim()) return "";

  try {
    const response = await backend.ai.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Virtual Cinematographer.
      CONTEXT: The user is scripting a short movie scene in Three.js.
      USER INPUT: "${originalPrompt}"
      
      TASK: Rewrite the input into a detailed Director's Script.
      - **CHARACTERS**: If the user asks for a character (robot, person), describe their appearance and ACTION (walking, waving).
      - MUST INCLUDE: Specific Camera Movement (e.g. "Slow Dolly In", "Truck Left", "Orbit", "Crane Up").
      - MUST INCLUDE: Visual Atmosphere & Lighting (e.g. "Cyberpunk Neon", "Golden Hour", "Spooky Fog").
      - Make it sound professional and ready for a code generator.
      `,
    });
    return response.text.trim();
  } catch (e) {
    return originalPrompt;
  }
};

export const generateAnimationCode = async (prompt: string, previousCode?: string, imageBase64?: string, category?: string): Promise<string> => {
  const isPrintable = category?.toLowerCase().includes('print') || category?.toLowerCase().includes('parametric');

  const mindset = `
    ROLE: You are a Computational Geometry Specialist & Parametric Designer.
    
    CORE PHILOSOPHY: **Form is Configurable**.
    You do NOT create static sculptures. You create **Smart Objects** driven by variables.
    
    YOUR GOAL:
    Generate clean, constructive THREE.js code.
    Crucially, you must expose PHYSICAL DIMENSIONS to the GUI so the user can TWEAK the design.
    
    VISUAL STYLE: 
    - **Blueprint/Prototyping Aesthetic**.
    - Material: \`new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.6, metalness: 0.1, flatShading: false })\`.
    - **EDGES**: You MUST add \`THREE.EdgesGeometry\` + \`THREE.LineSegments\` to the main mesh to highlight the wireframe contours on top of the solid model.
    - Background: Dark Technical Grid (#111827).
  `;

  const commonRequirements = `
    CRITICAL TECHNICAL REQUIREMENTS FOR THE HTML OUTPUT:
    1. **IMPORT MAP (LATEST STABLE)**: 
       <script type="importmap">
         {
           "imports": {
             "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
             "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
           }
         }
       </script>
    
    2. **MODULE SCRIPT**:
       - Import THREE, OrbitControls.
       - Import { TransformControls } from 'three/addons/controls/TransformControls.js'.
       - Import { STLExporter } from 'three/addons/exporters/STLExporter.js';
       - Import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
       - Import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
       - Import GUI from 'three/addons/libs/lil-gui.module.min.js'.
       - **NEW**: Import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
       - **NEW**: Import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
       - **NEW**: Import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

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
       - You MUST create a \`params\` object containing PHYSICAL DIMENSIONS (e.g., radius, height, thickness, count, angle).
       - You MUST create a \`regenerate()\` function that:
         1. Checks \`if (mesh.geometry) mesh.geometry.dispose();\`
         2. Creates NEW geometry based on current \`params\`.
         3. Assigns it to the mesh.
       - You MUST add sliders: \`gui.add(params, 'width', 1, 20).onChange(regenerate);\`
       - **GOAL**: The user must be able to CUSTOMIZE the shape using the UI sliders.
       
    6. **DEBUGGING HOOKS (CRITICAL)**:
       - At the very end of your script, you MUST expose the core variables to the global scope for the external debugger to work.
       - ADD THIS EXACT CODE at the end:
         \`\`\`js
         window.scene = scene;
         window.camera = camera;
         window.renderer = renderer;
         window.controls = controls; // OrbitControls
         \`\`\`
         
    7. **NO BLACK SCREENS**:
       - Always verify \`renderer.setSize(window.innerWidth, window.innerHeight)\`.
       - Always verify \`document.body.appendChild(renderer.domElement)\`.
       - Add \`body { margin: 0; overflow: hidden; }\` in \`<style>\`.
  `;

  const highFidelityRules = `
    *** GEOMETRIC CONSTRUCTION RULES ***:
    1. **USE PROFILES (2D -> 3D)**: 
       - Do not just stack \`BoxGeometry\`. 
       - **PREFERRED**: Define a \`THREE.Shape()\`, then use \`THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, ... })\`.
       - **PREFERRED**: Use \`THREE.LatheGeometry(points)\` for cylindrical objects (bottles, shafts, vases).
       - **PREFERRED**: Use \`THREE.TubeGeometry\` for pipes/wires.
    
    2. **MANIFOLD GEOMETRY (For 3D Printing)**:
       - Ensure volumes are closed.
       - If ${isPrintable ? "true" : "false"}: Avoid zero-thickness planes. Use \`side: THREE.DoubleSide\` only for visualization, but geometry must be thick.
       
    3. **GROUPING**:
       - Combine parts into a single \`THREE.Group\` for the final object.
       - IMPORTANT: Assign this group to a variable \`window.exportMesh = myGroup;\` so external exporters can find it easily.

    4. **SYNTAX SAFETY**:
       - **Use \`shape.closePath()\`** (NOT \`shape.close()\`) when defining 2D shapes.
       - If using \`THREE.Path\`, use \`closePath()\`.
  `;

  let fullPrompt = "";

  if (previousCode) {
    fullPrompt = `
      ${mindset}
      
      CONTEXT: You are modifying an existing Parametric CAD model.
      
      EXISTING CODE:
      ${previousCode}
      
      USER REQUEST FOR UPDATE: "${prompt}"
      ${imageBase64 ? "NOTE: User provided a reference image. Adjust geometry to match." : ""}
      
      TASK: 
      1. Analyze the EXISTING CODE.
      2. Modify the code to satisfy the USER REQUEST.
      3. **PRESERVE PARAMETERS**: If the user asks for a change, consider exposing it as a new Slider in the GUI.
      
      ${commonRequirements}
      ${highFidelityRules}
      
      OUTPUT FORMAT:
      - Return ONLY the raw string of the HTML file, starting with <!DOCTYPE html>.
    `;
  } else {
    fullPrompt = `
      ${mindset}
      
      TASK: Create a self-contained HTML file that renders a Configurable 3D Model.
      ${imageBase64 ? `
        **REVERSE ENGINEERING TASK**:
        1. Analyze the image GEOMETRY.
        2. Create a PARAMETRIC version of this object. (e.g., if it's a cup, allow changing height and radius).
        
        ${prompt ? `**ADDITIONAL INSTRUCTIONS**: "${prompt}"` : ""}
      ` : `User Request: "${prompt}"`}
      
      ${commonRequirements}
      ${highFidelityRules}
      
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
