/**
 * IframeCommandService - Promise-based command system with ACK pattern
 *
 * Provides reliable communication between React and iframe with:
 * - Promise-based commands that resolve/reject based on acknowledgment
 * - Configurable timeout handling
 * - Optional retry mechanism for failed commands
 * - Pending commands tracking for debugging
 */

export interface CommandOptions {
  timeout?: number;      // Timeout in ms (default: 5000)
  retries?: number;      // Number of retries (default: 0)
  retryDelay?: number;   // Delay between retries in ms (default: 500)
}

export interface CommandResult<T = any> {
  success: boolean;
  commandId: string;
  commandType: string;
  data?: T;
  error?: string;
  timestamp: number;
}

interface PendingCommand {
  commandId: string;
  type: string;
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: number;
  retriesLeft: number;
  message: any;
}

class IframeCommandService {
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private iframeRef: React.RefObject<HTMLIFrameElement> | null = null;
  private defaultTimeout = 5000;
  private defaultRetries = 0;
  private defaultRetryDelay = 500;

  /**
   * Initialize the service with the iframe reference
   */
  init(iframeRef: React.RefObject<HTMLIFrameElement>) {
    this.iframeRef = iframeRef;

    // Listen for ACK messages from iframe
    window.addEventListener('message', this.handleMessage);

    console.log('[CommandService] Initialized');
  }

  /**
   * Cleanup when component unmounts
   */
  destroy() {
    window.removeEventListener('message', this.handleMessage);

    // Reject all pending commands
    this.pendingCommands.forEach((cmd) => {
      clearTimeout(cmd.timeout);
      cmd.reject(new Error('Command service destroyed'));
    });
    this.pendingCommands.clear();
    this.iframeRef = null;

    console.log('[CommandService] Destroyed');
  }

  /**
   * Handle incoming messages from iframe
   */
  private handleMessage = (event: MessageEvent) => {
    if (!event.data || event.data.type !== 'commandAck') return;

    const { commandId, success, error, ...rest } = event.data;
    const pending = this.pendingCommands.get(commandId);

    if (!pending) {
      // ACK for unknown command (might have timed out already)
      console.warn('[CommandService] Received ACK for unknown command:', commandId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(commandId);

    const result: CommandResult = {
      success,
      commandId,
      commandType: pending.type,
      data: rest,
      error,
      timestamp: Date.now()
    };

    if (success) {
      pending.resolve(result);
    } else {
      // Check if we should retry
      if (pending.retriesLeft > 0) {
        console.log(`[CommandService] Command ${pending.type} failed, retrying... (${pending.retriesLeft} left)`);
        setTimeout(() => {
          this.retryCommand(pending);
        }, this.defaultRetryDelay);
      } else {
        pending.reject(new Error(error || 'Command failed'));
      }
    }
  };

  /**
   * Retry a failed command
   */
  private retryCommand(pending: PendingCommand) {
    const newCommandId = this.generateCommandId();
    const message = { ...pending.message, commandId: newCommandId };

    const timeout = setTimeout(() => {
      this.pendingCommands.delete(newCommandId);
      if (pending.retriesLeft > 1) {
        console.log(`[CommandService] Command ${pending.type} timed out, retrying...`);
        this.retryCommand({ ...pending, retriesLeft: pending.retriesLeft - 1 });
      } else {
        pending.reject(new Error(`Command ${pending.type} timed out after all retries`));
      }
    }, this.defaultTimeout);

    this.pendingCommands.set(newCommandId, {
      ...pending,
      commandId: newCommandId,
      timeout,
      retriesLeft: pending.retriesLeft - 1,
      message
    });

    this.sendToIframe(message);
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send message to iframe
   */
  private sendToIframe(message: any): boolean {
    if (!this.iframeRef?.current?.contentWindow) {
      console.error('[CommandService] Iframe not available');
      return false;
    }
    this.iframeRef.current.contentWindow.postMessage(message, '*');
    return true;
  }

  /**
   * Send a command and wait for acknowledgment
   */
  async send<T = any>(
    type: string,
    payload: Record<string, any> = {},
    options: CommandOptions = {}
  ): Promise<CommandResult<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
    } = options;

    const commandId = this.generateCommandId();
    const message = { type, ...payload, commandId };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        const pending = this.pendingCommands.get(commandId);
        this.pendingCommands.delete(commandId);

        if (pending && pending.retriesLeft > 0) {
          console.log(`[CommandService] Command ${type} timed out, retrying...`);
          this.retryCommand(pending);
        } else {
          reject(new Error(`Command ${type} timed out after ${timeout}ms`));
        }
      }, timeout);

      // Store pending command
      this.pendingCommands.set(commandId, {
        commandId,
        type,
        resolve,
        reject,
        timeout: timeoutHandle,
        createdAt: Date.now(),
        retriesLeft: retries,
        message
      });

