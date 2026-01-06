/**
 * Success Pattern Tracking Service
 *
 * Tracks generation history to:
 * - Learn from successful prompts and geometries
 * - Avoid repeating failed patterns
 * - Inject successful patterns into future AI prompts
 * - Improve generation quality over time
 */

export interface GenerationRecord {
  id: string;
  timestamp: number;
  prompt: string;
  success: boolean;
  geometries: string[];        // Extracted geometry types used
  materials: string[];         // Material types used
  codeLength: number;
  executionTime?: number;
  errorMessage?: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface SuccessPatterns {
  commonGeometries: { type: string; count: number; successRate: number }[];
  commonMaterials: { type: string; count: number }[];
  avgCodeLength: number;
  avgComplexity: string;
  successfulPromptPatterns: string[];  // Keywords from successful prompts
  failedPromptPatterns: string[];      // Keywords from failed prompts
}

const STORAGE_KEY = 'proshot_generation_history';
const MAX_RECORDS = 100;

class SuccessTrackingService {
  private history: GenerationRecord[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load history from localStorage
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
        console.log(`[SuccessTracking] Loaded ${this.history.length} records`);
      }
    } catch (error) {
      console.error('[SuccessTracking] Failed to load history:', error);
      this.history = [];
    }
  }

  /**
   * Save history to localStorage
   */
  private saveToStorage() {
    try {
      // Keep only last MAX_RECORDS
      if (this.history.length > MAX_RECORDS) {
        this.history = this.history.slice(-MAX_RECORDS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('[SuccessTracking] Failed to save history:', error);
    }
  }

  /**
   * Extract geometry types from Three.js code
   */
  extractGeometries(code: string): string[] {
    const geometryPattern = /new\s+THREE\.(\w+Geometry)/g;
    const matches = code.matchAll(geometryPattern);
    const geometries = new Set<string>();
    for (const match of matches) {
      geometries.add(match[1]);
    }
    return Array.from(geometries);
  }

  /**
   * Extract material types from Three.js code
   */
  extractMaterials(code: string): string[] {
    const materialPattern = /new\s+THREE\.(\w+Material)/g;
    const matches = code.matchAll(materialPattern);
    const materials = new Set<string>();
    for (const match of matches) {
      materials.add(match[1]);
    }
    return Array.from(materials);
  }

  /**
   * Extract keywords from prompt
   */
  private extractKeywords(prompt: string): string[] {
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with',
      'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so', 'yet',
      'both', 'either', 'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
      'create', 'make', 'add', 'build', 'generate', 'design', 'model', '3d', 'object', 'shape']);

    return prompt.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Record a generation attempt
   */
  record(
    prompt: string,
    code: string,
    success: boolean,
    complexity: 'low' | 'medium' | 'high' = 'medium',
    errorMessage?: string
  ): GenerationRecord {
    const record: GenerationRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      prompt,
      success,
      geometries: this.extractGeometries(code),
      materials: this.extractMaterials(code),
      codeLength: code.length,
      complexity,
      errorMessage
    };

    this.history.push(record);
    this.saveToStorage();

    console.log(`[SuccessTracking] Recorded ${success ? 'successful' : 'failed'} generation:`, {
      geometries: record.geometries,
      materials: record.materials,
      codeLength: record.codeLength
    });

    return record;
  }

  /**
   * Mark a generation as successful (after runtime execution)
   */
  markSuccess(recordId: string) {
    const record = this.history.find(r => r.id === recordId);
    if (record) {
      record.success = true;
      record.errorMessage = undefined;
      this.saveToStorage();
    }
  }

  /**
   * Mark a generation as failed (after runtime error)
   */
  markFailed(recordId: string, errorMessage: string) {
    const record = this.history.find(r => r.id === recordId);
    if (record) {
      record.success = false;
      record.errorMessage = errorMessage;
      this.saveToStorage();
    }
  }

  /**
   * Get success patterns for prompt injection
   */
  getSuccessPatterns(): SuccessPatterns {
    const successful = this.history.filter(r => r.success);
    const failed = this.history.filter(r => !r.success);

    // Count geometry usage
    const geometryCounts: Record<string, { total: number; success: number }> = {};
    this.history.forEach(r => {
      r.geometries.forEach(g => {
        if (!geometryCounts[g]) geometryCounts[g] = { total: 0, success: 0 };
        geometryCounts[g].total++;
        if (r.success) geometryCounts[g].success++;
      });
    });

    const commonGeometries = Object.entries(geometryCounts)
      .map(([type, counts]) => ({
        type,
        count: counts.total,
        successRate: counts.total > 0 ? counts.success / counts.total : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count material usage
    const materialCounts: Record<string, number> = {};
    successful.forEach(r => {
      r.materials.forEach(m => {
        materialCounts[m] = (materialCounts[m] || 0) + 1;
      });
    });

    const commonMaterials = Object.entries(materialCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average code length
    const avgCodeLength = successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.codeLength, 0) / successful.length)
      : 0;

    // Average complexity
    const complexityMap = { low: 1, medium: 2, high: 3 };
    const avgComplexityNum = successful.length > 0
      ? successful.reduce((sum, r) => sum + complexityMap[r.complexity], 0) / successful.length
      : 2;
    const avgComplexity = avgComplexityNum < 1.5 ? 'low' : avgComplexityNum < 2.5 ? 'medium' : 'high';

    // Extract keywords from prompts
    const successKeywords: Record<string, number> = {};
    successful.forEach(r => {
      this.extractKeywords(r.prompt).forEach(k => {
        successKeywords[k] = (successKeywords[k] || 0) + 1;
      });
    });

    const failedKeywords: Record<string, number> = {};
    failed.forEach(r => {
      this.extractKeywords(r.prompt).forEach(k => {
        failedKeywords[k] = (failedKeywords[k] || 0) + 1;
      });
    });

    const successfulPromptPatterns = Object.entries(successKeywords)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    const failedPromptPatterns = Object.entries(failedKeywords)
      .filter(([word, count]) => count >= 2 && !successKeywords[word])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      commonGeometries,
      commonMaterials,
      avgCodeLength,
      avgComplexity,
      successfulPromptPatterns,
      failedPromptPatterns
    };
  }

  /**
   * Build context string for AI prompt injection
   */
  buildContextForPrompt(): string {
    const patterns = this.getSuccessPatterns();
    const successful = this.history.filter(r => r.success);
    const failed = this.history.filter(r => !r.success);

    if (successful.length === 0) {
      return ''; // No history yet
    }

    let context = '\n\n═══════════════════════════════════════════════════════════════════════════════\n';
    context += 'LEARNING FROM PREVIOUS GENERATIONS (Use this to improve output):\n';
    context += '═══════════════════════════════════════════════════════════════════════════════\n';

    // Successful geometries
    if (patterns.commonGeometries.length > 0) {
      const highSuccessGeometries = patterns.commonGeometries
        .filter(g => g.successRate >= 0.7 && g.count >= 2)
        .map(g => g.type);
      if (highSuccessGeometries.length > 0) {
        context += `\nRELIABLE GEOMETRIES (high success rate):\n`;
        context += highSuccessGeometries.map(g => `  - THREE.${g}`).join('\n');
      }
    }

    // Common materials
    if (patterns.commonMaterials.length > 0) {
      context += `\n\nPREFERRED MATERIALS:\n`;
      context += patterns.commonMaterials.slice(0, 3).map(m => `  - THREE.${m.type}`).join('\n');
    }

    // Successful keywords
    if (patterns.successfulPromptPatterns.length > 0) {
      context += `\n\nSUCCESSFUL PROMPT PATTERNS: ${patterns.successfulPromptPatterns.join(', ')}`;
    }

    // Failed patterns to avoid
    if (failed.length > 0) {
      const recentErrors = failed
        .slice(-3)
        .filter(r => r.errorMessage)
        .map(r => r.errorMessage!.split('\n')[0].substring(0, 80));
      if (recentErrors.length > 0) {
        context += `\n\nAVOID THESE ERROR PATTERNS:\n`;
        context += recentErrors.map(e => `  - ${e}`).join('\n');
      }
    }

    context += '\n═══════════════════════════════════════════════════════════════════════════════\n';

    return context;
  }

  /**
   * Get statistics for UI display
   */
  getStats(): {
    totalGenerations: number;
    successRate: number;
    recentSuccessRate: number;
    topGeometries: string[];
    topMaterials: string[];
  } {
    const total = this.history.length;
    const successful = this.history.filter(r => r.success).length;
    const recent = this.history.slice(-10);
    const recentSuccessful = recent.filter(r => r.success).length;

    const patterns = this.getSuccessPatterns();

    return {
      totalGenerations: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      recentSuccessRate: recent.length > 0 ? (recentSuccessful / recent.length) * 100 : 0,
      topGeometries: patterns.commonGeometries.slice(0, 5).map(g => g.type),
      topMaterials: patterns.commonMaterials.slice(0, 3).map(m => m.type)
    };
  }

  /**
   * Get recent history for debugging
   */
  getRecentHistory(count: number = 10): GenerationRecord[] {
    return this.history.slice(-count);
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SuccessTracking] History cleared');
  }
}

// Singleton instance
export const successTracking = new SuccessTrackingService();
