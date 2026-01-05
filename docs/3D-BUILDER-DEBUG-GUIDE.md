# 3D Builder Debug Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           3D BUILDER SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────────────┐  │
│  │  InputPanel     │───▶│  Builder.tsx     │───▶│  GeminiService         │  │
│  │  (User Input)   │    │  (Orchestrator)  │    │  (AI Generation)       │  │
│  └─────────────────┘    └──────────────────┘    └────────────────────────┘  │
│          │                      │                          │                 │
│          ▼                      ▼                          ▼                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────────────┐  │
│  │  BuilderStore   │◀──▶│  Viewport.tsx    │◀──▶│  utils.ts (Driver)     │  │
│  │  (State)        │    │  (3D Canvas)     │    │  (Iframe Script)       │  │
│  └─────────────────┘    └──────────────────┘    └────────────────────────┘  │
│          │                      │                          │                 │
│          ▼                      ▼                          ▼                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────────────┐  │
│  │  Panels.tsx     │◀──▶│  PostMessage     │◀──▶│  Three.js Scene        │  │
│  │  (Tools UI)     │    │  (Communication) │    │  (Rendering)           │  │
│  └─────────────────┘    └──────────────────┘    └────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Enabling Debug Mode

### Console Commands
```javascript
// Enable debugging (in browser console)
window.enableDebug('debug');  // Options: 'error', 'warn', 'info', 'debug', 'trace'

// Disable debugging
window.disableDebug();

// Access debug service directly
window.proshotDebug.getLogs();
window.proshotDebug.exportLogs();
```

### UI Toggle
Click the 🐛 button in the bottom-left corner of the Builder to open the Debug Panel.

---

## Pre-Generation Flow (Before 3D Design)

### Flow Diagram
```
User Types Prompt
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. InputPanel.tsx                       │
│    - store.setPrompt(text)              │
│    - Debug: inputPromptChanged()        │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. User Clicks Template (Optional)      │
│    - store.setPrompt(templatePrompt)    │
│    - Debug: inputTemplateSelected()     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. User Adds Image (Optional)           │
│    - store.setRefImages([...])          │
│    - Debug: inputImageAdded()           │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. User Clicks "Enhance" (Optional)     │
│    - enhanceUserPrompt() API call       │
│    - Debug: inputEnhanceStarted/Completed│
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. User Clicks "Generate"               │
│    - handleGenerate()                   │
│    - Debug: generationStarted()         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 6. GeminiService API Call               │
│    - generateAnimationCode()            │
│    - Debug: generationAPICall()         │
│    - Debug: generationAPIResponse()     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 7. Code Stored                          │
│    - store.setHtmlCode(code, true)      │
│    - Debug: generationCompleted()       │
└─────────────────────────────────────────┘
```

### Debug Checkpoints (Pre-Generation)

| Checkpoint | Debug Method | What to Check |
|------------|--------------|---------------|
| Prompt Input | `inputPromptChanged` | Prompt length, has images |
| Template | `inputTemplateSelected` | Template name, generated prompt |
| Enhance | `inputEnhanceStarted/Completed` | Duration, enhanced prompt |
| Generate Start | `generationStarted` | Prompt, mode, category, has existing code |
| API Call | `generationAPICall` | Model, prompt length |
| API Response | `generationAPIResponse` | Response length, errors |
| Complete | `generationCompleted` | Final code length |

---

## Post-Generation Flow (After 3D Design)