      // Send to iframe
      if (!this.sendToIframe(message)) {
        clearTimeout(timeoutHandle);
        this.pendingCommands.delete(commandId);
        reject(new Error('Failed to send command - iframe not available'));
      }
    });
  }

  /**
   * Send a command without waiting for acknowledgment (fire-and-forget)
   * Use this for non-critical operations like view changes
   */
  sendFireAndForget(type: string, payload: Record<string, any> = {}): boolean {
    const commandId = this.generateCommandId();
    const message = { type, ...payload, commandId };
    return this.sendToIframe(message);
  }

  /**
   * Get count of pending commands (for debugging)
   */
  getPendingCount(): number {
    return this.pendingCommands.size;
  }

  /**
   * Get pending command types (for debugging)
   */
  getPendingTypes(): string[] {
    return Array.from(this.pendingCommands.values()).map(cmd => cmd.type);
  }

  /**
   * Cancel all pending commands
   */
  cancelAll() {
    this.pendingCommands.forEach((cmd) => {
      clearTimeout(cmd.timeout);
      cmd.reject(new Error('Command cancelled'));
    });
    this.pendingCommands.clear();
  }
}

// Singleton instance
export const iframeCommands = new IframeCommandService();

// Convenience functions for common operations
export const commands = {
  /**
   * Add a primitive shape to the scene
   */
  addPrimitive: (primType: 'box' | 'sphere' | 'cylinder' | 'plane') =>
    iframeCommands.send('addPrimitive', { primType }, { timeout: 3000 }),

  /**
   * Perform boolean operation
   */
  performBoolean: (op: 'union' | 'subtract' | 'intersect', targetId: string, toolId: string) =>
    iframeCommands.send('performBoolean', { op, targetId, toolId }, { timeout: 10000, retries: 1 }),

  /**
   * Select an object
   */
  selectObject: (objectId: string | null) =>
    iframeCommands.send('selectObject', { objectId }, { timeout: 2000 }),

  /**
   * Update material
   */
  updateMaterial: (config: any) =>
    iframeCommands.send('updateMaterial', { config }, { timeout: 2000 }),

  /**
   * Extrude sketch
   */
  extrudeSketch: (points: { x: number; y: number }[], height: number) =>
    iframeCommands.send('extrudeSketch', { points, height }, { timeout: 5000 }),

  /**
   * Repair mesh
   */
  repairMesh: () =>
    iframeCommands.send('repairMesh', {}, { timeout: 5000 }),

  /**
   * Export model (fire-and-forget since export handles its own completion)
   */
  exportModel: (format: string) =>
    iframeCommands.sendFireAndForget('exportModel', { format }),

  /**
   * Set view (fire-and-forget for responsiveness)
   */
  setView: (view: string) =>
    iframeCommands.sendFireAndForget('setView', { view }),

  /**
   * Set gizmo mode (fire-and-forget)
   */
  setGizmoMode: (mode: string) =>
    iframeCommands.sendFireAndForget('setGizmoMode', { mode }),

  /**
   * Toggle grid (fire-and-forget)
   */
  toggleGrid: (visible: boolean) =>
    iframeCommands.sendFireAndForget('toggleGrid', { visible }),

  /**
   * Set render mode (fire-and-forget)
   */
  setRenderMode: (mode: string) =>
    iframeCommands.sendFireAndForget('setRenderMode', { mode }),

  /**
   * Set environment (fire-and-forget)
   */
  setEnvironment: (env: string) =>
    iframeCommands.sendFireAndForget('setEnvironment', { env }),

  /**
   * Request camera state for bookmark
   */
  requestCameraState: () =>
    iframeCommands.sendFireAndForget('requestCameraState', {}),

  /**
   * Restore camera from bookmark
   */
  setCameraState: (position: number[], target: number[]) =>
    iframeCommands.sendFireAndForget('setCameraState', { position, target }),

  /**
   * Take snapshot
   */
  takeSnapshot: () =>
    iframeCommands.sendFireAndForget('takeSnapshot', {}),

  /**
   * Apply texture to selected object
   */
  applyTexture: (config: {
    diffuseMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    metalnessMap?: string;
    aoMap?: string;
    repeatX?: number;
    repeatY?: number;
    rotation?: number;
  }) =>
    iframeCommands.send('applyTexture', { config }, { timeout: 10000 }),

  /**
   * Remove texture from selected object
   */
  removeTexture: () =>
    iframeCommands.send('removeTexture', {}, { timeout: 3000 }),

  /**
   * Update texture transform (repeat/rotation) without reloading
   */
  updateTextureTransform: (config: {
    repeatX?: number;
    repeatY?: number;
    rotation?: number;
  }) =>
    iframeCommands.send('updateTextureTransform', { config }, { timeout: 2000 }),

  /**
   * Scale selected objects (precision mode)
   */
  setScale: (config: {
    uniform?: boolean;
    factor?: number;
    x?: number;
    y?: number;
    z?: number;
  }) =>
    iframeCommands.send('setScale', config, { timeout: 3000 }),

  /**
   * Apply animation preset to selected objects
   */
  applyAnimation: (config: {
    presetId: string;
    speed?: number;
    duration?: number;
    loop?: boolean;
    action?: 'play' | 'stop';
  }) =>
    iframeCommands.send('applyAnimation', config, { timeout: 3000 }),

  /**
   * Reset animation and restore original transforms
   */
  resetAnimation: () =>
    iframeCommands.send('resetAnimation', {}, { timeout: 2000 }),

  /**
   * Stop current animation
   */
  stopAnimation: () =>
    iframeCommands.send('applyAnimation', { action: 'stop' }, { timeout: 2000 }),

  /**
   * Spawn a base mesh from preset
   */
  spawnBaseMesh: (config: {
    presetId: string;
    code: string;
  }) =>
    iframeCommands.send('spawnBaseMesh', config, { timeout: 5000 }),
};
