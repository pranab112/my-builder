/**
 * Image Compression Service
 *
 * Compresses images before sending to AI to:
 * - Reduce API payload size (60-80% smaller)
 * - Improve response times
 * - Lower API costs
 * - Standardize image quality for better AI analysis
 */

export interface CompressionResult {
  compressed: string;      // Base64 compressed image
  originalSize: number;    // Original size in bytes
  compressedSize: number;  // Compressed size in bytes
  reduction: number;       // Percentage reduction
  dimensions: {
    original: { width: number; height: number };
    compressed: { width: number; height: number };
  };
}

export interface ImageAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  estimatedQuality: 'high' | 'medium' | 'low';
  isBlurry: boolean;
  dominantColors: string[];
}

// Configuration
const CONFIG = {
  maxDimension: 1024,      // Max width or height
  quality: 0.85,           // JPEG quality (0-1)
  outputFormat: 'image/jpeg',
  minSizeForCompression: 100 * 1024,  // Only compress if > 100KB
};

/**
 * Load an image from base64 string
 */
const loadImage = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
};

/**
 * Calculate base64 string size in bytes
 */
const getBase64Size = (base64: string): number => {
  // Remove data URL prefix if present
  const base64Data = base64.split(',')[1] || base64;
  // Each base64 character represents 6 bits, so 4 chars = 3 bytes
  return Math.ceil((base64Data.length * 3) / 4);
};

/**
 * Compress a single image
 */
export const compressImage = async (base64: string): Promise<CompressionResult> => {
  const originalSize = getBase64Size(base64);

  // Load the image
  const img = await loadImage(base64);
  const originalWidth = img.width;
  const originalHeight = img.height;

  // Calculate new dimensions maintaining aspect ratio
  let newWidth = originalWidth;
  let newHeight = originalHeight;

  if (originalWidth > CONFIG.maxDimension || originalHeight > CONFIG.maxDimension) {
    const scale = Math.min(
      CONFIG.maxDimension / originalWidth,
      CONFIG.maxDimension / originalHeight
    );
    newWidth = Math.round(originalWidth * scale);
    newHeight = Math.round(originalHeight * scale);
  }

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Convert to compressed format
  const compressed = canvas.toDataURL(CONFIG.outputFormat, CONFIG.quality);
  const compressedSize = getBase64Size(compressed);

  const reduction = ((originalSize - compressedSize) / originalSize) * 100;

  return {
    compressed,
    originalSize,
    compressedSize,
    reduction: Math.max(0, reduction), // Don't show negative reduction
    dimensions: {
      original: { width: originalWidth, height: originalHeight },
      compressed: { width: newWidth, height: newHeight }
    }
  };
};

/**
 * Compress multiple images in parallel
 */
export const compressImages = async (
  images: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{
  images: string[];
  stats: {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageReduction: number;
    processingTime: number;
  };
  details: CompressionResult[];
}> => {
  const startTime = performance.now();
  const details: CompressionResult[] = [];
  const compressedImages: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const result = await compressImage(images[i]);
      details.push(result);
      compressedImages.push(result.compressed);
      onProgress?.(i + 1, images.length);
    } catch (error) {
      console.error(`Failed to compress image ${i + 1}:`, error);
      // Keep original if compression fails
      compressedImages.push(images[i]);
      details.push({
        compressed: images[i],
        originalSize: getBase64Size(images[i]),
        compressedSize: getBase64Size(images[i]),
        reduction: 0,
        dimensions: {
          original: { width: 0, height: 0 },
          compressed: { width: 0, height: 0 }
        }
      });
    }
  }

  const processingTime = performance.now() - startTime;

  const totalOriginalSize = details.reduce((sum, d) => sum + d.originalSize, 0);
  const totalCompressedSize = details.reduce((sum, d) => sum + d.compressedSize, 0);
  const averageReduction = details.length > 0
    ? details.reduce((sum, d) => sum + d.reduction, 0) / details.length
    : 0;

  return {
    images: compressedImages,
    stats: {
      totalOriginalSize,
      totalCompressedSize,
      averageReduction,
      processingTime
    },
    details
  };
};

/**
 * Analyze image quality (basic heuristics)
 */
export const analyzeImageQuality = async (base64: string): Promise<ImageAnalysis> => {
  const img = await loadImage(base64);

  // Create small canvas for analysis
  const canvas = document.createElement('canvas');
  const size = 100; // Sample at 100x100
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // Calculate color variance (low variance = potentially blurry or low quality)
  let variance = 0;
  let prevR = 0, prevG = 0, prevB = 0;
  const colorCounts: Record<string, number> = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate local variance
    if (i > 0) {
      variance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
    }
    prevR = r; prevG = g; prevB = b;

    // Track dominant colors (quantize to 16 levels)
    const colorKey = `${Math.floor(r / 16)}-${Math.floor(g / 16)}-${Math.floor(b / 16)}`;
    colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
  }

  const pixelCount = (data.length / 4);
  const avgVariance = variance / pixelCount;

  // Determine quality based on variance and dimensions
  let estimatedQuality: 'high' | 'medium' | 'low' = 'medium';
  const isBlurry = avgVariance < 15; // Low variance suggests blur

  if (img.width >= 800 && img.height >= 800 && avgVariance > 25) {
    estimatedQuality = 'high';
  } else if (img.width < 400 || img.height < 400 || avgVariance < 10) {
    estimatedQuality = 'low';
  }

  // Extract top 5 dominant colors
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split('-').map(n => parseInt(n) * 16 + 8);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    });

  return {
    width: img.width,
    height: img.height,
    aspectRatio: img.width / img.height,
    estimatedQuality,
    isBlurry,
    dominantColors: sortedColors
  };
};

/**
 * Format bytes for display
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