### Flow Diagram
```
Code Generated (store.htmlCode)
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. Viewport Re-renders                  │
│    - srcDoc={injectContextAndDriver()}  │
│    - Debug: renderIframeLoading()       │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. Driver Script Injected               │
│    - Import map + driver code           │
│    - Debug: renderDriverInjected()      │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. Scene Auto-Detection                 │
│    - Hooks THREE.WebGLRenderer.render   │
│    - Captures window.scene/camera       │
│    - Debug: renderSceneDetected()       │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. Auto-Inject Lights (if none)         │
│    - AmbientLight + DirectionalLight    │
│    - Debug: renderLightsAutoInjected()  │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. Tools Initialized                    │
│    - TransformControls, CSG Evaluator   │
│    - Debug: renderToolsInitialized()    │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 6. Scene Graph Broadcast (500ms loop)   │
│    - postMessage('sceneGraphUpdate')    │
│    - Debug: sceneGraphUpdated()         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 7. GUI Config Broadcast (if GUI used)   │
│    - postMessage('guiConfig')           │
│    - Debug: guiConfigReceived()         │
└─────────────────────────────────────────┘
```

### Debug Checkpoints (Post-Generation)

| Checkpoint | Debug Method | What to Check |
|------------|--------------|---------------|
| Iframe Load | `renderIframeLoading` | Code length |
| Scene Ready | `renderSceneDetected` | scene, camera, renderer present |
| Lights Injected | `renderLightsAutoInjected` | Light count |
| Scene Graph | `sceneGraphUpdated` | Node count, selected count |
| GUI Config | `guiConfigReceived` | Control count |
| Errors | `runtimeError` | Error message, source |

---

## Panel Interaction Flow

### Boolean Operations
```
User Selects Target Object
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. Click Union/Subtract/Intersect       │
│    - store.setBooleanOp(op)             │
│    - store.setBooleanTarget(id)         │
│    - Debug: panelBooleanStarted()       │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. User Selects Tool Object             │
│    - store.selectedObjectIds changes    │
│    - useEffect triggers                 │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. PostMessage to Iframe                │
│    - type: 'performBoolean'             │
│    - Debug: messageToIframe()           │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. Driver Executes CSG                  │
│    - three-bvh-csg library              │
│    - Result added to scene              │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. Scene Graph Updated                  │
│    - postMessage('sceneGraphUpdate')    │
│    - Debug: panelBooleanCompleted()     │
└─────────────────────────────────────────┘
```

### Parametric Controls
```
AI Code Creates GUI
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. window.GUI().add(object, prop)       │
│    - Driver's GUI proxy intercepts      │
│    - postMessage('guiConfig')           │
│    - Debug: guiConfigReceived()         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. React Renders Sliders                │
│    - Parameters tab in Panels.tsx       │
│    - store.parameters displayed         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. User Adjusts Slider                  │
│    - onChange → handleParameterChange   │
│    - Debug: panelParameterChanged()     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. PostMessage to Iframe                │
│    - type: 'updateParam'                │
│    - Debug: messageToIframe()           │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. Driver Updates Value                 │
│    - object[property] = value           │
│    - onChangeCallback() fires           │
│    - Scene re-renders                   │
└─────────────────────────────────────────┘
```

### 2D Sketch → Extrude
```
User Draws on Canvas
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. Points Collected                     │
│    - sketchPoints state updated         │
│    - Canvas redraws with ghost line     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. User Sets Extrude Height             │
│    - extrudeHeight slider               │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. Click "Extrude Shape"                │
│    - handleSketchExtrude(points, height)│
│    - Debug: panelSketchExtruded()       │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. PostMessage to Iframe                │
│    - type: 'extrudeSketch'              │
│    - Debug: messageToIframe()           │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. Driver Creates ExtrudeGeometry       │
│    - THREE.Shape from points            │
│    - THREE.ExtrudeGeometry              │
│    - Added to scene                     │
└─────────────────────────────────────────┘
```

---

## Message Protocol Reference

### React → Iframe Messages

| Type | Data | Purpose |
|------|------|---------|
| `setRenderMode` | `{ mode }` | Wireframe/normal/etc |
| `toggleGrid` | `{ visible }` | Show/hide grid |
| `setGizmoMode` | `{ mode }` | translate/rotate/scale/none |
| `setView` | `{ view }` | front/side/top/center/iso |
| `addPrimitive` | `{ primType }` | box/sphere/cylinder/plane |
| `performBoolean` | `{ op, targetId, toolId }` | CSG operation |
| `updateMaterial` | `{ config }` | Color, metalness, roughness |
| `updateParam` | `{ name, value }` | GUI parameter |
| `extrudeSketch` | `{ points, height }` | 2D→3D |
| `exportModel` | `{ format }` | stl/gltf/3mf |
| `selectObject` | `{ objectId }` | Select by UUID |

### Iframe → React Messages

| Type | Data | Purpose |
|------|------|---------|
| `error` | `{ message }` | Runtime error |
| `sceneGraphUpdate` | `{ graph }` | Object hierarchy |
| `geometryStats` | `{ stats }` | Bounding box, tris |
| `guiConfig` | `{ controls }` | Parameter definitions |
| `cameraState` | `{ position, target }` | For bookmarks |
| `exportComplete` | - | Download started |

---

## Auto-Debug Flow

```
Runtime Error in Iframe
       │
       ▼
┌─────────────────────────────────────────┐
│ 1. Error Sent to Parent                 │
│    - postMessage({ type: 'error' })     │
│    - Debug: runtimeError()              │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 2. Store Updated                        │
│    - store.setRuntimeError(message)     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 3. Auto-Debug Check                     │
│    - if (autoDebug && !isFixing)        │
│    - if (fixAttempts < 3)               │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 4. handleAutoFix() Called               │
│    - Debug: autoFixStarted()            │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 5. fixThreeJSCode() API Call            │
│    - Gemini analyzes error + code       │
│    - Returns fixed code                 │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 6. Code Updated                         │
│    - store.setHtmlCode(fixed, true)     │
│    - Debug: autoFixCompleted()          │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ 7. Iframe Reloads                       │
│    - If no new error → success          │
│    - If error → loop (max 3 attempts)   │
└─────────────────────────────────────────┘
```

---

## Common Debug Scenarios

### "Generation Failed"
1. Check `generationAPICall` log → Was prompt sent?
2. Check `generationAPIResponse` log → Any API errors?
3. Check console for network errors
4. Verify API key in `.env`

### "Scene Not Rendering"
1. Check `renderSceneDetected` log → Found scene/camera/renderer?
2. Check `runtimeError` log → JS errors in generated code?
3. Look at iframe console for Three.js errors
4. Verify import map URLs are accessible

### "Boolean Operation Failed"
1. Check `panelBooleanStarted` log → Target ID correct?
2. Check `messageToIframe` log → Message sent?
3. Check `panelBooleanCompleted` log → Success status?
4. Ensure both objects are valid meshes (not groups)

### "Parameters Not Working"
1. Check `guiConfigReceived` log → Controls received?
2. Verify AI code uses `new window.GUI().add()`
3. Check `panelParameterChanged` log → Values changing?
4. Check `messageToIframe('updateParam')` log

### "Export Not Working"
1. Check `exportStarted` log → Format correct?
2. Check `exportCompleted` log → Received?
3. Look at iframe console for export errors
4. Verify scene has exportable meshes

---

## Performance Debugging

The debug service automatically tracks duration for:
- `generation-total` - Full generation cycle
- `generation-api` - API call only
- `enhance-prompt` - Prompt enhancement
- `iframe-load` - Iframe rendering
- `auto-fix` - Auto-fix cycle
- `export-{format}` - Export operations

View performance logs:
```javascript
window.proshotDebug.getLogs({ category: 'performance' });
```

---

## Debug Service API

```typescript
// Enable/Disable
debug.enable('debug');
debug.disable();
debug.isEnabled();

// Correlation tracking (for tracing flows)
const id = debug.startCorrelation('generation');
// ... operations ...
debug.endCorrelation();

// Performance markers
debug.startMark('my-operation');
const duration = debug.endMark('my-operation');

// Get/Export logs
debug.getLogs({ category: 'error' });
debug.exportLogs(); // Returns JSON string
debug.clearLogs();

// Subscribe to events
const unsubscribe = debug.subscribe((entry) => {
  console.log('New log:', entry);
});
```
